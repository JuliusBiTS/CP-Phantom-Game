"use client";

/**
 * Hands-free conversational mode — FEATURE_PLAN §M9.
 *
 * The GM's narration is read aloud (browser TTS); when it finishes the mic
 * opens and the player just talks. A spoken action is sent as a turn; a spoken
 * roll ("I got a fourteen and a seven") is parsed and submitted. Falls back to a
 * big tap-to-talk button where the Web Speech API isn't available (Firefox).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useSpeaker } from "@/lib/tts/useSpeaker";
import { parseSpokenDice, scoreTypedRoll } from "@/lib/dice/typedRoll";

type SR = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};

function srCtor(): (new () => SR) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

interface PendingRoll {
  prompt: string;
  statPair: string;
  pw: number;
  diceInstruction: string;
  dv: number | null;
}

export function ConversationHud({
  busy,
  pending,
  streamText,
  liveNarration,
  onAction,
  onRoll,
  onExit,
}: {
  busy: boolean;
  pending: PendingRoll | null;
  streamText: string;
  liveNarration: string;
  onAction: (text: string) => void;
  onRoll: (total: number, dice: number[]) => void;
  onExit: () => void;
}) {
  const [heard, setHeard] = useState("");
  const [listening, setListening] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const recRef = useRef<SR | null>(null);
  const spokenRef = useRef(0); // chars of streamText already spoken
  const hasSR = !!srCtor();

  const submit = useCallback(
    (raw: string) => {
      const text = raw.trim();
      if (!text) return;
      setHeard("");
      if (pending) {
        const dice = parseSpokenDice(text);
        if (dice.length === 0) {
          setNote("Didn't catch a number — say your dice again, or tap the dice pad.");
          return;
        }
        const scored = scoreTypedRoll(pending.pw, dice);
        onRoll(scored.total, dice);
      } else {
        onAction(text);
      }
    },
    [pending, onAction, onRoll],
  );

  const startListening = useCallback(() => {
    const Ctor = srCtor();
    if (!Ctor || busy) return;
    const rec = new Ctor();
    rec.lang = "en-US";
    rec.continuous = false;
    rec.interimResults = true;
    let final = "";
    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) final += r[0].transcript + " ";
        else interim += r[0].transcript;
      }
      setHeard((final + interim).trim());
    };
    rec.onerror = (ev) => {
      if (ev.error !== "no-speech" && ev.error !== "aborted") setNote(`Mic: ${ev.error}`);
    };
    rec.onend = () => {
      setListening(false);
      recRef.current = null;
      if (final.trim()) submit(final);
    };
    recRef.current = rec;
    setNote(null);
    setListening(true);
    try {
      rec.start();
    } catch {
      setListening(false);
    }
  }, [busy, submit]);

  const stopListening = useCallback(() => {
    recRef.current?.stop();
  }, []);

  const speaker = useSpeaker({
    rate: 1.02,
    onIdle: () => {
      // GM finished talking — hand the mic to the player.
      if (!busy && hasSR) startListening();
    },
  });

  // Speak streaming narration sentence-by-sentence as it arrives.
  useEffect(() => {
    if (!streamText) {
      spokenRef.current = 0;
      return;
    }
    const fresh = streamText.slice(spokenRef.current);
    const lastStop = Math.max(fresh.lastIndexOf(". "), fresh.lastIndexOf("! "), fresh.lastIndexOf("? "), fresh.lastIndexOf("\n"));
    if (lastStop > 0) {
      speaker.speak(fresh.slice(0, lastStop + 1));
      spokenRef.current += lastStop + 1;
    }
  }, [streamText, speaker]);

  // When a turn fully lands (no stream, not busy), speak whatever's left + the final narration.
  const lastNarrRef = useRef("");
  useEffect(() => {
    if (busy || streamText) return;
    if (liveNarration && liveNarration !== lastNarrRef.current) {
      lastNarrRef.current = liveNarration;
      speaker.cancel();
      spokenRef.current = 0;
      speaker.speak(liveNarration);
    }
  }, [busy, streamText, liveNarration, speaker]);

  // Speak a pending roll prompt, then listen.
  const spokePromptRef = useRef("");
  useEffect(() => {
    if (pending && pending.prompt !== spokePromptRef.current) {
      spokePromptRef.current = pending.prompt;
      speaker.cancel();
      speaker.speak(`Roll needed. ${pending.prompt}. ${pending.statPair}, ${pending.diceInstruction}${pending.dv != null ? `, beat ${pending.dv}` : ""}. Tell me your dice.`);
    }
    if (!pending) spokePromptRef.current = "";
  }, [pending, speaker]);

  useEffect(() => () => { speaker.cancel(); recRef.current?.abort(); }, [speaker]);

  const status = busy ? "THINKING" : speaker.speaking ? "SPEAKING" : listening ? "LISTENING" : "IDLE";
  const statusColor = status === "THINKING" ? "var(--gold-bright)" : status === "SPEAKING" ? "var(--cyan)" : status === "LISTENING" ? "var(--green-bright)" : "var(--text3)";

  return (
    <section className="panel panel-accent" style={{ borderColor: statusColor, margin: "12px 0", textAlign: "center" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span className="muted" style={{ fontSize: 10, letterSpacing: "0.2em" }}>HANDS-FREE</span>
        <button onClick={() => { speaker.cancel(); stopListening(); onExit(); }} style={{ padding: "2px 8px", fontSize: 10 }}>exit</button>
      </div>

      <div style={{ fontFamily: "var(--font-display)", fontSize: 22, letterSpacing: "0.15em", color: statusColor, margin: "14px 0 6px" }}>
        {status === "LISTENING" ? "◉ LISTENING" : status === "SPEAKING" ? "▶ SPEAKING" : status === "THINKING" ? "… THINKING" : "—"}
      </div>

      {heard && <div style={{ fontSize: 13, color: "var(--green-bright)", minHeight: 20 }}>“{heard}”</div>}

      <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 10, flexWrap: "wrap" }}>
        {!listening ? (
          <button onClick={startListening} disabled={busy || speaker.speaking} style={{ padding: "8px 18px" }}>
            {hasSR ? "🎤 Talk" : "🎤 Talk (tap-hold not available here)"}
          </button>
        ) : (
          <button onClick={stopListening} style={{ padding: "8px 18px", background: "var(--red)" }}>■ Stop & send</button>
        )}
        {speaker.speaking && (
          <button onClick={() => speaker.cancel()} style={{ padding: "8px 14px" }}>skip readout</button>
        )}
      </div>

      {!speaker.supported && (
        <div className="muted" style={{ fontSize: 10, marginTop: 6 }}>Your browser has no speech synthesis — text only.</div>
      )}
      {note && <div className="danger" style={{ fontSize: 11, marginTop: 6 }}>{note}</div>}

      {pending && (
        <div style={{ fontSize: 11, marginTop: 8, color: "var(--text2)" }}>
          Roll: <b>{pending.statPair}</b> · {pending.diceInstruction}{pending.dv != null ? ` · beat ${pending.dv}` : ""}
        </div>
      )}
      <p className="muted" style={{ fontSize: 11, whiteSpace: "pre-wrap", marginTop: 10, textAlign: "left", maxHeight: 120, overflow: "auto" }}>
        {streamText || liveNarration}
      </p>
    </section>
  );
}
