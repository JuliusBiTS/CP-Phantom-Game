import { describe, it, expect } from "vitest";
import { resolvePw, rangeBand } from "./pw";

describe("resolvePw — v12 §7.7 modifier ordering", () => {
  it("no modifiers → unchanged", () => {
    expect(resolvePw(28)).toBe(28);
  });

  it("Beispiel 1: pistol PW 28 beyond effective range → ÷2 → 14", () => {
    expect(resolvePw(28, [], 1)).toBe(14);
  });

  it("Beispiel 2: PW 28, distance + Snap Shot (2 halving sources) → ÷3 → 9", () => {
    expect(resolvePw(28, [], 2)).toBe(9);
  });

  it("halving is additive not multiplicative: 3 sources → ÷4", () => {
    expect(resolvePw(40, [], 3)).toBe(10);
  });

  it("flat mods apply before halving", () => {
    // (28 - 4 aimed shot) ÷ 2 = 12
    expect(resolvePw(28, [-4], 1)).toBe(12);
  });

  it("rounds down once, only after division", () => {
    // (27) ÷ 2 = 13.5 → 13
    expect(resolvePw(27, [], 1)).toBe(13);
  });

  it("never drops below 1 for an allowed attack", () => {
    expect(resolvePw(3, [-10], 2)).toBe(1);
  });
});

describe("rangeBand — v12 §6.4a", () => {
  it("classifies against effective / max thresholds", () => {
    expect(rangeBand(10, 15, 50)).toBe("effective");
    expect(rangeBand(15, 15, 50)).toBe("effective");
    expect(rangeBand(35, 15, 50)).toBe("extended");
    expect(rangeBand(60, 15, 50)).toBe("beyond");
  });
});
