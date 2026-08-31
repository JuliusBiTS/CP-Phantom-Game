import { describe, it, expect } from "vitest";
import { applyAutoStatusEffect, tickCombatant, dotDamage } from "./statusEffects";

describe("applyAutoStatusEffect", () => {
  it("adds a new effect, refreshes an existing one by type", () => {
    let e = applyAutoStatusEffect([], { type: "bleed", name: "Bleed", rounds: 3 });
    expect(e).toHaveLength(1);
    e = applyAutoStatusEffect(e, { type: "bleed", name: "Bleed", rounds: 3 });
    expect(e).toHaveLength(1); // refreshed, not duplicated
    expect(e[0].rounds).toBe(3);
  });
  it("stacks only when maxStacks is set", () => {
    let e = applyAutoStatusEffect([], { type: "burn", name: "Burn", rounds: 2, maxStacks: 3 });
    e = applyAutoStatusEffect(e, { type: "burn", name: "Burn", rounds: 2, maxStacks: 3 });
    e = applyAutoStatusEffect(e, { type: "burn", name: "Burn", rounds: 2, maxStacks: 3 });
    e = applyAutoStatusEffect(e, { type: "burn", name: "Burn", rounds: 2, maxStacks: 3 });
    expect(e[0].stacks).toBe(3); // capped
  });
});

describe("dotDamage", () => {
  it("bleed 2, poison 3, burn 2 / 4 at 2+ stacks", () => {
    expect(dotDamage({ type: "bleed", name: "b", rounds: 1 })).toBe(2);
    expect(dotDamage({ type: "poison", name: "p", rounds: 1 })).toBe(3);
    expect(dotDamage({ type: "burn", name: "x", rounds: 1, stacks: 1 })).toBe(2);
    expect(dotDamage({ type: "burn", name: "x", rounds: 1, stacks: 2 })).toBe(4);
  });
});

describe("tickCombatant — the deterministic round tick", () => {
  it("applies DoT, counts durations down, drops expired effects", () => {
    const r = tickCombatant({
      status_effects: [
        { type: "bleed", name: "Bleed", rounds: 2 },
        { type: "poison", name: "Poison", rounds: 1 }, // expires this tick
      ],
      hp_max: 30,
      hp_current: 20,
      stats: { grit: 5 },
    }, "V");
    expect(r.hp_current).toBe(20 - 2 - 3); // bleed 2 + poison 3
    expect(r.status_effects.map((e) => e.type)).toEqual(["bleed"]); // poison gone
    expect(r.status_effects[0].rounds).toBe(1); // 2 → 1
    expect(r.log.some((l) => l.includes("−5 HP"))).toBe(true);
  });

  it("respects the −grit HP floor", () => {
    const r = tickCombatant({
      status_effects: [{ type: "bleed", name: "Bleed", rounds: 5 }],
      hp_max: 10,
      hp_current: 1,
      stats: { grit: 4 },
    });
    expect(r.hp_current).toBe(-1); // 1 - 2, floored at -4
  });

  it("applies per-round talent regen", () => {
    const r = tickCombatant({
      status_effects: [],
      hp_max: 30,
      hp_current: 20,
      ip_max: 20,
      ip_current: 10,
      talents: [{ name: "Jack In", regen_stat: "ip", regen_amount: 3 }],
    });
    expect(r.ip_current).toBe(13);
  });

  it("no-ops cleanly with nothing active", () => {
    const r = tickCombatant({ status_effects: [], hp_max: 20, hp_current: 20 });
    expect(r.hp_current).toBe(20);
    expect(r.log).toEqual([]);
  });
});
