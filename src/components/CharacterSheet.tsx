"use client";

/**
 * Full character sheet — SOLO_MODE_BUILD_PLAN.md §8.1. Everything on the CP
 * Phantom record: stats, derived values, loadout, talents/techniques/hacks
 * (with catalog "learn" pickers), inventory/abilities, bio. Toggled by a button
 * or the `C` hotkey; the always-on numbers live in VitalsHud.
 *
 * Read-mostly with quick-adjusts. `onPatch` mutates `state.character` and the
 * caller persists. Big stat changes are meant to flow through the GM-review
 * pipeline, not here.
 */

import { useState } from "react";
import type { CharacterSheet as Sheet } from "@/lib/state/campaignState";
import { fullDerived } from "@/lib/rules/derived";
import { POWER_STATS, MOBILITY_STATS, MIND_STATS } from "@/lib/rules/derived";
import { pcPwReference } from "@/lib/rules/live";
import {
  TALENT_TREES, talentsInTree, resolveTalentLevel,
  TECHNIQUE_CATEGORIES, techniquesInCategory, findTechnique,
  HACK_CATEGORIES, hacksInCategory, findHack, effectiveHackIp,
  CYBERWARE_CATEGORIES, cyberwareInCategory, cyberwareEffectHint,
  weaponCatalogNames,
} from "@/lib/rules/catalogAccess";

type Tab = "stats" | "loadout" | "talents" | "techniques" | "hacks" | "gear" | "bio";
const TABS: Array<[Tab, string]> = [
  ["stats", "Stats"],
  ["loadout", "Loadout"],
  ["talents", "Talents"],
  ["techniques", "Techniques"],
  ["hacks", "Hacks"],
  ["gear", "Gear & Abilities"],
  ["bio", "Bio"],
];

const TREE_STATS: Record<string, readonly string[]> = { POWER: POWER_STATS, MOBILITY: MOBILITY_STATS, MIND: MIND_STATS };

function arr<T = Record<string, unknown>>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

export function CharacterSheet({
  character,
  onPatch,
  onClose,
}: {
  character: Sheet;
  onPatch: (mut: (c: Sheet) => void) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>("stats");
  const c = character;

  return (
    <section className="panel" style={{ borderColor: "var(--cyan-dim)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
        <h2 style={{ color: "var(--cyan)" }}>{c.name} — character sheet</h2>
        <button onClick={onClose} style={{ padding: "3px 9px" }}>Close (C)</button>
      </div>

      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 12 }}>
        {TABS.map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "4px 10px",
              fontSize: 10,
              background: tab === t ? "var(--surface3)" : "transparent",
              borderColor: tab === t ? "var(--cyan-dim)" : "var(--border)",
              color: tab === t ? "var(--cyan)" : "var(--text2)",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "stats" && <StatsTab c={c} />}
      {tab === "loadout" && <LoadoutTab c={c} onPatch={onPatch} />}
      {tab === "talents" && <TalentsTab c={c} onPatch={onPatch} />}
      {tab === "techniques" && <TechniquesTab c={c} onPatch={onPatch} />}
      {tab === "hacks" && <HacksTab c={c} onPatch={onPatch} />}
      {tab === "gear" && <GearTab c={c} onPatch={onPatch} />}
      {tab === "bio" && <BioTab c={c} onPatch={onPatch} />}
    </section>
  );
}

// ── Stats ─────────────────────────────────────────────────────────────────

function StatsTab({ c }: { c: Sheet }) {
  const d = fullDerived(c as never);
  const eff = d.effectiveStats;
  const rawStats = (c.stats ?? {}) as Record<string, number>;

  return (
    <div style={{ fontFamily: "var(--font)", fontSize: 12 }}>
      {(["POWER", "MOBILITY", "MIND"] as const).map((tree) => (
        <div key={tree} style={{ marginBottom: 10 }}>
          <div className="muted" style={{ fontSize: 10, letterSpacing: "0.2em" }}>
            {tree} — tree level <span className="stat-num">{d.treeLevels[tree.toLowerCase() as "power"]}</span>
          </div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 3 }}>
            {TREE_STATS[tree].map((s) => {
              const cyb = (eff[s] ?? 0) - (rawStats[s] ?? 0);
              return (
                <span key={s}>
                  {s} <span className="stat-num">{eff[s] ?? 0}</span>
                  {cyb !== 0 && <span className="ok" style={{ fontSize: 10 }}> ({rawStats[s] ?? 0}{cyb > 0 ? "+" : ""}{cyb})</span>}
                </span>
              );
            })}
          </div>
        </div>
      ))}
      <div style={{ marginBottom: 10 }}>
        <div className="muted" style={{ fontSize: 10, letterSpacing: "0.2em" }}>SPECIAL</div>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 3 }}>
          <span>rep <span className="stat-num">{eff.rep ?? 0}</span></span>
          <span>luck <span className="stat-num">{eff.luck ?? 0}</span></span>
          <span>eddies <span className="stat-num">{c.eurodollar ?? 0}</span></span>
        </div>
      </div>
      <div className="log-scroll" style={{ maxHeight: "none" }}>
        <p className="muted" style={{ fontSize: 10 }}>
          Shows the value in play. When the stored value differs from the v12 formula (GM override,
          drift), the formula is noted.
        </p>
        <DerivedRow k="HP max" stored={c.hp_max} formula={d.hp_max} />
        <DerivedRow k="Stamina max" stored={c.stamina_max} formula={d.stamina_max} />
        <DerivedRow k="IP max" stored={c.ip_max} formula={d.ip_max} />
        <DerivedRow k="Humanity max" stored={c.humanity_max} formula={d.humanity_max} extra={`base ${d.humanity_base}`} />
        <DerivedRow k="Initiative" stored={(c as { initiative?: number }).initiative} formula={d.initiative} />
        <Row k="Reaction value" v={String(d.reactionValue)} />
        <Row k="Capacity (Grit×5)" v={String(d.capacity)} />
        <Row k="Global XP" v={String(c.globalXP ?? 0)} />
        <Row k="Talent points spent" v={String(c.talentPointsSpent ?? 0)} />
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "1px 0" }}>
      <span className="muted">{k}</span>
      <span className="stat-num">{v}</span>
    </div>
  );
}

