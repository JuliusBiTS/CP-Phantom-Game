import { describe, it, expect } from "vitest";
import {
  computeWeaponPw,
  computeReactionPw,
  getEffectiveStats,
  resolveArmorSP,
  diceInstruction,
  pcPwReference,
  type LiveChar,
} from "./live";

const base: LiveChar = {
  name: "V",
  hp_max: 40,
  hp_current: 40,
  stats: { reflexes: 8, cool: 6, dexterity: 7, strength: 5, drive: 4, grit: 4, focus: 5, senses: 6 },
  weapons: [{ name: "Heavy Pistol", bonus: 5 }],
};

describe("getEffectiveStats — cyberware bonus (ported)", () => {
  it("adds Reflex Booster +3 reflexes", () => {
    const c = { ...base, cyberware: ["Reflex Booster"] };
    expect(getEffectiveStats(c).reflexes).toBe(11);
  });
  it("is case-insensitive and additive", () => {
    const c = { ...base, cyberware: ["cyberarm", "Grafted Muscles"] };
    expect(getEffectiveStats(c).strength).toBe(5 + 2 + 3);
  });
});

describe("computeWeaponPw — order of operations (matches computeLiveWeaponStats)", () => {
  it("base PW = effective stat pair sum", () => {
    const r = computeWeaponPw(base, "Heavy Pistol")!;
    expect(r.statPair).toBe("Ref+Cool");
    expect(r.basePw).toBe(14);
    expect(r.finalPw).toBe(14);
    expect(r.weaponBonus).toBe(5);
    expect(r.diceCount).toBe(1);
  });

  it("folds in cyberware before the stat sum", () => {
    const r = computeWeaponPw({ ...base, cyberware: ["reflex booster"] }, "Heavy Pistol")!;
    expect(r.finalPw).toBe(17);
  });

  it("adds always-on talent PW mods, scope-matched to the weapon", () => {
    const c: LiveChar = {
      ...base,
      talents: [{ name: "Weapon Focus", mods: [{ appliesTo: "pw", amount: 3, scope: "ranged" }] }],
    };
    expect(computeWeaponPw(c, "Heavy Pistol")!.finalPw).toBe(17);
    // Same talent must NOT apply to a melee weapon
    const cMelee = { ...c, weapons: [{ name: "Knife" }] };
    expect(computeWeaponPw(cMelee, "Knife")!.talentPwBonus).toBe(0);
  });

  it("does not auto-apply conditional talent mods, but names them as situational", () => {
    const c: LiveChar = {
      ...base,
      talents: [{ name: "First Bullet", mods: [{ appliesTo: "pw", amount: 4, scope: "ranged", conditional: true }] }],
    };
    const r = computeWeaponPw(c, "Heavy Pistol")!;
    expect(r.talentPwBonus).toBe(0);
    expect(r.situational.some((s) => s.includes("First Bullet"))).toBe(true);
  });

  it("Smart-tech level 2 → +6 PW, −1 weapon bonus", () => {
    const c: LiveChar = { ...base, weapons: [{ name: "Heavy Pistol", bonus: 5, tech: "smart", techLevel: 2 }] };
    const r = computeWeaponPw(c, "Heavy Pistol")!;
    expect(r.smartPwBonus).toBe(6);
    expect(r.finalPw).toBe(20);
    expect(r.weaponBonus).toBe(4);
  });

  it("applies the wound-state multiplier LAST, floored", () => {
    // hp 18/40 = 45% → Seriously Wounded ×0.8. (14) * 0.8 = 11.2 → 11
    const r = computeWeaponPw({ ...base, hp_current: 18 }, "Heavy Pistol")!;
    expect(r.woundMultiplier).toBe(0.8);
    expect(r.finalPw).toBe(11);
  });

  it("surfaces range bands for ranged weapons", () => {
    const r = computeWeaponPw(base, "Heavy Pistol")!;
    expect(r.range).toEqual({ effectiveM: 15, maxM: 50 });
  });
});

describe("computeReactionPw — Drive+Reflexes (CP Phantom, not the book's Speed+Reflexes)", () => {
  it("sums drive + reflexes", () => {
    expect(computeReactionPw(base).finalPw).toBe(12);
    expect(computeReactionPw(base).statPair).toBe("Drive+Reflexes");
  });
});

describe("diceInstruction", () => {
  it("PW 45 → 2 full + 1 capped-at-5", () => {
    expect(diceInstruction(45)).toBe("roll 2×d20 (counts to 20) + 1×d20 (counts to 5)");
  });
  it("PW 12 → single capped die", () => {
    expect(diceInstruction(12)).toBe("roll 1×d20 (counts to 12)");
  });
  it("PW 40 → exactly 2 full dice, no remainder die", () => {
    expect(diceInstruction(40)).toBe("roll 2×d20 (counts to 20)");
  });
});

describe("resolveArmorSP", () => {
  it("prefers sp_temp, then sp_base, then the catalog by name", () => {
    expect(resolveArmorSP({ armor_body: { sp_temp: 9, sp_base: 13 } })).toBe(9);
    expect(resolveArmorSP({ armor_body: { sp_base: 13 } })).toBe(13);
    expect(resolveArmorSP({ armor_body: { name: "Medium Armorjack" } })).toBe(13);
    expect(resolveArmorSP({})).toBe(0);
  });
});

describe("pcPwReference — assembled block", () => {
  it("includes every carried weapon, reaction, skills, armor", () => {
    const ref = pcPwReference({ ...base, weapons: [{ name: "Heavy Pistol" }, { name: "Knife" }], armor_body: { name: "Light Armorjack" } });
    expect(ref.weapons.map((w) => w.weapon).sort()).toEqual(["Heavy Pistol", "Knife"]);
    expect(ref.reaction.finalPw).toBe(12);
    expect(ref.skills.length).toBeGreaterThan(4);
    expect(ref.armorSP.body).toBe(11);
  });
});
