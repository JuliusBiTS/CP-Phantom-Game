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
import { applyDelta, TurnDelta } from "../state/delta";
import { rollPW, meleeOrRangedDamage } from "../dice/rollPW";
import { buildSystemPrompt, buildStateContext } from "./prompt";
import {
  TURN_TOOLS,
  TOOL_NAMES,
  RollDiceInput,
  RequestPlayerRollInput,
  CommitTurnInput,
  GenerateNpcInput,
  StartCombatInput,
  RollCriticalInjuryInput,
} from "./tools";
import { rollDice } from "../dice/rollPW";
import { resolveCritInjury } from "../rules/criticalInjuries";
import { maybeCompress } from "./compress";
import { addUsage } from "./cost";
import { pushHistory } from "../state/history";
import { generateNpcSheet } from "../rules/generate";
import { rollInitiativeFor, buildInitiativeOrder, initiativeLabel, type InitiativeEntry } from "../rules/initiative";
import { pcPwReference } from "../rules/live";

const MODEL = process.env.SOLO_MODEL || "claude-sonnet-5";
/** Fact compression is extractive — a cheaper model does it fine. */
const COMPRESS_MODEL = process.env.SOLO_COMPRESS_MODEL || "claude-haiku-4-5-20251001";
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

/** Streamed to the client mid-turn (FEATURE_PLAN.md §1.2). Terminal states
 *  (awaiting-player-roll / turn-complete) are the `TurnResult` return value. */
export type TurnEvent =
  | { type: "text"; delta: string }
  | { type: "roll"; roll: EngineRoll };
export type TurnEventSink = (ev: TurnEvent) => void;

function client() {
  return new Anthropic(); // resolves ANTHROPIC_API_KEY / auth profile from env
}

/** Models occasionally hand back tool input (or a nested object field) as a
 *  JSON *string* instead of an object. Unwrap one level of that. */
export function coerceObject(v: unknown): unknown {
  if (typeof v !== "string") return v;
  const t = v.trim();
  if (!t.startsWith("{") && !t.startsWith("[")) return v;
  try {
    return JSON.parse(t);
  } catch {
    return v;
  }
}

/** Tolerant commit_turn parse — a malformed delta downgrades to an empty delta
 *  (with a log note) rather than 500-ing the whole turn. */
