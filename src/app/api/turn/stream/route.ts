/**
 * POST /api/turn/stream — same contract as /api/turn, but Server-Sent Events.
 * FEATURE_PLAN.md §1.2. The client shows narration as it's written.
 *
 * Events:
 *   event: text          data: { delta }            — narration chunk
 *   event: roll          data: EngineRoll           — an engine roll resolved
 *   event: awaiting-roll  data: TurnResult(awaiting) — turn suspended for a PC roll
 *   event: done          data: TurnResult(complete)  — turn finished
 *   event: error         data: { message }
 *
 * Validation failures return plain JSON (4xx/5xx) so the client can fall back
 * to /api/turn.
 */

import { NextRequest, NextResponse } from "next/server";
import { CampaignState } from "@/lib/state/campaignState";
import { runTurn, type TurnInput } from "@/lib/llm/turn";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not set on the server." }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { state: rawState, input: rawInput } = (body ?? {}) as { state?: unknown; input?: unknown };
  const stateParsed = CampaignState.safeParse(rawState);
  if (!stateParsed.success) {
    return NextResponse.json({ error: "invalid campaign state", detail: stateParsed.error.issues.slice(0, 5) }, { status: 400 });
  }

  const input = rawInput as TurnInput;
  if (
    !input ||
    (input.kind !== "action" && input.kind !== "playerRoll") ||
    (input.kind === "action" && typeof input.text !== "string") ||
    (input.kind === "playerRoll" && (typeof input.total !== "number" || !Array.isArray(input.dice)))
  ) {
    return NextResponse.json({ error: "invalid turn input" }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      try {
        const result = await runTurn(stateParsed.data, input, (ev) => {
          if (ev.type === "text") send("text", { delta: ev.delta });
          else if (ev.type === "roll") send("roll", ev.roll);
        });
        send(result.kind === "awaiting-player-roll" ? "awaiting-roll" : "done", result);
      } catch (err) {
        console.error("[/api/turn/stream] error", err);
        send("error", { message: (err as Error).message || "turn failed" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
