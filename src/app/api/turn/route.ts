/**
 * POST /api/turn — run (or resume) one turn.
 *
 * Body: { state: CampaignState, input: TurnInput }
 *   input = { kind: "action", text }              → new player action
 *         | { kind: "playerRoll", total, dice }   → resume a suspended turn
 *
 * Returns a TurnResult (see lib/llm/turn.ts). The client persists the returned
 * `state`. The ANTHROPIC_API_KEY lives only here, server-side.
 */

import { NextRequest, NextResponse } from "next/server";
import { CampaignState } from "@/lib/state/campaignState";
import { runTurn, type TurnInput } from "@/lib/llm/turn";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not set on the server. Add it as a Vercel environment variable." },
      { status: 500 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { state: rawState, input: rawInput } = (body ?? {}) as {
    state?: unknown;
    input?: unknown;
  };

  const stateParsed = CampaignState.safeParse(rawState);
  if (!stateParsed.success) {
    return NextResponse.json(
      { error: "invalid campaign state", detail: stateParsed.error.issues.slice(0, 5) },
      { status: 400 },
    );
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

  try {
    const result = await runTurn(stateParsed.data, input);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[/api/turn] error", err);
    return NextResponse.json(
      { error: (err as Error).message || "turn failed" },
      { status: 500 },
    );
  }
}
