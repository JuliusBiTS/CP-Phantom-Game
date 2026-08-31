"use client";

/**
 * Always-on vitals HUD — the numbers you glance at every turn. Replaces the old
 * character panel + PW-reference block. The deep stuff lives in CharacterSheet
 * (button / `C` hotkey). SOLO_MODE_BUILD_PLAN.md §12 Phase 3.
 */

import { useState } from "react";
import type { CampaignState, CharacterSheet as Sheet } from "@/lib/state/campaignState";
import { pcPwReference } from "@/lib/rules/live";
import { getWoundState } from "@/lib/rules/woundState";
import { humanityBand } from "@/lib/rules/derived";

function Bar({ label, cur, max, colorAt }: { label: string; cur: number; max: number; colorAt?: (pct: number) => string }) {
  const pct = max ? Math.max(0, Math.min(1, cur / max)) : 0;
  const color = colorAt ? colorAt(pct) : "var(--cyan)";
  return (
    <div style={{ minWidth: 92 }}>
      <div className="muted" style={{ fontSize: 9, letterSpacing: "0.15em" }}>{label}</div>
      <div style={{ height: 5, background: "var(--surface3)", border: "1px solid var(--border)" }}>
        <div style={{ height: "100%", width: `${pct * 100}%`, background: color }} />
      </div>
      <div style={{ fontFamily: "var(--font)", fontSize: 11 }}>
        <span className="stat-num">{cur}</span>/<span className="stat-num">{max}</span>
      </div>
    </div>
  );
}