export function parseCommitInput(raw: unknown): { narration: string; delta: TurnDelta; deltaError?: string } {
  const o = (coerceObject(raw) ?? {}) as Record<string, unknown>;
  const narration = typeof o.narration === "string" ? o.narration : "";
  const parsed = CommitTurnInput.safeParse({ narration, delta: coerceObject(o.delta) ?? {} });
  if (parsed.success) return { narration: parsed.data.narration, delta: parsed.data.delta };
  const deltaOnly = TurnDelta.safeParse(coerceObject(o.delta) ?? {});
  return {
    narration,
    delta: deltaOnly.success ? deltaOnly.data : {},
    deltaError: JSON.stringify(parsed.error.issues.slice(0, 3)),
  };
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

/** Execute roll_critical_injury: 2d6 on the §13 table, recorded on the target. */
function executeCritInjury(state: CampaignState, raw: unknown): string {
  const input = RollCriticalInjuryInput.parse(raw);
  const { dice, total } = rollDice(2, 6);

  const targetSheet =
    input.who === "pc"
      ? (state.character as { criticalInjuries?: Array<{ id: string; table: string; roll: number; name: string; effect: string; fullFix: string; treatment: string }>; deathSavePenalty?: number })
      : (state.world.npcs.find((n) => n.id === input.npcId)?.sheet as typeof state.character | undefined);

  if (!targetSheet) return JSON.stringify({ error: `no target (${input.who} ${input.npcId ?? ""})` });

  const s = targetSheet as { criticalInjuries?: Array<{ id: string; table: string; roll: number; name: string; effect: string; fullFix: string; treatment: string }>; deathSavePenalty?: number };
  const existing = s.criticalInjuries ?? [];
  const row = resolveCritInjury(input.table, total, existing);

  const injury = {
    id: `ci_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    table: input.table,
    roll: total,
    name: row.name,
    effect: row.effect,
    fullFix: row.fullFix,
    treatment: "untreated" as const,
  };
  s.criticalInjuries = [...existing, injury];
  if (input.who === "pc" && row.deathSavePenalty) {
    s.deathSavePenalty = (s.deathSavePenalty ?? 0) + row.deathSavePenalty;
  }

  const line = `Critical injury — ${input.who === "pc" ? state.character.name || "PC" : input.npcId} (${input.table} 2d6 [${dice.join(",")}]=${total}): ${row.name} — ${row.effect}`;
  state.sessionLog.push({ ts: Date.now(), type: "roll", text: line, compressed: false, roll: { actor: input.who === "pc" ? state.character.name || "PC" : input.npcId ?? "?", isPC: input.who === "pc", pw: null, dv: null, dice, total, outcome: row.name, source: "engine" } });

  return JSON.stringify({
    table: input.table,
    dice,
    total,
    name: row.name,
    effect: row.effect,
    fullFix: row.fullFix,
    deathSavePenaltyAdded: input.who === "pc" ? row.deathSavePenalty ?? 0 : 0,
    bonusHpDamage: 5,
    note: "Apply the 5 bonus HP damage in commit_turn's delta and narrate. The injury is already recorded.",
  });
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

/**
 * Drop leading messages that would 400 the API: a `user` message with
 * `tool_result` blocks whose `tool_use` isn't in a preceding assistant message
 * (can happen if an old/partial transcript was persisted). Also drop a trailing
 * assistant `tool_use` with no following `tool_result`.
 */
function sanitizeTranscript(messages: Anthropic.MessageParam[]): Anthropic.MessageParam[] {
  const hasType = (m: Anthropic.MessageParam, t: string) =>
    Array.isArray(m.content) && m.content.some((b) => typeof b === "object" && b !== null && (b as { type?: string }).type === t);

  let start = 0;
  while (start < messages.length && messages[start].role === "user" && hasType(messages[start], "tool_result")) {
    start++;
  }
  let out = messages.slice(start);
  // trailing dangling tool_use
  if (out.length && out[out.length - 1].role === "assistant" && hasType(out[out.length - 1], "tool_use")) {
    out = out.slice(0, -1);
  }
  return out;
}

/** Add an ephemeral cache breakpoint to a message's last content block. */
export function markCache(m: Anthropic.MessageParam): Anthropic.MessageParam {
  const cc = { type: "ephemeral" as const };
  if (typeof m.content === "string") {
    return { ...m, content: [{ type: "text", text: m.content, cache_control: cc }] };
  }
  if (Array.isArray(m.content) && m.content.length) {
    const blocks = [...m.content];
    const last = blocks[blocks.length - 1];
    blocks[blocks.length - 1] = { ...last, cache_control: cc } as unknown as typeof last;
    return { ...m, content: blocks };
  }
  return m;
}

const CONTEXT_MARK = "\n\n---\n\nPlayer action: ";

/**
 * Once a turn is done, the giant state-context blob in its user message is dead
 * weight — the next turn re-sends the current state fresh. Strip it back to the
 * bare action line so the transcript doesn't grow O(n²). FEATURE_PLAN.md cost pass.
 */
export function stripStaleContext(messages: Anthropic.MessageParam[]): Anthropic.MessageParam[] {
  return messages.map((m) => {
    if (m.role === "user" && typeof m.content === "string") {
      const i = m.content.indexOf(CONTEXT_MARK);
      if (i !== -1) return { ...m, content: "Player action: " + m.content.slice(i + CONTEXT_MARK.length) };
    }
    return m;
  });
}

function messagesFor(state: CampaignState, freshUser: Anthropic.MessageParam[]): Anthropic.MessageParam[] {
  const prior = sanitizeTranscript((state.transcript ?? []) as Anthropic.MessageParam[]);
  // Cache the (now-slim) transcript prefix — it's stable across a turn's calls
  // and across turns until compression rewrites it.
  if (prior.length) prior[prior.length - 1] = markCache(prior[prior.length - 1]);
  return [...prior, ...freshUser];
}

/** The PC's initiative PW = Drive+Reflexes (§3), via the ported live math. */
function pcInitiativePw(state: CampaignState): number {
  try {
    return pcPwReference(state.character as never).reaction.finalPw;
  } catch {
    const s = (state.character.stats ?? {}) as Record<string, number>;
    return Math.max(1, (s.drive ?? 0) + (s.reflexes ?? 0));
  }
}

/**
 * start_combat: roll NPC initiative (engine), then SUSPEND for the PC's own
 * initiative roll. The resume handler builds the turn order.
 */
function executeStartCombat(state: CampaignState, raw: unknown, toolUseId: string, messages: Anthropic.MessageParam[], narration: string): TurnResult {
  const input = StartCombatInput.parse(raw);
  const npcRolls: InitiativeEntry[] = input.combatants.map((cb) => {
    const npc = state.world.npcs.find((n) => n.id === cb.id);
    const sheet = npc?.sheet as { _generated?: { reactionPw?: number }; stats?: Record<string, number> } | undefined;
    const pw =
      sheet?._generated?.reactionPw ||
      (sheet?.stats?.drive ?? 0) + (sheet?.stats?.reflexes ?? 0) ||
      8;
    const e = rollInitiativeFor({ id: cb.id, name: cb.name, isPC: false, pw });
    logRoll(
      state,
      { actor: cb.name, isPC: false, pw, dv: null, dice: e.dice, total: e.value, outcome: e.outcome, source: "engine" },
      `${cb.name} initiative — PW ${pw} → [${e.dice.join(", ")}] ${initiativeLabel(e)}`,
    );
    return e;
  });

  const pcPw = pcInitiativePw(state);
  state.pendingPlayerRoll = {
    toolUseId,
    prompt: "Roll initiative for combat",
    statPair: "Drive+Reflexes",
    pw: pcPw,
    diceInstruction: diceInstructionFor(pcPw),
    dv: null,
    kind: "initiative",
  };
  state.pendingInitiative = { npcRolls, combatants: input.combatants };
  state.pendingTurnMessages = messages as unknown[];
  state.sessionLog.push({ ts: Date.now(), type: "system", text: `Combat starting — roll initiative (Drive+Reflexes, PW ${pcPw})`, compressed: false });

  return {
    kind: "awaiting-player-roll",
    state,
    prompt: state.pendingPlayerRoll,
    narrationSoFar: narration,
  };
}

function diceInstructionFor(pw: number): string {
  const full = Math.floor(Math.max(pw, 0) / 20);
  const rem = Math.max(pw, 0) % 20;
  const parts: string[] = [];
  if (full > 0) parts.push(`${full}×d20 (counts to 20)`);
  if (rem > 0 || full === 0) parts.push(`1×d20 (counts to ${rem})`);
  return `roll ${parts.join(" + ")}`;
}

/** Turn the player's typed initiative roll into an InitiativeEntry. */
function rollInitiativeForFromTyped(state: CampaignState, pw: number, dice: number[], total: number): InitiativeEntry {
  const first = dice[0];
  const outcome: InitiativeEntry["outcome"] =
    first === 1 ? "crit-success" : first === 20 ? "crit-fail" : total > 0 ? "hit" : "miss";
  return {
    id: "PC",
    name: state.character.name || "PC",
    isPC: true,
    pw,
    dice,
    outcome,
    value: outcome === "hit" ? total : pw,
  };
}

async function drive(
  state: CampaignState,
  seedMessages: Anthropic.MessageParam[],
  onEvent?: TurnEventSink,
): Promise<TurnResult> {
  const anthropic = client();
  const messages: Anthropic.MessageParam[] = [...seedMessages];
  const rolls: EngineRoll[] = [];
  let narration = "";

  for (let i = 0; i < MAX_LOOP_ITERATIONS; i++) {
    const stream = anthropic.messages.stream({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: [
        { type: "text", text: buildSystemPrompt(state), cache_control: { type: "ephemeral" } },
      ],
      tools: TURN_TOOLS,
      messages,
    });
    if (onEvent) stream.on("text", (delta) => onEvent({ type: "text", delta }));
    const response = await stream.finalMessage();

    state.meta.usage = addUsage(state.meta.usage, response.usage);
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
      const input = coerceObject(tu.input);
      if (tu.name === TOOL_NAMES.roll) {
        const { result, roll } = executeRollDice(state, input);
        rolls.push(roll);
        onEvent?.({ type: "roll", roll });
        toolResults.push({ type: "tool_result", tool_use_id: tu.id, content: result });
      } else if (tu.name === TOOL_NAMES.generateNpc) {
        const result = executeGenerateNpc(state, input);
        toolResults.push({ type: "tool_result", tool_use_id: tu.id, content: result });
      } else if (tu.name === TOOL_NAMES.critInjury) {
        const result = executeCritInjury(state, input);
        toolResults.push({ type: "tool_result", tool_use_id: tu.id, content: result });
      } else if (tu.name === TOOL_NAMES.startCombat) {
        // Push any tool results gathered so far, then suspend for PC initiative.
        if (toolResults.length) messages.push({ role: "user", content: toolResults });
        return executeStartCombat(state, input, tu.id, messages, narration);
      } else if (tu.name === TOOL_NAMES.playerRoll) {
        const p = RequestPlayerRollInput.parse(input);
        // SUSPEND. Persist everything needed to resume.
        state.pendingPlayerRoll = {
          toolUseId: tu.id,
          prompt: p.prompt,
          statPair: p.statPair,
          pw: p.pw,
          diceInstruction: p.diceInstruction,
          dv: p.dv,
          kind: "action",
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
        const c = parseCommitInput(input);
        toolResults.push({ type: "tool_result", tool_use_id: tu.id, content: "committed" });
        messages.push({ role: "user", content: toolResults });
        const finalNarration = c.narration || narration;
        state.sessionLog.push({ ts: Date.now(), type: "narration", text: finalNarration, compressed: false });
        if (c.deltaError) {
          state.sessionLog.push({
            ts: Date.now(),
            type: "system",
            text: `Delta rejected (${c.deltaError}) — narration kept, state changes dropped. Re-state them next turn.`,
            compressed: false,
          });
        }
        let next = applyDelta(state, c.delta);
        persistTranscript(next, messages);
        next = await maybeCompress(next, { anthropic, model: COMPRESS_MODEL, windowTurns: TRANSCRIPT_WINDOW_TURNS });
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
  state.transcript = stripStaleContext(messages) as unknown[];
  state.pendingPlayerRoll = null;
  state.pendingInitiative = null;
  state.pendingTurnMessages = null;
}

export async function runTurn(
  state: CampaignState,
  input: TurnInput,
  onEvent?: TurnEventSink,
): Promise<TurnResult> {
  let working: CampaignState = structuredClone(state);

  if (input.kind === "action") {
    // Snapshot for undo BEFORE anything mutates, then count the turn.
    working = pushHistory(working, input.text);
    working.meta.model = MODEL;
    working.meta.usage = { ...working.meta.usage, turns: (working.meta.usage?.turns ?? 0) + 1 };
    working.sessionLog.push({ ts: Date.now(), type: "action", text: input.text, compressed: false });
    const userContent = `${buildStateContext(working)}\n\n---\n\nPlayer action: ${input.text}`;
    const seed = messagesFor(working, [{ role: "user", content: userContent }]);
    return drive(working, seed, onEvent);
  }

  // resume: input.kind === 'playerRoll'
  const pending = working.pendingPlayerRoll;
  const priorMessages = working.pendingTurnMessages as Anthropic.MessageParam[] | null;
  if (!pending || !priorMessages) {
    throw new Error("runTurn: no suspended turn to resume");
  }

  // ── Combat start: this roll was the PC's initiative — build the order ─────
  if (pending.kind === "initiative" && working.pendingInitiative) {
    const stash = working.pendingInitiative as { npcRolls: InitiativeEntry[]; combatants: Array<{ id: string; name: string }> };
    const pcEntry = rollInitiativeForFromTyped(working, pending.pw, input.dice, input.total);
    const ordered = buildInitiativeOrder([pcEntry, ...stash.npcRolls]);
    working.combat = {
      active: true,
      round: 1,
      turnIndex: 0,
      order: ordered.map((e) => ({
        id: e.id,
        name: e.name,
        isPC: e.isPC,
        initiative: e.value,
        initiativeOutcome: e.outcome,
        cover: "none" as const,
        coverHp: null,
        rangeFromPcM: null,
      })),
      pcTargetId: stash.combatants[0]?.id ?? null,
      lastPcAction: null,
    };
    working.sessionLog.push({
      ts: Date.now(),
      type: "roll",
      text: `Player initiative — [${input.dice.join(", ")}] ${initiativeLabel(pcEntry)}`,
      compressed: false,
      roll: { actor: working.character.name || "PC", isPC: true, pw: pending.pw, dv: null, dice: input.dice, total: input.total, outcome: pcEntry.outcome, source: "player-typed" },
    });
    working.sessionLog.push({
      ts: Date.now(),
      type: "system",
      text: `Combat — round 1. Turn order: ${ordered.map((e) => `${e.name}${e.isPC ? " (you)" : ""}`).join(" → ")}`,
      compressed: false,
    });

    const orderStr = ordered.map((e, i) => `${i}: ${e.name}${e.isPC ? " (PC)" : ""} — ${initiativeLabel(e)}`).join("\n");
    const resumeMsg: Anthropic.MessageParam[] = [
      ...priorMessages,
      {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: pending.toolUseId,
            content: `Combat started. Round 1. Turn order (index → combatant):\n${orderStr}\n\nResolve turns in this order starting from index 0. Use roll_dice for each NPC turn; pause via request_player_roll when it reaches the PC. Keep combat.turnIndex updated in commit_turn's delta, increment combat.round when the order wraps, and set combat.removeCombatantIds for anyone who drops. Call commit_turn when it's the PC's turn to act (or the fight ends — then set combat.end).`,
          },
        ],
      },
    ];
    working.pendingPlayerRoll = null;
    working.pendingInitiative = null;
    working.pendingTurnMessages = null;
    return drive(working, resumeMsg, onEvent);
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
  return drive(working, resumeMessages, onEvent);
}
