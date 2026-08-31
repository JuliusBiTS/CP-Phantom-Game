import { describe, it, expect } from "vitest";
import {
  rollPW,
  pwDiceCaps,
  pwDiceCount,
  meleeOrRangedDamage,
  type PwRoll,
} from "./rollPW";

/** Deterministic d20 that yields a fixed script, then repeats its last value. */
function scripted(values: number[]): () => number {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

describe("pwDiceCaps / pwDiceCount", () => {
  it("PW ≤ 20 → one die capped at PW (or 20)", () => {
    expect(pwDiceCaps(1)).toEqual([1]);
    expect(pwDiceCaps(15)).toEqual([15]);
    expect(pwDiceCaps(20)).toEqual([20]);
  });
  it("PW 45 → [20, 20, 5] (the rulebook v12 §2.1 example)", () => {
    expect(pwDiceCaps(45)).toEqual([20, 20, 5]);
  });
  it("exact multiples of 20 get no remainder die", () => {
    expect(pwDiceCaps(40)).toEqual([20, 20]);
    expect(pwDiceCaps(60)).toEqual([20, 20, 20]);
  });
  it("pwDiceCount matches cap array length for PW > 0", () => {
    for (const pw of [1, 12, 20, 21, 40, 45, 61, 99]) {
      expect(pwDiceCount(pw)).toBe(pwDiceCaps(pw).length);
    }
  });
});

describe("rollPW — the rulebook v12 §2.1 worked example", () => {
  it("PW 45, roll 14+12+7 → only 14 and 12 count → 26", () => {
    const r = rollPW(45, { roll: scripted([14, 12, 7]) });
    expect(r.caps).toEqual([20, 20, 5]);
    expect(r.dice).toEqual([14, 12, 7]);
    expect(r.counted).toEqual([14, 12, 0]); // 7 > cap 5 → contributes nothing
    expect(r.total).toBe(26);
    expect(r.outcome).toBe("hit");
  });
});

describe("rollPW — crit semantics (v12 §2.2)", () => {
  it("first die natural 1 → crit success, no numeric total", () => {
    const r = rollPW(45, { roll: scripted([1, 19, 4]) });
    expect(r.outcome).toBe("crit-success");
    expect(r.total).toBeNull();
  });
  it("first die natural 20 → crit fail, no numeric total", () => {
    const r = rollPW(45, { roll: scripted([20, 3, 2]) });
    expect(r.outcome).toBe("crit-fail");
    expect(r.total).toBeNull();
  });
  it("2nd+ die natural 1 counts its own cap", () => {
    // caps [20,20,5]; dice [10, 1, 1] → 10 + 20 + 5 = 35
    const r = rollPW(45, { roll: scripted([10, 1, 1]) });
    expect(r.counted).toEqual([10, 20, 5]);
    expect(r.total).toBe(35);
  });
  it("2nd+ die natural 20 is dropped", () => {
    // caps [20,20]; dice [11, 20] → 11 + 0 = 11
    const r = rollPW(40, { roll: scripted([11, 20]) });
    expect(r.counted).toEqual([11, 0]);
    expect(r.total).toBe(11);
  });
  it("a 1 and a 20 in the same roll cancel and reroll both", () => {
    // caps [20,20]: first pass [1, 20] cancels → reroll both → [8, 9]
    const r = rollPW(40, { roll: scripted([1, 20, 8, 9]) });
    expect(r.rerollPasses).toBe(1);
    expect(r.dice).toEqual([8, 9]);
    expect(r.total).toBe(17);
    expect(r.outcome).toBe("hit");
  });
});

describe("rollPW — single-die low PW", () => {
  it("a single capped die that rolls over its cap → miss", () => {
    const r = rollPW(12, { roll: scripted([17]) });
    expect(r.caps).toEqual([12]);
    expect(r.counted).toEqual([0]);
    expect(r.total).toBe(0);
    expect(r.outcome).toBe("miss");
  });
  it("a single capped die at or under its cap → hit", () => {
    const r = rollPW(12, { roll: scripted([9]) });
    expect(r.total).toBe(9);
    expect(r.outcome).toBe("hit");
  });
});

describe("meleeOrRangedDamage (v12 §2.3)", () => {
  it("subtracts armor, floors at 1", () => {
    expect(meleeOrRangedDamage(26, 5, 11)).toBe(20);
    expect(meleeOrRangedDamage(8, 3, 40)).toBe(1); // armor eats it, min 1
  });
});

describe("rollPW — statistical sanity of the CSPRNG (§9 test 4)", () => {
  it("PW 20 over 4000 real rolls looks like a fair d20, not 'dramatic'", () => {
    const N = 4000;
    const counts = new Array(21).fill(0);
    let critS = 0;
    let critF = 0;
    let sum = 0;
    let hits = 0;
    for (let i = 0; i < N; i++) {
      const r: PwRoll = rollPW(20); // real crypto RNG, no injected roll
      counts[r.dice[0]]++;
      if (r.outcome === "crit-success") critS++;
      else if (r.outcome === "crit-fail") critF++;
      else {
        sum += r.total ?? 0;
        hits++;
      }
    }
    // Each face ~5% (200/4000). Allow a wide band — this catches a broken RNG,
    // not a slightly unlucky run.
    for (let face = 1; face <= 20; face++) {
      expect(counts[face]).toBeGreaterThan(120);
      expect(counts[face]).toBeLessThan(300);
    }
    // 1s and 20s each ~5%.
    expect(critS / N).toBeGreaterThan(0.03);
    expect(critS / N).toBeLessThan(0.07);
    expect(critF / N).toBeGreaterThan(0.03);
    expect(critF / N).toBeLessThan(0.07);
    // Mean of a non-crit single d20 roll (faces 2..19) is ~10.5.
    const mean = sum / hits;
    expect(mean).toBeGreaterThan(9);
    expect(mean).toBeLessThan(12);
  });
});
