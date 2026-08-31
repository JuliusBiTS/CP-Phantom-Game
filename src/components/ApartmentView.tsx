"use client";

/** The apartment — FEATURE_PLAN §M9. A full-screen home-base view: stations
 *  (upgrades) down one side, the stash + who's visiting on the other. Hotkey H. */

import type { CampaignState } from "@/lib/state/campaignState";

const STATIONS: Array<{ key: string; label: string; blurb: string }> = [
  { key: "workbench", label: "Workbench", blurb: "craft & mod gear" },
  { key: "medbay", label: "Medbay", blurb: "faster, better healing" },
  { key: "armory", label: "Armory", blurb: "secure weapons, fast re-kit" },
  { key: "terminal", label: "Terminal", blurb: "research · jack in safely" },
  { key: "safe-room", label: "Safe room", blurb: "ride out heat" },
  { key: "security", label: "Security", blurb: "harder to hit you at home" },
];

const itemName = (x: unknown) => (typeof x === "string" ? x : (x as { name?: string })?.name ?? "item");

export function ApartmentView({ state, onClose }: { state: CampaignState; onClose: () => void }) {
  const a = state.apartment;
  return (
    <div className="board-shell">
      <div className="board-toolbar">
        <span className="board-title">
          {"// "}
          {a.owned ? (a.name || "HOME BASE").toUpperCase() : "NO HOME BASE YET"}
          {a.owned && a.district ? ` — ${a.district}` : ""}
        </span>
        <button onClick={onClose} style={{ padding: "3px 10px", fontSize: 10 }}>Close (H)</button>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "18px 22px", maxWidth: 900, margin: "0 auto", width: "100%" }}>
        {!a.owned && (
          <p className="muted">
            You don&apos;t have a place of your own. In downtime, tell the GM you want to find one — a squat, a cheap
            conapt, somewhere decent. Then you can stash gear, install a workbench or medbay, and let contacts come to
            you instead of meeting in the rain.
          </p>
        )}

        {a.owned && (
          <>
            <div style={{ fontFamily: "var(--font)", fontSize: 12, marginBottom: 14 }}>
              <span className="muted">TIER</span> {a.tier}
              {a.safehouse && <span className="ok" style={{ marginLeft: 12 }}>✓ registered safehouse</span>}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 8, marginBottom: 18 }}>
              {STATIONS.map((s) => {
                const have = a.upgrades.includes(s.key);
                return (
                  <div
                    key={s.key}
                    style={{
                      border: `1px solid ${have ? "var(--cyan-dim)" : "var(--border)"}`,
                      background: have ? "var(--surface3)" : "var(--surface2)",
                      opacity: have ? 1 : 0.5,
                      padding: 10,
                    }}
                  >
                    <div style={{ fontFamily: "var(--font-display)", letterSpacing: "0.04em", color: have ? "var(--cyan)" : "var(--text3)" }}>
                      {s.label}
                    </div>
                    <div className="muted" style={{ fontSize: 10 }}>{have ? s.blurb : "not installed"}</div>
                  </div>
                );
              })}
            </div>

            <h2>Stash ({a.stash.length})</h2>
            <div className="log-scroll" style={{ marginBottom: 16 }}>
              {a.stash.length === 0 && <span className="muted">Nothing stashed.</span>}
              {a.stash.map((it, i) => (
                <div key={i} style={{ fontSize: 12 }}>{itemName(it)}</div>
              ))}
            </div>

            <h2>Visitors</h2>
            {a.visitors.length === 0 && <p className="muted" style={{ fontSize: 12 }}>Nobody&apos;s dropped by.</p>}
            {a.visitors.map((v) => {
              const npc = state.world.npcs.find((n) => n.id === v.npcId);
              return (
                <div key={v.npcId} style={{ fontSize: 12, padding: "2px 0" }}>
                  <b>{npc?.name ?? v.npcId}</b> — {v.reason}
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
