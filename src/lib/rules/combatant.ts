/**
 * Unified combatant view — one function that turns any CP Phantom character
 * sheet (PC, imported, or generated NPC) into the numbers a combat tracker
 * needs. SOLO_MODE_BUILD_PLAN.md §12 Phase 3.
 *
 * Reuses the same ported math as everything else: getWoundState,
 * computeWeaponPw, resolveArmorSP.
 */

import { getWoundState, type WoundState } from "./woundState";
import { computeWeaponPw, resolveArmorSP, type LiveChar } from "./live";

export interface CombatantWeapon {
  name: string;
  statPair: string;
  pw: number;
  diceInstruction: string;
  weaponBonus: number;
}

export interface CombatantView {
  name: string;
  type: "PC" | "NPC" | "Ally" | "Companion" | "Drone" | "Security";
  hp: number;
  hpMax: number;
  hpPct: number;
  wound: WoundState | null;
  armorSP: { body: number; head: number };
  reactionPw: number | null;
  weapons: CombatantWeapon[];
  statusEffects: string[];
  generated?: { tier: string; archetype: string };
}

type Flagged = LiveChar & { isSecurityUnit?: boolean; isNPC?: boolean; isAlly?: boolean };

function typeOf(c: Flagged): CombatantView["type"] {
  if (c.isDrone) return "Drone";
  if (c.isSecurityUnit) return "Security";
  if (c.isCompanion) return "Companion";
  if (c.isAlly) return "Ally";
  if (c.isNPC) return "NPC";
  return "PC";
}

export function combatantView(sheet: unknown): CombatantView {
  const c = (sheet ?? {}) as Flagged & {
    _generated?: { tier?: string; archetype?: string; primaryPw?: number; reactionPw?: number };
  };
  const hpMax = c.hp_max ?? 1;
  const hp = c.hp_current ?? hpMax;
  const wound = getWoundState(c);

  const weapons: CombatantWeapon[] = [];
  for (const w of c.weapons ?? []) {
    if (!w.name) continue;
    const live = computeWeaponPw(c, w.name, w);
    if (live) {
      weapons.push({
        name: w.name,
        statPair: live.statPair,
        pw: live.finalPw,
        diceInstruction: live.diceInstruction,
        weaponBonus: live.weaponBonus,
      });
    } else if (c._generated?.primaryPw != null) {
      weapons.push({ name: w.name, statPair: "—", pw: c._generated.primaryPw, diceInstruction: "", weaponBonus: w.bonus ?? 0 });
    }
  }

  const statusEffects = Array.isArray(c.status_effects)
    ? (c.status_effects as Array<{ name?: string; type?: string }>).map((e) => String(e.name ?? e.type ?? "")).filter(Boolean)
    : [];

  return {
    name: c.name ?? "?",
    type: typeOf(c),
    hp,
    hpMax,
    hpPct: hpMax ? Math.max(0, Math.min(1, hp / hpMax)) : 0,
    wound,
    armorSP: { body: resolveArmorSP(c, "body"), head: resolveArmorSP(c, "head") },
    reactionPw:
      c._generated?.reactionPw ??
      (c.stats ? (Number(c.stats.drive) || 0) + (Number(c.stats.reflexes) || 0) : null),
    weapons,
    statusEffects,
    generated: c._generated?.tier ? { tier: c._generated.tier, archetype: c._generated.archetype ?? "?" } : undefined,
  };
}
