/**
 * Token accounting + cost estimate — FEATURE_PLAN.md §1.4 / §M1.
 *
 * Accumulate `response.usage` from every model call into `state.meta.usage`,
 * then estimate a dollar figure for the session cost meter. The figure is an
 * estimate — published per-token rates, no taxes/discounts.
 *
 * `costUsd` is costed per call, at that call's own model's rate, then summed —
 * NOT recomputed later from summed raw tokens under one assumed model. The
 * app calls three models (Sonnet 5 narrator, Haiku 4.5 for background jobs),
 * so pricing the blended token total at a single rate would misprice whichever
 * model isn't `state.meta.model`.
 */

import type { Usage } from "../state/campaignState";

/** Shape of the SDK's `message.usage`. */
export interface ApiUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
}

/** USD per 1,000,000 tokens. Verify against platform.claude.com pricing before
 *  changing — these drift when Anthropic updates rates. */
const RATES: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  "claude-sonnet-5": { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  "claude-opus-5": { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  "claude-haiku-4-5": { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 },
};

function rateFor(model: string) {
  const key = Object.keys(RATES).find((k) => model.startsWith(k));
  return RATES[key ?? "claude-sonnet-5"];
}

/** Dollar cost of one API usage block, at one model's published rates. */
export function costOfUsage(d: ApiUsage | undefined | null, model: string): number {
  if (!d) return 0;
  const r = rateFor(model);
  return (
    ((d.input_tokens ?? 0) * r.input +
      (d.output_tokens ?? 0) * r.output +
      (d.cache_read_input_tokens ?? 0) * r.cacheRead +
      (d.cache_creation_input_tokens ?? 0) * r.cacheWrite) /
    1_000_000
  );
}

/** One API usage block, from a call on `model`, as a Usage-shaped delta —
 *  for server routes that don't hold a running Usage accumulator themselves
 *  (recap, world-tick, campaign generation) and just hand the client
 *  something to fold in with `mergeUsage`. `turns` is always 0: only the main
 *  turn loop bumps that, once per player action. */
export function usageDelta(d: ApiUsage | undefined | null, model: string): Usage {
  return {
    inputTokens: d?.input_tokens ?? 0,
    outputTokens: d?.output_tokens ?? 0,
    cacheReadTokens: d?.cache_read_input_tokens ?? 0,
    cacheWriteTokens: d?.cache_creation_input_tokens ?? 0,
    turns: 0,
    costUsd: costOfUsage(d, model),
  };
}

/** Field-wise sum of two Usage totals — no model/rate knowledge needed, so
 *  it's safe to call client-side on a delta a server route already costed. */
export function mergeUsage(acc: Usage, delta: Usage): Usage {
  return {
    inputTokens: acc.inputTokens + delta.inputTokens,
    outputTokens: acc.outputTokens + delta.outputTokens,
    cacheReadTokens: acc.cacheReadTokens + delta.cacheReadTokens,
    cacheWriteTokens: acc.cacheWriteTokens + delta.cacheWriteTokens,
    turns: acc.turns + delta.turns,
    costUsd: (acc.costUsd ?? 0) + (delta.costUsd ?? 0),
  };
}

/** Fold one API usage block into the running total. `turns` is untouched —
 *  only the main turn loop bumps that, separately, once per player action. */
export function addUsage(acc: Usage, d: ApiUsage | undefined | null, model: string): Usage {
  if (!d) return acc;
  return mergeUsage(acc, usageDelta(d, model));
}

/** Fallback for usage recorded before `costUsd` existed (or a save from
 *  before per-call costing shipped): recompute assuming everything ran on
 *  one model. Inaccurate for a campaign that mixed models — real totals are
 *  in `u.costUsd` going forward. */
export function estimateCostUsd(u: Usage | undefined, model = "claude-sonnet-5"): number {
  if (!u) return 0;
  const r = rateFor(model);
  return (
    (u.inputTokens * r.input +
      u.outputTokens * r.output +
      u.cacheReadTokens * r.cacheRead +
      u.cacheWriteTokens * r.cacheWrite) /
    1_000_000
  );
}

export function formatCostUsd(n: number): string {
  if (n <= 0) return "$0.00";
  if (n < 0.01) return "<$0.01";
  return "$" + n.toFixed(2);
}

export function totalTokens(u: Usage | undefined): number {
  if (!u) return 0;
  return u.inputTokens + u.outputTokens + u.cacheReadTokens + u.cacheWriteTokens;
}
