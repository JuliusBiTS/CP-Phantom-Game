"use client";

/**
 * Combat tracker — SOLO_MODE_BUILD_PLAN.md §12 Phase 3. Every combatant's real
 * HP / wound / armor / weapon PW, plus (in structured combat) the initiative
 * order, round, whose turn it is, and the controls the PLAYER uses to feed the
 * v12 math: target, range-from-me, cover. Writes to state.combat.
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

function Card({
  v,
  active,
  targeted,
  onTarget,
}: {
  v: CombatantView;
  active?: boolean;
  targeted?: boolean;
  onTarget?: () => void;
}) {
  const color = TYPE_COLOR[v.type];
  const woundCut = v.wound ? Math.round((1 - v.wound.pwMult) * 100) : 0;
  return (
    <div
      className={active ? "reticle" : undefined}
      style={{
        border: `1px solid ${targeted ? "var(--gold-bright)" : "var(--border2)"}`,
        borderLeft: `3px solid ${color}`,
        padding: 10,
        background: active ? "var(--surface3)" : "var(--surface2)",
        cursor: onTarget ? "pointer" : undefined,
      }}
      onClick={onTarget}
    >
      {active && (
        <>
          <span className="reticle-tr" />
          <span className="reticle-bl" />
        </>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, letterSpacing: "0.04em" }}>
          {v.name}
          {targeted && <span style={{ color: "var(--gold-bright)", fontSize: 9 }}> ◎ TARGET</span>}
        </span>
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

export function CombatTracker({
  state,
  onPatchCombat,
}: {
  state: CampaignState;
  onPatchCombat: (mut: (c: CampaignState["combat"]) => void) => void;
}) {
  const combat = state.combat;
  const structured = combat?.active && combat.order.length > 0;

  const npcsWithSheets = state.world.npcs.filter((n) => n.sheet && n.status === "alive");
  if (!structured && npcsWithSheets.length === 0) return null;

  const viewFor = (id: string): CombatantView | null => {
    if (id === "PC") return combatantView(state.character);
    const npc = state.world.npcs.find((n) => n.id === id);
    return npc?.sheet ? combatantView(npc.sheet) : null;
  };

  // Structured combat: render in initiative order.
  if (structured) {
    return (
      <section className="panel" style={{ borderColor: "var(--red)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <h2 style={{ color: "var(--red-bright)" }}>Combat — round {combat.round}</h2>
          <button onClick={() => onPatchCombat((c) => { c.active = false; c.order = []; })} style={{ padding: "3px 9px", fontSize: 10 }}>
            End combat
          </button>
        </div>
        <div style={{ fontSize: 11, color: "var(--text2)", marginBottom: 8 }}>
          Order: {combat.order.map((o, i) => (
            <span key={o.id} style={{ color: i === combat.turnIndex ? "var(--cyan)" : undefined }}>
              {i > 0 ? " → " : ""}{o.name}
            </span>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 8 }}>
          {combat.order.map((o, i) => {
            const v = viewFor(o.id);
            if (!v) return null;
            const isTargetable = !o.isPC;
            return (
              <div key={o.id}>
                <Card
                  v={v}
                  active={i === combat.turnIndex}
                  targeted={combat.pcTargetId === o.id}
                  onTarget={isTargetable ? () => onPatchCombat((c) => { c.pcTargetId = o.id; }) : undefined}
                />
                {isTargetable && (
                  <div style={{ display: "flex", gap: 6, marginTop: 3, fontSize: 10, alignItems: "center" }}>
                    <span className="muted">range</span>
                    <input
                      type="number"
                      value={o.rangeFromPcM ?? ""}
                      placeholder="m"
                      onChange={(e) =>
                        onPatchCombat((c) => {
                          const t = c.order.find((x) => x.id === o.id);
                          if (t) t.rangeFromPcM = e.target.value === "" ? null : Number(e.target.value);
                        })
                      }
                      style={{ width: 52, fontSize: 10, padding: "2px 4px" }}
                    />
                    <label style={{ display: "flex", gap: 3, alignItems: "center", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={o.cover === "behind"}
                        onChange={(e) =>
                          onPatchCombat((c) => {
                            const t = c.order.find((x) => x.id === o.id);
                            if (t) t.cover = e.target.checked ? "behind" : "none";
                          })
                        }
                      />
                      behind cover
                    </label>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <p className="muted" style={{ fontSize: 10, marginTop: 6 }}>
          Set range + cover per enemy — the GM applies the v12 distance/cover PW rules from these, not guesses.
        </p>
      </section>
    );
  }

  // Loose combat (NPCs have sheets but no initiative rolled yet).
  const pcView = combatantView(state.character);
  return (
    <section className="panel" style={{ borderColor: "var(--border2)" }}>
      <h2>Combat tracker</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 8 }}>
        <Card v={pcView} />
        {npcsWithSheets.map((n) => {
          const v = combatantView(n.sheet);
          return <Card key={n.id} v={v} />;
        })}
      </div>
    </section>
  );
}
