"use client";

/**
 * React hook wrapping the local-Whisper worker + mic capture.
 * Fallback dictation for browsers without the Web Speech API (Firefox, Safari
 * desktop). SOLO_MODE_BUILD_PLAN.md §5.2a.
 */

import { useCallback, useEffect, useRef, useState } from "react";

export type WhisperStatus =
  | "idle"
  | "loading-model"
  | "ready"
  | "recording"
  | "transcribing"
  | "error";

async function blobTo16kMono(blob: Blob): Promise<Float32Array> {
  const arrayBuf = await blob.arrayBuffer();
  const AC: typeof AudioContext =
    window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  // Decoding into a 16 kHz context resamples for us.
  const ctx = new AC({ sampleRate: 16000 });
  try {
    const audioBuf = await ctx.decodeAudioData(arrayBuf);
    if (audioBuf.numberOfChannels === 1) return audioBuf.getChannelData(0).slice();
    // mix down to mono
    const len = audioBuf.length;
    const out = new Float32Array(len);
    for (let ch = 0; ch < audioBuf.numberOfChannels; ch++) {
      const data = audioBuf.getChannelData(ch);
      for (let i = 0; i < len; i++) out[i] += data[i] / audioBuf.numberOfChannels;
    }
    return out;
  } finally {
    ctx.close();
  }
}

export function useLocalWhisper(onText: (text: string) => void) {
  const [status, setStatus] = useState<WhisperStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [modelLabel, setModelLabel] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const workerRef = useRef<Worker | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
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
        setStatus("loading-model");
        setProgress(d.pct ?? 0);
        if (d.label) setModelLabel(d.label);
      } else if (d.type === "ready") {
        setStatus((s) => (s === "loading-model" || s === "idle" ? "ready" : s));
      } else if (d.type === "result") {
        setStatus("ready");
        if (d.text) onTextRef.current(d.text);
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

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const startRecording = useCallback(async () => {
    setErrorMsg(null);
    const worker = ensureWorker();
    if (status === "idle" || status === "error") {
      setStatus("loading-model");
      worker.postMessage({ type: "load" });
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setStatus("error");
      setErrorMsg("Microphone blocked — allow it for this site, then try again.");
      return;
    }
    streamRef.current = stream;
    const mime = MediaRecorder.isTypeSupported("audio/webm")
      ? "audio/webm"
      : MediaRecorder.isTypeSupported("audio/ogg")
        ? "audio/ogg"
        : "";
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    chunksRef.current = [];
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    rec.onstop = async () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunksRef.current, { type: mime || "audio/webm" });
      if (blob.size === 0) {
        setStatus("ready");
        return;
      }
      setStatus("transcribing");
      try {
        const audio = await blobTo16kMono(blob);
        ensureWorker().postMessage({ type: "transcribe", audio }, [audio.buffer]);
      } catch (err) {
        setStatus("error");
        setErrorMsg("Couldn't decode the recording: " + (err as Error).message);
      }
    };
    recorderRef.current = rec;
    rec.start();
    setStatus("recording");
  }, [ensureWorker, status]);

  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
  }, []);

  return { status, progress, modelLabel, errorMsg, startRecording, stopRecording };
}
