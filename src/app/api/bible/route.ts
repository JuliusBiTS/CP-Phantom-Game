/**
 * POST /api/bible — generate a campaign bible for a new 'campaign'-mode game.
 * Body: { premise: string, character: CharacterSheet }
 * Returns: { bible: CampaignBible }
 */

import { NextRequest, NextResponse } from "next/server";
import { CharacterSheet } from "@/lib/state/campaignState";
import { generateCampaignBible } from "@/lib/llm/bible";

export const runtime = "nodejs";
export const maxDuration = 60;

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
  if (!character.success) {
    return NextResponse.json({ error: "invalid character" }, { status: 400 });
  }
  try {
    const bible = await generateCampaignBible(String(body.premise ?? ""), character.data);
    return NextResponse.json({ bible });
  } catch (err) {
    console.error("[/api/bible]", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
