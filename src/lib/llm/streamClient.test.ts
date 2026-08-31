import { describe, it, expect, vi, afterEach } from "vitest";
import { runTurnStream, StreamUnavailable } from "./streamClient";

function sseResponse(frames: string[], { chunkAt = 999 }: { chunkAt?: number } = {}): Response {
  const body = frames.join("");
  const bytes = new TextEncoder().encode(body);
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      // Emit in small slices to exercise cross-chunk frame reassembly.
      for (let i = 0; i < bytes.length; i += chunkAt) controller.enqueue(bytes.slice(i, i + chunkAt));
      controller.close();
    },
  });
  return new Response(stream, { headers: { "content-type": "text/event-stream" } });
}

const noop = { onText: () => {}, onRoll: () => {}, onDone: () => {}, onError: () => {} };

afterEach(() => vi.restoreAllMocks());

describe("runTurnStream", () => {
  it("reassembles text/roll/done events split across network chunks", async () => {
    const frames = [
      `event: text\ndata: ${JSON.stringify({ delta: "You step " })}\n\n`,
      `event: text\ndata: ${JSON.stringify({ delta: "into the rain." })}\n\n`,
      `event: roll\ndata: ${JSON.stringify({ actor: "Ganger", total: 14 })}\n\n`,
      `event: done\ndata: ${JSON.stringify({ kind: "turn-complete", narration: "You step into the rain.", rolls: [] })}\n\n`,
    ];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(sseResponse(frames, { chunkAt: 7 })));

    let text = "";
    const rolls: unknown[] = [];
    let done: Record<string, unknown> | null = null;
    await runTurnStream({}, {
      onText: (d) => (text += d),
      onRoll: (r) => rolls.push(r),
      onDone: (d) => (done = d),
      onError: () => {},
    });

    expect(text).toBe("You step into the rain.");
    expect(rolls).toEqual([{ actor: "Ganger", total: 14 }]);
    expect(done).toMatchObject({ kind: "turn-complete" });
  });

  it("routes an SSE error event to onError, not a throw", async () => {
    const frames = [`event: error\ndata: ${JSON.stringify({ message: "model 400" })}\n\n`];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(sseResponse(frames)));
    const onError = vi.fn();
    await runTurnStream({}, { ...noop, onError });
    expect(onError).toHaveBeenCalledWith("model 400");
  });

  it("surfaces a JSON validation error without falling back", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "invalid turn input" }), {
          status: 400,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    const onError = vi.fn();
    await runTurnStream({}, { ...noop, onError });
    expect(onError).toHaveBeenCalledWith("invalid turn input");
  });

  it("throws StreamUnavailable when the endpoint doesn't stream (fallback path)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("Not Found", { status: 404, headers: { "content-type": "text/plain" } })),
    );
    await expect(runTurnStream({}, noop)).rejects.toBeInstanceOf(StreamUnavailable);
  });

  it("throws StreamUnavailable when fetch itself rejects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    await expect(runTurnStream({}, noop)).rejects.toBeInstanceOf(StreamUnavailable);
  });
});
