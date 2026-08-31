import { describe, it, expect } from "vitest";
import { applyDelta } from "./delta";
import { newCampaignState, type CampaignState } from "./campaignState";

function base(): CampaignState {
  return newCampaignState({ id: "c", name: "T", mode: "gigs", character: { name: "V", stats: {}, hp_max: 30, hp_current: 30 } });
}

describe("applyDelta — suggestedActions", () => {
  it("replaces the set each turn and caps at 4", () => {
    let s = applyDelta(base(), { suggestedActions: ["a", "b", "c"] });
    expect(s.suggestedActions).toEqual(["a", "b", "c"]);
    s = applyDelta(s, { suggestedActions: ["x", "y", "z", "w", "v"] });
    expect(s.suggestedActions).toEqual(["x", "y", "z", "w"]);
  });

  it("leaves the set untouched when the delta omits it", () => {
    const s1 = applyDelta(base(), { suggestedActions: ["keep me"] });
    const s2 = applyDelta(s1, { pcHpChange: -1 });
    expect(s2.suggestedActions).toEqual(["keep me"]);
  });
});

describe("applyDelta — mode + downtime clock", () => {
  it("enters and exits sub-modes", () => {
    let s = applyDelta(base(), { mode: { enter: "downtime" } });
    expect(s.mode).toBe("downtime");
    s = applyDelta(s, { mode: { exit: true } });
    expect(s.mode).toBe("exploration");
  });

  it("exit wins if both are somehow set, then enter re-applies", () => {
    // exit is processed first, then enter — net effect: enter
    const s = applyDelta(base(), { mode: { exit: true, enter: "netrun" } });
    expect(s.mode).toBe("netrun");
  });

  it("advanceDays accrues on the lifetime counter and logs", () => {
    let s = applyDelta(base(), { advanceDays: 2 });
    expect(s.downtime.daysElapsed).toBe(2);
    s = applyDelta(s, { advanceDays: 3 });
    expect(s.downtime.daysElapsed).toBe(5);
    expect(s.sessionLog.some((l) => l.type === "system" && l.text.includes("3 days pass"))).toBe(true);
  });

  it("ignores non-positive advanceDays", () => {
    const s = applyDelta(base(), { advanceDays: 0 });
    expect(s.downtime.daysElapsed).toBe(0);
    expect(s.sessionLog).toHaveLength(0);
  });
});

describe("applyDelta — M4 aftermath", () => {
  it("advanceDays in downtime is a full rest (HP restored, injuries persist)", () => {
    let s = base();
    s.mode = "downtime";
    s.character.hp_current = 5;
    s.character.criticalInjuries = [{ id: "ci1", table: "body", roll: 8, name: "Broken Leg", effect: "-4 Speed", fullFix: "Surgery", treatment: "untreated" }];
    s = applyDelta(s, { advanceDays: 2 });
    expect(s.character.hp_current).toBe(30);
    expect(s.character.criticalInjuries).toHaveLength(1);
  });

  it("advanceDays outside downtime does NOT heal", () => {
    let s = base();
    s.character.hp_current = 5;
    s = applyDelta(s, { advanceDays: 3 });
    expect(s.character.hp_current).toBe(5);
  });

  it("healing a critical injury refunds its death save penalty", () => {
    let s = base();
    s.character.deathSavePenalty = 1;
    s.character.criticalInjuries = [{ id: "ci1", table: "body", roll: 2, name: "Severed Arm", effect: "", fullFix: "Surgery DV 22", treatment: "untreated" }];
    s = applyDelta(s, { pcCriticalInjury: { treatId: "ci1", to: "healed" } });
    expect(s.character.criticalInjuries![0].treatment).toBe("healed");
    expect(s.character.deathSavePenalty).toBe(0);
  });

  it("installCyberware appends chrome and drops current Humanity", () => {
    let s = base();
    s.character.humanity_current = 14;
    s.character.humanity_max = 20;
    s = applyDelta(s, { installCyberware: { name: "Sandevistan", humanityLoss: 2 } });
    expect(s.character.cyberware).toContain("Sandevistan");
    expect(s.character.humanity_current).toBe(12);
  });

  it("economy: eddie changes clamp at 0; rent auto-deducts every 30 days", () => {
    let s = base();
    s.character.eurodollar = 100;
    s = applyDelta(s, { economy: { eddieChange: -500 } });
    expect(s.character.eurodollar).toBe(0);

    s.character.eurodollar = 2000;
    s.mode = "downtime";
    s = applyDelta(s, { economy: { setLifestyle: { tier: "decent", rentPerMonth: 1500 } } });
    s = applyDelta(s, { advanceDays: 31 });
    expect(s.character.eurodollar).toBe(500); // 2000 - 1500 rent
    expect(s.character.lifestyle!.paidThroughDay).toBe(30);
  });
});
