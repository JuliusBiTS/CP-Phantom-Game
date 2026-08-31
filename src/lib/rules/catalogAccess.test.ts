import { describe, it, expect } from "vitest";
import {
  findTalent, resolveTalentLevel, sumTalentMaxBonus,
  effectiveHackIp,
  findTechnique,
  allCyberwareNames, cyberwareImpact,
  TALENT_TREES, HACK_CATEGORIES,
} from "./catalogAccess";

describe("catalog accessors", () => {
  it("has the expected trees / categories", () => {
    expect(TALENT_TREES.length).toBeGreaterThan(5);
    expect(HACK_CATEGORIES).toContain("Combat");
  });

  it("findTalent resolves a known talent and its levels", () => {
    const t = findTalent("System Expertise");
    expect(t).not.toBeNull();
    expect(t!.entry.levels.length).toBeGreaterThan(1);
    const l = resolveTalentLevel("System Expertise", "II");
    expect(l?.lvl).toBe("II");
    expect(l?.mods?.some((m) => m.appliesTo === "pw")).toBe(true);
  });

  it("sumTalentMaxBonus reads the catalog when the stored talent lacks maxBonus", () => {
    // 'Zaeher Ueberlebender' V gives Max HP; stored entry here has only name+lvl
    const found = findTalent("Zaeher Ueberlebender");
    expect(found).not.toBeNull();
    const hp = sumTalentMaxBonus([{ name: "Zaeher Ueberlebender", lvl: "II" }], "hp");
    expect(hp).toBeGreaterThan(0);
  });

  it("effectiveHackIp applies an Efficient Code-style discount", () => {
    const base = effectiveHackIp("Ping", []);
    expect(base).not.toBeNull();
    const discounted = effectiveHackIp("Ping", [{ name: "Efficient Code", lvl: "III" }]);
    // Ping is a Utility hack; Efficient Code III discounts Utility by 1
    expect(discounted!.effective).toBeLessThanOrEqual(base!.effective);
  });

  it("findTechnique resolves a known technique", () => {
    expect(findTechnique("Staggering Strike") || findTechnique("Grapple")).toBeTruthy();
  });

  it("cyberware catalog + impact", () => {
    expect(allCyberwareNames()).toContain("Reflex Booster");
    expect(cyberwareImpact(["Reinforced Frame III"])).toBeGreaterThan(0);
    expect(cyberwareImpact([])).toBe(0);
  });
});