export function VitalsHud({
  state,
  onPatch,
  onOpenSheet,
}: {
  state: CampaignState;
  onPatch: (mut: (c: Sheet) => void) => void;
  onOpenSheet: () => void;
}) {
  const c = state.character;
  const [collapsed, setCollapsed] = useState(false);
  const wound = getWoundState(c as never);
  const pw = (() => {
    try {
      return pcPwReference(c as never);
    } catch {
      return null;
    }
  })();

  const adj = (field: "hp" | "stamina" | "ip", delta: number) =>
    onPatch((c) => {
      const maxK = `${field === "hp" ? "hp" : field === "stamina" ? "stamina" : "ip"}_max` as keyof Sheet;
      const curK = `${field === "hp" ? "hp" : field === "stamina" ? "stamina" : "ip"}_current` as keyof Sheet;
      const max = (c[maxK] as number) ?? 0;
      const cur = (c[curK] as number) ?? max;
      (c as Record<string, number>)[curK as string] = Math.max(0, Math.min(max, cur + delta));
    });

  return (
    <section className="panel" style={{ borderColor: wound ? "var(--red)" : "var(--border)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontFamily: "var(--font-display)", fontSize: 15, letterSpacing: "0.05em" }}>
          {c.name}
          {wound && <span className="danger" style={{ fontSize: 11 }}>  {wound.name.toUpperCase()} −{Math.round((1 - wound.pwMult) * 100)}%</span>}
        </span>
        <span style={{ display: "flex", gap: 6 }}>
          <button onClick={onOpenSheet} style={{ padding: "3px 10px" }}>Character (C)</button>
          <button onClick={() => setCollapsed((v) => !v)} style={{ padding: "3px 8px" }}>{collapsed ? "▸" : "▾"}</button>
        </span>
      </div>

      {!collapsed && (
        <>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", margin: "8px 0" }}>
            {c.hp_max != null && (
              <div>
                <Bar label="HP" cur={c.hp_current ?? c.hp_max} max={c.hp_max} colorAt={(p) => (p <= 0.25 ? "var(--red-bright)" : p <= 0.5 ? "var(--gold-bright)" : "var(--green-bright)")} />
                <QuickAdj onMinus={() => adj("hp", -1)} onPlus={() => adj("hp", 1)} />
              </div>
            )}
            {c.stamina_max != null && (
              <div>
                <Bar label="STAMINA" cur={c.stamina_current ?? c.stamina_max} max={c.stamina_max} />
                <QuickAdj onMinus={() => adj("stamina", -1)} onPlus={() => adj("stamina", 1)} />
              </div>
            )}
            {c.ip_max != null && (
              <div>
                <Bar label="IP" cur={c.ip_current ?? c.ip_max} max={c.ip_max} />
                <QuickAdj onMinus={() => adj("ip", -1)} onPlus={() => adj("ip", 1)} />
              </div>
            )}
            {c.humanity_max != null && (
              <div>
                <Bar label="HUMANITY" cur={c.humanity_current ?? c.humanity_max} max={c.humanity_max} colorAt={() => "var(--purple-bright)"} />
                {(() => {
                  const b = humanityBand(c.humanity_current ?? c.humanity_max);
                  return (
                    <div style={{ fontSize: 9, letterSpacing: "0.1em" }} className={b.danger ? "danger" : "muted"} title={b.note}>
                      {b.label.toUpperCase()}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          {Array.isArray(c.criticalInjuries) && c.criticalInjuries.length > 0 && (
            <div className="danger" style={{ fontSize: 11, margin: "2px 0 4px" }}>
              ⚠ {c.criticalInjuries.filter((i) => i.treatment !== "healed").length} critical injur
              {c.criticalInjuries.filter((i) => i.treatment !== "healed").length === 1 ? "y" : "ies"}:{" "}
              {c.criticalInjuries
                .filter((i) => i.treatment !== "healed")
                .map((i) => `${i.name}${i.treatment === "quick-fixed" ? " (patched)" : ""}`)
                .join(", ") || "all healed"}
            </div>
          )}

          <div style={{ fontSize: 12 }}>
            <span className="muted">LOCATION</span> {state.world.currentLocation || "—"}
            {"    "}
            <span className="muted">EDDIES</span> <span className="stat-num">{c.eurodollar ?? 0}</span>
            {state.meta.inGameDate && (
              <>
                {"    "}
                <span className="muted">DATE</span> {state.meta.inGameDate}
              </>
            )}
          </div>
          <div style={{ fontSize: 12 }}>
            <span className="muted">QUESTS</span>{" "}
            {state.questLog.filter((q) => q.status === "active").map((q) => q.title).join(" · ") || "—"}
          </div>

          {pw && (
            <div style={{ marginTop: 6, fontFamily: "var(--font)", fontSize: 11, color: "var(--text2)" }}>
              {pw.weapons.map((w) => (
                <div key={w.weapon} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span>
                    {w.weapon} ({w.statPair}) — PW <span className="stat-num">{w.finalPw}</span> · {w.diceInstruction} · WB {w.weaponBonus}
                  </span>
                  {w.mag && (
                    <>
                      <span className={w.mag.current === 0 ? "danger" : undefined}>
                        mag <span className="stat-num">{w.mag.current}</span>/{w.mag.max}
                      </span>
                      <button
                        onClick={() =>
                          onPatch((c) => {
                            const ws = (c.weapons as Array<{ name?: string; magCurrent?: number }>) ?? [];
                            const t = ws.find((x) => x.name?.toLowerCase() === w.weapon.toLowerCase());
                            if (t) t.magCurrent = w.mag!.max;
                          })
                        }
                        style={{ padding: "0 6px", fontSize: 9 }}
                      >
                        reload
                      </button>
                    </>
                  )}
                </div>
              ))}
              <div>
                {pw.reaction.label} ({pw.reaction.statPair}) — PW <span className="stat-num">{pw.reaction.finalPw}</span>
              </div>
            </div>
          )}

          {state.pendingChangeset.filter((p) => p.reviewed === "pending").length > 0 && (
            <div style={{ fontSize: 12, color: "var(--gold-bright)", marginTop: 4 }}>
              GM REVIEW QUEUE: {state.pendingChangeset.filter((p) => p.reviewed === "pending").length} pending
            </div>
          )}
        </>
      )}
    </section>
  );
}

function QuickAdj({ onMinus, onPlus }: { onMinus: () => void; onPlus: () => void }) {
  return (
    <div style={{ display: "flex", gap: 3, marginTop: 2 }}>
      <button onClick={onMinus} style={{ padding: "0 6px", fontSize: 10 }}>−</button>
      <button onClick={onPlus} style={{ padding: "0 6px", fontSize: 10 }}>+</button>
    </div>
  );
}
