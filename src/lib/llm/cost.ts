/**
 * Token accounting + cost estimate — FEATURE_PLAN.md §1.4 / §M1.
 *
 * Accumulate `response.usage` from every model call into `state.meta.usage`,
 * then estimate a dollar figure for the session cost meter. The figure is an
 * estimate — published per-token rates, no taxes/discounts.
 */

import type { Usage } from "../state/campaignState";

/** Shape of the SDK's `message.usage`. */
export interface ApiUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
}

/** USD per 1,000,000 tokens. */
const RATES: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  "claude-sonnet-5": { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
  "claude-opus-5": { input: 15, output: 75, cacheRead: 1.5, cacheWrite: 18.75 },
  "claude-haiku-4-5": { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 },
};

function rateFor(model: string) {
  const key = Object.keys(RATES).find((k) => model.startsWith(k));
  return RATES[key ?? "claude-sonnet-5"];
}

/** Fold one API usage block into the running total. `turns` is untouched. */
export function addUsage(acc: Usage, d: ApiUsage | undefined | null): Usage {
  if (!d) return acc;
  return {
    inputTokens: acc.inputTokens + (d.input_tokens ?? 0),
    outputTokens: acc.outputTokens + (d.output_tokens ?? 0),
    cacheReadTokens: acc.cacheReadTokens + (d.cache_read_input_tokens ?? 0),
    cacheWriteTokens: acc.cacheWriteTokens + (d.cache_creation_input_tokens ?? 0),
    turns: acc.turns,
  };
}

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
