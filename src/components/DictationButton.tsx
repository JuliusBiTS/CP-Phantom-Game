"use client";

/**
 * Speech-to-text dictation — SOLO_MODE_BUILD_PLAN.md §5.2a.
 *
 * Browser-native Web Speech API (`SpeechRecognition`). No API key, no service,
 * nothing to configure — the browser's own recognizer handles the audio
 * (Chrome/Edge → Google, Safari → Apple). A local Whisper model via
 * transformers.js is a possible Phase 3 upgrade (also free, ~40-200 MB download).
 *
 * Chrome quirks handled here: `continuous` mode still fires `onend` after a
 * silence, so we auto-restart while the user still wants to dictate; and we ask
 * for the mic explicitly via getUserMedia first so the permission prompt is
 * reliable and denials produce a clear message instead of silence.
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
  onstart: (() => void) | null;
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
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const wantRef = useRef(false); // does the user still want to be dictating?
  const cbRef = useRef({ onFinalText, onInterimText });
  const startRef = useRef<() => void>(() => {});

  useEffect(() => {
    cbRef.current = { onFinalText, onInterimText };
  }, [onFinalText, onInterimText]);

  useEffect(() => {
    const id = requestAnimationFrame(() => setSupported(getCtor() !== null));
    return () => {
      cancelAnimationFrame(id);
      wantRef.current = false;
      recRef.current?.abort();
    };
  }, []);

  const startRecognition = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.onstart = () => setStatus("listening…");
    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) cbRef.current.onFinalText(r[0].transcript.trim());
        else interim += r[0].transcript;
      }
      if (interim) cbRef.current.onInterimText?.(interim);
    };
    rec.onerror = (ev) => {
      if (ev.error === "no-speech" || ev.error === "aborted") return; // transient — onend restarts
      wantRef.current = false;
      setListening(false);
      setStatus(
        ev.error === "not-allowed" || ev.error === "service-not-allowed"
          ? "Microphone blocked — allow it for this site in your browser's address-bar permissions, then try again."
          : ev.error === "network"
            ? "Speech service unreachable (network)."
            : `Speech error: ${ev.error}`,
      );
    };
    rec.onend = () => {
      // Chrome ends the session on silence; restart if the user still wants it.
      if (wantRef.current) {
        try {
          rec.start();
        } catch {
          setTimeout(() => {
            if (wantRef.current) startRef.current();
          }, 250);
        }
      } else {
        setListening(false);
        setStatus(null);
      }
    };
    recRef.current = rec;
    try {
      rec.start();
    } catch {
      // "already started" — ignore
    }
  }, [lang]);

  useEffect(() => {
    startRef.current = startRecognition;
  }, [startRecognition]);

  const toggle = useCallback(async () => {
    if (listening) {
      wantRef.current = false;
      recRef.current?.stop();
      return;
    }
    if (!window.isSecureContext) {
      setStatus("Dictation needs HTTPS (or localhost).");
      return;
    }
    setStatus("requesting microphone…");
    try {
      // Explicit prompt — more reliable than letting SpeechRecognition ask.
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop()); // release it; SpeechRecognition opens its own
    } catch {
      setStatus("Microphone blocked — allow it for this site, then try again.");
      return;
    }
    wantRef.current = true;
    setListening(true);
    setStatus("listening…");
    startRecognition();
  }, [listening, startRecognition]);

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <button
        type="button"
        onClick={toggle}
        disabled={!supported}
        title={supported ? (listening ? "Stop dictation" : "Dictate (speech to text)") : "Speech recognition needs Chrome or Edge."}
        aria-pressed={listening}
        style={{
          padding: "6px 10px",
          background: listening ? "var(--red, #7a1428)" : undefined,
          cursor: supported ? "pointer" : "not-allowed",
        }}
      >
        {listening ? "● REC — stop" : "🎤 Dictate"}
      </button>
      {!supported && <span className="muted" style={{ fontSize: 11 }}>Chrome / Edge only</span>}
      {status && (
        <span style={{ fontSize: 11, color: status.startsWith("listening") ? "var(--green-bright,#29ffa8)" : "var(--red-bright, #ff3b5c)" }}>
          {status}
        </span>
      )}
    </span>
  );
}
