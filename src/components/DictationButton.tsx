"use client";

/**
 * Speech-to-text dictation — SOLO_MODE_BUILD_PLAN.md §5.2a.
 *
 * Uses the browser-native Web Speech API (`SpeechRecognition`). Zero cost, no
 * API key, no extra service — it runs in the browser (Chrome/Edge send audio to
 * Google's recognizer; Safari uses Apple's). This satisfies the "everything
 * except the Anthropic API must be free" constraint with nothing to configure.
 *
 * Degrades cleanly: if the API is missing (e.g. Firefox), the button renders
 * disabled with a title explaining why, and typing still works.
 *
 * A local Whisper model via transformers.js is a possible Phase 3 upgrade for
 * offline use / better accuracy — also free, but a ~40-200MB model download.
 */

import { useCallback, useEffect, useRef, useState } from "react";

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;
interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>;
}

function getCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function DictationButton({
  onFinalText,
  onInterimText,
  lang = "en-US",
}: {
  onFinalText: (text: string) => void;
  onInterimText?: (text: string) => void;
  lang?: string;
}) {
  // Browser-API availability is external state; read it once after mount to
  // avoid an SSR/client hydration mismatch.
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => setSupported(getCtor() !== null));
    return () => {
      cancelAnimationFrame(id);
      recRef.current?.abort();
    };
  }, []);

  const toggle = useCallback(() => {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const Ctor = getCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) onFinalText(r[0].transcript.trim());
        else interim += r[0].transcript;
      }
      if (interim) onInterimText?.(interim);
    };
    rec.onerror = (ev) => {
      setError(
        ev.error === "not-allowed"
          ? "Microphone permission denied."
          : ev.error === "no-speech"
            ? "No speech detected."
            : `Speech error: ${ev.error}`,
      );
      setListening(false);
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    setError(null);
    setListening(true);
    rec.start();
  }, [listening, lang, onFinalText, onInterimText]);

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <button
        type="button"
        onClick={toggle}
        disabled={!supported}
        title={
          supported
            ? listening
              ? "Stop dictation"
              : "Dictate (speech to text)"
            : "Speech recognition isn't available in this browser. Try Chrome or Edge."
        }
        aria-pressed={listening}
        style={{
          padding: "6px 10px",
          border: "1px solid var(--border2, #2a3868)",
          background: listening ? "var(--red, #7a1428)" : "transparent",
          color: "inherit",
          cursor: supported ? "pointer" : "not-allowed",
        }}
      >
        {listening ? "● REC" : "🎤 Dictate"}
      </button>
      {error && <span style={{ color: "var(--red-bright, #ff3b5c)", fontSize: 12 }}>{error}</span>}
    </span>
  );
}
