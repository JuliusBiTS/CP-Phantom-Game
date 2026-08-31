"use client";

/** NET dive HUD — FEATURE_PLAN §M7. Shows the architecture as a stack of floors,
 *  the IP bar, the trace gauge and the alarm level. Sits where the combat tracker
 *  goes while `state.mode === "netrun"`. */

import type { CampaignState } from "@/lib/state/campaignState";
import { alarmLevel, TRACE_CAP, CYBERDECK_INFO } from "@/lib/rules/net";

const KIND_ICON: Record<string, string> = {
  passthrough: "▪",
  file: "▤",
  control: "⚙",
  ice: "▲",
  blackwall: "▓",
};

export function NetrunView({ state, onExit, busy }: { state: CampaignState; onExit: () => void; busy: boolean }) {
  const n = state.netrun;
  const c = state.character;
  const ipCur = c.ip_current ?? c.ip_max ?? 0;
  const ipMax = c.ip_max ?? 0;
  const tracePct = Math.min(1, n.trace / TRACE_CAP);
  const alarm = alarmLevel(n.alarm);

  return (
    <section className="panel" style={{ borderColor: "var(--cyan-dim)", margin: "12px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <h2 style={{ color: "var(--cyan)" }}>◈ NETRUN — {n.target || "the system"}</h2>
        <button onClick={onExit} disabled={busy} style={{ padding: "3px 10px", fontSize: 10 }}>
          Jack out ⏏
        </button>
      </div>

      <div style={{ display: "flex", gap: 18, margin: "6px 0", fontFamily: "var(--font)", fontSize: 11, flexWrap: "wrap" }}>
        <span>
          <span className="muted" style={{ fontSize: 9, letterSpacing: "0.15em" }}>IP </span>
          <span className="stat-num" style={{ fontSize: 15 }}>{ipCur}</span>/{ipMax}
          <span className="muted"> · {n.deck} +{CYBERDECK_INFO[n.deck]?.ipRegen ?? 2}/turn</span>
        </span>
        <span>
          <span className="muted" style={{ fontSize: 9, letterSpacing: "0.15em" }}>CONN </span>
          {n.connection}
        </span>
        <span className={n.alarm >= 2 ? "danger" : "muted"} style={{ fontSize: 10 }} title={alarm.desc}>
          ALARM {alarm.name}
        </span>
      </div>

      <div style={{ marginBottom: 10 }}>
        <div className="muted" style={{ fontSize: 9, letterSpacing: "0.15em" }}>TRACE {n.trace}/{TRACE_CAP}</div>
        <div style={{ height: 6, background: "var(--surface3)", border: "1px solid var(--border)" }}>
          <div style={{ height: "100%", width: `${tracePct * 100}%`, background: tracePct >= 0.75 ? "var(--red-bright)" : tracePct >= 0.4 ? "var(--gold-bright)" : "var(--cyan)" }} />
        </div>
      </div>

      <div style={{ display: "grid", gap: 4 }}>
        {n.architecture.map((f, i) => {
          const here = i === n.position;
          return (
            <div
              key={f.floor}
              style={{
                display: "flex",
                gap: 8,
                alignItems: "baseline",
                padding: "4px 8px",
                border: `1px solid ${here ? "var(--cyan)" : "var(--border)"}`,
                background: here ? "var(--surface3)" : f.cleared ? "transparent" : "var(--surface2)",
                opacity: f.cleared && !here ? 0.5 : 1,
                borderLeft: `3px solid ${f.ice ? "var(--red-bright)" : "var(--border2)"}`,
              }}
            >
              <span style={{ color: here ? "var(--cyan)" : "var(--text3)", fontFamily: "var(--font)" }}>{f.floor}</span>
              <span style={{ color: f.ice ? "var(--red-bright)" : "var(--text2)" }}>{KIND_ICON[f.kind] ?? "▪"}</span>
              <span style={{ flex: 1, fontSize: 12 }}>
                {f.name}
                {f.cleared && <span className="ok" style={{ fontSize: 9 }}> ✓</span>}
                {f.ice && (
                  <span className="danger" style={{ fontSize: 10 }} title={f.ice.effect}>
                    {" "}· {f.ice.name} (FW {f.ice.firewall}){f.ice.lethal ? " ☠" : ""}
                  </span>
                )}
                {f.loot && !f.cleared && <span className="muted" style={{ fontSize: 10 }}> · {f.loot}</span>}
              </span>
              {here && <span style={{ fontSize: 9, color: "var(--cyan)", letterSpacing: "0.15em" }}>YOU</span>}
            </div>
          );
        })}
      </div>

      {n.daemons.length > 0 && (
        <div style={{ marginTop: 6, fontSize: 10 }}>
          <span className="muted">DAEMONS </span>
          {n.daemons.join(" · ")}
        </div>
      )}
    </section>
  );
}
