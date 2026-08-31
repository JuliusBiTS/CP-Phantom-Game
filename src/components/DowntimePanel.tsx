"use client";

/**
 * Downtime banner — FEATURE_PLAN.md §M3. Sits where the combat tracker goes
 * while `state.mode === "downtime"`. The errand chips live in QuickActions;
 * this is the at-a-glance state: how long you've been resting, and your money.
 */

import type { CampaignState } from "@/lib/state/campaignState";

export function DowntimePanel({ state, onExit, busy }: { state: CampaignState; onExit: () => void; busy: boolean }) {
  const eddies = (state.character.eurodollar as number | undefined) ?? 0;
  const days = state.downtime.daysElapsed;

  return (
    <section className="panel panel-accent" style={{ borderColor: "var(--gold)", margin: "12px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <h2 style={{ color: "var(--gold-bright)" }}>Downtime</h2>
        <button onClick={onExit} disabled={busy} style={{ padding: "3px 10px", fontSize: 10 }}>
          Back to work →
        </button>
      </div>
      <div style={{ display: "flex", gap: 22, margin: "6px 0 2px", fontFamily: "var(--font)" }}>
        <span>
          <span className="muted" style={{ fontSize: 9, letterSpacing: "0.15em" }}>DAYS ELAPSED </span>
          <span className="stat-num" style={{ fontSize: 16 }}>{days}</span>
        </span>
        <span>
          <span className="muted" style={{ fontSize: 9, letterSpacing: "0.15em" }}>EDDIES </span>
          <span className="stat-num" style={{ fontSize: 16 }}>{eddies.toLocaleString()}</span>
        </span>
        {state.meta.inGameDate && (
          <span>
            <span className="muted" style={{ fontSize: 9, letterSpacing: "0.15em" }}>DATE </span>
            {state.meta.inGameDate}
          </span>
        )}
      </div>
      <p className="muted" style={{ fontSize: 11 }}>
        Shopping, ripperdoc visits, training, legwork — one beat each, days at a time. Pick an errand below, or head
        back to work.
      </p>
    </section>
  );
}