function DerivedRow({ k, stored, formula, extra }: { k: string; stored?: number; formula: number; extra?: string }) {
  const shown = stored ?? formula;
  const drift = stored != null && stored !== formula;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "1px 0" }}>
      <span className="muted">{k}</span>
      <span className="stat-num">
        {shown}
        {extra ? ` (${extra})` : ""}
        {drift && <span className="muted" style={{ fontSize: 10 }}> · formula {formula}</span>}
      </span>
    </div>
  );
}

// ── Loadout ───────────────────────────────────────────────────────────────

function LoadoutTab({ c, onPatch }: { c: Sheet; onPatch: (m: (c: Sheet) => void) => void }) {
  const [addW, setAddW] = useState("");
  const pw = (() => {
    try {
      return pcPwReference(c as never).weapons;
    } catch {
      return [];
    }
  })();
  const weapons = arr<{ name?: string; bonus?: number; tags?: string[]; attachments?: unknown[]; tech?: string }>(c.weapons);

  return (
    <div style={{ fontFamily: "var(--font)", fontSize: 12 }}>
      <h3 style={{ fontSize: 11, color: "var(--text2)", letterSpacing: "0.15em" }}>WEAPONS</h3>
      {weapons.map((w, i) => {
        const live = pw.find((p) => p.weapon === w.name);
        return (
          <div key={i} style={{ border: "1px solid var(--border)", padding: 8, marginBottom: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <b>{w.name}</b>
              <button onClick={() => onPatch((c) => { (c.weapons as unknown[]).splice(i, 1); })} style={{ padding: "0 7px", fontSize: 10 }}>remove</button>
            </div>
            {live && (
              <div className="muted">
                {live.statPair} · PW <span className="stat-num">{live.finalPw}</span> · {live.diceInstruction} · WB {live.weaponBonus}
              </div>
            )}
            {w.tech && <div className="muted">tech: {w.tech}</div>}
            {arr(w.attachments).length > 0 && (
              <div className="muted">attachments: {arr<{ name?: string }>(w.attachments).map((a) => a.name).join(", ")}</div>
            )}
            {live?.situational?.length ? <div style={{ color: "var(--gold-bright)", fontSize: 11 }}>situational: {live.situational.join(" · ")}</div> : null}
          </div>
        );
      })}
      <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
        <select value={addW} onChange={(e) => setAddW(e.target.value)} style={{ fontSize: 11 }}>
          <option value="">— add weapon from catalog —</option>
          {weaponCatalogNames().map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
        <button
          disabled={!addW}
          onClick={() => {
            onPatch((c) => { (c.weapons ??= [] as unknown[]).push({ name: addW }); });
            setAddW("");
          }}
          style={{ fontSize: 10 }}
        >
          add
        </button>
      </div>

      <h3 style={{ fontSize: 11, color: "var(--text2)", letterSpacing: "0.15em", marginTop: 12 }}>ARMOR</h3>
      {(["armor_body", "armor_head"] as const).map((slot) => {
        const a = c[slot] as { name?: string; sp_base?: number; sp_temp?: number } | null | undefined;
        return (
          <div key={slot} className="muted">
            {slot === "armor_body" ? "Body" : "Head"}: {a?.name ?? "—"}
            {a && ` · SP ${a.sp_temp ?? a.sp_base ?? 0}/${a.sp_base ?? 0}`}
          </div>
        );
      })}

      <h3 style={{ fontSize: 11, color: "var(--text2)", letterSpacing: "0.15em", marginTop: 12 }}>CYBERWARE</h3>
      {arr<string>(c.cyberware).map((cw, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between" }}>
          <span>{cw} <span className="muted">— {cyberwareEffectHint(cw)}</span></span>
          <button onClick={() => onPatch((c) => { (c.cyberware as string[]).splice(i, 1); })} style={{ padding: "0 7px", fontSize: 10 }}>remove</button>
        </div>
      ))}
      <CyberwarePicker onAdd={(name) => onPatch((c) => { (c.cyberware ??= [] as string[]).push(name); })} />
    </div>
  );
}

function CyberwarePicker({ onAdd }: { onAdd: (name: string) => void }) {
  const [cat, setCat] = useState<string>(CYBERWARE_CATEGORIES[0]);
  const [name, setName] = useState("");
  return (
    <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
      <select value={cat} onChange={(e) => { setCat(e.target.value); setName(""); }} style={{ fontSize: 11 }}>
        {CYBERWARE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <select value={name} onChange={(e) => setName(e.target.value)} style={{ fontSize: 11 }}>
        <option value="">— install —</option>
        {cyberwareInCategory(cat).map((n) => <option key={n} value={n}>{n}</option>)}
      </select>
      <button disabled={!name} onClick={() => { onAdd(name); setName(""); }} style={{ fontSize: 10 }}>add</button>
    </div>
  );
}

// ── Talents ───────────────────────────────────────────────────────────────

function TalentsTab({ c, onPatch }: { c: Sheet; onPatch: (m: (c: Sheet) => void) => void }) {
  const talents = arr<{ name?: string; lvl?: string; desc?: string; effect?: string }>(c.talents);
  const [tree, setTree] = useState<string>(TALENT_TREES[0]);
  const [pick, setPick] = useState("");
  const [lvl, setLvl] = useState("");
  const pickLevels = pick ? talentsInTree(tree).find((t) => t.name === pick)?.levels ?? [] : [];

  return (
    <div style={{ fontFamily: "var(--font)", fontSize: 12 }}>
      {talents.length === 0 && <p className="muted">No talents yet.</p>}
      {talents.map((t, i) => {
        const cat = resolveTalentLevel(t.name ?? "", t.lvl);
        return (
          <div key={i} style={{ border: "1px solid var(--border)", padding: 8, marginBottom: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <b>{t.name} {t.lvl && <span className="stat-num">{t.lvl}</span>}</b>
              <button onClick={() => onPatch((c) => { (c.talents as unknown[]).splice(i, 1); })} style={{ padding: "0 7px", fontSize: 10 }}>remove</button>
            </div>
            <div className="muted">{cat?.effect ?? t.effect ?? t.desc ?? "—"}</div>
            {cat?.req && <div className="muted" style={{ fontSize: 10 }}>req: {cat.req}</div>}
          </div>
        );
      })}

      <h3 style={{ fontSize: 11, color: "var(--text2)", letterSpacing: "0.15em", marginTop: 10 }}>LEARN A TALENT</h3>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <select value={tree} onChange={(e) => { setTree(e.target.value); setPick(""); setLvl(""); }} style={{ fontSize: 11 }}>
          {TALENT_TREES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={pick} onChange={(e) => { setPick(e.target.value); setLvl(""); }} style={{ fontSize: 11 }}>
          <option value="">— talent —</option>
          {talentsInTree(tree).map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}
        </select>
        <select value={lvl} onChange={(e) => setLvl(e.target.value)} style={{ fontSize: 11 }} disabled={!pick}>
          <option value="">— level —</option>
          {pickLevels.map((l) => <option key={l.lvl} value={l.lvl}>{l.lvl} ({l.req})</option>)}
        </select>
        <button
          disabled={!pick || !lvl}
          onClick={() => {
            const entry = talentsInTree(tree).find((t) => t.name === pick);
            const level = entry?.levels.find((l) => l.lvl === lvl);
            if (!entry || !level) return;
            onPatch((c) => {
              (c.talents ??= [] as unknown[]).push({
                name: entry.name, lvl: level.lvl, desc: level.effect, req: level.req, mods: level.mods ?? [],
                ...(level.maxBonus ? { maxBonus: level.maxBonus } : {}),
                ...(level.regen_stat ? { regen_stat: level.regen_stat, regen_amount: level.regen_amount } : {}),
                ...(level.hackIpDiscount ? { hackIpDiscount: level.hackIpDiscount } : {}),
              });
            });
            setPick(""); setLvl("");
          }}
          style={{ fontSize: 10 }}
        >
          learn
        </button>
      </div>
      {pick && lvl && (
        <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
          {pickLevels.find((l) => l.lvl === lvl)?.effect}
        </div>
      )}
    </div>
  );
}

// ── Techniques ────────────────────────────────────────────────────────────

function TechniquesTab({ c, onPatch }: { c: Sheet; onPatch: (m: (c: Sheet) => void) => void }) {
  const techs = arr<{ name?: string }>(c.techniques);
  const [cat, setCat] = useState<string>(TECHNIQUE_CATEGORIES[0]);
  const [pick, setPick] = useState("");
  return (
    <div style={{ fontFamily: "var(--font)", fontSize: 12 }}>
      {techs.length === 0 && <p className="muted">No techniques yet.</p>}
      {techs.map((t, i) => {
        const cat = findTechnique(t.name ?? "");
        return (
          <div key={i} style={{ border: "1px solid var(--border)", padding: 8, marginBottom: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <b>{t.name}</b>
              <button onClick={() => onPatch((c) => { (c.techniques as unknown[]).splice(i, 1); })} style={{ padding: "0 7px", fontSize: 10 }}>remove</button>
            </div>
            <div className="muted">{cat?.entry.effect ?? "—"}{cat?.entry.stamina != null && ` · ${cat.entry.stamina} STA`}</div>
          </div>
        );
      })}
      <h3 style={{ fontSize: 11, color: "var(--text2)", letterSpacing: "0.15em", marginTop: 10 }}>LEARN A TECHNIQUE</h3>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <select value={cat} onChange={(e) => { setCat(e.target.value); setPick(""); }} style={{ fontSize: 11 }}>
          {TECHNIQUE_CATEGORIES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={pick} onChange={(e) => setPick(e.target.value)} style={{ fontSize: 11 }}>
          <option value="">— technique —</option>
          {techniquesInCategory(cat).map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}
        </select>
        <button disabled={!pick} onClick={() => { onPatch((c) => { (c.techniques ??= [] as unknown[]).push({ name: pick }); }); setPick(""); }} style={{ fontSize: 10 }}>learn</button>
      </div>
    </div>
  );
}

// ── Hacks ─────────────────────────────────────────────────────────────────

function HacksTab({ c, onPatch }: { c: Sheet; onPatch: (m: (c: Sheet) => void) => void }) {
  const hacks = arr<{ name?: string; ip?: number; effect?: string }>(c.hacks);
  const [cat, setCat] = useState<string>(HACK_CATEGORIES[0]);
  const [pick, setPick] = useState("");
  return (
    <div style={{ fontFamily: "var(--font)", fontSize: 12 }}>
      <div className="muted" style={{ fontSize: 11, marginBottom: 6 }}>
        Cyberdeck: {String((c as { cyberdeck?: string }).cyberdeck ?? "—")} · Firewall: {String((c as { firewall?: number }).firewall ?? "—")}
      </div>
      {hacks.length === 0 && <p className="muted">No hacks yet.</p>}
      {hacks.map((h, i) => {
        const cat = findHack(h.name ?? "");
        const ip = effectiveHackIp(h.name ?? "", arr(c.talents));
        return (
          <div key={i} style={{ border: "1px solid var(--border)", padding: 8, marginBottom: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <b>{h.name}</b>
              <button onClick={() => onPatch((c) => { (c.hacks as unknown[]).splice(i, 1); })} style={{ padding: "0 7px", fontSize: 10 }}>remove</button>
            </div>
            <div className="muted">
              {ip ? `${ip.effective} IP${ip.effective !== ip.base ? ` (base ${ip.base})` : ""}` : `${h.ip ?? cat?.entry.ip ?? "?"} IP`}
              {" — "}{cat?.entry.effect ?? h.effect ?? "—"}
            </div>
          </div>
        );
      })}
      <h3 style={{ fontSize: 11, color: "var(--text2)", letterSpacing: "0.15em", marginTop: 10 }}>ADD A HACK</h3>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <select value={cat} onChange={(e) => { setCat(e.target.value); setPick(""); }} style={{ fontSize: 11 }}>
          {HACK_CATEGORIES.map((h) => <option key={h} value={h}>{h}</option>)}
        </select>
        <select value={pick} onChange={(e) => setPick(e.target.value)} style={{ fontSize: 11 }}>
          <option value="">— hack —</option>
          {hacksInCategory(cat).map((h) => <option key={h.name} value={h.name}>{h.name} ({h.ip} IP)</option>)}
        </select>
        <button
          disabled={!pick}
          onClick={() => {
            const entry = hacksInCategory(cat).find((h) => h.name === pick);
            if (entry) onPatch((c) => { (c.hacks ??= [] as unknown[]).push({ name: entry.name, ip: entry.ip, effect: entry.effect }); });
            setPick("");
          }}
          style={{ fontSize: 10 }}
        >
          add
        </button>
      </div>
    </div>
  );
}

// ── Gear & Abilities ──────────────────────────────────────────────────────

function GearTab({ c, onPatch }: { c: Sheet; onPatch: (m: (c: Sheet) => void) => void }) {
  const inv = arr<{ name?: string; qty?: number; slots?: number }>(c.inventory);
  const abilities = arr<{ name?: string; desc?: string; usesMax?: number; usesCurrent?: number }>(c.abilities);
  const [itemName, setItemName] = useState("");
  const [itemQty, setItemQty] = useState("1");

  return (
    <div style={{ fontFamily: "var(--font)", fontSize: 12 }}>
      <h3 style={{ fontSize: 11, color: "var(--text2)", letterSpacing: "0.15em" }}>INVENTORY</h3>
      {inv.map((it, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "1px 0" }}>
          <span>{it.qty && it.qty > 1 ? `${it.qty}× ` : ""}{it.name}{it.slots ? ` (${it.slots} slots)` : ""}</span>
          <button onClick={() => onPatch((c) => { (c.inventory as unknown[]).splice(i, 1); })} style={{ padding: "0 7px", fontSize: 10 }}>remove</button>
        </div>
      ))}
      <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
        <input value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="item" style={{ fontSize: 11, width: 160 }} />
        <input value={itemQty} onChange={(e) => setItemQty(e.target.value)} style={{ fontSize: 11, width: 44 }} />
        <button
          disabled={!itemName.trim()}
          onClick={() => {
            onPatch((c) => { (c.inventory ??= [] as unknown[]).push({ name: itemName.trim(), qty: parseInt(itemQty, 10) || 1, slots: 0 }); });
            setItemName(""); setItemQty("1");
          }}
          style={{ fontSize: 10 }}
        >
          add
        </button>
      </div>

      <h3 style={{ fontSize: 11, color: "var(--text2)", letterSpacing: "0.15em", marginTop: 12 }}>ABILITIES</h3>
      {abilities.length === 0 && <p className="muted">None.</p>}
      {abilities.map((a, i) => (
        <div key={i} style={{ border: "1px solid var(--border)", padding: 6, marginBottom: 4 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <b>{a.name}</b>
            {a.usesMax ? (
              <span style={{ display: "flex", gap: 4, alignItems: "center" }}>
                <button onClick={() => onPatch((c) => { const x = (c.abilities as Array<{ usesCurrent?: number }>)[i]; x.usesCurrent = Math.max(0, (x.usesCurrent ?? a.usesMax ?? 0) - 1); })} style={{ padding: "0 6px" }}>−</button>
                <span className="stat-num">{a.usesCurrent ?? a.usesMax}/{a.usesMax}</span>
                <button onClick={() => onPatch((c) => { const x = (c.abilities as Array<{ usesCurrent?: number }>)[i]; x.usesCurrent = Math.min(a.usesMax ?? 0, (x.usesCurrent ?? 0) + 1); })} style={{ padding: "0 6px" }}>+</button>
              </span>
            ) : null}
          </div>
          {a.desc && <div className="muted">{a.desc}</div>}
        </div>
      ))}
    </div>
  );
}

// ── Bio ───────────────────────────────────────────────────────────────────

function BioTab({ c, onPatch }: { c: Sheet; onPatch: (m: (c: Sheet) => void) => void }) {
  return (
    <div style={{ fontFamily: "var(--font)", fontSize: 12 }}>
      <label className="muted" style={{ fontSize: 10, letterSpacing: "0.2em" }}>NOTES / LIFE-PATH JOURNAL</label>
      <textarea
        defaultValue={c.notes ?? ""}
        onBlur={(e) => onPatch((c) => { c.notes = e.target.value; })}
        rows={16}
        style={{ width: "100%", marginTop: 4, fontSize: 11 }}
      />
      <p className="muted" style={{ fontSize: 10 }}>Edits save when you click away.</p>
    </div>
  );
}
