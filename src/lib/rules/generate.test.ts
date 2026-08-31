import { describe, it, expect } from "vitest";
import { computeAttributes, generateNpcSheet } from "./generate";

describe("computeAttributes — ported from CP Phantom, deterministic", () => {
  it("same concept → identical block every time", () => {
    const a = computeAttributes("THREAT", "GUNNER");
    const b = computeAttributes("THREAT", "GUNNER");
    expect(a).toEqual(b);
  });

  it("GUNNER / THREAT resolves to the hand-computed spread", () => {
    const a = computeAttributes("THREAT", "GUNNER");
    // power lead 14 → distribute(28, ...) with largest-remainder
    expect(a).toMatchObject({
      power: 14, mobility: 20, mind: 12,
      strength: 4, dexterity: 10, grit: 7, drive: 4, core: 3,
      speed: 6, agility: 6, reflexes: 16, stealth: 4, senses: 8,
      intelligence: 3, focus: 4, creativity: 3, will: 4, cool: 10,
    });
  });

  it("tier scales the leads (GRUNT ≈ 0.55×, BOSS = 2×)", () => {
    const grunt = computeAttributes("GRUNT", "BRUISER");
    const boss = computeAttributes("BOSS", "BRUISER");
    expect(grunt.power).toBe(Math.round(20 * 0.55));
    expect(boss.power).toBe(40);
  });

  it("no sub-stat exceeds its lead (the distribute cap)", () => {
    const a = computeAttributes("BOSS", "SNIPER");
    for (const k of ["strength", "dexterity", "grit", "drive", "core"]) {
      expect(a[k]).toBeLessThanOrEqual(a.power);
    }
  });
});

describe("generateNpcSheet", () => {
  it("computes HP / Stamina / IP / reaction from the attribute spread", () => {
    const { summary } = generateNpcSheet({
      id: "ganger-1", name: "Ganger", tier: "THREAT", archetype: "GUNNER",
      weapons: ["Heavy Pistol"], armorName: "Kevlar Vest",
    });
    // grit 7 + core 3 → round(10 * 1.5) = 15
    expect(summary.hp_max).toBe(15);
    // drive 4 + core 3 → round(7 * 1.5) = 11
    expect(summary.stamina_max).toBe(11);
    // mindSum 24 → floor(24/5)*2 = 8
    expect(summary.ip_max).toBe(8);
    // drive 4 + reflexes 16
    expect(summary.reactionPw).toBe(20);
    expect(summary.armorSP).toBe(7); // Kevlar Vest body
  });

  it("resolves each weapon's PW from the NPC's own stats", () => {
    const { summary } = generateNpcSheet({
      id: "g", name: "G", tier: "THREAT", archetype: "GUNNER", weapons: ["Heavy Pistol"],
    });
    const hp = summary.weapons[0];
    expect(hp.name).toBe("Heavy Pistol");
    expect(hp.statPair).toBe("Ref+Cool");
    expect(hp.pw).toBe(26); // reflexes 16 + cool 10
    expect(hp.weaponBonus).toBe(5);
  });

  it("HEAVY archetype on a GRUNT is downgraded to GUNNER", () => {
    const { summary } = generateNpcSheet({
      id: "h", name: "H", tier: "GRUNT", archetype: "HEAVY", weapons: ["SMG"],
    });
    expect(summary.archetype).toBe("GUNNER");
  });

  it("Subdermal Armor adds +4 SP, not a stat; other cyberware adds stats", () => {
    const plain = generateNpcSheet({ id: "a", name: "A", tier: "THREAT", archetype: "BRUISER", weapons: ["Heavy Melee"], armorName: "Light Armorjack" });
    const subdermal = generateNpcSheet({ id: "b", name: "B", tier: "THREAT", archetype: "BRUISER", weapons: ["Heavy Melee"], armorName: "Light Armorjack", cyberware: ["Subdermal Armor"] });
    expect(subdermal.summary.armorSP).toBe(plain.summary.armorSP + 4);

    const boosted = generateNpcSheet({ id: "c", name: "C", tier: "THREAT", archetype: "BRUISER", weapons: ["Heavy Melee"], cyberware: ["Cyberarm"] });
    expect(boosted.summary.stats.strength).toBe(plain.summary.stats.strength + 2);
  });

  it("produces a CharacterSheet-shaped object marked as an NPC", () => {
    const { sheet } = generateNpcSheet({ id: "x", name: "X", tier: "GRUNT", archetype: "STEALTH", weapons: ["Knife"], role: "enemy" });
    expect(sheet).toMatchObject({ name: "X", isNPC: true, isAlly: false });
    expect(sheet.hp_current).toBe(sheet.hp_max);
    expect(Array.isArray(sheet.weapons)).toBe(true);
  });
});
