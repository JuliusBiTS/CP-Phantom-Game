import { describe, it, expect } from "vitest";
import { computeLeafWrite, AUTO_APPLY_KINDS } from "./pushback";

/**
 * The safety-critical path: what a GM-approved change actually writes to a live
 * CP Phantom character. Only 4 kinds may auto-apply, always as a single leaf
 * field, always computed from the current value.
 */
describe("computeLeafWrite — GM push-back", () => {
  const char = { globalXP: 1200, humanity_current: 40, humanity_max: 50, inventory: [{ name: "a" }], notes: "existing" };

  it("only xp / humanity / loot / note can auto-apply", () => {
    expect([...AUTO_APPLY_KINDS].sort()).toEqual(["humanity", "loot", "note", "xp"]);
    for (const kind of ["talent", "injury", "other"] as const) {
      expect(computeLeafWrite(kind, {}, char)).toHaveProperty("error");
    }
  });

  it("xp adds to the current globalXP, writing only that leaf", () => {
    const w = computeLeafWrite("xp", { globalXP: 450 }, char);
    expect(w).toMatchObject({ field: "globalXP", before: 1200, after: 1650, value: 1650 });
  });

  it("humanity subtracts and clamps at 0", () => {
    expect(computeLeafWrite("humanity", { humanity: 6 }, char)).toMatchObject({ field: "humanity_current", after: 34 });
    expect(computeLeafWrite("humanity", { humanity: 999 }, char)).toMatchObject({ after: 0 });
  });

  it("loot appends to inventory, never replaces", () => {
    const w = computeLeafWrite("loot", { name: "Militech Pistol", qty: 1 }, char);
    if ("error" in w) throw new Error(w.error);
    expect((w.value as unknown[]).length).toBe(2);
    expect((w.value as Array<{ name: string }>)[0].name).toBe("a"); // original kept
  });

  it("note appends to existing notes with a dated tag", () => {
    const w = computeLeafWrite("note", { note: "Killed a Militech patrol" }, char);
    if ("error" in w) throw new Error(w.error);
    expect(String(w.value)).toMatch(/^existing\n\n\[solo \d{4}-\d\d-\d\d\] Killed a Militech patrol$/);
  });

  it("rejects empty / malformed patches instead of writing garbage", () => {
    expect(computeLeafWrite("xp", {}, char)).toHaveProperty("error");
    expect(computeLeafWrite("xp", { globalXP: 0 }, char)).toHaveProperty("error");
    expect(computeLeafWrite("humanity", {}, char)).toHaveProperty("error");
    expect(computeLeafWrite("loot", {}, char)).toHaveProperty("error");
    expect(computeLeafWrite("note", { note: "  " }, char)).toHaveProperty("error");
  });

  it("never returns a field outside the four allowed leaves", () => {
    const allowed = new Set(["globalXP", "humanity_current", "inventory", "notes"]);
    for (const [kind, patch] of [
      ["xp", { xp: 10 }],
      ["humanity", { humanity: 1 }],
      ["loot", { name: "x" }],
      ["note", { note: "x" }],
    ] as const) {
      const w = computeLeafWrite(kind, patch, char);
      if ("error" in w) throw new Error(w.error);
      expect(allowed.has(w.field)).toBe(true);
    }
  });
});
