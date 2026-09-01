import { describe, it, expect } from "vitest";
import { pushHistory, popHistory, snapshotFor, HISTORY_LIMIT } from "./history";
import { newCampaignState, type CampaignState } from "./campaignState";

function base(): CampaignState {
  return newCampaignState({ id: "c", name: "T", mode: "gigs", character: { name: "V", stats: {}, hp_max: 30, hp_current: 30 } });
}

describe("history ring", () => {
  it("snapshot strips its own history + transcript so snapshots stay small", () => {
    const s = pushHistory(base(), "one");
    s.transcript = [{ role: "user", content: "big" }];
    const snap = snapshotFor(s) as CampaignState & { history?: unknown };
    expect(snap.history).toBeUndefined();
    expect(snap.transcript).toEqual([]);
    expect(snap.meta.id).toBe("c");
  });

  it("push then pop restores the pre-turn state", () => {
    let s = base();
    s.world.currentLocation = "Watson";
    s = pushHistory(s, "moved");
    s.world.currentLocation = "Pacifica"; // the "turn" happens
    const res = popHistory(s);
    expect(res).not.toBeNull();
    expect(res!.state.world.currentLocation).toBe("Watson");
    expect(res!.label).toBe("moved");
    expect(res!.state.history).toHaveLength(0);
  });

  it("caps the ring at HISTORY_LIMIT, dropping oldest", () => {
    let s = base();
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) s = pushHistory(s, `turn ${i}`);
    expect(s.history).toHaveLength(HISTORY_LIMIT);
    expect(s.history[0].label).toBe(`turn ${5}`);
  });

  it("pop on an empty ring returns null", () => {
    expect(popHistory(base())).toBeNull();
  });

  it("nested undo walks back turn by turn", () => {
    let s = base();
    s.meta.name = "A";
    s = pushHistory(s, "->B");
    s.meta.name = "B";
    s = pushHistory(s, "->C");
    s.meta.name = "C";
    const back1 = popHistory(s)!;
    expect(back1.state.meta.name).toBe("B");
    const back2 = popHistory(back1.state)!;
    expect(back2.state.meta.name).toBe("A");
    expect(popHistory(back2.state)).toBeNull();
  });
});
