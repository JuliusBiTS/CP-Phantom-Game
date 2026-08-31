import { describe, it, expect } from "vitest";
import { COVER_MATERIALS, findCoverMaterial, coverHpFor } from "./cover";

describe("cover materials (§18.2)", () => {
  it("has the six materials with the book's thick/thin HP", () => {
    expect(COVER_MATERIALS.map((m) => [m.key, m.thick, m.thin])).toEqual([
      ["steel", 50, 25],
      ["stone", 40, 20],
      ["ballistic-glass", 30, 15],
      ["concrete", 25, 10],
      ["wood", 20, 5],
      ["plastic", 15, 0],
    ]);
  });

  it("finds a material by key, label, or loose substring", () => {
    expect(findCoverMaterial("steel")?.key).toBe("steel");
    expect(findCoverMaterial("Concrete")?.key).toBe("concrete");
    expect(findCoverMaterial("a thick concrete barricade")?.key).toBe("concrete");
    expect(findCoverMaterial("marshmallow")).toBeUndefined();
    expect(findCoverMaterial(undefined)).toBeUndefined();
  });

  it("coverHpFor keys off thickness, defaults thick", () => {
    expect(coverHpFor("steel")).toBe(50);
    expect(coverHpFor("steel", "thin")).toBe(25);
    expect(coverHpFor("wood", "thin")).toBe(5);
    expect(coverHpFor("nonsense")).toBeNull();
  });
});
