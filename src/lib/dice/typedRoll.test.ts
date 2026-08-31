import { describe, it, expect } from "vitest";
import { parseSpokenDice, scoreTypedRoll } from "./typedRoll";

describe("parseSpokenDice", () => {
  it("digits and number words", () => {
    expect(parseSpokenDice("14 12 7")).toEqual([14, 12, 7]);
    expect(parseSpokenDice("fourteen, twelve, seven")).toEqual([14, 12, 7]);
    expect(parseSpokenDice("um 14 uh 99 and 7")).toEqual([14, 7]);
  });
});

describe("scoreTypedRoll — mirrors rollPW cap semantics", () => {
  it("v12 example PW 45 [14,12,7] -> 26", () => {
    expect(scoreTypedRoll(45, [14, 12, 7])).toEqual({ total: 26, outcome: "hit" });
  });
  it("first-die crit", () => {
    expect(scoreTypedRoll(45, [1, 5, 5]).outcome).toBe("crit-success");
    expect(scoreTypedRoll(45, [20, 5, 5]).outcome).toBe("crit-fail");
  });
  it("2nd+ die nat 1 counts cap, nat 20 dropped", () => {
    expect(scoreTypedRoll(45, [10, 1, 20]).total).toBe(30);
  });
  it("single capped die over cap -> miss", () => {
    expect(scoreTypedRoll(12, [17])).toEqual({ total: 0, outcome: "miss" });
  });
});
