/**
 * Critical injuries — rulebook v12 §13. Two 2d6 tables (body / head).
 *
 * Trigger (§13.1): an attack scores a crit success (first die = 1) AND net
 * damage after armour > 0. Also: every hit while Mortally Wounded. The injury
 * deals +5 bonus damage straight to HP (ignores armour/SP), then roll 2d6 here.
 * If that row is already present, take the next row down.
 *
 * Treatment (§13.4): Quick Fix (First Aid / Paramedic roll) suspends the effect
 * until the next fight; permanent healing needs Surgery / higher Paramedic, at a
 * cost keyed to the DV — DV12=100eb, DV15=500eb, DV17=1000eb, DV22=2000eb.
 * Critical injuries do NOT heal on rest.
 */

export type CriticalInjuryTable = "body" | "head";

export interface CriticalInjuryRow {
  roll: number;
  name: string;
  effect: string;
  quickFix: string;
  fullFix: string;
  /** Permanent addition to the base Death Save penalty until fully healed. */
  deathSavePenalty?: number;
}

export const CRIT_INJURY_BODY: CriticalInjuryRow[] = [
  { roll: 2, name: "Severed Arm", effect: "Arm gone. Held items drop. No two-handed weapons.", quickFix: "not possible", fullFix: "Surgery DV 22", deathSavePenalty: 1 },
  { roll: 3, name: "Severed Hand", effect: "Hand gone. Held items drop.", quickFix: "not possible", fullFix: "Surgery DV 22", deathSavePenalty: 1 },
  { roll: 4, name: "Collapsed Lung", effect: "−2 Speed (min 1).", quickFix: "Paramedic DV 15", fullFix: "Surgery DV 17", deathSavePenalty: 1 },
  { roll: 5, name: "Broken Ribs", effect: "Moving >4m re-triggers the +5 bonus damage.", quickFix: "Paramedic DV 12", fullFix: "Paramedic DV 15 or Surgery" },
  { roll: 6, name: "Broken Arm", effect: "Arm unusable. Held items drop.", quickFix: "Paramedic DV 12", fullFix: "Paramedic DV 15 or Surgery" },
  { roll: 7, name: "Foreign Object", effect: "Moving >4m re-triggers the +5 bonus damage.", quickFix: "First Aid / Paramedic DV 12", fullFix: "Quick Fix removes it for good" },
  { roll: 8, name: "Broken Leg", effect: "−4 Speed (min 1).", quickFix: "Paramedic DV 12", fullFix: "Paramedic DV 15 or Surgery" },
  { roll: 9, name: "Torn Muscle", effect: "−2 to all melee attacks.", quickFix: "Paramedic DV 12", fullFix: "Quick Fix removes it for good" },
  { roll: 10, name: "Spinal Injury", effect: "No main action next round.", quickFix: "Paramedic DV 15", fullFix: "Surgery DV 17", deathSavePenalty: 1 },
  { roll: 11, name: "Crushed Fingers", effect: "−4 to all actions with that hand.", quickFix: "Paramedic DV 12", fullFix: "Surgery DV 17" },
  { roll: 12, name: "Severed Leg", effect: "Leg gone. −6 Speed (min 1). Can't dodge.", quickFix: "not possible", fullFix: "Surgery DV 22", deathSavePenalty: 1 },
];

export const CRIT_INJURY_HEAD: CriticalInjuryRow[] = [
  { roll: 2, name: "Lost Eye", effect: "−4 ranged & sight Perception.", quickFix: "not possible", fullFix: "Surgery DV 22", deathSavePenalty: 1 },
  { roll: 3, name: "Brain Injury", effect: "−2 to all actions.", quickFix: "not possible", fullFix: "Surgery DV 22", deathSavePenalty: 1 },
  { roll: 4, name: "Damaged Eye", effect: "−2 ranged & sight Perception.", quickFix: "Paramedic DV 15", fullFix: "Surgery DV 12" },
  { roll: 5, name: "Concussion", effect: "−2 to all actions.", quickFix: "First Aid / Paramedic DV 12", fullFix: "Quick Fix removes it for good" },
  { roll: 6, name: "Broken Jaw", effect: "−4 to any action requiring speech.", quickFix: "Paramedic DV 12", fullFix: "Paramedic or Surgery DV 12" },
  { roll: 7, name: "Foreign Object (Head)", effect: "Moving >4m re-triggers the +5 bonus damage.", quickFix: "First Aid / Paramedic DV 12", fullFix: "Quick Fix removes it for good" },
  { roll: 8, name: "Whiplash", effect: "—", quickFix: "Paramedic DV 12", fullFix: "Paramedic or Surgery DV 12", deathSavePenalty: 1 },
  { roll: 9, name: "Skull Fracture", effect: "Head hits deal ×3 instead of ×2.", quickFix: "Paramedic DV 15", fullFix: "Paramedic or Surgery DV 15", deathSavePenalty: 1 },
  { roll: 10, name: "Hearing Damage", effect: "Moving >4m: no movement next round. −2 hearing Perception.", quickFix: "Paramedic DV 12", fullFix: "Surgery DV 12" },
  { roll: 11, name: "Crushed Windpipe", effect: "Cannot speak.", quickFix: "not possible", fullFix: "Surgery DV 17", deathSavePenalty: 1 },
  { roll: 12, name: "Lost Ear", effect: "Like Hearing Damage, but −4 Perception.", quickFix: "not possible", fullFix: "Surgery DV 22", deathSavePenalty: 1 },
];

export function critInjuryRows(table: CriticalInjuryTable): CriticalInjuryRow[] {
  return table === "head" ? CRIT_INJURY_HEAD : CRIT_INJURY_BODY;
}

/** Look up a row, clamping the roll to 2–12. */
export function critInjuryRow(table: CriticalInjuryTable, roll: number): CriticalInjuryRow {
  const rows = critInjuryRows(table);
  const clamped = Math.max(2, Math.min(12, Math.round(roll)));
  return rows.find((r) => r.roll === clamped) ?? rows[rows.length - 1];
}

/**
 * §13.1 "already present → next row down". Given a rolled row and the injuries
 * the character already has on that table, walk down until we hit a free row.
 */
export function resolveCritInjury(
  table: CriticalInjuryTable,
  roll: number,
  existing: Array<{ table: string; name: string }>,
): CriticalInjuryRow {
  const rows = critInjuryRows(table);
  const have = new Set(existing.filter((e) => e.table === table).map((e) => e.name));
  let idx = rows.findIndex((r) => r.roll === Math.max(2, Math.min(12, Math.round(roll))));
  if (idx < 0) idx = rows.length - 1;
  for (let step = 0; step < rows.length; step++) {
    const r = rows[(idx - step + rows.length) % rows.length];
    if (!have.has(r.name)) return r;
  }
  return rows[idx];
}

/** §13.4 surgery cost, keyed off the DV mentioned in the fullFix text. */
export function surgeryCostEb(fullFix: string): number {
  const m = fullFix.match(/DV\s*(\d+)/);
  const dv = m ? Number(m[1]) : 12;
  if (dv >= 22) return 2000;
  if (dv >= 17) return 1000;
  if (dv >= 15) return 500;
  return 100;
}

export const BONUS_HP_DAMAGE = 5;
