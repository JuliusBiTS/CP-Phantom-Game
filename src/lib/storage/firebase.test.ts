import { describe, it, expect } from "vitest";
import { soloPath } from "./firebase";

/**
 * Locks in the isolation guarantee: the solo tool's one write primitive
 * (`soloWrite` → `soloPath`) can never target anything outside `soloCampaigns/`,
 * and in particular can never touch CP Phantom's `campaign/` data.
 */
describe("soloPath — CP Phantom data isolation", () => {
  it("keeps normal solo paths under soloCampaigns/", () => {
    expect(soloPath("campaigns/c_123")).toBe("soloCampaigns/campaigns/c_123");
    expect(soloPath("index/c_123")).toBe("soloCampaigns/index/c_123");
    expect(soloPath("/index/")).toBe("soloCampaigns/index");
  });

  it("refuses to target CP Phantom's campaign node, however phrased", () => {
    expect(() => soloPath("campaign")).toThrow();
    expect(() => soloPath("campaign/characters/abc")).toThrow();
    expect(() => soloPath("/campaign/characters/abc")).toThrow();
    expect(() => soloPath("campaign/mapImage")).toThrow();
  });

  it("refuses path traversal", () => {
    expect(() => soloPath("../campaign")).toThrow();
    expect(() => soloPath("x/../../campaign/characters")).toThrow();
  });

  it("refuses a re-prefixed / smuggled sibling path", () => {
    expect(() => soloPath("soloCampaigns/../campaign")).toThrow();
  });
});
