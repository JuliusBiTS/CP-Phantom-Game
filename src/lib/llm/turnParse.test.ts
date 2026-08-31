import { describe, it, expect } from "vitest";
import { coerceObject, parseCommitInput } from "./turn";

describe("coerceObject", () => {
  it("unwraps a JSON-string object / array, leaves everything else", () => {
    expect(coerceObject('{"a":1}')).toEqual({ a: 1 });
    expect(coerceObject("[1,2]")).toEqual([1, 2]);
    expect(coerceObject({ a: 1 })).toEqual({ a: 1 });
    expect(coerceObject("just a string")).toBe("just a string");
    expect(coerceObject("{not json")).toBe("{not json");
    expect(coerceObject(42)).toBe(42);
  });
});

describe("parseCommitInput", () => {
  it("accepts a normal object input", () => {
    const r = parseCommitInput({ narration: "You duck.", delta: { pcHpChange: -3 } });
    expect(r.narration).toBe("You duck.");
    expect(r.delta.pcHpChange).toBe(-3);
    expect(r.deltaError).toBeUndefined();
  });

  it("recovers when delta arrives as a JSON string (the reported bug)", () => {
    const r = parseCommitInput({ narration: "You move.", delta: JSON.stringify({ moveToLocation: "Watson" }) });
    expect(r.delta.moveToLocation).toBe("Watson");
    expect(r.deltaError).toBeUndefined();
  });

  it("recovers when the whole input is a JSON string", () => {
    const r = parseCommitInput(JSON.stringify({ narration: "Hi", delta: { advanceDays: 1 } }));
    expect(r.narration).toBe("Hi");
    expect(r.delta.advanceDays).toBe(1);
  });

  it("downgrades a truly invalid delta to empty + flags deltaError, keeping narration", () => {
    const r = parseCommitInput({ narration: "Kept.", delta: { suggestedActions: "not an array" } });
    expect(r.narration).toBe("Kept.");
    expect(r.delta).toEqual({});
    expect(r.deltaError).toBeTruthy();
  });

  it("tolerates a missing delta", () => {
    const r = parseCommitInput({ narration: "Only prose." });
    expect(r.delta).toEqual({});
    expect(r.deltaError).toBeUndefined();
  });
});
