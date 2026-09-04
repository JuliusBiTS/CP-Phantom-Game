/**
 * POST /api/generate-campaign — the campaign generator. FEATURE_PLAN §M9.
 * Body: { premise: string, character: CharacterSheet }
 * Returns: { bible: CampaignBible, plan: CampaignPlan }
 */

import { NextRequest, NextResponse } from "next/server";
import { CharacterSheet } from "@/lib/state/campaignState";
import { generateCampaignPlan } from "@/lib/llm/bible";

export const runtime = "nodejs";
export const maxDuration = 90;

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not set on the server." }, { status: 500 });
  }
  let body: { premise?: unknown; character?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const character = CharacterSheet.safeParse(body.character);
  if (!character.success) return NextResponse.json({ error: "invalid character" }, { status: 400 });
  try {
    const { bible, plan, usage } = await generateCampaignPlan(String(body.premise ?? ""), character.data);
    return NextResponse.json({ bible, plan, usage });
  } catch (err) {
    console.error("[/api/generate-campaign]", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
