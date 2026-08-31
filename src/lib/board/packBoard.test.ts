import { describe, it, expect } from "vitest";
import { packBoard } from "./layout";
import type { CampaignState } from "../state/campaignState";

type Board = CampaignState["missionBoard"];

function win(id: string, extra: Partial<Board["windows"][number]> = {}): Board["windows"][number] {
  return { id, kind: "dossier", refId: id, x: 0, y: 0, w: 280, h: 200, z: 1, collapsed: false, pinned: false, noteText: "", createdAt: 1, ...extra };
}

function board(ws: Board["windows"]): Board {
  return { windows: ws, links: [], activeMissionQuestId: null, lastOpenedAt: 0, blowUpAt: 0 };
}

function rectsOverlap(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

describe("packBoard", () => {
  it("produces a non-overlapping layout", () => {
    const ws = Array.from({ length: 12 }, (_, i) => win(`w${i}`, { createdAt: i, h: 150 + (i % 3) * 60 }));
    const out = packBoard(board(ws), 1300);
    for (let i = 0; i < out.windows.length; i++) {
      for (let j = i + 1; j < out.windows.length; j++) {
        expect(rectsOverlap(out.windows[i], out.windows[j])).toBe(false);
      }
    }
  });

  it("orders pinned first, then by kind, then by age", () => {
    const ws = [
      win("note", { kind: "note", createdAt: 1 }),
      win("obj", { kind: "objective", createdAt: 5 }),
      win("pinnedDossier", { kind: "dossier", pinned: true, createdAt: 9 }),
      win("oldDossier", { kind: "dossier", createdAt: 2 }),
    ];
    const out = packBoard(board(ws), 400); // 1 column → order == y order
    const ids = [...out.windows].sort((a, b) => a.y - b.y).map((w) => w.id);
    expect(ids).toEqual(["pinnedDossier", "obj", "oldDossier", "note"]);
  });

  it("keeps the same window set — nothing added or dropped", () => {
    const ws = [win("a"), win("b", { kind: "note" }), win("c", { kind: "bible", refId: null })];
    const out = packBoard(board(ws), 1200);
    expect(out.windows.map((w) => w.id).sort()).toEqual(["a", "b", "c"]);
  });

  it("collapses to one column on a narrow viewport", () => {
    const out = packBoard(board([win("a"), win("b"), win("c")]), 380);
    const xs = new Set(out.windows.map((w) => w.x));
    expect(xs.size).toBe(1);
  });
});
