import { describe, it, expect } from "vitest";
import { combatantView } from "./combatant";
import { generateNpcSheet } from "./generate";

describe("combatantView", () => {
  it("reads a PC sheet — HP %, wound state, weapon PW", () => {
    const v = combatantView({
      name: "V",
      stats: { reflexes: 8, cool: 6, drive: 4 },
      hp_max: 40,
      hp_current: 18, // 45% → Seriously Wounded
      weapons: [{ name: "Heavy Pistol" }],
      armor_body: { name: "Light Armorjack" },
    });
    expect(v.type).toBe("PC");
    expect(v.hpPct).toBeCloseTo(0.45);
    expect(v.wound?.name).toBe("Seriously Wounded");
    expect(v.armorSP.body).toBe(11);
    // Heavy Pistol PW = reflexes 8 + cool 6 = 14, then ×0.8 wound → 11
    expect(v.weapons[0].pw).toBe(11);
  });

  it("reads a generated NPC sheet straight through", () => {
    const { sheet } = generateNpcSheet({
      id: "g", name: "Ganger", tier: "THREAT", archetype: "GUNNER", weapons: ["Heavy Pistol"], armorName: "Kevlar Vest",
    });
    const v = combatantView(sheet);
    expect(v.type).toBe("NPC");
    expect(v.hp).toBe(v.hpMax);
    expect(v.generated).toEqual({ tier: "THREAT", archetype: "GUNNER" });
    expect(v.weapons[0].pw).toBe(26); // reflexes 16 + cool 10 for GUNNER/THREAT
    expect(v.armorSP.body).toBe(7);
  });

  it("classifies allies and drones", () => {
    expect(combatantView({ name: "A", isNPC: true, isAlly: true, hp_max: 10 }).type).toBe("Ally");
    expect(combatantView({ name: "D", isDrone: true, hp_max: 10 }).type).toBe("Drone");
  });
});
