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
import { CampaignBible, CampaignPlan, Usage } from "../state/campaignState";
import { toInputSchema } from "./tools";
import { usageDelta, mergeUsage } from "./cost";
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
): Promise<{ bible: z.infer<typeof CampaignBible>; usage: Usage }> {
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
  return { bible: CampaignBible.parse(BibleShape.parse(call.input)), usage: usageDelta(response.usage, MODEL) };
}

// ── Full campaign generator — FEATURE_PLAN §M9 ──────────────────────────────
//
// Two calls, not one: the bible (proven) then the gigs given the bible. A single
// deeply-nested forced tool call was unreliable — models truncated it (leaving
// `acts` as a broken partial string). If the gigs call fails the bible still
// ships, so the campaign is fully playable, just without the gig roadmap.

const GigsShape = z.object({
  acts: z
    .array(
      z.object({
        act: z.number().describe("1-based act number, matching the bible's acts in order."),
        goal: z.string().describe("Short — the bible act's goal."),
        gigs: z
          .array(
            z.object({
              title: z.string(),
              hook: z.string().describe("One or two lines — how a fixer pitches it."),
              contact: z.string().describe("Who offers it."),
              opposition: z.string().describe("The main opposition — a concept for generating NPCs."),
              location: z.string(),
              advancesTwist: z.number().nullable().describe("0-based index of the bible twist this advances, or null."),
              payoutEb: z.number().describe("Eddie payout before the fixer's cut."),
            }),
          )
          .min(1)
          .max(3),
      }),
    )
    .min(2)
    .max(6)
    .describe("One entry per bible act, in order. 1–3 gigs each."),
});

function coerceJson(v: unknown): unknown {
  if (typeof v !== "string") return v;
  const t = v.trim();
  if (!t.startsWith("{") && !t.startsWith("[")) return v;
  try {
    return JSON.parse(t);
  } catch {
    return v;
  }
}

export async function generateCampaignPlan(
  premise: string,
  character: CharacterSheet,
): Promise<{ bible: z.infer<typeof CampaignBible>; plan: z.infer<typeof CampaignPlan>; usage: Usage }> {
  const { bible, usage: bibleUsage } = await generateCampaignBible(premise, character);
  const emptyPlan = CampaignPlan.parse({ generated: false, currentAct: 1, acts: [] });

  try {
    const anthropic = new Anthropic();
    const res = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 6000,
      system: `You are breaking a solo Cyberpunk campaign into gigs. Given the campaign bible, produce 1–3 concrete GIGS per act — jobs the PC can take that move that act toward its turning point. Each gig gets a fixer-pitch hook, who offers it, the opposition, the location, a payout, and which bible twist (0-based index) it advances (or null). A spine, not rails.`,
      messages: [
        {
          role: "user",
          content:
            `Campaign bible:\n\`\`\`json\n${JSON.stringify(bible, null, 2)}\n\`\`\`\n\n` +
            `PC: ${character.name}. Premise: ${premise || "(GM-invented)"}\n\nBreak every act into gigs.`,
        },
      ],
      tools: [{ name: "record_gigs", description: "Record the per-act gigs.", input_schema: toInputSchema(GigsShape) }],
      tool_choice: { type: "tool", name: "record_gigs" },
    });

    const usage = mergeUsage(bibleUsage, usageDelta(res.usage, MODEL));
    const call = res.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "record_gigs");
    if (!call) return { bible, plan: emptyPlan, usage };

    const raw = coerceJson(call.input) as { acts?: unknown };
    const parsed = GigsShape.safeParse({ acts: coerceJson(raw?.acts) });
    if (!parsed.success) {
      console.warn("[campaign] gigs parse failed, shipping bible only:", parsed.error.issues.slice(0, 3));
      return { bible, plan: emptyPlan, usage };
    }

    const plan = CampaignPlan.parse({
      generated: true,
      currentAct: 1,
      acts: parsed.data.acts.map((a) => ({
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
    return { bible, plan, usage };
  } catch (err) {
    console.warn("[campaign] gigs call failed, shipping bible only:", (err as Error).message);
    return { bible, plan: emptyPlan, usage: bibleUsage };
  }
}
