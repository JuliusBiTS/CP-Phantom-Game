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
import { CampaignBible, CampaignPlan } from "../state/campaignState";
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

// ── Full campaign generator — FEATURE_PLAN §M9 ──────────────────────────────

const PlanShape = z.object({
  bible: BibleShape,
  acts: z
    .array(
      z.object({
        act: z.number(),
        goal: z.string(),
        gigs: z
          .array(
            z.object({
              title: z.string(),
              hook: z.string().describe("The job as a fixer would pitch it — one or two lines."),
              contact: z.string().describe("Who offers it (a fixer / contact name + one phrase)."),
              opposition: z.string().describe("The main opposition — a concept the GM can generate NPCs from."),
              location: z.string(),
              advancesTwist: z.number().nullable().describe("Index (0-based) of the bible twist this gig moves toward, or null."),
              payoutEb: z.number().describe("Eddie payout before the fixer's cut."),
            }),
          )
          .min(1)
          .max(3),
      }),
    )
    .min(3)
    .max(5)
    .describe("One entry per bible act, in order. 1–3 gigs each."),
});

export async function generateCampaignPlan(
  premise: string,
  character: CharacterSheet,
): Promise<{ bible: z.infer<typeof CampaignBible>; plan: z.infer<typeof CampaignPlan> }> {
  const anthropic = new Anthropic();
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 8000,
    system:
      SYSTEM +
      `\n\nAlso break each act into 1–3 concrete GIGS — jobs the PC can take that move the act forward. Each gig: a hook a fixer would pitch, who offers it, the opposition, the location, a payout, and which bible twist (if any) it advances. The gigs are a spine, not rails — order and hooks will adapt in play.`,
    messages: [
      {
        role: "user",
        content:
          `Player character:\n${JSON.stringify({ name: character.name, stats: character.stats, cyberware: character.cyberware, notes: character.notes }, null, 2)}\n\n` +
          `Campaign premise:\n${premise || "(none — invent a strong one)"}\n\nDesign the full campaign: bible + gigs per act.`,
      },
    ],
    tools: [{ name: "record_campaign", description: "Record the finished campaign.", input_schema: toInputSchema(PlanShape) }],
    tool_choice: { type: "tool", name: "record_campaign" },
  });

  const call = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "record_campaign");
  if (!call) throw new Error("campaign generation produced no result");
  const raw = PlanShape.parse(call.input);
  const bible = CampaignBible.parse(raw.bible);
  const plan = CampaignPlan.parse({
    generated: true,
    currentAct: 1,
    acts: raw.acts.map((a) => ({
      act: a.act,
      goal: a.goal,
      gigs: a.gigs.map((g, i) => ({
        id: `gig_${a.act}_${i}`,
        act: a.act,
        title: g.title,
        hook: g.hook,
        contact: g.contact,
        opposition: g.opposition,
        location: g.location,
        advancesTwist: g.advancesTwist,
        payoutEb: g.payoutEb,
        status: a.act === 1 ? "available" : "locked",
      })),
    })),
  });
  return { bible, plan };
}
