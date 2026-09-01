/**
 * Undo ring — FEATURE_PLAN.md §1.3 / §M1.
 *
 * Before every player turn we snapshot the whole Campaign State (minus its own
 * history, so snapshots don't nest) onto `state.history`. `undo` pops the last
 * snapshot and restores it. Cheap, and the safety net the tool never had.
 */

import type { CampaignState } from "./campaignState";

export const HISTORY_LIMIT = 10;

/** A snapshot is the state with the big, self-healing bits stripped: its own
 *  `history` (no nesting) and `transcript` (the model re-reads current state
 *  fresh every turn, so a slightly-ahead transcript self-corrects). Keeps the
 *  snapshot small enough for a 10-deep ring in localStorage. */
export function snapshotFor(state: CampaignState): CampaignState {
  const clone = structuredClone(state) as Partial<CampaignState>;
  delete clone.history;
  clone.transcript = [];
  return clone as CampaignState;
}

/** Return a new state with `label`'s snapshot pushed (ring capped at HISTORY_LIMIT). */
export function pushHistory(state: CampaignState, label: string): CampaignState {
  const next = structuredClone(state);
  const entry = { ts: Date.now(), label: (label || "turn").slice(0, 120), snapshot: snapshotFor(state) };
  next.history = [...(next.history ?? []), entry].slice(-HISTORY_LIMIT);
  return next;
}

/** Pop the newest snapshot. Returns null when there's nothing to undo. */
export function popHistory(state: CampaignState): { state: CampaignState; label: string } | null {
  const hist = state.history ?? [];
  if (hist.length === 0) return null;
  const last = hist[hist.length - 1];
  const restored = structuredClone(last.snapshot) as CampaignState;
  restored.history = hist.slice(0, -1);
  restored.meta.lastPlayedAt = Date.now();
  return { state: restored, label: last.label };
}
