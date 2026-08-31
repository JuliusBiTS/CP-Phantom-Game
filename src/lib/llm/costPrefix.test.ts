import { describe, it, expect } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { stripStaleContext, markCache } from "./turn";
import { buildSystemPrompt, buildStateContext } from "./prompt";
import { newCampaignState, type CampaignState } from "../state/campaignState";

describe("stripStaleContext", () => {
  it("cuts the state blob out of a completed turn's user message, keeps the action", () => {
    const ctx = "# Campaign State (source of truth)\n```json\n{\"a\":1}\n```";
    const msgs: Anthropic.MessageParam[] = [
      { role: "user", content: `${ctx}\n\n---\n\nPlayer action: I open the door.` },
      { role: "assistant", content: "You open it." },
    ];
    const out = stripStaleContext(msgs);
    expect(out[0].content).toBe("Player action: I open the door.");
    expect(out[1]).toBe(msgs[1]);
  });

  it("leaves messages without the marker untouched (tool results, resume messages)", () => {
    const msgs: Anthropic.MessageParam[] = [
      { role: "user", content: "Player action: attack" },
      { role: "user", content: [{ type: "tool_result", tool_use_id: "t1", content: "ok" }] },
    ];
    expect(stripStaleContext(msgs)).toEqual(msgs);
  });
});

describe("markCache", () => {
  it("wraps a string message and marks it", () => {
    const m = markCache({ role: "user", content: "hello" });
    expect(m.content).toEqual([{ type: "text", text: "hello", cache_control: { type: "ephemeral" } }]);
  });

  it("marks the last block of an array message", () => {
    const m = markCache({
      role: "assistant",
      content: [
        { type: "text", text: "a" },
        { type: "text", text: "b" },
      ],
    });
    const blocks = m.content as Array<Record<string, unknown>>;
    expect(blocks[0].cache_control).toBeUndefined();
    expect(blocks[1].cache_control).toEqual({ type: "ephemeral" });
  });
});

describe("bible moved to the cached system prompt", () => {
  function withBible(): CampaignState {
    const s = newCampaignState({ id: "c", name: "T", mode: "campaign", character: { name: "V", stats: {}, hp_max: 30, hp_current: 30 } });
    s.campaignBible = {
      antagonist: "Mr. Blue",
      drivingConflict: "corp war",
      acts: [{ goal: "g", turningPoint: "t" }],
      plantedTwists: [{ twist: "the fixer is a cop", delivered: false }],
      recurringNpcs: [],
    };
    return s;
  }

  it("system prompt carries the bible, per-turn context does not", () => {
    const s = withBible();
    expect(buildSystemPrompt(s)).toContain("the fixer is a cop");
    expect(buildStateContext(s)).not.toContain("the fixer is a cop");
    expect(buildStateContext(s)).not.toContain("campaignBible");
  });

  it("no bible → no bible block", () => {
    const s = newCampaignState({ id: "c", name: "T", mode: "gigs", character: { name: "V", stats: {}, hp_max: 30, hp_current: 30 } });
    expect(buildSystemPrompt(s)).not.toContain("campaign bible (GM-ONLY)");
  });
});
