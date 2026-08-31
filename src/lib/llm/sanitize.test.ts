import { describe, it, expect } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { sanitizeTranscript } from "./turn";

const asst = (blocks: unknown[] | string): Anthropic.MessageParam => ({ role: "assistant", content: blocks as never });
const user = (blocks: unknown[] | string): Anthropic.MessageParam => ({ role: "user", content: blocks as never });
const tu = (id: string, name = "roll_dice") => ({ type: "tool_use", id, name, input: {} });
const tr = (id: string) => ({ type: "tool_result", tool_use_id: id, content: "ok" });

describe("sanitizeTranscript", () => {
  it("passes a clean transcript through unchanged", () => {
    const t = [user("hi"), asst([tu("a")]), user([tr("a")]), asst([{ type: "text", text: "done" }])];
    expect(sanitizeTranscript(t)).toEqual(t);
  });

  it("heals a MIDDLE orphan — the reported bug (suspend split results across two messages)", () => {
    // assistant emitted roll_dice + request_player_roll; only roll_dice got a result
    const t = [
      asst([tu("roll1"), tu("pr1", "request_player_roll")]),
      user([tr("roll1")]), // pr1 missing!
      user("Player roll result: total 14"),
      asst([{ type: "text", text: "You hit." }]),
    ];
    const out = sanitizeTranscript(t);
    const results = (out[1].content as Array<{ tool_use_id?: string }>).map((b) => b.tool_use_id);
    expect(results).toEqual(["roll1", "pr1"]);
  });

  it("injects a synthetic results message when the next message isn't tool_results at all", () => {
    const t = [asst([tu("x")]), user("just text, no results"), asst([{ type: "text", text: "ok" }])];
    const out = sanitizeTranscript(t);
    expect(out).toHaveLength(4);
    expect((out[1].content as Array<{ tool_use_id?: string }>)[0].tool_use_id).toBe("x");
    expect(out[2].content).toBe("just text, no results");
  });

  it("still drops a trailing dangling tool_use", () => {
    const t = [user("hi"), asst([tu("a")])];
    expect(sanitizeTranscript(t)).toEqual([user("hi")]);
  });

  it("still drops leading orphaned tool_results", () => {
    const t = [user([tr("gone")]), user("hi"), asst([{ type: "text", text: "ok" }])];
    expect(sanitizeTranscript(t)).toEqual([user("hi"), asst([{ type: "text", text: "ok" }])]);
  });
});
