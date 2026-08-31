"use client";

/**
 * Lightweight combat tracker — SOLO_MODE_BUILD_PLAN.md §12 Phase 3. Shows every
 * combatant's real HP / wound state / armor / weapon PW so "did HP actually
 * track correctly" is verifiable at a glance, not buried in prose. Read-only:
 * it renders from Campaign State, which the turn loop updates.
 *
 * Shown whenever the world has ≥1 alive NPC carrying a generated/cached sheet
 * (NPCs only get a sheet when they need to roll — i.e. a fight is on).
 */

import type { CampaignState } from "@/lib/state/campaignState";
import { combatantView, type CombatantView } from "@/lib/rules/combatant";

const TYPE_COLOR: Record<CombatantView["type"], string> = {
  PC: "var(--cyan)",
  NPC: "var(--red-bright)",
  Ally: "var(--green-bright)",
  Companion: "var(--blue-bright)",
  Drone: "var(--red-bright)",
  Security: "var(--red-bright)",
};

function Card({ v }: { v: CombatantView }) {
  const color = TYPE_COLOR[v.type];
  const woundCut = v.wound ? Math.round((1 - v.wound.pwMult) * 100) : 0;
  return (
    <div style={{ border: `1px solid var(--border2)`, borderLeft: `3px solid ${color}`, padding: 10, background: "var(--surface2)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, letterSpacing: "0.04em" }}>{v.name}</span>
        <span style={{ fontSize: 9, letterSpacing: "0.15em", color }}>
          {v.type.toUpperCase()}
          {v.generated ? ` · ${v.generated.tier}/${v.generated.archetype}` : ""}
        </span>
      </div>

      <div style={{ margin: "6px 0 4px" }}>
        <div style={{ height: 6, background: "var(--surface3)", border: "1px solid var(--border)" }}>
          <div
            style={{
              height: "100%",
              width: `${v.hpPct * 100}%`,
              background: v.hpPct <= 0.25 ? "var(--red-bright)" : v.hpPct <= 0.5 ? "var(--gold-bright)" : "var(--green-bright)",
            }}
          />
        </div>
        <div style={{ fontFamily: "var(--font)", fontSize: 11, marginTop: 2 }}>
          HP <span className="stat-num">{v.hp}</span>/<span className="stat-num">{v.hpMax}</span>
          {" · SP "}
          <span className="stat-num">{v.armorSP.body}</span>
          {v.armorSP.head ? `/${v.armorSP.head}` : ""}
          {v.reactionPw != null && (
            <>
              {" · RW "}
              <span className="stat-num">{v.reactionPw}</span>
            </>
          )}
        </div>
      </div>

      {v.wound && (
        <div style={{ fontSize: 10, color: "var(--red-bright)", letterSpacing: "0.06em" }}>
          {v.wound.name.toUpperCase()} −{woundCut}% PW{v.wound.lockSecondary ? " · NO SECONDARY" : ""}
        </div>
      )}

      {v.weapons.map((w) => (
        <div key={w.name} style={{ fontFamily: "var(--font)", fontSize: 11, marginTop: 2, color: "var(--text2)" }}>
          {w.name} {w.statPair !== "—" && `(${w.statPair})`} — PW <span className="stat-num">{w.pw}</span> · WB {w.weaponBonus}
        </div>
      ))}

      {v.statusEffects.length > 0 && (
        <div style={{ marginTop: 4, display: "flex", gap: 4, flexWrap: "wrap" }}>
          {v.statusEffects.map((s) => (
            <span key={s} style={{ fontSize: 9, padding: "1px 5px", border: "1px solid var(--border2)", color: "var(--gold-bright)" }}>
              {s}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function CombatTracker({ state }: { state: CampaignState }) {
  const npcs = state.world.npcs.filter((n) => n.sheet && n.status === "alive");
  if (npcs.length === 0) return null;

  const pcView = combatantView(state.character);
  const npcViews = npcs.map((n) => combatantView(n.sheet));

  return (
    <section className="panel" style={{ borderColor: "var(--border2)" }}>
      <h2>Combat tracker</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 8 }}>
        <Card v={pcView} />
        {npcViews.map((v, i) => (
          <Card key={npcs[i].id} v={v} />
        ))}
      </div>
      <p className="muted" style={{ fontSize: 10, marginTop: 6 }}>
        Live from Campaign State. Dead NPCs drop off automatically.
      </p>
    </section>
  );
}
