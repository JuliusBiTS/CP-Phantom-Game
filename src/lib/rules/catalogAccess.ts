/**
 * Typed accessors over the CP Phantom catalogs (see catalogs.ts). Used by the
 * character sheet's viewers and its "learn / install / add" pickers.
 */

import {
  TALENT_CATALOG,
  TECHNIQUE_CATALOG,
  HACK_CATALOG,
  CYBERWARE_CATALOG,
  ATTACHMENT_CATALOG,
  MELEE_MOD_CATALOG,
  CONSUMABLE_CATALOG,
  CYBERWARE_IMPACT,
} from "./catalogs";
import { WEAPON_TABLE } from "./live";

// ── Talents ───────────────────────────────────────────────────────────────

export interface TalentLevel {
  lvl: string;
  req: string;
  effect: string;
  mods?: Array<{ appliesTo?: string; amount?: number; conditional?: boolean; scope?: string }>;
  regen_stat?: string;
  regen_amount?: number;
  maxBonus?: { stat: string; amount: number };
  usesPerFight?: number;
  hackIpDiscount?: Record<string, number>;
  [k: string]: unknown;
}
export interface TalentEntry {
  name: string;
  levels: TalentLevel[];
}

export const TALENT_TREES = Object.keys(TALENT_CATALOG) as Array<keyof typeof TALENT_CATALOG>;

export function talentsInTree(tree: string): TalentEntry[] {
  return ((TALENT_CATALOG as Record<string, unknown>)[tree] as TalentEntry[]) ?? [];
}

export function findTalent(name: string): { tree: string; entry: TalentEntry } | null {
  const n = name.trim().toLowerCase();
  for (const tree of TALENT_TREES) {
    const hit = talentsInTree(tree).find((t) => t.name.toLowerCase() === n);
    if (hit) return { tree, entry: hit };
  }
  return null;
}

/** Resolve a stored `{name, lvl}` (or free name) to its catalog level entry. */
export function resolveTalentLevel(name: string, lvl?: string): TalentLevel | null {
  const found = findTalent(name);
  if (!found) return null;
  if (lvl) {
    const exact = found.entry.levels.find((l) => l.lvl === lvl);
    if (exact) return exact;
  }
  return found.entry.levels[0] ?? null;
}

/** Sum a stat's pool bonus across owned talents (§ HP/STA/IP maxBonus). */
export function sumTalentMaxBonus(
  talents: Array<{ name?: string; lvl?: string; maxBonus?: { stat: string; amount: number } }> | undefined,
  stat: "hp" | "stamina" | "ip",
): number {
  return (talents ?? []).reduce((sum, t) => {
    const mb = t.maxBonus ?? resolveTalentLevel(t.name ?? "", t.lvl)?.maxBonus;
    return sum + (mb?.stat === stat ? mb.amount || 0 : 0);
  }, 0);
}

// ── Techniques ────────────────────────────────────────────────────────────

export interface TechniqueEntry {
  name: string;
  stamina?: number;
  effect?: string;
  weaponType?: string;
  [k: string]: unknown;
}

export const TECHNIQUE_CATEGORIES = Object.keys(TECHNIQUE_CATALOG) as Array<keyof typeof TECHNIQUE_CATALOG>;

export function techniquesInCategory(cat: string): TechniqueEntry[] {
  return ((TECHNIQUE_CATALOG as Record<string, unknown>)[cat] as TechniqueEntry[]) ?? [];
}

export function findTechnique(name: string): { category: string; entry: TechniqueEntry } | null {
  const n = name.trim().toLowerCase();
  for (const cat of TECHNIQUE_CATEGORIES) {
    const hit = techniquesInCategory(cat).find((t) => t.name.toLowerCase() === n);
    if (hit) return { category: cat, entry: hit };
  }
  return null;
}

// ── Hacks ─────────────────────────────────────────────────────────────────

export interface HackEntry {
  name: string;
  ip: number;
  effect: string;
  [k: string]: unknown;
}

export const HACK_CATEGORIES = Object.keys(HACK_CATALOG) as Array<keyof typeof HACK_CATALOG>;

