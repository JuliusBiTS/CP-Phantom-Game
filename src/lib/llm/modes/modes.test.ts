import { describe, it, expect } from "vitest";
import { MODES, modePromptFragment, modeContextSlice } from "./index";
import { buildSystemPrompt, buildStateContext } from "../prompt";
import { newCampaignState, Mode, type CampaignState } from "../../state/campaignState";

function base(): CampaignState {
  return newCampaignState({ id: "c", name: "T", mode: "gigs", character: { name: "V", stats: {}, hp_max: 30, hp_current: 30, eurodollar: 900 } });
}

describe("sub-mode framework", () => {
  it("every Mode has a definition and composes without collision", () => {
    for (const m of Mode.options) {
      expect(MODES[m]).toBeDefined();
      const s = base();
      s.mode = m;
      const prompt = buildSystemPrompt(s);
      expect(prompt).toContain("who rolls"); // base survives
      // exploration adds nothing; others add exactly one "## Mode:" header
      const headers = prompt.match(/## Mode:/g) ?? [];
      expect(headers.length).toBe(m === "exploration" ? 0 : 1);
    }
  });

  it("exploration is a no-op fragment", () => {
    const s = base();
    expect(modePromptFragment(s)).toBe("");
    expect(modeContextSlice(s)).toBeUndefined();
  });

  it("downtime injects its loop + a context slice with the day count and eddies", () => {
    const s = base();
    s.mode = "downtime";
    s.downtime.daysElapsed = 4;
    expect(modePromptFragment(s)).toContain("DOWNTIME");
    expect(modeContextSlice(s)).toEqual({ downtime: { daysElapsed: 4 }, eddies: 900 });
    expect(buildStateContext(s)).toContain('"mode": "downtime"');
  });
});
