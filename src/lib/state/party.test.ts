import { describe, it, expect } from "vitest";
import { newCampaignState, CampaignState, type CampaignState as CS } from "./campaignState";

/** The PartyRail swap logic, replicated as a pure transform for testing. */
function swapIn(s: CS, id: string): CS {
  const next = structuredClone(s);
  const i = next.party.bench.findIndex((m) => m.id === id);
  if (i < 0) return next;
  const incoming = next.party.bench[i].sheet;
  next.party.bench[i] = { id: "swapped", sheet: next.character };
  next.character = incoming;
  return next;
}

describe("party mode", () => {
  it("state parses with a bench and round-trips", () => {
    const s = newCampaignState({ id: "c", name: "T", mode: "gigs", character: { name: "V", stats: {}, hp_max: 30, hp_current: 30 } });
    s.party.bench.push({ id: "m1", sheet: { name: "Jax", stats: {}, hp_max: 25, hp_current: 20 } });
    const parsed = CampaignState.parse(JSON.parse(JSON.stringify(s)));
    expect(parsed.party.bench[0].sheet.name).toBe("Jax");
  });

  it("swapping keeps the party whole — active <-> bench, no PC lost", () => {
    let s = newCampaignState({ id: "c", name: "T", mode: "gigs", character: { name: "V", stats: {}, hp_max: 30, hp_current: 12 } });
    s.party.bench.push({ id: "m1", sheet: { name: "Jax", stats: {}, hp_max: 25, hp_current: 25 } });
    s = swapIn(s, "m1");
    expect(s.character.name).toBe("Jax");
    expect(s.party.bench).toHaveLength(1);
    expect(s.party.bench[0].sheet.name).toBe("V");
    expect(s.party.bench[0].sheet.hp_current).toBe(12); // V's damage preserved
  });
});
