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
