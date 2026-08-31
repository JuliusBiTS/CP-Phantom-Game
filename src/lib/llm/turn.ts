/**
 * Turn orchestrator — SOLO_MODE_BUILD_PLAN.md §5.2.
 *
 * A turn spans one or two HTTP requests:
 *   1. player action → model narrates, rolls for NPCs via the engine, then
 *      either finishes (commit_turn) or asks for a PC roll (request_player_roll)
 *      and SUSPENDS — the raw message history is persisted on the state.
 *   2. player types their physical roll → the suspended turn resumes with that
 *      number as the pending tool's result, model adjudicates and finishes.
 *
 * The model never generates a die result. NPC rolls come from rollPW (real
 * CSPRNG); PC rolls come from the player. Every roll is written to sessionLog.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { CampaignState } from "../state/campaignState";
import type { TurnDelta } from "../state/delta";
import { applyDelta } from "../state/delta";
import { rollPW, meleeOrRangedDamage } from "../dice/rollPW";
import { SYSTEM_PROMPT, buildStateContext } from "./prompt";
import {
  TURN_TOOLS,
  TOOL_NAMES,
  RollDiceInput,
  RequestPlayerRollInput,
  CommitTurnInput,
  GenerateNpcInput,
} from "./tools";
import { maybeCompress } from "./compress";
import { generateNpcSheet } from "../rules/generate";

const MODEL = process.env.SOLO_MODEL || "claude-sonnet-5";
const MAX_TOKENS = 8000;
const MAX_LOOP_ITERATIONS = 12;
/** How many recent turns of raw transcript to keep before compressing (§5.3). */
const TRANSCRIPT_WINDOW_TURNS = 6;

export type TurnInput =
  | { kind: "action"; text: string }
  | { kind: "playerRoll"; total: number; dice: number[] };

export type TurnResult =
  | {
      kind: "awaiting-player-roll";
      state: CampaignState;
      prompt: { prompt: string; statPair: string; pw: number; diceInstruction: string; dv: number | null };
      narrationSoFar: string;
    }
  | {
      kind: "turn-complete";
      state: CampaignState;
      narration: string;
      delta: TurnDelta;
      rolls: EngineRoll[];
    };

export interface EngineRoll {
  actor: string;
  purpose: string;
  pw: number;
  dv: number | null;
  dice: number[];
  total: number | null;
  outcome: string;
  hit: boolean | null;
  damage?: number;
}

function client() {
  return new Anthropic(); // resolves ANTHROPIC_API_KEY / auth profile from env
}