export function hacksInCategory(cat: string): HackEntry[] {
  return ((HACK_CATALOG as Record<string, unknown>)[cat] as HackEntry[]) ?? [];
}

export function findHack(name: string): { category: string; entry: HackEntry } | null {
  const n = name.trim().toLowerCase();
  for (const cat of HACK_CATEGORIES) {
    const hit = hacksInCategory(cat).find((h) => h.name.toLowerCase() === n);
    if (hit) return { category: cat, entry: hit };
  }
  return null;
}

/** IP cost after Efficient Code-style talent discounts (talent.hackIpDiscount). */
export function effectiveHackIp(
  hackName: string,
  talents: Array<{ name?: string; lvl?: string; hackIpDiscount?: Record<string, number> }> | undefined,
): { base: number; effective: number } | null {
  const found = findHack(hackName);
  if (!found) return null;
  const base = found.entry.ip ?? 0;
  let discount = 0;
  for (const t of talents ?? []) {
    const d = t.hackIpDiscount ?? resolveTalentLevel(t.name ?? "", t.lvl)?.hackIpDiscount;
    if (d && typeof d[found.category] === "number") discount = Math.max(discount, d[found.category]);
  }
  return { base, effective: Math.max(1, base - discount) };
}

// ── Cyberware ─────────────────────────────────────────────────────────────

export const CYBERWARE_CATEGORIES = Object.keys(CYBERWARE_CATALOG) as Array<keyof typeof CYBERWARE_CATALOG>;

export function cyberwareInCategory(cat: string): string[] {
  return ((CYBERWARE_CATALOG as Record<string, unknown>)[cat] as string[]) ?? [];
}

export function allCyberwareNames(): string[] {
  return CYBERWARE_CATEGORIES.flatMap((c) => cyberwareInCategory(c));
}

const FIREWALL_ITEM_BONUS: Record<string, number> = {
  "basic ice": 5,
  "hardened ice": 10,
  "militech firewall": 15,
  "blackwall fragment": 20,
};

export function cyberwareImpact(cyberware: string[] | undefined): number {
  return (cyberware ?? []).reduce((sum, cw) => {
    const v = (CYBERWARE_IMPACT as Record<string, number>)[String(cw).trim().toLowerCase()];
    return sum + (v || 0);
  }, 0);
}

/** One-line effect hint for a cyberware name — built from the same tables the
 *  live math reads (stat bonus, firewall, humanity impact). */
export function cyberwareEffectHint(name: string): string {
  const norm = String(name).trim().toLowerCase();
  const parts: string[] = [];
  // stat bonuses live in live.ts's CYBERWARE_STAT_BONUS
  const impact = (CYBERWARE_IMPACT as Record<string, number>)[norm];
  const fw = FIREWALL_ITEM_BONUS[norm];
  if (norm === "subdermal armor") parts.push("+4 Body SP");
  if (fw) parts.push(`+${fw} Firewall`);
  if (impact) parts.push(`Humanity impact ${impact}`);
  return parts.join(" · ") || "flavour — no automatic bonus";
}

// ── Attachments & consumables ────────────────────────────────────────────

export const ATTACHMENTS = ATTACHMENT_CATALOG as ReadonlyArray<{ name: string; effect: string; costTier: string }>;
export const MELEE_MODS = MELEE_MOD_CATALOG as ReadonlyArray<{ name: string; effect: string; costTier: string }>;

export const CONSUMABLE_POOLS = Object.keys(CONSUMABLE_CATALOG) as Array<keyof typeof CONSUMABLE_CATALOG>;
export function consumablesInPool(pool: string): Array<{ name: string; effect: string }> {
  const g = (CONSUMABLE_CATALOG as Record<string, unknown>)[pool] as { basic?: Array<{ name: string; effect: string }>; premium?: Array<{ name: string; effect: string }> };
  return [...(g?.basic ?? []), ...(g?.premium ?? [])];
}

// ── Weapons (from live.ts's WEAPON_TABLE) ─────────────────────────────────

export function weaponCatalogNames(): string[] {
  return Object.keys(WEAPON_TABLE);
}
