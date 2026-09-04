/**
 * Fact compression — SOLO_MODE_BUILD_PLAN.md §5.3.
 *
 * "The single most important piece of engineering in the whole project for
 * solving 'AI Dungeon forgets things.'"
 *
 * After every N turns, distil the OLD transcript into durable structured facts
 * (merged into world.npcs / world.factions / questLog / knownLocations) and
 * drop those raw turns from the model's recent-history window. Prompt cost then
 * stays flat instead of O(conversation length). The full raw log is still kept
 * verbatim in sessionLog for the player to scroll — it's just not re-sent.
 */

import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { CampaignState } from "../state/campaignState";
import { applyDelta } from "../state/delta";
import { toInputSchema } from "./tools";
import { addUsage } from "./cost";

const CompressionResult = z.object({
  npcFacts: z.array(z.object({ id: z.string(), name: z.string().optional(), addFacts: z.array(z.string()) })).default([]),
  factionFacts: z.array(z.object({ name: z.string(), standingWithPC: z.string().optional(), addFacts: z.array(z.string()) })).default([]),
  questUpdates: z
    .array(z.object({ id: z.string(), title: z.string().optional(), status: z.enum(["active", "completed", "failed"]).optional(), summary: z.string().optional() }))
    .default([]),
  locationFacts: z.array(z.object({ name: z.string(), description: z.string().optional() })).default([]),
});

const COMPRESS_SYSTEM = `You compress an old stretch of solo-RPG transcript into durable facts. Extract only things that remain TRUE and MATTER going forward: names and dispositions of people met, promises made, items acquired, places visited and what's notable about them, faction standing changes, quest progress. Phrase each as a short standalone fact ("PC promised the fixer Rook a cut of the Militech job", "Militech is hostile to the PC in Watson"). Do not include moment-to-moment combat blow-by-blow or atmosphere. Return the structured object.`;

interface CompressOpts {
  anthropic: Anthropic;
  model: string;
  windowTurns: number;
  /** Compress every this-many turns. */
  everyTurns?: number;
}

/** Count "turns" as user/assistant message pairs in the transcript. */
function turnCount(transcript: unknown[]): number {
  return transcript.filter((m) => (m as Anthropic.MessageParam).role === "assistant").length;
}

export async function maybeCompress(state: CampaignState, opts: CompressOpts): Promise<CampaignState> {
  const every = opts.everyTurns ?? 4;
  const s = structuredClone(state);
  s.turnsSinceCompression = (s.turnsSinceCompression ?? 0) + 1;

  const transcript = (s.transcript ?? []) as Anthropic.MessageParam[];
  const turns = turnCount(transcript);

  if (s.turnsSinceCompression < every || turns <= opts.windowTurns) {
    return s;
  }

  // Split: everything before the recent window gets compressed & dropped.
  const keepFromAssistant = turns - opts.windowTurns;
  let seenAssistants = 0;
  let splitIdx = 0;
  for (let i = 0; i < transcript.length; i++) {
    if ((transcript[i] as Anthropic.MessageParam).role === "assistant") {
      seenAssistants++;
      if (seenAssistants === keepFromAssistant) {
        splitIdx = i + 1;
        break;
      }
    }
  }
  // The kept window must NOT start with a user message that carries orphaned
  // tool_result blocks (their tool_use just got compressed away) — the API
  // rejects that. Advance the split past any such leading messages.
  const isToolResultMsg = (m: Anthropic.MessageParam) =>
    m.role === "user" &&
    Array.isArray(m.content) &&
    m.content.some((b) => typeof b === "object" && b !== null && (b as { type?: string }).type === "tool_result");
  while (splitIdx < transcript.length && isToolResultMsg(transcript[splitIdx] as Anthropic.MessageParam)) {
    splitIdx++;
  }

  const toCompress = transcript.slice(0, splitIdx);
  const toKeep = transcript.slice(splitIdx);
  if (toCompress.length === 0) return s;

  try {
    const response = await opts.anthropic.messages.create({
      model: opts.model,
      max_tokens: 4000,
      system: COMPRESS_SYSTEM,
      messages: [
        {
          role: "user",
          content:
            `Existing known NPCs: ${JSON.stringify(s.world.npcs.map((n) => ({ id: n.id, name: n.name })))}\n` +
            `Existing quests: ${JSON.stringify(s.questLog.map((q) => ({ id: q.id, title: q.title })))}\n\n` +
            `Transcript to compress:\n${JSON.stringify(toCompress).slice(0, 60000)}`,
        },
      ],
      tools: [
        {
          name: "record_facts",
          description: "Record the durable facts distilled from the transcript.",
          input_schema: toInputSchema(CompressionResult),
        },
      ],
      tool_choice: { type: "tool", name: "record_facts" },
    });

    // Billed regardless of what happens below — record it before anything else can throw.
    s.meta.usage = addUsage(s.meta.usage, response.usage, opts.model);

    const call = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "record_facts",
    );
    if (call) {
      const facts = CompressionResult.parse(call.input);
      const merged = applyDelta(s, {
        upsertNpcs: facts.npcFacts.map((f) => ({ id: f.id, name: f.name, addFacts: f.addFacts })),
        upsertFactions: facts.factionFacts.map((f) => ({ name: f.name, standingWithPC: f.standingWithPC, addFacts: f.addFacts })),
        upsertQuests: facts.questUpdates,
      });
      for (const l of facts.locationFacts) {
        if (!merged.world.knownLocations.some((k) => k.name === l.name)) {
          merged.world.knownLocations.push({ name: l.name, description: l.description ?? "", notableFacts: [] });
        }
      }
      merged.transcript = toKeep as unknown[];
      merged.turnsSinceCompression = 0;
      for (const entry of merged.sessionLog) {
        // Mark the compressed span; keep it in the log for scrollback.
        if (!entry.compressed && entry.ts < Date.now() - 1) entry.compressed = true;
      }
      merged.sessionLog.push({ ts: Date.now(), type: "system", text: `Compressed ${toCompress.length} messages into durable facts.`, compressed: true });
      return merged;
    }
  } catch (err) {
    // Never let a compression failure break play — just keep the window as-is.
    s.sessionLog.push({ ts: Date.now(), type: "system", text: `Fact compression skipped (error): ${(err as Error).message}`, compressed: true });
  }
  return s;
}
