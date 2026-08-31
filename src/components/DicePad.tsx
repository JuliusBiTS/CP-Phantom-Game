"use client";

/**
 * Fast physical-dice entry — SOLO_MODE_BUILD_PLAN.md §12 Phase 3. One field per
 * die with its cap shown; live counted-total + crit/hit readout before you
 * submit; speak the faces instead of typing. Replaces the bare text input.
 */

import { useMemo, useRef, useState } from "react";
import { pwDiceCaps } from "@/lib/dice/rollPW";
import { parseSpokenDice, scoreTypedRoll } from "@/lib/dice/typedRoll";
import { DictationButton } from "./DictationButton";

export function DicePad({
  pw,
  dv,
  busy,
  onSubmit,
}: {
  pw: number;
  dv: number | null;
  busy: boolean;
  onSubmit: (total: number, dice: number[]) => void;
}) {
  const caps = useMemo(() => pwDiceCaps(pw), [pw]);
  // Parent passes key={pw + prompt} so a new roll remounts this with fresh state.
  const [vals, setVals] = useState<string[]>(() => caps.map(() => ""));
  const firstRef = useRef<HTMLInputElement>(null);

  const dice = vals.map((v) => parseInt(v, 10)).filter((n) => Number.isFinite(n) && n >= 1 && n <= 20);
  const complete = dice.length === caps.length;
  const score = complete ? scoreTypedRoll(pw, dice) : null;
  const hit =
    score && dv != null
      ? score.outcome === "crit-success"
        ? true
        : score.outcome === "crit-fail"
          ? false
          : score.total >= dv
      : null;

  function setVal(i: number, v: string) {
    setVals((prev) => {
      const next = [...prev];
      next[i] = v.replace(/[^\d]/g, "").slice(0, 2);
      return next;
    });
  }

  function submit() {
    if (complete && score) onSubmit(score.total, dice);
  }

  function fillFromSpeech(text: string) {
    const parsed = parseSpokenDice(text);
    if (parsed.length === 0) return;
    setVals(caps.map((_, i) => (parsed[i] != null ? String(parsed[i]) : "")));
    if (parsed.length >= caps.length) {
      const s = scoreTypedRoll(pw, parsed.slice(0, caps.length));
      onSubmit(s.total, parsed.slice(0, caps.length));
    }
  }

  return (
    <div>
      <p className="muted" style={{ fontSize: 11 }}>
        Roll {caps.length}×d20. Enter each face — or say them (&ldquo;fourteen twelve seven&rdquo;).
      </p>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
        {caps.map((cap, i) => (
          <label key={i} style={{ textAlign: "center" }}>
            <div className="muted" style={{ fontSize: 9, letterSpacing: "0.1em" }}>
              die {i + 1} · ≤{cap}
            </div>
            <input
              ref={i === 0 ? firstRef : undefined}
              inputMode="numeric"
              value={vals[i] ?? ""}
              onChange={(e) => setVal(i, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
                if (e.key === " " && i < caps.length - 1) {
                  e.preventDefault();
                  (e.currentTarget.parentElement?.parentElement?.children[i + 1]?.querySelector("input") as HTMLInputElement)?.focus();
                }
              }}
              style={{ width: 48, textAlign: "center", fontFamily: "var(--font)", fontSize: 16 }}
            />
          </label>
        ))}
        <button onClick={submit} disabled={!complete || busy} style={{ height: 34 }}>
          {busy ? "…" : "Submit"}
        </button>
        <DictationButton onFinalText={fillFromSpeech} />
      </div>

      {score && (
        <div style={{ marginTop: 6, fontFamily: "var(--font)", fontSize: 13 }}>
          {score.outcome === "crit-success" && <span className="ok">CRIT SUCCESS</span>}
          {score.outcome === "crit-fail" && <span className="danger">CRIT FAIL</span>}
          {(score.outcome === "hit" || score.outcome === "miss") && (
            <>
              counted <span className="stat-num">{score.total}</span>
              {dv != null && (
                <>
                  {" vs DV "}
                  <span className="stat-num">{dv}</span> →{" "}
                  <span className={hit ? "ok" : "danger"}>{hit ? "HIT" : "MISS"}</span>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
