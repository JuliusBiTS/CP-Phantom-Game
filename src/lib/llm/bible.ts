/**
 * Campaign bible generation — SOLO_MODE_BUILD_PLAN.md §5.6.
 *
 * Generated ONCE, at campaign creation, for 'campaign' mode only. A real
 * planned structure — antagonist, acts, pre-committed twists, NPC true
 * motivations — that the model writes *toward* every turn but reveals only
 * through in-fiction discovery. This is the single biggest lever against
 * "AI Dungeon plots go nowhere."
 */

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { CampaignBible } from "../state/campaignState";
import { toInputSchema } from "./tools";
import type { CharacterSheet } from "../state/campaignState";

const MODEL = process.env.SOLO_MODEL || "claude-sonnet-5";

const BibleShape = z.object({
  antagonist: z.string().describe("The core antagonist or faction driving the campaign. A name and a one-paragraph sketch."),
  drivingConflict: z.string().describe("The central conflict the whole campaign turns on."),
  acts: z
    .array(z.object({ goal: z.string(), turningPoint: z.string() }))
    .min(3)
    .max(5)
    .describe("3-5 acts. Each: what the PC is trying to do, and the event that ends the act."),
  plantedTwists: z
    .array(z.object({ twist: z.string(), delivered: z.boolean().default(false) }))
    .min(2)
    .max(3)
    .describe("2-3 genuine surprises the model COMMITS to now — not improvised later. Each a concrete reveal."),
  recurringNpcs: z
    .array(z.object({ name: z.string(), presents: z.string(), actualMotivation: z.string() }))
    .min(2)
    .describe("Key recurring NPCs: how they present to the PC vs. what they actually want (which may differ)."),
});

const SYSTEM = `You are designing the private campaign bible for a solo Cyberpunk tabletop campaign in the homebrew "CP Phantom" ruleset (Night City, 2045, corps won, the NET is monitored and rotting, street cred is currency). This is GM-only — the player never sees it directly. It must give a solo game an actual throughline: a real antagonist, a shaped act structure, and twists you commit to in advance rather than inventing when it feels dramatic. Ground it in the player's character and their stated premise. Noir tone, concrete specifics (names, places, factions), not vague.`;

export async function generateCampaignBible(
  premise: string,
  character: CharacterSheet,
): Promise<z.infer<typeof CampaignBible>> {
  const anthropic = new Anthropic();
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4000,
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content:
          `Player character:\n${JSON.stringify({ name: character.name, stats: character.stats, cyberware: character.cyberware, notes: character.notes }, null, 2)}\n\n` +
          `Campaign premise from the player:\n${premise || "(none given — invent a strong one that fits the character)"}\n\n` +
          `Design the campaign bible.`,
      },
    ],
    tools: [
      {
        name: "record_bible",
        description: "Record the finished campaign bible.",
        input_schema: toInputSchema(BibleShape),
      },
    ],
    tool_choice: { type: "tool", name: "record_bible" },
  });

  const call = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "record_bible",
  );
  if (!call) throw new Error("bible generation produced no result");
  return CampaignBible.parse(BibleShape.parse(call.input));
}
