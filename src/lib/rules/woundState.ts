/**
 * Automated wound state — ported verbatim from CP Phantom's `getWoundState`
 * (`index.html`). This is a deliberate HOUSE RULE that overrides rulebook v12
 * §14.1's flat −2 / −4: a flat malus barely registers against this system's
 * actual PW range (summed d20s per §2), so the malus is a percentage of PW
 * instead, and "Flatlining" (≤10% HP) is a house tier the book doesn't have.
 *
 * Per SOLO_MODE_BUILD_PLAN.md §3.1: follow the CODE here, not the book text.
 */

export interface WoundState {
  key: "serious" | "critical" | "flatlining";
  name: string;
  /** Multiply the entity's PW by this. 0.8 = −20%, 0.6 = −40%. */
  pwMult: number;
  /** Flatlining only: no secondary action this turn. */
  lockSecondary: boolean;
}

export interface WoundInput {
  hp_max?: number;
  hp_current?: number;
  isDrone?: boolean;
  isVehicle?: boolean;
  isCompanion?: boolean;
}

export function getWoundState(c: WoundInput | null | undefined): WoundState | null {
  if (!c || c.isDrone || c.isVehicle || c.isCompanion) return null;
  const hpMax = c.hp_max || 1;
  const hpCur = c.hp_current ?? hpMax;
  if (hpCur <= 0) return null; // that's the Death Save / Dying state, not this
  const pct = hpCur / hpMax;
  if (pct <= 0.1) return { key: "flatlining", name: "Flatlining", pwMult: 0.6, lockSecondary: true };
  if (pct <= 0.25) return { key: "critical", name: "Critically Wounded", pwMult: 0.6, lockSecondary: false };
  if (pct <= 0.5) return { key: "serious", name: "Seriously Wounded", pwMult: 0.8, lockSecondary: false };
  return null;
}

/** Apply the wound-state PW multiplier, flooring (matches CP Phantom display). */
export function applyWoundToPw(pw: number, wound: WoundState | null): number {
  if (!wound) return pw;
  return Math.floor(pw * wound.pwMult);
}
