import { describe, it, expect } from "vitest";
import { initFromOrigin, applyDelta, finalizeBuild, emptyAllocation, allocationTotals, withAllocation } from "./engine";
import { w20Outcome } from "./tables";

describe("initFromOrigin", () => {
  it("named stats → 3, everything else → 2, origin bonuses set", () => {
    const b = initFromOrigin("street"); // Agility, Reflexes, Stealth, Cool named; HP 10, STA 10, IP 0
    expect(b.stats.agility).toBe(3);
    expect(b.stats.reflexes).toBe(3);
    expect(b.stats.strength).toBe(2);
    expect(b.stats.intelligence).toBe(2);
    expect(b.hpBonus).toBe(10);
    expect(b.ipBonus).toBe(0);
  });

  it("warzone origin carries its −2 humanity", () => {
    expect(initFromOrigin("warzone").humanityBonus).toBe(-2);
  });
});

describe("applyDelta", () => {
  const base = initFromOrigin("academy");

  it("routes humanity/hp/ip/eb to their bonuses, everything else to stats", () => {
    let b = applyDelta(base, { intelligence: 2 });
    expect(b.stats.intelligence).toBe(base.stats.intelligence + 2);
    b = applyDelta(b, { humanity: -1 });
    expect(b.humanityBonus).toBe(base.humanityBonus - 1);
    b = applyDelta(b, { hp: -2 });
    expect(b.hpBonus).toBe(base.hpBonus - 2);
    b = applyDelta(b, { eb: 200 });
    expect(b.eurodollar).toBe(200);
  });

  it("never takes a stat below 0", () => {
    const b = applyDelta(base, { rep: -99 });
    expect(b.stats.rep).toBe(0);
  });
});

describe("w20Outcome — activity result table", () => {
  it("maps rolls to the rulebook bands", () => {
    expect(w20Outcome(1).apply("strength", "grit")).toEqual({ strength: 5 });
    expect(w20Outcome(7).apply("strength", "grit")).toEqual({ strength: 1 });
    expect(w20Outcome(12).apply("strength", "grit")).toEqual({ strength: 2 });
    expect(w20Outcome(16).apply("strength", "grit")).toEqual({ strength: 2, grit: 1 });
    expect(w20Outcome(20).apply("strength", "grit")).toEqual({});
  });
});

describe("free-point allocation", () => {
  it("totals and per-tree sums", () => {
    const a = emptyAllocation();
    a.power.strength = 4;
    a.mind.cool = 3;
    const t = allocationTotals(a);
    expect(t.power).toBe(4);
    expect(t.mind).toBe(3);
    expect(t.all).toBe(7);
  });

  it("folds into stats without mutating the build", () => {
    const b = initFromOrigin("nomad");
    const a = emptyAllocation();
    a.power.strength = 3;
    const merged = withAllocation(b, a);
    expect(merged.strength).toBe(b.stats.strength + 3);
    expect(b.stats.strength).toBe(2); // untouched (nomad doesn't name strength)
  });
});

describe("finalizeBuild — derived stats (v12 §1.3 / §7)", () => {
  it("computes HP/Stamina/IP/Humanity from final stats + origin bonuses", () => {
    // academy: Int/Foc/Cre/Will named (3), rest 2; HP 7, STA 7, IP 16
    let b = initFromOrigin("academy");
    b = applyDelta(b, { grit: 3, core: 3 }); // grit 5, core 5
    const sheet = finalizeBuild(b, "Testrunner", emptyAllocation());
    // HP = grit(5) + core(5) + originHP(7) = 17
    expect(sheet.hp_max).toBe(17);
    expect(sheet.hp_current).toBe(17);
    // Stamina = drive(2) + core(5) + originSTA(7) = 14
    expect(sheet.stamina_max).toBe(14);
    // MindSum = int3+foc3+cre3+will3+cool2+rep2 = 16 → floor(16/5)*2 = 6, + originIP 16 = 22
    expect(sheet.ip_max).toBe(22);
    // Humanity base = clamp(12 + floor((will3+cool2)/2), 15, 30) = clamp(14,15,30) = 15
    expect(sheet.humanity_max).toBe(15);
    expect(sheet.notes).toContain("life-path wizard");
  });
});
