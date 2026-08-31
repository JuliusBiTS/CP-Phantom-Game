"use client";

/** Mic capture via MediaRecorder. Shared by the local-Whisper and cloud paths. */

import { useCallback, useEffect, useRef, useState } from "react";

interface RecorderCallbacks {
  onBlob: (blob: Blob, mime: string) => void;
  onError?: (msg: string) => void;
}

export function useRecorder({ onBlob, onError }: RecorderCallbacks) {
  const [recording, setRecording] = useState(false);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const cbRef = useRef({ onBlob, onError });

  useEffect(() => {
    cbRef.current = { onBlob, onError };
  }, [onBlob, onError]);

  useEffect(() => () => streamRef.current?.getTracks().forEach((t) => t.stop()), []);

  const start = useCallback(async () => {
    if (!window.isSecureContext) {
      cbRef.current.onError?.("Dictation needs HTTPS (or localhost).");
      return false;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      cbRef.current.onError?.("Microphone blocked — allow it for this site, then try again.");
      return false;
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
    rec.onstop = () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      const type = rec.mimeType || mime || "audio/webm";
      const blob = new Blob(chunksRef.current, { type });
      setRecording(false);
      if (blob.size > 0) cbRef.current.onBlob(blob, type);
    };
    recRef.current = rec;
    rec.start();
    setRecording(true);
    return true;
  }, []);

  const stop = useCallback(() => {
    if (recRef.current && recRef.current.state !== "inactive") recRef.current.stop();
  }, []);

  return { recording, start, stop };
}
