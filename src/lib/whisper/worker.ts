/**
 * Local Whisper worker — SOLO_MODE_BUILD_PLAN.md §5.2a Phase 3 upgrade.
 *
 * Runs OpenAI Whisper entirely in the browser via transformers.js (WebGPU if
 * available, else WASM). No API key, no server, works in Firefox (which has no
 * Web Speech API). The model (~40 MB, whisper-tiny.en) downloads once on first
 * use and is cached by the browser.
 *
 * Messages in:  { type: "load" } | { type: "transcribe", audio: Float32Array }
 * Messages out: { type: "progress", pct } | { type: "ready" }
 *             | { type: "result", text } | { type: "error", message }
 */

import { pipeline, env, type AutomaticSpeechRecognitionPipeline } from "@huggingface/transformers";

env.allowLocalModels = false;

const MODEL_ID = "Xenova/whisper-tiny.en";

let transcriberPromise: Promise<AutomaticSpeechRecognitionPipeline> | null = null;

function getTranscriber(): Promise<AutomaticSpeechRecognitionPipeline> {
  if (!transcriberPromise) {
    transcriberPromise = pipeline("automatic-speech-recognition", MODEL_ID, {
      progress_callback: (p: unknown) => {
        const prog = p as { status?: string; progress?: number };
        if (prog.status === "progress" && typeof prog.progress === "number") {
          self.postMessage({ type: "progress", pct: Math.round(prog.progress) });
        } else if (prog.status === "ready") {
          self.postMessage({ type: "ready" });
        }
      },
    }) as Promise<AutomaticSpeechRecognitionPipeline>;
  }
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
