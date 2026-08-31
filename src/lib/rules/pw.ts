/**
 * PW (Probewert) computation helpers — rulebook v12 §2.4 (stat pairs) and the
 * v12 §7.7 modifier-ordering rule that is new in this rulebook version.
 *
 * The heavy per-weapon / per-hack / per-technique PW math (talent mods, wound
 * penalty, attachments, "rallied" buffs) lives in CP Phantom's
 * `computeLiveWeaponStats` family — port those into `rules/live.ts` when Phase 1
 * needs them. This file is only the shared primitives.
 */

/** Base stat-pair table — rulebook v12 §2.4 "Beispiel-Probewerte". */
export const STAT_PAIRS = {
  pistol: ["reflexes", "cool"],
  smg: ["dexterity", "reflexes"],
  assaultRifle: ["dexterity", "reflexes"],
  shotgun: ["strength", "reflexes"],
  heavyWeapon: ["strength", "focus"],
  sniper: ["focus", "senses"],
  meleeLight: ["dexterity", "agility"],
  meleeStandard: ["dexterity", "strength"],
  meleeHeavy: ["strength", "grit"],
  hackRoutine: ["intelligence", "focus"],
  hackExotic: ["intelligence", "creativity"],
  dodge: ["speed", "reflexes"],
  persuade: ["creativity", "cool"],
  intimidate: ["will", "cool"],
} as const satisfies Record<string, readonly [string, string]>;

export type StatPairKey = keyof typeof STAT_PAIRS;

export function pwFromStats(
  stats: Record<string, number | undefined>,
  a: string,
  b: string,
): number {
  return (Number(stats[a]) || 0) + (Number(stats[b]) || 0);
}

/**
 * Rulebook v12 §7.7 "Reihenfolge der Modifikatoren" — the new modifier-ordering
 * rule for this version:
 *
 *   1. Start from the normal PW (stats + talents + cyberware + gear).
 *   2. Apply all fixed ± PW mods (movement, wounds, darkness, marks…).
 *   3. Count all *halving* sources (distance beyond effective range, autofire,
 *      blindfire, a talent-imposed half reaction shot…).
 *   4. With n halving sources, divide the PW by (n + 1). Additive, NOT
 *      multiplicative: 1 source → half, 2 → a third, 3 → a quarter.
 *   5. Round down — once, only after the division.
 *   6. Final PW is at least 1, provided the attack is allowed at all.
 *
 * Range-legality (beyond max range → no attack) is the caller's decision; this
 * assumes the action is permitted and therefore clamps to a minimum of 1.
 */
export function resolvePw(
  basePw: number,
  flatMods: number[] = [],
  halvingSources = 0,
): number {
  const flat = flatMods.reduce((a, b) => a + b, 0);
  let pw = basePw + flat;
  if (halvingSources > 0) pw = pw / (halvingSources + 1);
  pw = Math.floor(pw);
  return Math.max(1, pw);
}

export type RangeBand = "effective" | "extended" | "beyond";

/**
 * Which range band a distance falls in — rulebook v12 §6.4a / §7.7.
 * `effective` = full PW, `extended` = one halving source (half PW),
 * `beyond` = no attack.
 */
export function rangeBand(
  distanceM: number,
  effectiveM: number,
  maxM: number,
): RangeBand {
  if (distanceM <= effectiveM) return "effective";
  if (distanceM <= maxM) return "extended";
  return "beyond";
}

/** Effective / max range thresholds in metres — rulebook v12 §6.4a. */
export const WEAPON_RANGES: Record<string, { effective: number; max: number }> = {
  pistol: { effective: 15, max: 50 },
  smg: { effective: 25, max: 75 },
  shotgun: { effective: 12, max: 30 },
  assaultRifle: { effective: 50, max: 200 },
  lmg: { effective: 100, max: 300 },
  sniper: { effective: 300, max: 1000 },
  launcher: { effective: 100, max: 300 },
  thrownGrenade: { effective: 0, max: 25 },
};
