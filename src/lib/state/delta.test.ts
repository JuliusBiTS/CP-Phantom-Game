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
