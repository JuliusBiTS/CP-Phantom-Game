/**
 * THE REAL DICE ENGINE — SOLO_MODE_BUILD_PLAN.md §5.7.
 *
 * Every roll for an entity that is NOT the player's own PC (enemies, NPCs,
 * allies, companions, drones, environmental checks) comes from here. The LLM
 * receives the returned object as data and narrates *that* — it never picks or
 * fudges a number, and it must not describe an outcome before this has run.
 *
 * The cap / crit semantics are ported verbatim from CP Phantom's authoritative
 * implementation (`index.html` → `rollInitiative` / `pwDiceCount`), which is
 * itself rulebook v12 §2.1–2.2:
 *
 *   - PW → one full d20 per complete multiple of 20, plus one capped remainder
 *     die for the leftover (a d20 that only "counts" up to the remainder value).
 *   - A non-first die that rolls ABOVE its cap contributes 0 — not the cap.
 *     (v12 example: PW 45 → caps [20,20,5]; roll 14+12+7 → only 14+12 count → 26.)
 *   - First die natural 1  → whole-roll CRIT SUCCESS.
 *   - First die natural 20 → whole-roll CRIT FAIL.
 *   - 2nd+ die natural 1  → that die counts its own cap (its max).
 *   - 2nd+ die natural 20 → that die is dropped entirely.
 *   - A 1 and a 20 in the same roll (different dice) cancel — reroll both.
 *
 * Only the RNG differs from CP Phantom: this uses crypto (CSPRNG) instead of
 * Math.random, so an NPC's d20 is a genuine uniform draw.
 */

export type RollOutcome = "crit-success" | "crit-fail" | "hit" | "miss";

export interface PwRoll {
  /** PW the roll was made against (already fully modified — see rules/pw.ts). */
  pw: number;
  /** Per-die cap values, in order. `dice[i]` was rolled against `caps[i]`. */
  caps: number[];
  /** Raw d20 face values, after any 1&20 cancel-rerolls. */
  dice: number[];
  /** What each die contributed to the total (0 = missed its cap or dropped). */
  counted: number[];
  /** Sum of `counted`. `null` on a crit (success or fail) — no numeric total. */
  total: number | null;
  outcome: RollOutcome;
  /** How many cancel-reroll passes the 1&20 rule triggered (usually 0). */
  rerollPasses: number;
}

/** Uniform integer in [1, sides] from the platform CSPRNG (rejection sampling). */
function cryptoDie(sides = 20): number {
  const g: Crypto | undefined =
    typeof globalThis !== "undefined" ? (globalThis.crypto as Crypto) : undefined;
  if (!g || typeof g.getRandomValues !== "function") {
    throw new Error(
      "rollPW: no Web Crypto available — the dice engine must not fall back to Math.random",
    );
  }
  const maxUnbiased = Math.floor(0xffffffff / sides) * sides;
  const buf = new Uint32Array(1);
  let x: number;
  do {
    g.getRandomValues(buf);
    x = buf[0];
  } while (x >= maxUnbiased);
  return (x % sides) + 1;
}

/**
 * Cap values for a PW, matching CP Phantom's `rollInitiative`:
 * `full` dice capped at 20, plus one remainder die when PW isn't a multiple of
 * 20 (or when there are no full dice at all, e.g. PW ≤ 20).
 */
export function pwDiceCaps(pw: number): number[] {
  const safe = Math.max(pw || 0, 0);
  const full = Math.floor(safe / 20);
  const remainder = safe % 20;
  const caps: number[] = [];
  for (let i = 0; i < full; i++) caps.push(20);
  if (remainder > 0 || caps.length === 0) caps.push(remainder);
  return caps;
}

/** Dice count for a PW — `index.html` → `pwDiceCount`. */
export function pwDiceCount(pw: number): number {
  if (pw <= 0) return 1;
  return Math.ceil(pw / 20);
}

/** Roll `count` d20s, then apply the "1 and 20 cancel, reroll both" rule. */
function rollDiceWithCancel(count: number, roll: () => number): { dice: number[]; passes: number } {
  const dice = Array.from({ length: count }, roll);
  let passes = 0;
  for (let guard = 0; guard < 10; guard++) {
    const i1 = dice.indexOf(1);
    const i20 = dice.indexOf(20);
    if (i1 === -1 || i20 === -1) break;
    dice[i1] = roll();
    dice[i20] = roll();
    passes++;
  }
  return { dice, passes };
}

export interface RollPwOptions {
  /** Inject a deterministic d20 for tests. Defaults to the CSPRNG. */
  roll?: () => number;
}

/**
 * Roll a fully-modified PW. `pw` must already have talents/wounds/distance/etc.
 * folded in — use `rules/pw.ts` helpers upstream, not this function.
 */
export function rollPW(pw: number, opts: RollPwOptions = {}): PwRoll {
  const roll = opts.roll ?? (() => cryptoDie(20));
  const caps = pwDiceCaps(pw);
  const { dice, passes } = rollDiceWithCancel(caps.length, roll);

  if (dice[0] === 1) {
    return {
      pw, caps, dice,
      counted: dice.map(() => 0),
      total: null,
      outcome: "crit-success",
      rerollPasses: passes,
    };
  }
  if (dice[0] === 20) {
    return {
      pw, caps, dice,
      counted: dice.map(() => 0),
      total: null,
      outcome: "crit-fail",
      rerollPasses: passes,
    };
  }

  const counted = dice.map((r, i) => {
    const cap = caps[i];
    if (i === 0) return r <= cap ? r : 0;
    if (r === 1) return cap; // 2nd+ die natural 1 → counts its cap
    if (r === 20) return 0; // 2nd+ die natural 20 → dropped
    return r <= cap ? r : 0;
  });

  const total = counted.reduce((a, b) => a + b, 0);
  const anyHit = counted.some((c) => c > 0);
  return {
    pw, caps, dice, counted, total,
    outcome: anyHit ? "hit" : "miss",
    rerollPasses: passes,
  };
}

/**
 * Damage for a landed hit — rulebook v12 §2.3.
 * damage = rollTotal + weaponBonus − targetArmor, min 1 per hit (armor can
 * reduce to 0, but a hit that connects always deals ≥ 1). Armor ablation
 * (−1 temp SP per hit) is tracked on the target elsewhere, not here.
 */
export function meleeOrRangedDamage(
  rollTotal: number,
  weaponBonus: number,
  targetArmorSP: number,
): number {
  const raw = rollTotal + weaponBonus - Math.max(0, targetArmorSP);
  return Math.max(1, raw);
}
