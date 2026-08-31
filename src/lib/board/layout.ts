/**
 * Mission Board layout — SOLO_MODE_BUILD_PLAN.md §13.
 *
 * The board is a view over the intel the GM already tracks. This module owns:
 *  - autoLayoutBoard: the "blow up" — build a fresh window set on mission start
 *  - syncBoard: after every turn, spawn a (collapsed) window for anything the GM
 *    just mentioned that isn't on the board yet, so nothing is ever invisible
 */

import type { CampaignState, MissionBoard } from "../state/campaignState";

type BoardWindow = MissionBoard["windows"][number];

const uid = () => `w_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
const now = () => Date.now();

const GRID = { x0: 24, y0: 24, w: 300, h: 210, gapX: 24, gapY: 24, cols: 3 };
function slot(i: number): { x: number; y: number; w: number; h: number } {
  const col = i % GRID.cols;
  const row = Math.floor(i / GRID.cols);
  return {
    x: GRID.x0 + col * (GRID.w + GRID.gapX),
    y: GRID.y0 + row * (GRID.h + GRID.gapY),
    w: GRID.w,
    h: GRID.h,
  };
}

/** An NPC worth a window: has facts, isn't plain neutral, isn't dead-and-forgotten. */
function npcIsIntel(n: CampaignState["world"]["npcs"][number]): boolean {
  if (n.notableFacts.length > 0) return true;
  if (n.sheet) return true;
  const d = (n.disposition ?? "").toLowerCase();
  return d !== "" && d !== "neutral" && d !== "unknown";
}

function hasWindow(board: MissionBoard, kind: BoardWindow["kind"], refId: string | null): boolean {
  return board.windows.some((w) => w.kind === kind && w.refId === refId);
}

function mkWindow(kind: BoardWindow["kind"], refId: string | null, pos: { x: number; y: number; w: number; h: number }, extra: Partial<BoardWindow> = {}): BoardWindow {
  return {
    id: uid(),
    kind,
    refId,
    x: pos.x,
    y: pos.y,
    w: pos.w,
    h: pos.h,
    z: 1,
    collapsed: false,
    pinned: false,
    noteText: "",
    createdAt: now(),
    ...extra,
  };
}

/**
 * Mission start: keep any pinned / user-moved windows, (re)build the default set
 * around the focus quest. Bumps `blowUpAt` so the UI animates the entrance.
 */
export function autoLayoutBoard(state: CampaignState, focusQuestId?: string | null): MissionBoard {
  const board: MissionBoard = structuredClone(state.missionBoard);
  const world = state.world;

  // Keep pinned + note windows + anything the player has clearly arranged.
  const kept = board.windows.filter((w) => w.pinned || w.kind === "note");
  const keptRefs = new Set(kept.map((w) => `${w.kind}:${w.refId}`));
  const next: BoardWindow[] = [...kept];
  let i = 0;
  const place = (kind: BoardWindow["kind"], refId: string | null, extra?: Partial<BoardWindow>) => {
    if (keptRefs.has(`${kind}:${refId}`)) return;
    next.push(mkWindow(kind, refId, slot(i++), extra));
  };

  const activeQuests = state.questLog.filter((q) => q.status === "active");
  const focus = focusQuestId ? activeQuests.find((q) => q.id === focusQuestId) : activeQuests[0];
  if (focus) place("objective", focus.id, { pinned: true });
  for (const q of activeQuests) if (q.id !== focus?.id) place("objective", q.id);

  for (const n of world.npcs.filter(npcIsIntel)) place("dossier", n.id);
  for (const l of world.knownLocations) place("location", l.name);
  for (const f of world.factions.filter((f) => (f.standingWithPC ?? "neutral").toLowerCase() !== "neutral" || f.notableFacts.length))
    place("faction", f.name);

  if (state.campaignBible) place("bible", null);
  if (next.filter((w) => w.kind === "dossier").length >= 2) place("connections", null);

  board.windows = next;
  board.activeMissionQuestId = focus?.id ?? null;
  board.blowUpAt = now();
  return board;
}

/**
 * Run after every applyDelta: add a collapsed window for anything the GM just
 * referenced that has no window yet. Never removes windows.
 */
export function syncBoard(state: CampaignState): MissionBoard {
  const board: MissionBoard = structuredClone(state.missionBoard);
  if (board.windows.length === 0 && board.blowUpAt === 0) return board; // board not started yet

  const stacked = () => board.windows.filter((w) => w.collapsed && w.y < 40).length;
  const parkPos = () => ({ x: 24 + stacked() * 34, y: 8, w: 260, h: 44 });

  for (const n of state.world.npcs) {
    if (npcIsIntel(n) && !hasWindow(board, "dossier", n.id)) {
      board.windows.push(mkWindow("dossier", n.id, parkPos(), { collapsed: true }));
    }
  }
  for (const l of state.world.knownLocations) {
    if (!hasWindow(board, "location", l.name)) {
      board.windows.push(mkWindow("location", l.name, parkPos(), { collapsed: true }));
    }
  }
  for (const q of state.questLog.filter((q) => q.status === "active")) {
    if (!hasWindow(board, "objective", q.id)) {
      board.windows.push(mkWindow("objective", q.id, parkPos(), { collapsed: true }));
    }
  }
  return board;
}
