/**
 * The three turn-loop tools — SOLO_MODE_BUILD_PLAN.md §5.2 / §5.7.
 *
 *  roll_dice          → executed by the backend NOW, in-loop. Real CSPRNG dice.
 *                       Used for every non-PC entity + environmental checks.
 *  request_player_roll → NOT executed by the backend. Suspends the turn and
 *                       returns to the client. The player rolls a physical die
 *                       and types the number; the turn resumes with that value
 *                       as this tool's result.
 *  commit_turn         → ends the turn. Carries the narration + structured delta.
 */

import type Anthropic from "@anthropic-ai/sdk";
import { TurnDelta } from "../state/delta";
import { z } from "zod";

/** Zod → JSON Schema for an Anthropic tool `input_schema` (drops `$schema`). */
export function toInputSchema(schema: z.ZodType): Anthropic.Tool.InputSchema {
  const js = z.toJSONSchema(schema, { io: "input" }) as Record<string, unknown>;
  delete js.$schema;
  return js as Anthropic.Tool.InputSchema;
}

export const TOOL_NAMES = {
  roll: "roll_dice",
  playerRoll: "request_player_roll",
  commit: "commit_turn",
} as const;

export const RollDiceInput = z.object({
  actor: z.string().describe("Name of the entity making the roll, e.g. 'Ganger #2', 'corp patrol drone'."),
  purpose: z.string().describe("What the roll is for, e.g. 'assault rifle attack on the PC', 'perception check'."),
  pw: z.number().int().describe("The fully-modified Probewert to roll against (folds in wounds, distance, cover, talents)."),
  dv: z.number().int().nullable().describe("The DV / target number this roll must meet or beat, or null for an opposed / GM-read roll."),
  weaponBonus: z.number().int().optional().describe("Weapon bonus to add to the roll total for damage, if this is an attack."),
  targetArmorSP: z.number().int().optional().describe("Effective armor SP of the target, for damage computation."),
});

export const RequestPlayerRollInput = z.object({
  prompt: z.string().describe("Plain-language description of what the PC is attempting."),
  statPair: z.string().describe("The two stats, e.g. 'Reflexes + Cool'."),
  pw: z.number().int().describe("The PC's fully-modified PW for this action."),
  diceInstruction: z.string().describe("Exactly what to physically roll, e.g. 'roll 1×d20' or 'roll 2×d20 (both count to 20) + 1×d20 (counts to 5)'."),
  dv: z.number().int().nullable().describe("The DV to beat, or null if opposed / hidden."),
});

export const CommitTurnInput = z.object({
  narration: z.string().describe("The prose the player sees now. 2nd person, present tense, tight."),
  delta: TurnDelta.describe("Every state change this turn, as structured data."),
});

export const TURN_TOOLS: Anthropic.Tool[] = [
  {
    name: TOOL_NAMES.roll,
    description:
      "Roll real dice for a NON-PC entity (enemy, NPC, ally, companion, drone, turret) or an environmental/hazard check. The backend computes the result with a real RNG and returns it. NEVER narrate the outcome of such a roll before calling this.",
    input_schema: toInputSchema(RollDiceInput),
  },
  {
    name: TOOL_NAMES.playerRoll,
    description:
      "Ask the player to physically roll for their OWN character. This suspends the turn until the player types the result. Use for every action or reaction taken by the PC. Do not also call commit_turn this step.",
    input_schema: toInputSchema(RequestPlayerRollInput),
  },
  {
    name: TOOL_NAMES.commit,
    description:
      "End the turn. Provide the narration the player sees and the full structured delta of state changes. Call exactly once, and never in the same step as request_player_roll.",
    input_schema: toInputSchema(CommitTurnInput),
  },
];
