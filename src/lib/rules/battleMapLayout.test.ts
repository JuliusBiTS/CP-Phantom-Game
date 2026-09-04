import { describe, expect, it } from "vitest";
import { adjacentPairs, layoutZones } from "./battleMapLayout";

describe("layoutZones", () => {
  it("keeps explicit gx/gy as given", () => {
    const out = layoutZones([
      { id: "bar", gx: 1, gy: 1 },
      { id: "door", gx: 0, gy: 0 },
    ]);
    expect(out).toEqual([
      { id: "bar", gx: 1, gy: 1 },
      { id: "door", gx: 0, gy: 0 },
    ]);
  });

  it("auto-places zones with no coordinates at all (old saves / omitted by the GM)", () => {
    const out = layoutZones([{ id: "a" }, { id: "b" }, { id: "c" }]);
    expect(out).toHaveLength(3);
    const keys = out.map((z) => `${z.gx},${z.gy}`);
    expect(new Set(keys).size).toBe(3); // no overlap
    for (const z of out) {
      expect(z.gx).toBeGreaterThanOrEqual(0);
      expect(z.gy).toBeGreaterThanOrEqual(0);
    }
  });

  it("packs a mix of explicit and missing coordinates without collisions", () => {
    const out = layoutZones([
      { id: "fixed", gx: 0, gy: 0 },
      { id: "auto1" },
      { id: "auto2" },
    ]);
    const keys = out.map((z) => `${z.gx},${z.gy}`);
    expect(new Set(keys).size).toBe(3);
    const fixed = out.find((z) => z.id === "fixed")!;
    expect(fixed.gx).toBe(0);
    expect(fixed.gy).toBe(0);
  });

  it("falls back to auto-placement when two zones claim the same explicit cell", () => {
    const out = layoutZones([
      { id: "first", gx: 2, gy: 2 },
      { id: "second", gx: 2, gy: 2 },
    ]);
    const keys = out.map((z) => `${z.gx},${z.gy}`);
    expect(new Set(keys).size).toBe(2); // still no overlap
    expect(out.find((z) => z.id === "first")).toEqual({ id: "first", gx: 2, gy: 2 });
  });

  it("clamps out-of-range explicit coordinates onto the board", () => {
    const out = layoutZones([{ id: "far", gx: 99, gy: -5 }]);
    expect(out[0].gx).toBeLessThanOrEqual(4);
    expect(out[0].gy).toBeGreaterThanOrEqual(0);
  });

  it("preserves input order in the returned array", () => {
    const out = layoutZones([{ id: "z1" }, { id: "z2", gx: 3, gy: 3 }, { id: "z3" }]);
    expect(out.map((z) => z.id)).toEqual(["z1", "z2", "z3"]);
  });

  it("is deterministic across repeated calls with the same input", () => {
    const zones = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
    const first = layoutZones(zones);
    const second = layoutZones(zones);
    expect(second).toEqual(first);
  });

  it("handles zero zones", () => {
    expect(layoutZones([])).toEqual([]);
  });
});

describe("adjacentPairs", () => {
  it("connects only orthogonally adjacent cells, not diagonal or distant ones", () => {
    const laidOut = [
      { id: "a", gx: 0, gy: 0 },
      { id: "b", gx: 1, gy: 0 }, // adjacent to a
      { id: "c", gx: 1, gy: 1 }, // diagonal to a, adjacent to b
      { id: "d", gx: 4, gy: 4 }, // isolated
    ];
    const pairs = adjacentPairs(laidOut).map(([x, y]) => [x.id, y.id].sort().join("-"));
    expect(pairs).toContain("a-b");
    expect(pairs).toContain("b-c");
    expect(pairs).not.toContain("a-c");
    expect(pairs.some((p) => p.includes("d"))).toBe(false);
  });

  it("returns nothing for a single zone", () => {
    expect(adjacentPairs([{ id: "solo", gx: 0, gy: 0 }])).toEqual([]);
  });
});
