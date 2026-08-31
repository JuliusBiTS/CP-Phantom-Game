"use client";

/**
 * One-time hacker-terminal boot intro — SOLO_MODE_BUILD_PLAN.md §7. Ported from
 * CP Phantom's `startBootSequence` so this reads as the same product: typewriter
 * terminal lines with [OK] tags → glitch → glitched wordmark reveal, ~10s total.
 * Gated once per browser tab session, always skippable on any key/click, and
 * skipped entirely under prefers-reduced-motion.
 */

import { useEffect, useState } from "react";

const LINES = [
  "> INITIALIZING NEURAL INTERFACE...",
  "> MOUNTING CAMPAIGN STATE...",
  "> LOADING RULESET — CP PHANTOM v12...",
  "> CALIBRATING DICE ENGINE (CSPRNG)...",
  "> SYNCING GM PROTOCOLS...",
  "> ESTABLISHING SECURE UPLINK...",
  "> CONNECTION ESTABLISHED",
];

const KEY = "cpph_solo_boot_seen";
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function BootSequence() {
  const [gone, setGone] = useState(true);
  const [hiding, setHiding] = useState(false);
  const [glitch, setGlitch] = useState(false);
  const [showLogo, setShowLogo] = useState(false);
  const [rows, setRows] = useState<Array<{ text: string; ok: boolean }>>([]);

  useEffect(() => {
    let aborted = false; // per-effect-invocation (survives StrictMode double-mount)
    let seen = true;
    try {
      seen = sessionStorage.getItem(KEY) === "1";
    } catch {
      seen = false;
    }
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (seen || reduce) return;

    // This component's whole job is a timed intro animation — driving state
    // from the effect over timers is the intended pattern here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGone(false);

    const finish = () => {
      if (aborted) return;
      aborted = true;
      try {
        sessionStorage.setItem(KEY, "1"); // only mark "seen" once it has actually played
      } catch {
        /* private mode */
      }
      setHiding(true);
      setTimeout(() => setGone(true), 750);
    };
    const onAny = () => finish();
    document.addEventListener("keydown", onAny);
    document.addEventListener("click", onAny);
    // Hard cap — never let the intro overstay its welcome, whatever the
    // environment does to timers.
    const capId = setTimeout(finish, 13000);

    (async () => {
      for (let li = 0; li < LINES.length; li++) {
        if (aborted) return;
        const full = LINES[li];
        setRows((r) => [...r, { text: "", ok: false }]);
        for (let i = 0; i < full.length; i++) {
          if (aborted) return;
          setRows((r) => {
            const next = [...r];
            next[li] = { text: full.slice(0, i + 1), ok: false };
            return next;
          });
          await wait(10 + Math.random() * 14);
        }
        await wait(90);
        setRows((r) => {
          const next = [...r];
          next[li] = { text: full, ok: true };
          return next;
        });
        await wait(110);
      }
      if (aborted) return;
      setGlitch(true);
      await wait(480);
      if (aborted) return;
      setGlitch(false);
      setShowLogo(true);
      await wait(3000);
      finish();
    })();

    return () => {
      aborted = true;
      clearTimeout(capId);
      document.removeEventListener("keydown", onAny);
      document.removeEventListener("click", onAny);
    };
  }, []);

  if (gone) return null;

  return (
    <div id="boot-sequence" className={`${hiding ? "boot-hide" : ""} ${glitch ? "boot-glitch" : ""}`}>
      <div className="boot-grid" />
      <div className="boot-scanline" />
      <div className={`boot-terminal ${showLogo ? "boot-fade-out" : ""}`}>
        {rows.map((row, i) => (
          <div key={i} className="boot-line">
            {row.text}
            {row.ok && <span className="boot-ok">{"  [OK]"}</span>}
            {i === rows.length - 1 && !row.ok && <span className="boot-cursor" />}
          </div>
        ))}
      </div>
      <div className={`boot-logo-wrap ${showLogo ? "show" : ""}`}>
        <div className="boot-logo-tag">Night City Sprawl</div>
        <div className="boot-logo-title" data-text="CP PHANTOM">CP PHANTOM</div>
        <div className="boot-logo-sub">Solo Companion</div>
      </div>
      <div className="boot-skip">press any key to skip</div>
    </div>
  );
}
