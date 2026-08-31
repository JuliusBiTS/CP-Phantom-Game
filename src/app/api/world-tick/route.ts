/**
 * POST /api/world-tick — the rumor mill. FEATURE_PLAN §M5.
 *
 * Advances the world off-screen: factions and the antagonist move toward the
 * bible while the player is between gigs. Returns a TurnDelta (applied client-
 * side) + a short "while you were dark" paragraph.
 *
 * Body: { state: CampaignState }
 * Returns: { delta: TurnDelta, narration: string }
 */

import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { CampaignState } from "@/lib/state/campaignState";
import { TurnDelta } from "@/lib/state/delta";
import { toInputSchema } from "@/lib/llm/tools";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 45;

const MODEL = process.env.SOLO_WORLDTICK_MODEL || process.env.SOLO_COMPRESS_MODEL || "claude-haiku-4-5-20251001";

const WorldTick = z.object({
  narration: z.string().describe("2–4 sentences, GM voice: what shifted in Night City while the PC was heads-down. Concrete, and things they'll notice."),
  delta: TurnDelta.describe("The world changes: upsertFactions / upsertNpcs (addFacts), consequences.add or .escalate, missionBoard updates, a timelineBeat. No PC stat changes."),
});

const SYSTEM = `You advance the world between the player's scenes in a solo Cyberpunk campaign. The player has been between gigs; time has passed. Move the antagonist and the factions one small step toward the campaign bible. Prefer changes the player will NOTICE next session — a checkpoint tightened, a rival making a play, a contact going quiet, a debt's holder getting impatient, an armed consequence escalating. 1–2 moves, not a montage. Do not touch the PC's stats, HP, gear or money. Return the structured result.`;

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
  const parsed = CampaignState.safeParse((body as { state?: unknown })?.state);
  if (!parsed.success) return NextResponse.json({ error: "invalid campaign state" }, { status: 400 });
  const s = parsed.data;

  const ctx = {
    inGameDate: s.meta.inGameDate,
    daysElapsed: s.downtime.daysElapsed,
    bible: s.campaignBible,
    factions: s.world.factions,
    npcs: s.world.npcs.filter((n) => n.notableFacts.length || n.disposition !== "neutral").map((n) => ({ id: n.id, name: n.name, disposition: n.disposition, status: n.status, facts: n.notableFacts })),
    activeQuests: s.questLog.filter((q) => q.status === "active").map((q) => ({ id: q.id, title: q.title })),
    armedConsequences: s.consequences.filter((c) => c.status === "armed"),
    recentNarration: s.sessionLog.filter((l) => l.type === "narration").slice(-2).map((l) => l.text),
  };

  try {
    const anthropic = new Anthropic();
    const res = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system: SYSTEM,
      messages: [{ role: "user", content: `Campaign state:\n\n\`\`\`json\n${JSON.stringify(ctx, null, 2)}\n\`\`\`` }],
      tools: [{ name: "record_world_tick", description: "Record how the world moved.", input_schema: toInputSchema(WorldTick) }],
      tool_choice: { type: "tool", name: "record_world_tick" },
    });
    const call = res.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "record_world_tick");
    if (!call) return NextResponse.json({ delta: {}, narration: "" });
    const out = WorldTick.parse(call.input);
    return NextResponse.json({ delta: out.delta, narration: out.narration });
  } catch (err) {
    console.error("[/api/world-tick]", err);
    return NextResponse.json({ error: (err as Error).message || "world tick failed" }, { status: 500 });
  }
}
