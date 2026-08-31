"use client";

/** Tone-dial sliders — FEATURE_PLAN.md §M2. Used in the new-campaign form and
 *  the in-play header popover. */

import type { Tone } from "@/lib/state/campaignState";
import { DEFAULT_TONE, TONE_DIALS } from "@/lib/llm/tone";

const LEVEL_TAG = ["off", "light", "full", "max"];

export function ToneEditor({
  tone,
  onChange,
  compact,
}: {
  tone: Partial<Tone> | undefined;
  onChange: (t: Tone) => void;
  compact?: boolean;
}) {
  const t: Tone = { ...DEFAULT_TONE, ...(tone ?? {}) };
  const set = (k: keyof Tone, v: number) => onChange({ ...t, [k]: v });

  return (
    <div style={{ display: "grid", gap: compact ? 8 : 12 }}>
      {TONE_DIALS.map((d) => {
        const v = t[d.key];
        return (
          <div key={d.key}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontSize: 12, fontFamily: "var(--font-display)", letterSpacing: "0.04em" }}>{d.label}</span>
              <span className="muted" style={{ fontSize: 10, fontFamily: "var(--font)" }}>
                {v}/3 · {LEVEL_TAG[v]}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={3}
              step={1}
              value={v}
              onChange={(e) => set(d.key, Number(e.target.value))}
              style={{ width: "100%" }}
            />
            {!compact && (
              <div className="muted" style={{ fontSize: 10, lineHeight: 1.4 }}>
                {d.help} — <span style={{ color: "var(--text2)" }}>{d.levels[v]}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
