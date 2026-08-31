"use client";

/**
 * Speech-to-text dictation — SOLO_MODE_BUILD_PLAN.md §5.2a.
 *
 * Three paths, auto-selected best-first:
 *  1. Cloud (if the server has GROQ_API_KEY / OPENAI_API_KEY) → /api/transcribe.
 *     Instant, accurate, tiny bandwidth. Groq has a free tier.
 *  2. Chrome / Edge → the browser-native Web Speech API (free, streaming).
 *  3. Firefox / Safari desktop with no cloud key → local Whisper via
 *     transformers.js, entirely in-browser (free, ~145 MB one-time model).
 *
 * `localStorage.cpph_dictation` forces one: "cloud" | "webspeech" | "whisper".
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocalWhisper } from "@/lib/whisper/useLocalWhisper";
import { useCloudWhisper, useCloudTranscribeAvailable } from "@/lib/whisper/useCloudWhisper";

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

interface Props {
  onFinalText: (text: string) => void;
  onInterimText?: (text: string) => void;
  lang?: string;
}

export function DictationButton(props: Props) {
  const { available: cloud } = useCloudTranscribeAvailable();
  const [pref, setPref] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let p: string | null = null;
    try {
      p = localStorage.getItem("cpph_dictation");
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPref(p);
  }, []);

  if (pref === undefined || cloud === null) {
    return (
      <button type="button" disabled style={{ padding: "6px 10px" }}>
        🎤 Dictate
      </button>
    );
  }

  const hasWebSpeech = !!getCtor();
  const mode =
    pref === "cloud" && cloud
      ? "cloud"
      : pref === "webspeech" && hasWebSpeech
        ? "webspeech"
        : pref === "whisper"
          ? "whisper"
          : cloud
            ? "cloud"
            : hasWebSpeech
              ? "webspeech"
              : "whisper";

  if (mode === "cloud") return <CloudDictation onFinalText={props.onFinalText} />;
  if (mode === "webspeech") return <WebSpeechDictation {...props} />;
  return <WhisperDictation onFinalText={props.onFinalText} />;
}

function CloudDictation({ onFinalText }: { onFinalText: (t: string) => void }) {
  const { status, errorMsg, startRecording, stopRecording } = useCloudWhisper(onFinalText);
  const recording = status === "recording";
  const label =
    status === "transcribing" ? "transcribing…" : status === "error" ? errorMsg : status === "recording" ? null : null;
  return (
    <Shell
      listening={recording}
      onClick={() => (recording ? stopRecording() : startRecording())}
      disabled={status === "transcribing"}
      statusMsg={label}
      idleText="🎤 Dictate"
    />
  );
}

// ── Web Speech API path (Chrome / Edge) ────────────────────────────────────

function WebSpeechDictation({ onFinalText, onInterimText, lang = "en-US" }: Props) {
  const [listening, setListening] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const wantRef = useRef(false);
  const cbRef = useRef({ onFinalText, onInterimText });
  const startRef = useRef<() => void>(() => {});

  useEffect(() => {
    cbRef.current = { onFinalText, onInterimText };
  }, [onFinalText, onInterimText]);
  useEffect(() => () => {
    wantRef.current = false;
    recRef.current?.abort();
  }, []);

  const startRecognition = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.onstart = () => setStatusMsg("listening…");
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
      if (ev.error === "no-speech" || ev.error === "aborted") return;
      wantRef.current = false;
      setListening(false);
      setStatusMsg(
        ev.error === "not-allowed" || ev.error === "service-not-allowed"
          ? "Mic blocked — allow it for this site, then retry."
          : ev.error === "network"
            ? "Speech service unreachable."
            : `Speech error: ${ev.error}`,
      );
    };
    rec.onend = () => {
      if (wantRef.current) {
        try {
          rec.start();
        } catch {
          setTimeout(() => wantRef.current && startRef.current(), 250);
        }
      } else {
        setListening(false);
        setStatusMsg(null);
      }
    };
    recRef.current = rec;
    try {
      rec.start();
    } catch {
      /* already started */
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
      setStatusMsg("Dictation needs HTTPS (or localhost).");
      return;
    }
    setStatusMsg("requesting microphone…");
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      s.getTracks().forEach((t) => t.stop());
    } catch {
      setStatusMsg("Mic blocked — allow it for this site, then retry.");
      return;
    }
    wantRef.current = true;
    setListening(true);
    setStatusMsg("listening…");
    startRecognition();
  }, [listening, startRecognition]);

  return <Shell listening={listening} onClick={toggle} statusMsg={statusMsg} />;
}

// ── Local Whisper path (Firefox / Safari desktop) ─────────────────────────

function WhisperDictation({ onFinalText }: { onFinalText: (t: string) => void }) {
  const { status, progress, modelLabel, errorMsg, startRecording, stopRecording } = useLocalWhisper(onFinalText);
  const recording = status === "recording";

  const label =
    status === "loading-model"
      ? `downloading ${modelLabel ?? "model"} — ${progress}%`
      : status === "transcribing"
        ? "transcribing…"
        : status === "recording"
          ? null
          : status === "error"
            ? errorMsg
            : status === "idle"
              ? "first use downloads a ~40 MB model"
              : null;

  return (
    <Shell
      listening={recording}
      onClick={() => (recording ? stopRecording() : startRecording())}
      disabled={status === "loading-model" || status === "transcribing"}
      statusMsg={label}
      idleText="🎤 Dictate (local Whisper)"
    />
  );
}

// ── shared button shell ───────────────────────────────────────────────────

function Shell({
  listening,
  onClick,
  statusMsg,
  disabled,
  idleText = "🎤 Dictate",
}: {
  listening: boolean;
  onClick: () => void;
  statusMsg?: string | null;
  disabled?: boolean;
  idleText?: string;
}) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-pressed={listening}
        style={{ padding: "6px 10px", background: listening ? "var(--red, #7a1428)" : undefined }}
      >
        {listening ? "● REC — stop" : idleText}
      </button>
      {statusMsg && (
        <span
          style={{
            fontSize: 11,
            color: statusMsg.startsWith("listening") ? "var(--green-bright,#29ffa8)" : "var(--text3,#56638a)",
          }}
        >
          {statusMsg}
        </span>
      )}
    </span>
  );
}
