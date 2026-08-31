/**
 * Sub-mode framework — FEATURE_PLAN.md §1.1.
 *
 * The ambient play loop (`state.mode`) selects a prompt fragment and a context
 * slice. Combat is a separate layer (`combat.active`) handled in the base prompt.
 * Downtime is the first consumer; netrun / chase slot in here later (M7 / M8).
 *
 * Entering / leaving a mode is a `delta.mode` field, applied in applyDelta.
 */

import type { CampaignState, Mode } from "../../state/campaignState";
import { EXPLORATION_MODE } from "./exploration";
import { DOWNTIME_MODE } from "./downtime";

export interface ModeDef {
  /** Appended to the system prompt while this mode is active. */
  promptFragment: string;
  /** Extra JSON folded into the per-turn Campaign State context. */
  contextSlice?: (state: CampaignState) => Record<string, unknown> | undefined;
}

const STUB = (name: string): ModeDef => ({
  promptFragment: `\n\n## Mode: ${name}\n\nThis subsystem isn't built yet — steer the fiction back to exploration and set \`delta.mode.exit = true\`.`,
});

export const MODES: Record<Mode, ModeDef> = {
  exploration: EXPLORATION_MODE,
  downtime: DOWNTIME_MODE,
  netrun: STUB("netrun"),
  chase: STUB("chase"),
};

export function modePromptFragment(state: CampaignState): string {
  return MODES[state.mode]?.promptFragment ?? "";
}

export function modeContextSlice(state: CampaignState): Record<string, unknown> | undefined {
  return MODES[state.mode]?.contextSlice?.(state);
}
