import { describe, it, expect } from "vitest";
import { toneFragment, DEFAULT_TONE, TONE_DIALS } from "./tone";
import { buildSystemPrompt } from "./prompt";
import { newCampaignState } from "../state/campaignState";

describe("toneFragment", () => {
  it("emits one guidance line per dial at the selected level", () => {
    const frag = toneFragment({ grit: 3, lethality: 0, gore: 2, romance: 1, wit: 1 });
    expect(frag).toContain("Grit 3/3");
    expect(frag).toContain(TONE_DIALS[0].levels[3]);
    expect(frag).toContain("Lethality 0/3");
    expect(frag).toContain(TONE_DIALS[1].levels[0]);
  });

  it("fills missing dials from the default and clamps out-of-range", () => {
    const frag = toneFragment({ grit: 9 } as never);
    expect(frag).toContain("Grit 3/3"); // clamped
    expect(frag).toContain(`Romance ${DEFAULT_TONE.romance}/3`); // defaulted
  });

  it("is stable for the same tone (cache-safe)", () => {
    expect(toneFragment(DEFAULT_TONE)).toBe(toneFragment({ ...DEFAULT_TONE }));
  });
});

describe("buildSystemPrompt", () => {
  it("appends the campaign's tone block to the base prompt", () => {
    const s = newCampaignState({ id: "c", name: "T", mode: "gigs", character: { name: "V", stats: {}, hp_max: 30, hp_current: 30 } });
    s.meta.tone = { grit: 0, lethality: 0, gore: 0, romance: 0, wit: 3 };
    const p = buildSystemPrompt(s);
    expect(p).toContain("who rolls"); // base prompt still there
    expect(p).toContain("## Tone (player-set");
    expect(p).toContain("Wit 3/3");
  });
});
