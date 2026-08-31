import { describe, it, expect } from "vitest";
import {
  CRIT_INJURY_BODY,
  CRIT_INJURY_HEAD,
  critInjuryRow,
  resolveCritInjury,
  surgeryCostEb,
} from "./criticalInjuries";

describe("critical injury tables", () => {
  it("both tables are complete 2–12", () => {
    expect(CRIT_INJURY_BODY.map((r) => r.roll)).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(CRIT_INJURY_HEAD.map((r) => r.roll)).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it("looks up by roll and clamps out-of-range", () => {
    expect(critInjuryRow("body", 8).name).toBe("Broken Leg");
    expect(critInjuryRow("head", 2).name).toBe("Lost Eye");
    expect(critInjuryRow("body", 99).roll).toBe(12);
    expect(critInjuryRow("body", -3).roll).toBe(2);
  });
});

describe("resolveCritInjury — §13.1 'already present, next row down'", () => {
  it("returns the rolled row when free", () => {
    expect(resolveCritInjury("body", 8, []).name).toBe("Broken Leg");
  });

  it("walks down when the rolled row is already held", () => {
    const have = [{ table: "body", name: "Broken Leg" }];
    expect(resolveCritInjury("body", 8, have).name).toBe(CRIT_INJURY_BODY[8 - 2 - 1].name); // roll 7
  });

  it("only collides within the same table", () => {
    const have = [{ table: "head", name: "Broken Leg" }]; // wrong table, ignored
    expect(resolveCritInjury("body", 8, have).name).toBe("Broken Leg");
  });
});

describe("surgeryCostEb", () => {
  it("keys off the DV in the fullFix text", () => {
    expect(surgeryCostEb("Surgery DV 22")).toBe(2000);
    expect(surgeryCostEb("Surgery DV 17")).toBe(1000);
    expect(surgeryCostEb("Paramedic DV 15 or Surgery")).toBe(500);
    expect(surgeryCostEb("Surgery DV 12")).toBe(100);
    expect(surgeryCostEb("Quick Fix removes it for good")).toBe(100);
  });
});
