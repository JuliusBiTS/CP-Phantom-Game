import { describe, it, expect } from "vitest";
import { autoLayoutBoard, syncBoard } from "./layout";
import { applyDelta } from "../state/delta";
import { newCampaignState, type CampaignState } from "../state/campaignState";

function base(): CampaignState {
  const s = newCampaignState({ id: "c", name: "T", mode: "gigs", character: { name: "V", stats: {}, hp_max: 30, hp_current: 30 } });
  s.questLog.push({ id: "q1", title: "Find Diaz", status: "active", summary: "", flags: {} });
  s.world.npcs.push({ id: "rook", name: "Rook", disposition: "hostile", status: "alive", notableFacts: ["Runs the Coin Slot"] });
  s.world.npcs.push({ id: "bystander", name: "Bystander", disposition: "neutral", status: "alive", notableFacts: [] });
  s.world.knownLocations.push({ name: "Coin Slot", description: "A dive", notableFacts: [] });
  return s;
}

describe("autoLayoutBoard", () => {
  it("builds windows for the focus objective, intel NPCs, and locations — not plain neutrals", () => {
    const board = autoLayoutBoard(base(), "q1");
    const kinds = board.windows.map((w) => `${w.kind}:${w.refId}`);
    expect(kinds).toContain("objective:q1");
    expect(kinds).toContain("dossier:rook");
    expect(kinds).toContain("location:Coin Slot");
    expect(kinds).not.toContain("dossier:bystander"); // neutral, no facts
    expect(board.windows.find((w) => w.kind === "objective")?.pinned).toBe(true);
    expect(board.blowUpAt).toBeGreaterThan(0);
  });

  it("keeps pinned + note windows across a re-layout", () => {
    const s = base();
    s.missionBoard.windows.push({ id: "keep", kind: "note", refId: null, x: 500, y: 500, w: 200, h: 100, z: 3, collapsed: false, pinned: false, noteText: "my plan", createdAt: 1 });
    const board = autoLayoutBoard(s, "q1");
    expect(board.windows.some((w) => w.id === "keep")).toBe(true);
  });
});

describe("applyDelta — mission board", () => {
  it("event: mission-start triggers the layout", () => {
    const s = applyDelta(base(), {
      upsertQuests: [{ id: "q2", title: "New gig", status: "active" }],
      missionBoard: { event: "mission-start", focusQuestId: "q2" },
    });
    expect(s.missionBoard.activeMissionQuestId).toBe("q2");
    expect(s.missionBoard.windows.some((w) => w.kind === "objective" && w.refId === "q2")).toBe(true);
  });

  it("pin creates a featured window with the GM note", () => {
    let s = autoLayoutState(base());
    s = applyDelta(s, { missionBoard: { pin: [{ kind: "dossier", refId: "rook", note: "the lead" }] } });
    const w = s.missionBoard.windows.find((x) => x.kind === "dossier" && x.refId === "rook");
    expect(w?.pinned).toBe(true);
    expect(w?.gmNote).toBe("the lead");
  });

  it("addLinks connects two windows", () => {
    let s = autoLayoutState(base());
    s = applyDelta(s, {
      upsertFactions: [{ name: "Tyger Claws" }],
      missionBoard: { addLinks: [{ fromKind: "dossier", fromRefId: "rook", toKind: "faction", toRefId: "Tyger Claws", label: "runs with" }] },
    });
    expect(s.missionBoard.links.length).toBe(1);
    expect(s.missionBoard.links[0].label).toBe("runs with");
  });

  it("syncBoard auto-spawns a collapsed dossier for a newly-mentioned NPC", () => {
    let s = autoLayoutState(base());
    s = applyDelta(s, { upsertNpcs: [{ id: "newguy", name: "New Guy", addFacts: ["Saw the whole thing"] }] });
    const w = s.missionBoard.windows.find((x) => x.kind === "dossier" && x.refId === "newguy");
    expect(w).toBeTruthy();
    expect(w?.collapsed).toBe(true);
  });
});

function autoLayoutState(s: CampaignState): CampaignState {
  const next = structuredClone(s);
  next.missionBoard = autoLayoutBoard(next, "q1");
  return next;
}

describe("syncBoard", () => {
  it("no-ops when the board hasn't been started", () => {
    const b = syncBoard(base());
    expect(b.windows).toEqual([]);
  });
});
