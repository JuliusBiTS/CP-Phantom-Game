"use client";

/**
 * Cloud dictation — records the mic and POSTs to /api/transcribe (Groq or
 * OpenAI Whisper, server-side key). Instant, tiny bandwidth, accurate. Only
 * offered when the server reports a key is configured.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRecorder } from "./useRecorder";

export type CloudStatus = "idle" | "recording" | "transcribing" | "error";

export function useCloudTranscribeAvailable() {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [provider, setProvider] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/transcribe")
      .then((r) => r.json())
      .then((d: { available?: boolean; provider?: string }) => {
        if (cancelled) return;
        setAvailable(!!d.available);
        setProvider(d.provider ?? null);
      })
      .catch(() => !cancelled && setAvailable(false));
    return () => {
      cancelled = true;
    };
  }, []);
  return { available, provider };
}

export function useCloudWhisper(onText: (text: string) => void) {
  const [status, setStatus] = useState<CloudStatus>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const onTextRef = useRef(onText);
  useEffect(() => {
    onTextRef.current = onText;
  }, [onText]);

  const handleBlob = useCallback(async (blob: Blob) => {
    setStatus("transcribing");
    try {
      const form = new FormData();
      form.append("audio", blob, "audio.webm");
      const res = await fetch("/api/transcribe", { method: "POST", body: form });
      const data = (await res.json()) as { text?: string; error?: string };
      if (!res.ok || data.error) throw new Error(data.error || `transcription failed (${res.status})`);
      setStatus("idle");
      if (data.text) onTextRef.current(data.text);
    } catch (e) {
      setStatus("error");
      setErrorMsg((e as Error).message);
    }
  }, []);

  const { start, stop } = useRecorder({
    onBlob: handleBlob,
    onError: (m) => {
      setStatus("error");
      setErrorMsg(m);
    },
  });

  const startRecording = useCallback(async () => {
    setErrorMsg(null);
    const ok = await start();
    if (ok) setStatus("recording");
  }, [start]);

  return { status, errorMsg, startRecording, stopRecording: stop };
}
