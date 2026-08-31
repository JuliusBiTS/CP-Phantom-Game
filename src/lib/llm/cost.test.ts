import { describe, it, expect } from "vitest";
import { addUsage, estimateCostUsd, formatCostUsd, totalTokens } from "./cost";
import type { Usage } from "../state/campaignState";

const zero: Usage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, turns: 0 };

describe("addUsage", () => {
  it("folds an API usage block in and leaves turns alone", () => {
    const u = addUsage({ ...zero, turns: 3 }, {
      input_tokens: 100,
      output_tokens: 50,
      cache_read_input_tokens: 900,
      cache_creation_input_tokens: 10,
    });
    expect(u).toEqual({ inputTokens: 100, outputTokens: 50, cacheReadTokens: 900, cacheWriteTokens: 10, turns: 3 });
  });

  it("tolerates missing / null fields and undefined input", () => {
    expect(addUsage(zero, undefined)).toBe(zero);
    expect(addUsage(zero, { input_tokens: 5, cache_read_input_tokens: null })).toMatchObject({ inputTokens: 5, cacheReadTokens: 0 });
  });

  it("accumulates across calls", () => {
    let u = zero;
    u = addUsage(u, { input_tokens: 10, output_tokens: 1 });
    u = addUsage(u, { input_tokens: 10, output_tokens: 2 });
    expect(totalTokens(u)).toBe(23);
  });
});

describe("estimateCostUsd", () => {
  it("prices sonnet-5 at published rates", () => {
    const u: Usage = { inputTokens: 1_000_000, outputTokens: 1_000_000, cacheReadTokens: 0, cacheWriteTokens: 0, turns: 0 };
    expect(estimateCostUsd(u, "claude-sonnet-5")).toBeCloseTo(18, 5); // 3 + 15
  });

  it("falls back to sonnet rates for an unknown model and handles a versioned id", () => {
    const u: Usage = { inputTokens: 1_000_000, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, turns: 0 };
    expect(estimateCostUsd(u, "claude-sonnet-5-20990101")).toBeCloseTo(3, 5);
    expect(estimateCostUsd(u, "mystery-model")).toBeCloseTo(3, 5);
  });
});

describe("formatCostUsd", () => {
  it("shows a sub-cent floor and 0", () => {
    expect(formatCostUsd(0)).toBe("$0.00");
    expect(formatCostUsd(0.003)).toBe("<$0.01");
    expect(formatCostUsd(1.2345)).toBe("$1.23");
  });
});
