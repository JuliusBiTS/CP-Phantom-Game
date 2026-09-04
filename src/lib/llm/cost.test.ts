import { describe, it, expect } from "vitest";
import { addUsage, costOfUsage, estimateCostUsd, formatCostUsd, mergeUsage, totalTokens, usageDelta } from "./cost";
import type { Usage } from "../state/campaignState";

const zero: Usage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, turns: 0, costUsd: 0 };

describe("addUsage", () => {
  it("folds an API usage block in, prices it at the given model's rate, and leaves turns alone", () => {
    const u = addUsage(
      { ...zero, turns: 3 },
      { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 900, cache_creation_input_tokens: 10 },
      "claude-sonnet-5",
    );
    expect(u.inputTokens).toBe(100);
    expect(u.outputTokens).toBe(50);
    expect(u.cacheReadTokens).toBe(900);
    expect(u.cacheWriteTokens).toBe(10);
    expect(u.turns).toBe(3);
    expect(u.costUsd).toBeCloseTo(costOfUsage({ input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 900, cache_creation_input_tokens: 10 }, "claude-sonnet-5"), 10);
  });

  it("tolerates missing / null fields and undefined input", () => {
    expect(addUsage(zero, undefined, "claude-sonnet-5")).toBe(zero);
    expect(addUsage(zero, { input_tokens: 5, cache_read_input_tokens: null }, "claude-sonnet-5")).toMatchObject({ inputTokens: 5, cacheReadTokens: 0 });
  });

  it("accumulates across calls", () => {
    let u = zero;
    u = addUsage(u, { input_tokens: 10, output_tokens: 1 }, "claude-sonnet-5");
    u = addUsage(u, { input_tokens: 10, output_tokens: 2 }, "claude-sonnet-5");
    expect(totalTokens(u)).toBe(23);
  });

  it("prices mixed-model calls correctly — the point of per-call costing", () => {
    // A Sonnet narrator call and a Haiku background-job call must not both be
    // priced at whichever model happens to be state.meta.model.
    let u = zero;
    u = addUsage(u, { input_tokens: 1_000_000, output_tokens: 0 }, "claude-sonnet-5"); // $2
    u = addUsage(u, { input_tokens: 1_000_000, output_tokens: 0 }, "claude-haiku-4-5"); // $1
    expect(u.costUsd).toBeCloseTo(3, 5);
    // A single-rate re-estimate over the blended tokens would get this wrong
    // (2M tokens at sonnet's $2 = $4, not the true $3) — that's the bug this fixes.
    expect(estimateCostUsd(u, "claude-sonnet-5")).toBeCloseTo(4, 5);
  });
});

describe("usageDelta / mergeUsage", () => {
  it("produces a Usage-shaped delta with turns always 0", () => {
    const d = usageDelta({ input_tokens: 100, output_tokens: 20 }, "claude-haiku-4-5");
    expect(d).toEqual({ inputTokens: 100, outputTokens: 20, cacheReadTokens: 0, cacheWriteTokens: 0, turns: 0, costUsd: costOfUsage({ input_tokens: 100, output_tokens: 20 }, "claude-haiku-4-5") });
  });

  it("returns an all-zero delta for undefined usage", () => {
    expect(usageDelta(undefined, "claude-sonnet-5")).toEqual({ ...zero });
  });

  it("merges without needing model info (a client can fold a server-costed delta)", () => {
    const bibleDelta = usageDelta({ input_tokens: 1_000_000 }, "claude-sonnet-5"); // $2
    const gigsDelta = usageDelta({ input_tokens: 1_000_000 }, "claude-sonnet-5"); // $2
    const merged = mergeUsage(bibleDelta, gigsDelta);
    expect(merged.inputTokens).toBe(2_000_000);
    expect(merged.costUsd).toBeCloseTo(4, 5);
  });
});

describe("estimateCostUsd", () => {
  it("prices sonnet-5 at published rates", () => {
    const u: Usage = { ...zero, inputTokens: 1_000_000, outputTokens: 1_000_000 };
    expect(estimateCostUsd(u, "claude-sonnet-5")).toBeCloseTo(12, 5); // $2 + $10
  });

  it("prices opus-5 at published rates", () => {
    const u: Usage = { ...zero, inputTokens: 1_000_000, outputTokens: 1_000_000 };
    expect(estimateCostUsd(u, "claude-opus-5")).toBeCloseTo(30, 5); // $5 + $25
  });

  it("falls back to sonnet rates for an unknown model and handles a versioned id", () => {
    const u: Usage = { ...zero, inputTokens: 1_000_000 };
    expect(estimateCostUsd(u, "claude-sonnet-5-20990101")).toBeCloseTo(2, 5);
    expect(estimateCostUsd(u, "mystery-model")).toBeCloseTo(2, 5);
  });
});

describe("formatCostUsd", () => {
  it("shows a sub-cent floor and 0", () => {
    expect(formatCostUsd(0)).toBe("$0.00");
    expect(formatCostUsd(0.003)).toBe("<$0.01");
    expect(formatCostUsd(1.2345)).toBe("$1.23");
  });
});
