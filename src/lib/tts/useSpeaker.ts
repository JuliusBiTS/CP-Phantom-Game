"use client";

/**
 * Text-to-speech via the browser's built-in `speechSynthesis` — free, offline,
 * works in Chrome/Edge/Firefox/Safari. FEATURE_PLAN §M9 (conversational mode).
 *
 * `speak()` queues text; long text is split into sentences so it starts fast
 * and streaming narration can be fed in a chunk at a time. `onIdle` fires when
 * the queue drains — used to hand the mic back to the player.
 */

import { useCallback, useEffect, useRef, useState } from "react";

export function ttsSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
}

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function useSpeaker(opts?: { rate?: number; onIdle?: () => void }) {
  const [speaking, setSpeaking] = useState(false);
  const pendingRef = useRef(0);
  const enabledRef = useRef(true);
  const idleRef = useRef(opts?.onIdle);
  const rateRef = useRef(opts?.rate ?? 1);
  useEffect(() => {
    idleRef.current = opts?.onIdle;
    rateRef.current = opts?.rate ?? 1;
  });

  useEffect(() => {
    return () => {
      if (ttsSupported()) window.speechSynthesis.cancel();
    };
  }, []);

  const pickVoice = useCallback((): SpeechSynthesisVoice | undefined => {
    const vs = window.speechSynthesis.getVoices();
    // Prefer a natural-sounding English voice; fall back to whatever's default.
    return (
      vs.find((v) => /en(-|_)?(US|GB)/i.test(v.lang) && /natural|neural|google|siri|jenny|aria/i.test(v.name)) ??
      vs.find((v) => /^en/i.test(v.lang)) ??
      vs[0]
    );
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!ttsSupported() || !enabledRef.current) return;
      const parts = splitSentences(text);
      if (parts.length === 0) return;
      const voice = pickVoice();
      for (const part of parts) {
        const u = new SpeechSynthesisUtterance(part);
        if (voice) u.voice = voice;
        u.rate = rateRef.current;
        u.onstart = () => setSpeaking(true);
        u.onend = () => {
          pendingRef.current = Math.max(0, pendingRef.current - 1);
          if (pendingRef.current === 0) {
            setSpeaking(false);
            idleRef.current?.();
          }
        };
        u.onerror = u.onend;
        pendingRef.current += 1;
        window.speechSynthesis.speak(u);
      }
    },
    [pickVoice],
  );

  const cancel = useCallback(() => {
    if (!ttsSupported()) return;
    pendingRef.current = 0;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  const setEnabled = useCallback(
    (on: boolean) => {
      enabledRef.current = on;
      if (!on) cancel();
    },
    [cancel],
  );

  return { speak, cancel, speaking, setEnabled, supported: ttsSupported() };
}
