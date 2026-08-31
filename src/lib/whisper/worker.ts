/**
 * Local Whisper worker — SOLO_MODE_BUILD_PLAN.md §5.2a Phase 3 upgrade.
 *
 * Runs OpenAI Whisper entirely in the browser via transformers.js on the WASM
 * backend. No API key, no server; works in Firefox (which has no Web Speech
 * API). The model downloads once on first use and is cached by the browser.
 *
 * Messages in:  { type: "load" } | { type: "transcribe", audio: Float32Array }
 * Messages out: { type: "progress", pct, label } | { type: "ready" }
 *             | { type: "result", text } | { type: "error", message }
 */

import { pipeline, env, type AutomaticSpeechRecognitionPipeline } from "@huggingface/transformers";

env.allowLocalModels = false;
// Single-threaded WASM: multi-threaded needs COOP/COEP cross-origin isolation
// headers we don't set, and threaded init fails without them.
try {
  const wasm = env.backends?.onnx?.wasm;
  if (wasm) wasm.numThreads = 1;
} catch {
  /* older builds */
}

let transcriberPromise: Promise<AutomaticSpeechRecognitionPipeline> | null = null;

/**
 * Load order. `whisper-base.en` is a big accuracy jump over tiny and worth the
 * download for a Firefox user who wants dictation. Quantised decoder variants
 * hit an ONNX Runtime Web bug ("Missing required scale …
 * TransposeDQWeightsForMatMulNBits"), so we try unquantised first and disable
 * the extended graph optimisation that trips on quantised MatMul.
 */
const ATTEMPTS: Array<{ model: string; dtype: "fp16" | "fp32" | "q8"; label: string }> = [
  { model: "Xenova/whisper-base.en", dtype: "fp16", label: "whisper-base.en (~145 MB)" },
  { model: "Xenova/whisper-tiny.en", dtype: "fp16", label: "whisper-tiny.en (~78 MB)" },
  { model: "Xenova/whisper-tiny.en", dtype: "fp32", label: "whisper-tiny.en full (~150 MB)" },
];

async function loadPipeline(): Promise<AutomaticSpeechRecognitionPipeline> {
  let lastErr: unknown;
  for (const attempt of ATTEMPTS) {
    try {
      self.postMessage({ type: "progress", pct: 0, label: attempt.label });
      return (await pipeline("automatic-speech-recognition", attempt.model, {
        dtype: { encoder_model: attempt.dtype, decoder_model_merged: attempt.dtype },
        device: "wasm",
        session_options: { graphOptimizationLevel: "basic" },
        progress_callback: (p: unknown) => {
          const prog = p as { status?: string; progress?: number };
          if (prog.status === "progress" && typeof prog.progress === "number") {
            self.postMessage({ type: "progress", pct: Math.round(prog.progress), label: attempt.label });
          }
        },
      })) as AutomaticSpeechRecognitionPipeline;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

function getTranscriber(): Promise<AutomaticSpeechRecognitionPipeline> {
  if (!transcriberPromise) transcriberPromise = loadPipeline();
  return transcriberPromise;
}

self.onmessage = async (e: MessageEvent) => {
  const data = e.data as { type: string; audio?: Float32Array };
  try {
    if (data.type === "load") {
      await getTranscriber();
      self.postMessage({ type: "ready" });
      return;
    }
    if (data.type === "transcribe" && data.audio) {
      const transcriber = await getTranscriber();
      const out = (await transcriber(data.audio, {
        chunk_length_s: 30,
        stride_length_s: 5,
      })) as { text: string } | { text: string }[];
      const text = Array.isArray(out) ? out.map((o) => o.text).join(" ") : out.text;
      self.postMessage({ type: "result", text: text.trim() });
      return;
    }
  } catch (err) {
    self.postMessage({ type: "error", message: (err as Error).message || String(err) });
  }
};
