import { describe, it, expect } from "vitest";
import { rollInitiativeFor, buildInitiativeOrder, type InitiativeEntry } from "./initiative";

function scripted(v: number[]) {
  let i = 0;
  return () => v[Math.min(i++, v.length - 1)];
}

describe("initiative", () => {
  it("rolls a PW and reports the outcome", () => {
    const e = rollInitiativeFor({ id: "g1", name: "Ganger", isPC: false, pw: 14 }, { roll: scripted([9]) });
    expect(e.outcome).toBe("hit");
    expect(e.value).toBe(9);
  });

  it("crit success on first-die 1, crit fail on first-die 20", () => {
    expect(rollInitiativeFor({ id: "a", name: "A", isPC: false, pw: 14 }, { roll: scripted([1]) }).outcome).toBe("crit-success");
    expect(rollInitiativeFor({ id: "b", name: "B", isPC: false, pw: 14 }, { roll: scripted([20]) }).outcome).toBe("crit-fail");
  });

  it("orders: crit success first, then hits by total, misses by PW, crit fail last", () => {
    const entries: InitiativeEntry[] = [
      { id: "miss1", name: "M1", isPC: false, pw: 30, dice: [], outcome: "miss", value: 30 },
      { id: "hit1", name: "H1", isPC: false, pw: 10, dice: [], outcome: "hit", value: 12 },
      { id: "crit", name: "C", isPC: true, pw: 15, dice: [], outcome: "crit-success", value: 15 },
      { id: "hit2", name: "H2", isPC: false, pw: 10, dice: [], outcome: "hit", value: 18 },
      { id: "fail", name: "F", isPC: false, pw: 20, dice: [], outcome: "crit-fail", value: 20 },
    ];
    const order = buildInitiativeOrder(entries).map((e) => e.id);
    expect(order).toEqual(["crit", "hit2", "hit1", "miss1", "fail"]);
  });
});
