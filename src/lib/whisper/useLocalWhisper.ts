"use client";

/**
 * React hook wrapping the local-Whisper worker + mic capture.
 * Fallback dictation for browsers without the Web Speech API (Firefox, Safari
 * desktop). SOLO_MODE_BUILD_PLAN.md §5.2a.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRecorder } from "./useRecorder";

export type WhisperStatus =
  | "idle"
  | "loading-model"
  | "ready"
  | "recording"
  | "transcribing"
  | "error";

const TARGET_RATE = 16000;

/**
 * Decode a recorded blob to 16 kHz mono Float32 PCM — what Whisper expects.
 * `decodeAudioData` on a fixed-rate AudioContext does NOT resample reliably
 * across browsers (Firefox keeps the native 48 kHz), which feeds Whisper
 * 3×-fast audio and it returns a single hallucinated token. So decode at the
 * native rate, then render through an OfflineAudioContext at 16 kHz mono —
 * that path resamples and downmixes correctly everywhere.
 */
async function blobTo16kMono(blob: Blob): Promise<Float32Array> {
  const arrayBuf = await blob.arrayBuffer();
  const AC: typeof AudioContext =
    window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

  const decodeCtx = new AC();
  let decoded: AudioBuffer;
  try {
    decoded = await decodeCtx.decodeAudioData(arrayBuf.slice(0));
  } finally {
    void decodeCtx.close();
  }

  if (Math.round(decoded.sampleRate) === TARGET_RATE && decoded.numberOfChannels === 1) {
    return decoded.getChannelData(0).slice();
  }

  const frames = Math.max(1, Math.ceil(decoded.duration * TARGET_RATE));
  const offline = new OfflineAudioContext(1, frames, TARGET_RATE);
  const src = offline.createBufferSource();
  src.buffer = decoded;
  src.connect(offline.destination);
  src.start(0);
  const rendered = await offline.startRendering();
  return rendered.getChannelData(0).slice();
}

export function useLocalWhisper(onText: (text: string) => void) {
  const [status, setStatus] = useState<WhisperStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [modelLabel, setModelLabel] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const workerRef = useRef<Worker | null>(null);
  const onTextRef = useRef(onText);

  useEffect(() => {
    onTextRef.current = onText;
  }, [onText]);

  const ensureWorker = useCallback(() => {
    if (workerRef.current) return workerRef.current;
    const w = new Worker(new URL("./worker.ts", import.meta.url));
    w.onmessage = (e: MessageEvent) => {
      const d = e.data as { type: string; pct?: number; label?: string; text?: string; message?: string };
      if (d.type === "progress") {
        setProgress(d.pct ?? 0);
        if (d.label) setModelLabel(d.label);
        // Don't stomp "recording"/"transcribing" — the model loads in the bg.
        setStatus((s) => (s === "recording" || s === "transcribing" ? s : "loading-model"));
      } else if (d.type === "ready") {
        setStatus((s) => (s === "loading-model" || s === "idle" ? "ready" : s));
      } else if (d.type === "result") {
        setStatus("ready");
        onTextRef.current(d.text ?? "");
      } else if (d.type === "error") {
        setStatus("error");
        setErrorMsg(d.message ?? "Whisper failed");
        // Drop the worker so the next click retries from a clean slate.
        workerRef.current?.terminate();
        workerRef.current = null;
      }
    };
    w.onerror = (e) => {
      setStatus("error");
      setErrorMsg(e.message || "Whisper worker failed to load");
      workerRef.current?.terminate();
      workerRef.current = null;
    };
    workerRef.current = w;
    return w;
  }, []);

  useEffect(() => () => workerRef.current?.terminate(), []);

  const handleBlob = useCallback(
    async (blob: Blob) => {
      setStatus("transcribing");
      try {
        const audio = await blobTo16kMono(blob);
        if (audio.length < 4000) {
          setStatus("ready");
          setErrorMsg("Recording was too short / silent.");
          return;
        }
        ensureWorker().postMessage({ type: "transcribe", audio }, [audio.buffer]);
      } catch (err) {
        setStatus("error");
        setErrorMsg("Couldn't decode the recording: " + (err as Error).message);
      }
    },
    [ensureWorker],
  );

  const { start, stop } = useRecorder({
    onBlob: handleBlob,
    onError: (m) => {
      setStatus("error");
      setErrorMsg(m);
    },
  });

  const startRecording = useCallback(async () => {
    setErrorMsg(null);
    ensureWorker().postMessage({ type: "load" }); // model downloads in the background
    const ok = await start();
    if (ok) setStatus("recording");
  }, [ensureWorker, start]);

  return { status, progress, modelLabel, errorMsg, startRecording, stopRecording: stop };
}
