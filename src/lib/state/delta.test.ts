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

describe("applyDelta — M6 combat depth", () => {
  function inCombat(): CampaignState {
    const s = base();
    s.combat = {
      active: true,
      round: 1,
      turnIndex: 0,
      order: [
        { id: "PC", name: "V", isPC: true, role: "pc", initiative: 15, initiativeOutcome: "hit", cover: "none", coverHp: null, rangeFromPcM: null, zoneId: "bar" },
        { id: "g1", name: "Ganger", isPC: false, role: "enemy", initiative: 10, initiativeOutcome: "hit", cover: "none", coverHp: null, rangeFromPcM: 8, zoneId: "door" },
      ],
      pcTargetId: "g1",
      lastPcAction: null,
      zones: [{ id: "bar", name: "The bar" }, { id: "door", name: "Front door" }],
      overwatch: [],
      flinkUsed: false,
    };
    return s;
  }

  it("sets enemy intent and moves combatants between zones", () => {
    let s = inCombat();
    s = applyDelta(s, { combat: { intents: [{ combatantId: "g1", intent: "charging the bar" }], moves: [{ combatantId: "g1", toZoneId: "bar" }] } });
    expect(s.combat.order[1].intent).toBe("charging the bar");
    expect(s.combat.order[1].zoneId).toBe("bar");
  });

  it("cover HP: set from the §18.2 table, then shoot it down to nothing", () => {
    let s = inCombat();
    s = applyDelta(s, { combat: { setCover: [{ combatantId: "g1", material: "wood" }] } });
    expect(s.combat.order[1].coverHp).toBe(20);
    expect(s.combat.order[1].cover).toBe("behind");
    s = applyDelta(s, { combat: { coverDamage: [{ combatantId: "g1", amount: 25 }] } });
    expect(s.combat.order[1].coverHp).toBeNull();
    expect(s.combat.order[1].cover).toBe("none");
    expect(s.sessionLog.some((l) => l.text.includes("shot to pieces"))).toBe(true);
  });

  it("overwatch: arm and clear; flink flag; end resets it all", () => {
    let s = inCombat();
    s = applyDelta(s, { combat: { overwatch: { set: [{ combatantId: "g1", trigger: "anyone breaks cover", weapon: "SMG" }] }, flinkUsed: true } });
    expect(s.combat.overwatch).toHaveLength(1);
    expect(s.combat.flinkUsed).toBe(true);
    s = applyDelta(s, { combat: { overwatch: { clearIds: ["g1"] } } });
    expect(s.combat.overwatch).toHaveLength(0);
    s = applyDelta(s, { combat: { end: true } });
    expect(s.combat.flinkUsed).toBe(false);
    expect(s.combat.zones).toHaveLength(0);
  });
});

describe("applyDelta — M9 apartment + campaign plan", () => {
  it("apartment: buy, upgrade, stash / unstash, visitors", () => {
    let s = base();
    s.character.inventory = ["a spare rifle", "burner phone"];
    s = applyDelta(s, { apartment: { set: { owned: true, name: "V's conapt", district: "Watson", tier: "cheap" }, addUpgrade: "workbench" } });
    expect(s.apartment.owned).toBe(true);
    expect(s.apartment.upgrades).toEqual(["workbench"]);

    s = applyDelta(s, { apartment: { stashItem: "a spare rifle" } });
    expect(s.apartment.stash).toContain("a spare rifle");
    expect(s.character.inventory).toEqual(["burner phone"]);

    s = applyDelta(s, { apartment: { unstashItem: "a spare rifle" } });
    expect(s.character.inventory).toContain("a spare rifle");
    expect(s.apartment.stash).toHaveLength(0);

    s = applyDelta(s, { apartment: { visitor: { npcId: "rook", reason: "wants his cut" } } });
    expect(s.apartment.visitors).toHaveLength(1);
    s = applyDelta(s, { apartment: { clearVisitor: "rook" } });
    expect(s.apartment.visitors).toHaveLength(0);
  });

  it("campaign plan: set gig status, advance act unlocks that act's gigs", () => {
    let s = base();
    s.campaignPlan = {
      generated: true,
      currentAct: 1,
      acts: [
        { act: 1, goal: "get in", gigs: [{ id: "gig_1_0", act: 1, title: "Case the club", hook: "", contact: "Rook", opposition: "", location: "", advancesTwist: null, payoutEb: 500, status: "available" }] },
        { act: 2, goal: "go deeper", gigs: [{ id: "gig_2_0", act: 2, title: "The heist", hook: "", contact: "Rook", opposition: "", location: "", advancesTwist: 0, payoutEb: 3000, status: "locked" }] },
      ],
    };
    s = applyDelta(s, { campaignPlan: { setGigStatus: [{ id: "gig_1_0", status: "active" }] } });
    expect(s.campaignPlan.acts[0].gigs[0].status).toBe("active");
    s = applyDelta(s, { campaignPlan: { advanceToAct: 2 } });
    expect(s.campaignPlan.currentAct).toBe(2);
    expect(s.campaignPlan.acts[1].gigs[0].status).toBe("available");
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

  it("consequences: add / resolve / escalate; timeline beats append", () => {
    let s = applyDelta(base(), { consequences: { add: [{ text: "Killed a Tyger Claw with witnesses", severity: "major", kind: "enemy" }] } });
    expect(s.consequences).toHaveLength(1);
    const id = s.consequences[0].id;
    s = applyDelta(s, { consequences: { escalateId: id } });
    expect(s.consequences[0].severity).toBe("grave");
    s = applyDelta(s, { consequences: { resolveId: id, resolveNote: "settled with the Claws" } });
    expect(s.consequences[0].status).toBe("resolved");
    expect(s.consequences[0].resolvedNote).toBe("settled with the Claws");

    s = applyDelta(s, { timelineBeat: "Took the Diaz gig." });
    expect(s.timeline.map((b) => b.text)).toEqual(["Took the Diaz gig."]);
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