function textOf(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

function logRoll(state: CampaignState, entry: NonNullable<CampaignState["sessionLog"][number]["roll"]>, text: string) {
  state.sessionLog.push({ ts: Date.now(), type: "roll", text, compressed: false, roll: entry });
}

/** Execute a roll_dice tool call with the real engine. */
function executeRollDice(state: CampaignState, raw: unknown): { result: string; roll: EngineRoll } {
  const input = RollDiceInput.parse(raw);
  const r = rollPW(input.pw);
  let damage: number | undefined;
  const hit =
    input.dv == null
      ? null
      : r.outcome === "crit-success"
        ? true
        : r.outcome === "crit-fail"
          ? false
          : r.total != null && r.total >= input.dv;

  if (hit && input.weaponBonus != null && r.total != null) {
    damage = meleeOrRangedDamage(r.total, input.weaponBonus, input.targetArmorSP ?? 0);
  }

  const roll: EngineRoll = {
    actor: input.actor,
    purpose: input.purpose,
    pw: input.pw,
    dv: input.dv,
    dice: r.dice,
    total: r.total,
    outcome: r.outcome,
    hit,
    damage,
  };

  const parts = [
    `${input.actor} — ${input.purpose}`,
    `PW ${input.pw} → rolled [${r.dice.join(", ")}]`,
    r.total != null ? `total ${r.total}` : r.outcome.toUpperCase(),
    input.dv != null ? `vs DV ${input.dv} → ${hit ? "HIT" : "MISS"}` : "",
    damage != null ? `damage ${damage}` : "",
  ].filter(Boolean);
  const text = parts.join(" · ");

  logRoll(state, {
    actor: input.actor,
    isPC: false,
    pw: input.pw,
    dv: input.dv,
    dice: r.dice,
    total: r.total,
    outcome: r.outcome,
    source: "engine",
  }, text);

  const resultForModel = JSON.stringify({
    dice: r.dice,
    countedTotal: r.total,
    outcome: r.outcome,
    ...(input.dv != null ? { dv: input.dv, hit } : {}),
    ...(damage != null ? { damage } : {}),
  });
  return { result: resultForModel, roll };
}

/** Execute generate_npc: deterministic stat block, cached onto world.npcs. */
function executeGenerateNpc(state: CampaignState, raw: unknown): string {
  const input = GenerateNpcInput.parse(raw);
  const { sheet, summary } = generateNpcSheet({
    id: input.id,
    name: input.name,
    tier: input.tier,
    archetype: input.archetype,
    weapons: input.weapons,
    cyberware: input.cyberware,
    armorName: input.armorName,
    role: input.role,
  });

  let npc = state.world.npcs.find((n) => n.id === input.id);
  if (!npc) {
    npc = { id: input.id, name: input.name, disposition: input.role === "ally" ? "friendly" : "hostile", status: "alive", notableFacts: [] };
    state.world.npcs.push(npc);
  }
  npc.name = input.name;
  npc.sheet = sheet;

  state.sessionLog.push({
    ts: Date.now(),
    type: "system",
    text: `Generated ${input.name} — ${summary.tier}/${summary.archetype}, HP ${summary.hp_max}, armor SP ${summary.armorSP}, ${summary.weapons.map((w) => `${w.name} PW ${w.pw}`).join(", ")}`,
    compressed: false,
  });

  return JSON.stringify(summary);
}

function messagesFor(state: CampaignState, freshUser: Anthropic.MessageParam[]): Anthropic.MessageParam[] {
  const prior = (state.transcript ?? []) as Anthropic.MessageParam[];
  return [...prior, ...freshUser];
}

async function drive(
  state: CampaignState,
  seedMessages: Anthropic.MessageParam[],
): Promise<TurnResult> {
  const anthropic = client();
  const messages: Anthropic.MessageParam[] = [...seedMessages];
  const rolls: EngineRoll[] = [];
  let narration = "";

  for (let i = 0; i < MAX_LOOP_ITERATIONS; i++) {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: [
        { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      ],
      tools: TURN_TOOLS,
      messages,
    });

    narration = [narration, textOf(response.content)].filter(Boolean).join("\n\n");
    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason !== "tool_use") {
      // Model ended without commit_turn — treat its text as the narration,
      // empty delta. (The system prompt tells it to always commit.)
      persistTranscript(state, messages);
      return { kind: "turn-complete", state, narration, delta: {}, rolls };
    }

    const toolUses = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const tu of toolUses) {
      if (tu.name === TOOL_NAMES.roll) {
        const { result, roll } = executeRollDice(state, tu.input);
        rolls.push(roll);
        toolResults.push({ type: "tool_result", tool_use_id: tu.id, content: result });
      } else if (tu.name === TOOL_NAMES.generateNpc) {
        const result = executeGenerateNpc(state, tu.input);
        toolResults.push({ type: "tool_result", tool_use_id: tu.id, content: result });
      } else if (tu.name === TOOL_NAMES.playerRoll) {
        const p = RequestPlayerRollInput.parse(tu.input);
        // SUSPEND. Persist everything needed to resume.
        state.pendingPlayerRoll = {
          toolUseId: tu.id,
          prompt: p.prompt,
          statPair: p.statPair,
          pw: p.pw,
          diceInstruction: p.diceInstruction,
          dv: p.dv,
        };
        state.pendingTurnMessages = messages as unknown[];
        state.sessionLog.push({
          ts: Date.now(),
          type: "system",
          text: `Awaiting player roll: ${p.prompt} (${p.statPair}, PW ${p.pw}, ${p.diceInstruction}${p.dv != null ? `, DV ${p.dv}` : ""})`,
          compressed: false,
        });
        return {
          kind: "awaiting-player-roll",
          state,
          prompt: p,
          narrationSoFar: narration,
        };
      } else if (tu.name === TOOL_NAMES.commit) {
        const c = CommitTurnInput.parse(tu.input);
        toolResults.push({ type: "tool_result", tool_use_id: tu.id, content: "committed" });
        messages.push({ role: "user", content: toolResults });
        const finalNarration = c.narration || narration;
        state.sessionLog.push({ ts: Date.now(), type: "narration", text: finalNarration, compressed: false });
        let next = applyDelta(state, c.delta);
        persistTranscript(next, messages);
        next = await maybeCompress(next, { anthropic, model: MODEL, windowTurns: TRANSCRIPT_WINDOW_TURNS });
        return { kind: "turn-complete", state: next, narration: finalNarration, delta: c.delta, rolls };
      } else {
        toolResults.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: `unknown tool ${tu.name}`,
          is_error: true,
        });
      }
    }

    messages.push({ role: "user", content: toolResults });
  }

  // Loop budget exhausted without a commit — finalize defensively.
  persistTranscript(state, messages);
  return { kind: "turn-complete", state, narration, delta: {}, rolls };
}

function persistTranscript(state: CampaignState, messages: Anthropic.MessageParam[]) {
  state.transcript = messages as unknown[];
  state.pendingPlayerRoll = null;
  state.pendingTurnMessages = null;
}

export async function runTurn(state: CampaignState, input: TurnInput): Promise<TurnResult> {
  const working: CampaignState = structuredClone(state);

  if (input.kind === "action") {
    working.sessionLog.push({ ts: Date.now(), type: "action", text: input.text, compressed: false });
    const userContent = `${buildStateContext(working)}\n\n---\n\nPlayer action: ${input.text}`;
    const seed = messagesFor(working, [{ role: "user", content: userContent }]);
    return drive(working, seed);
  }

  // resume: input.kind === 'playerRoll'
  const pending = working.pendingPlayerRoll;
  const priorMessages = working.pendingTurnMessages as Anthropic.MessageParam[] | null;
  if (!pending || !priorMessages) {
    throw new Error("runTurn: no suspended turn to resume");
  }
  working.sessionLog.push({
    ts: Date.now(),
    type: "roll",
    text: `Player roll — ${pending.prompt}: rolled [${input.dice.join(", ")}] total ${input.total}${pending.dv != null ? ` vs DV ${pending.dv}` : ""}`,
    compressed: false,
    roll: {
      actor: working.character.name || "PC",
      isPC: true,
      pw: pending.pw,
      dv: pending.dv,
      dice: input.dice,
      total: input.total,
      source: "player-typed",
    },
  });

  const resumeMessages: Anthropic.MessageParam[] = [
    ...priorMessages,
    {
      role: "user",
      content: [
        {
          type: "tool_result",
          tool_use_id: pending.toolUseId,
          content: JSON.stringify({
            playerRolled: input.dice,
            total: input.total,
            ...(pending.dv != null ? { dv: pending.dv, meetsDv: input.total >= pending.dv } : {}),
          }),
        },
      ],
    },
  ];
  working.pendingPlayerRoll = null;
  working.pendingTurnMessages = null;
  return drive(working, resumeMessages);
}
