"use client";

/**
 * Mission Board — the cyberpunk case wall. SOLO_MODE_BUILD_PLAN.md §13.
 * Draggable/resizable intel windows over the Campaign State; the GM populates
 * it via the turn delta, new intel glows until you've looked. Hotkey `M`.
 */

import { useEffect, useRef, useState } from "react";
import type { CampaignState } from "@/lib/state/campaignState";
import { autoLayoutBoard } from "@/lib/board/layout";

type Board = CampaignState["missionBoard"];
type BWindow = Board["windows"][number];

const MOBILE_BP = 760;

export function MissionBoard({
  state,
  onPatchState,
  onClose,
}: {
  state: CampaignState;
  onPatchState: (mut: (s: CampaignState) => void) => void;
  onClose: () => void;
}) {
  const board = state.missionBoard;
  const [narrow, setNarrow] = useState(false);
  // Freeze "what counts as new" at mount so the glow persists this whole visit.
  const [seenBefore] = useState(() => board.lastOpenedAt);

  useEffect(() => {
    // innerWidth can read 0 transiently (hidden pane) — only go stacked on a real small width.
    const check = () => setNarrow(window.innerWidth > 0 && window.innerWidth < MOBILE_BP);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Mark "seen" a beat after open, so NEW intel glows first.
  useEffect(() => {
    const t = setTimeout(() => onPatchState((s) => { s.missionBoard.lastOpenedAt = Date.now(); }), 2500);
    return () => clearTimeout(t);
  }, [onPatchState]);

  function patchWin(id: string, mut: (w: BWindow) => void) {
    onPatchState((s) => {
      const w = s.missionBoard.windows.find((x) => x.id === id);
      if (w) mut(w);
    });
  }
  function bringForward(id: string) {
    onPatchState((s) => {
      const maxZ = Math.max(0, ...s.missionBoard.windows.map((w) => w.z));
      const w = s.missionBoard.windows.find((x) => x.id === id);
      if (w) w.z = maxZ + 1;
    });
  }
  function closeWin(id: string) {
    onPatchState((s) => {
      s.missionBoard.windows = s.missionBoard.windows.filter((w) => w.id !== id);
      s.missionBoard.links = s.missionBoard.links.filter((l) => l.from !== id && l.to !== id);
    });
  }
  function addNote() {
    onPatchState((s) => {
      s.missionBoard.windows.push({
        id: `w_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        kind: "note",
        refId: null,
        x: 60 + Math.random() * 40,
        y: 60 + Math.random() * 40,
        w: 260,
        h: 180,
        z: Math.max(1, ...s.missionBoard.windows.map((w) => w.z)) + 1,
        collapsed: false,
        pinned: false,
        noteText: "",
        createdAt: Date.now(),
      });
    });
  }

  const header = (
    <div className="board-toolbar">
      <span className="board-title">
        {"// MISSION BOARD"}
        {board.activeMissionQuestId ? ` — ${state.questLog.find((q) => q.id === board.activeMissionQuestId)?.title ?? ""}` : ""}
      </span>
      <span style={{ display: "flex", gap: 6 }}>
        <button onClick={addNote} style={{ padding: "3px 9px", fontSize: 10 }}>+ Note</button>
        <button onClick={() => onPatchState((s) => { s.missionBoard = autoLayoutBoard(s, s.missionBoard.activeMissionQuestId); })} style={{ padding: "3px 9px", fontSize: 10 }}>
          {board.windows.length ? "Re-tidy" : "Build board"}
        </button>
        <button onClick={onClose} style={{ padding: "3px 9px", fontSize: 10 }}>Close (M)</button>
      </span>
    </div>
  );

  if (narrow) {
    return (
      <div className="board-shell board-stacked">
        {header}
        <div style={{ padding: 12, display: "grid", gap: 10 }}>
          {board.windows
            .slice()
            .sort((a, b) => Number(b.pinned) - Number(a.pinned))
            .map((w) => (
              <div key={w.id} className={`board-window ${w.pinned ? "pinned" : ""}`} style={{ position: "static", width: "auto" }}>
                <WindowFrame w={w} state={state} isNew={w.createdAt > seenBefore} patchWin={patchWin} patchState={onPatchState} onClose={() => closeWin(w.id)} onFocus={() => {}} stacked />
              </div>
            ))}
        </div>
      </div>
    );
  }

  return (
    <div className="board-shell">
      {header}
      <div className="board-canvas" key={board.blowUpAt}>
        <div className="board-grid" />
        <div className="board-scan" />
        <LinkLayer board={board} />
        {board.windows.map((w, i) => (
          <div
            key={w.id}
            className={`board-window ${w.pinned ? "pinned" : ""} board-in`}
            style={{ left: w.x, top: w.y, width: w.w, zIndex: w.z, animationDelay: `${Math.min(i * 60, 600)}ms` }}
          >
            <WindowFrame
              w={w}
              state={state}
              isNew={w.createdAt > seenBefore}
              patchWin={patchWin}
              patchState={onPatchState}
              onClose={() => closeWin(w.id)}
              onFocus={() => bringForward(w.id)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── link layer ────────────────────────────────────────────────────────────

function LinkLayer({ board }: { board: Board }) {
  const anchor = (id: string) => {
    const w = board.windows.find((x) => x.id === id);
    if (!w) return null;
    return { x: w.x + w.w / 2, y: w.y + (w.collapsed ? 20 : Math.min(w.h, 120) / 2) };
  };
  return (
    <svg className="board-links" width="100%" height="100%">
      {board.links.map((l) => {
        const a = anchor(l.from);
        const b = anchor(l.to);
        if (!a || !b) return null;
        const mx = (a.x + b.x) / 2;
        return (
          <g key={l.id}>
            <path d={`M ${a.x} ${a.y} C ${mx} ${a.y}, ${mx} ${b.y}, ${b.x} ${b.y}`} className="board-link-line" />
            {l.label && (
              <text x={mx} y={(a.y + b.y) / 2 - 4} className="board-link-label" textAnchor="middle">
                {l.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ── window frame (drag + resize + chrome) ─────────────────────────────────

function WindowFrame({
  w,
  state,
  isNew,
  patchWin,
  patchState,
  onClose,
  onFocus,
  stacked,
}: {
  w: BWindow;
  state: CampaignState;
  isNew: boolean;
  patchWin: (id: string, mut: (w: BWindow) => void) => void;
  patchState: (mut: (s: CampaignState) => void) => void;
  onClose: () => void;
  onFocus: () => void;
  stacked?: boolean;
}) {
  const dragRef = useRef<{ px: number; py: number; wx: number; wy: number } | null>(null);
  const resizeRef = useRef<{ px: number; py: number; ww: number; wh: number } | null>(null);

  function onTitlePointerDown(e: React.PointerEvent) {
    if (stacked) return;
    onFocus();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { px: e.clientX, py: e.clientY, wx: w.x, wy: w.y };
  }
  function onTitlePointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.px;
    const dy = e.clientY - dragRef.current.py;
    patchWin(w.id, (win) => {
      win.x = Math.max(0, dragRef.current!.wx + dx);
      win.y = Math.max(0, dragRef.current!.wy + dy);
    });
  }
  function endDrag(e: React.PointerEvent) {
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    dragRef.current = null;
    resizeRef.current = null;
  }
  function onResizePointerDown(e: React.PointerEvent) {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    resizeRef.current = { px: e.clientX, py: e.clientY, ww: w.w, wh: w.h };
  }
  function onResizePointerMove(e: React.PointerEvent) {
    if (!resizeRef.current) return;
    patchWin(w.id, (win) => {
      win.w = Math.max(180, resizeRef.current!.ww + (e.clientX - resizeRef.current!.px));
      win.h = Math.max(90, resizeRef.current!.wh + (e.clientY - resizeRef.current!.py));
    });
  }

  const title = windowTitle(w, state);

  return (
    <div className={`board-frame ${isNew ? "is-new" : ""}`}>
      <span className="reticle-tr board-bracket" />
      <span className="reticle-bl board-bracket" />
      <div
        className="board-frame-bar"
        onPointerDown={onTitlePointerDown}
        onPointerMove={onTitlePointerMove}
        onPointerUp={endDrag}
        style={{ cursor: stacked ? "default" : "grab" }}
      >
        <span className="board-frame-title">
          {isNew && <span className="board-new">NEW</span>} {title}
        </span>
        <span style={{ display: "flex", gap: 4 }}>
          <button className="board-mini" onClick={() => patchWin(w.id, (x) => { x.pinned = !x.pinned; })} title="Pin">
            {w.pinned ? "★" : "☆"}
          </button>
          <button className="board-mini" onClick={() => patchWin(w.id, (x) => { x.collapsed = !x.collapsed; })} title="Collapse">
            {w.collapsed ? "▸" : "▾"}
          </button>
          <button className="board-mini" onClick={onClose} title="Close">✕</button>
        </span>
      </div>
      {!w.collapsed && (
        <div className="board-frame-body" style={{ maxHeight: stacked ? undefined : w.h }}>
          <WindowBody w={w} state={state} patchWin={patchWin} patchState={patchState} />
        </div>
      )}
      {!stacked && !w.collapsed && (
        <div className="board-resize" onPointerDown={onResizePointerDown} onPointerMove={onResizePointerMove} onPointerUp={endDrag} />
      )}
    </div>
  );
}

function windowTitle(w: BWindow, s: CampaignState): string {
  switch (w.kind) {
    case "dossier": {
      const n = s.world.npcs.find((x) => x.id === w.refId);
      return `DOSSIER — ${n?.name?.toUpperCase() ?? "?"}`;
    }
    case "objective": {
      const q = s.questLog.find((x) => x.id === w.refId);
      return `OBJECTIVE — ${q?.title?.toUpperCase() ?? "?"}`;
    }
    case "location":
      return `LOCATION — ${(w.refId ?? "?").toUpperCase()}`;
    case "faction":
      return `FACTION — ${(w.refId ?? "?").toUpperCase()}`;
    case "note":
      return "NOTE";
    case "connections":
      return "CONNECTIONS";
    case "bible":
      return "CAMPAIGN INTEL — EYES ONLY";
  }
}

// ── window bodies ─────────────────────────────────────────────────────────

function FactList({
  facts,
  onAdd,
}: {
  facts: string[];
  onAdd: (f: string) => void;
}) {
  const [v, setV] = useState("");
  return (
    <div>
      <ul style={{ margin: "4px 0", paddingLeft: 16 }}>
        {facts.map((f, i) => (
          <li key={i} style={{ fontSize: 11 }}>
            {f.startsWith("?") ? <span className="board-lead">{f}</span> : f}
          </li>
        ))}
      </ul>
      <input
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && v.trim()) {
            onAdd(v.trim());
            setV("");
          }
        }}
        placeholder="+ note a fact (?prefix = lead)"
        style={{ width: "100%", fontSize: 10 }}
      />
    </div>
  );
}

function WindowBody({
  w,
  state,
  patchWin,
  patchState,
}: {
  w: BWindow;
  state: CampaignState;
  patchWin: (id: string, mut: (w: BWindow) => void) => void;
  patchState: (mut: (s: CampaignState) => void) => void;
}) {
  const GmNote = w.gmNote ? <div className="board-gmnote">◆ {w.gmNote}</div> : null;

  switch (w.kind) {
    case "dossier": {
      const n = state.world.npcs.find((x) => x.id === w.refId);
      if (!n) return <div className="muted">— gone —</div>;
      return (
        <div style={{ fontSize: 11 }}>
          {GmNote}
          <div>
            <span className="muted">DISPOSITION</span>{" "}
            <select
              value={n.disposition}
              onChange={(e) => patchState((s) => { const x = s.world.npcs.find((y) => y.id === n.id); if (x) x.disposition = e.target.value; })}
              style={{ fontSize: 10 }}
            >
              {["hostile", "wary", "neutral", "friendly", "unknown"].map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            {" · "}
            <span className={n.status === "dead" ? "danger" : "ok"}>{n.status}</span>
          </div>
          <FactList
            facts={n.notableFacts}
            onAdd={(f) => patchState((s) => { const x = s.world.npcs.find((y) => y.id === n.id); if (x && !x.notableFacts.includes(f)) x.notableFacts.push(f); })}
          />
          <PlayerAnnotation w={w} patchWin={patchWin} />
        </div>
      );
    }
    case "objective": {
      const q = state.questLog.find((x) => x.id === w.refId);
      if (!q) return <div className="muted">—</div>;
      return (
        <div style={{ fontSize: 11 }}>
          {GmNote}
          <div className="muted">{q.summary || "—"}</div>
          {Object.keys(q.flags ?? {}).length > 0 && (
            <div style={{ marginTop: 4 }}>
              {Object.entries(q.flags).map(([k, val]) => (
                <label key={k} style={{ display: "flex", gap: 4, alignItems: "center", fontSize: 10 }}>
                  <input
                    type="checkbox"
                    checked={val === true || val === "done"}
                    onChange={(e) =>
                      patchState((s) => {
                        const x = s.questLog.find((y) => y.id === q.id);
                        if (x) x.flags = { ...x.flags, [k]: e.target.checked };
                      })
                    }
                  />
                  {k}
                </label>
              ))}
            </div>
          )}
          <PlayerAnnotation w={w} patchWin={patchWin} />
        </div>
      );
    }
    case "location": {
      const l = state.world.knownLocations.find((x) => x.name === w.refId);
      if (!l) return <div className="muted">—</div>;
      return (
        <div style={{ fontSize: 11 }}>
          {GmNote}
          <div className="muted">{l.description}</div>
          <FactList
            facts={l.notableFacts}
            onAdd={(f) => patchState((s) => { const x = s.world.knownLocations.find((y) => y.name === l.name); if (x && !x.notableFacts.includes(f)) x.notableFacts.push(f); })}
          />
          <PlayerAnnotation w={w} patchWin={patchWin} />
        </div>
      );
    }
    case "faction": {
      const f = state.world.factions.find((x) => x.name === w.refId);
      if (!f) return <div className="muted">—</div>;
      return (
        <div style={{ fontSize: 11 }}>
          {GmNote}
          <div><span className="muted">STANDING</span> {f.standingWithPC}</div>
          <FactList
            facts={f.notableFacts}
            onAdd={(fact) => patchState((s) => { const x = s.world.factions.find((y) => y.name === f.name); if (x && !x.notableFacts.includes(fact)) x.notableFacts.push(fact); })}
          />
          <PlayerAnnotation w={w} patchWin={patchWin} />
        </div>
      );
    }
    case "note":
      return (
        <textarea
          value={w.noteText}
          onChange={(e) => patchWin(w.id, (x) => { x.noteText = e.target.value; })}
          placeholder="…"
          style={{ width: "100%", height: "100%", minHeight: 90, fontSize: 11, resize: "none", border: "none", background: "transparent" }}
        />
      );
    case "connections": {
      const links = state.missionBoard.links;
      const name = (id: string) => {
        const win = state.missionBoard.windows.find((x) => x.id === id);
        return win ? windowTitle(win, state).split("—")[1]?.trim() ?? "?" : "?";
      };
      return (
        <div style={{ fontSize: 11 }}>
          {links.length === 0 && <div className="muted">No connections mapped yet.</div>}
          {links.map((l) => (
            <div key={l.id}>
              {name(l.from)} <span className="muted">—{l.label ? ` ${l.label} ` : "—"}→</span> {name(l.to)}
            </div>
          ))}
        </div>
      );
    }
    case "bible": {
      const b = state.campaignBible;
      if (!b) return <div className="muted">Campaign mode only.</div>;
      return (
        <div style={{ fontSize: 11 }}>
          <div><b>Antagonist:</b> {b.antagonist}</div>
          <div style={{ marginTop: 4 }}><b>Conflict:</b> {b.drivingConflict}</div>
          <div style={{ marginTop: 4 }}><b>Acts</b></div>
          {b.acts.map((a, i) => <div key={i} className="muted">{i + 1}. {a.goal}</div>)}
          <div style={{ marginTop: 4 }}><b>Leads / twists</b></div>
          {b.plantedTwists.map((t, i) => (
            <div key={i} className={t.delivered ? "board-declassified" : "board-redacted"}>
              {t.delivered ? `✓ ${t.twist}` : "█████ █████████ ████ ███████ █████"}
            </div>
          ))}
        </div>
      );
    }
  }
}

function PlayerAnnotation({ w, patchWin }: { w: BWindow; patchWin: (id: string, mut: (w: BWindow) => void) => void }) {
  return (
    <input
      value={w.noteText}
      onChange={(e) => patchWin(w.id, (x) => { x.noteText = e.target.value; })}
      placeholder="+ your note"
      style={{ width: "100%", fontSize: 10, marginTop: 4, color: "var(--gold-bright)" }}
    />
  );
}
