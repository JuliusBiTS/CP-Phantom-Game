/**
 * POST /api/recap — a "Previously on…" cold-open. FEATURE_PLAN.md §M2.
 *
 * Body: { state: CampaignState }
 * Returns: { recap: string }   (3–5 sentences, GM voice)
 *
 * Cheap: a slim, bible-free context and a tight token cap.
 */

import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { CampaignState } from "@/lib/state/campaignState";
import { usageDelta } from "@/lib/llm/cost";

export const runtime = "nodejs";
export const maxDuration = 30;

// A recap is a short summary — a cheap model handles it well.
const MODEL = process.env.SOLO_RECAP_MODEL || process.env.SOLO_COMPRESS_MODEL || "claude-haiku-4-5-20251001";

const SYSTEM = `You write the "Previously on…" cold-open for a solo Cyberpunk RPG session the player is returning to. 3–5 sentences, second person ("you"), in a terse noir GM voice. Remind them where they are, who matters right now, what's unresolved, and anything primed to go wrong. Do NOT introduce new plot, and do NOT reveal anything the player hasn't discovered in the fiction. Output only the recap prose.`;

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

  const recentNarration = s.sessionLog
    .filter((l) => l.type === "narration")
    .slice(-3)
    .map((l) => l.text);

  const ctx = {
    inGameDate: s.meta.inGameDate || undefined,
    location: s.world.currentLocation || undefined,
    activeQuests: s.questLog.filter((q) => q.status === "active").map((q) => ({ title: q.title, summary: q.summary })),
    people: s.world.npcs
      .filter((n) => n.notableFacts.length || n.status !== "alive")
      .map((n) => ({ name: n.name, disposition: n.disposition, status: n.status, facts: n.notableFacts })),
    factions: s.world.factions.map((f) => ({ name: f.name, standing: f.standingWithPC })),
    recentNarration,
  };

  if (recentNarration.length === 0) return NextResponse.json({ recap: "" });

  try {
    const anthropic = new Anthropic();
    const res = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 400,
      system: SYSTEM,
      messages: [{ role: "user", content: `Campaign so far:\n\n\`\`\`json\n${JSON.stringify(ctx, null, 2)}\n\`\`\`` }],
    });
    const recap = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    return NextResponse.json({ recap, usage: usageDelta(res.usage, MODEL) });
  } catch (err) {
    console.error("[/api/recap] error", err);
    return NextResponse.json({ error: (err as Error).message || "recap failed" }, { status: 500 });
  }
}
