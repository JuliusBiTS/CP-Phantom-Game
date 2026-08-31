/**
 * Derived stats for a PC — rulebook v12 §1.3 / §7.
 * (CP Phantom's `calcDerived` matches for HP/Stamina/Humanity/IP; it still uses
 * Speed+Reflexes for Initiative where v12 §1.3 now says Drive+Reflexes — v12
 * wins here since this feeds character creation. Push-back never writes
 * Initiative, so there's no drift risk to CP Phantom data.)
 */

export const POWER_STATS = ["strength", "dexterity", "grit", "drive", "core"] as const;
export const MOBILITY_STATS = ["speed", "agility", "reflexes", "stealth", "senses"] as const;
export const MIND_STATS = ["intelligence", "focus", "creativity", "will", "cool", "rep"] as const;

export const ALL_STATS = [
  ...POWER_STATS,
  ...MOBILITY_STATS,
  ...MIND_STATS,
  "luck",
] as const;
export type StatKey = (typeof ALL_STATS)[number];

export interface OriginBonuses {
  hp?: number;
  stamina?: number;
  ip?: number;
  humanity?: number;
  initiative?: number;
}

function s(stats: Record<string, number>, k: string): number {
  return Number(stats[k]) || 0;
}

export function sumTree(stats: Record<string, number>, tree: readonly string[]): number {
  return tree.reduce((a, k) => a + s(stats, k), 0);
}

export function treeLevels(stats: Record<string, number>) {
  return {
    power: Math.floor(sumTree(stats, POWER_STATS) / 2),
    mobility: Math.floor(sumTree(stats, MOBILITY_STATS) / 2),
    mind: Math.floor(sumTree(stats, MIND_STATS) / 2),
  };
}

export function humanityBase(stats: Record<string, number>, bonus = 0): number {
  return Math.min(30, Math.max(15, 12 + Math.floor((s(stats, "will") + s(stats, "cool")) / 2))) + bonus;
}

export interface DerivedStats {
  hp_max: number;
  stamina_max: number;
  ip_max: number;
  humanity_max: number;
  humanity_base: number;
  initiative: number;
  reactionValue: number;
  capacity: number;
  treeLevels: { power: number; mobility: number; mind: number };
}

import { sumTalentMaxBonus, cyberwareImpact as calcCyberwareImpact } from "./catalogAccess";
import { getEffectiveStats, type LiveChar } from "./live";

export function calcDerived(
  stats: Record<string, number>,
  origin: OriginBonuses = {},
  cyberwareImpact = 0,
): DerivedStats {
  const mindSum = sumTree(stats, MIND_STATS);
  const base = humanityBase(stats, origin.humanity ?? 0);
  return {
    hp_max: s(stats, "grit") + s(stats, "core") + (origin.hp ?? 0),
    stamina_max: s(stats, "drive") + s(stats, "core") + (origin.stamina ?? 0),
    ip_max: Math.floor(mindSum / 5) * 2 + (origin.ip ?? 0),
    humanity_base: base,
    humanity_max: Math.max(0, base - cyberwareImpact),
    initiative: s(stats, "drive") + s(stats, "reflexes") + (origin.initiative ?? 0),
    reactionValue: s(stats, "drive") + s(stats, "reflexes"),
    capacity: s(stats, "grit") * 5,
    treeLevels: treeLevels(stats),
  };
}

interface FullChar extends LiveChar {
  origin_hp_bonus?: number;
  origin_sta_bonus?: number;
  origin_ip_bonus?: number;
  origin_humanity_bonus?: number;
  talents?: Array<{ name?: string; lvl?: string; maxBonus?: { stat: string; amount: number } }>;
}

/**
 * Derived stats for a whole character record: effective stats (base +
 * cyberware), origin bonuses off the sheet, talent HP/STA/IP pool boosts,
 * cyberware Humanity impact. Matches CP Phantom's `saveCharacter` math.
 */
export function fullDerived(c: FullChar): DerivedStats & { effectiveStats: Record<string, number> } {
  const effective = getEffectiveStats(c);
  const impact = calcCyberwareImpact(c.cyberware);
  const d = calcDerived(
    effective,
    {
      hp: (c.origin_hp_bonus ?? 0) + sumTalentMaxBonus(c.talents, "hp"),
      stamina: (c.origin_sta_bonus ?? 0) + sumTalentMaxBonus(c.talents, "stamina"),
      ip: (c.origin_ip_bonus ?? 0) + sumTalentMaxBonus(c.talents, "ip"),
      humanity: c.origin_humanity_bonus ?? 0,
    },
    impact,
  );
  return { ...d, effectiveStats: effective };
}
