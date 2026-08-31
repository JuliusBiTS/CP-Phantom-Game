"use client";

/** Abstract chase HUD — FEATURE_PLAN §M8 / §22.5. The Spur track + each
 *  vehicle's SDP. Sits where the combat tracker goes while `mode === "chase"`. */

import type { CampaignState } from "@/lib/state/campaignState";
import { SPUR_MAX, chaseDv } from "@/lib/rules/vehicles";

const ROLE_COLOR: Record<string, string> = {
  pc: "var(--cyan)",
  ally: "var(--green-bright)",
  pursuer: "var(--red-bright)",
  quarry: "var(--gold-bright)",
};

export function ChaseView({ state, onExit, busy }: { state: CampaignState; onExit: () => void; busy: boolean }) {
  const ch = state.chase;
  const goodEnd = ch.pcRole === "runner" ? SPUR_MAX : SPUR_MAX;
  const dv = chaseDv(ch.pursuerTier);

  return (
    <section className="panel" style={{ borderColor: "var(--gold)", margin: "12px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <h2 style={{ color: "var(--gold-bright)" }}>» CHASE — {ch.terrain} · round {ch.round}</h2>
        <button onClick={onExit} disabled={busy} style={{ padding: "3px 10px", fontSize: 10 }}>
          Bail out ⏏
        </button>
      </div>

      <div style={{ fontSize: 11, color: "var(--text2)", margin: "2px 0 8px" }}>
        You are the <b>{ch.pcRole}</b> · driver rolls Drive+Reflexes vs DV <span className="stat-num">{dv}</span> ·{" "}
        {ch.pcRole === "runner" ? "Spur 6 = shaken, Spur 0 = they pull alongside" : "Spur 6 = you run them down, Spur 0 = you lose them"}
      </div>

      {/* Spur track */}
      <div style={{ display: "flex", gap: 3, marginBottom: 10 }}>
        {Array.from({ length: SPUR_MAX + 1 }, (_, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: 18,
              border: "1px solid var(--border2)",
              background: i === ch.spur ? "var(--gold-bright)" : i < ch.spur ? "var(--gold)" : "var(--surface3)",
              color: i === ch.spur ? "var(--bg)" : "var(--text3)",
              fontFamily: "var(--font)",
              fontSize: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            title={i === goodEnd ? "shaken / caught" : i === 0 ? "alongside" : ""}
          >
            {i}
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gap: 4 }}>
        {ch.vehicles.map((v) => {
          const pct = v.sdpMax ? Math.max(0, v.sdp / v.sdpMax) : 0;
          return (
            <div key={v.id} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 11, opacity: v.disabled ? 0.5 : 1 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: ROLE_COLOR[v.role] ?? "var(--text3)" }} />
              <span style={{ minWidth: 120 }}>{v.name}{v.disabled && <span className="danger"> ✕ wrecked</span>}</span>
              <div style={{ flex: 1, height: 5, background: "var(--surface3)", border: "1px solid var(--border)" }}>
                <div style={{ height: "100%", width: `${pct * 100}%`, background: pct <= 0.25 ? "var(--red-bright)" : pct <= 0.5 ? "var(--gold-bright)" : "var(--green-bright)" }} />
              </div>
              <span className="stat-num" style={{ fontSize: 10 }}>SDP {v.sdp}/{v.sdpMax}</span>
              <span className="muted" style={{ fontSize: 9 }}>SP {v.bodySp} · spd {v.speed}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
