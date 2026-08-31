"use client";

/**
 * Mission Board — the cyberpunk case wall. SOLO_MODE_BUILD_PLAN.md §13.
 * Draggable/resizable intel windows over the Campaign State; the GM populates
 * it via the turn delta, new intel glows until you've looked. Hotkey `M`.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { CampaignState } from "@/lib/state/campaignState";
import { autoLayoutBoard, packBoard } from "@/lib/board/layout";
import { PortraitUpload } from "@/components/PortraitUpload";
import { CaseFile } from "@/components/CaseFile";

type Board = CampaignState["missionBoard"];
type BWindow = Board["windows"][number];

const MOBILE_BP = 760;

type Gesture = { mode: "move" | "resize"; id: string; px: number; py: number; ox: number; oy: number; ow: number; oh: number };
type LiveBox = { id: string; x: number; y: number; w: number; h: number };

export function MissionBoard({
  state,
  onPatchState,
  onPatchBoard,
  onClose,
}: {
  state: CampaignState;
  onPatchState: (mut: (s: CampaignState) => void) => void;
  /** Board-only patch — clones just `missionBoard`, not the whole (large) state. */
  onPatchBoard: (mut: (b: Board) => void) => void;
  onClose: () => void;
}) {
  const board = state.missionBoard;
  const [narrow, setNarrow] = useState(false);
  // Freeze "what counts as new" at mount so the glow persists this whole visit.
  const [seenBefore] = useState(() => board.lastOpenedAt);

  const [gesture, setGesture] = useState<Gesture | null>(null);
  const [live, setLive] = useState<LiveBox | null>(null);
  // Link mode: click a window, then another, to draw a red-string connection.
  const [linkMode, setLinkMode] = useState(false);
  const [linkFrom, setLinkFrom] = useState<string | null>(null);
  // Mirror of `live` written synchronously in the move handler, so pointer-up can
  // read the final box even before React has flushed the drag renders.
  const liveRef = useRef<LiveBox | null>(null);

  useEffect(() => {
    // innerWidth can read 0 transiently (hidden pane) — only go stacked on a real small width.
    const check = () => setNarrow(window.innerWidth > 0 && window.innerWidth < MOBILE_BP);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Mark "seen" a beat after open, so NEW intel glows first.
  useEffect(() => {
    const t = setTimeout(() => onPatchBoard((b) => { b.lastOpenedAt = Date.now(); }), 2500);
    return () => clearTimeout(t);
  }, [onPatchBoard]);

  // ── drag / resize: track live in local state, commit ONCE on pointer-up ────
  useEffect(() => {
    if (!gesture) return;
    document.body.style.userSelect = "none";
    const onMove = (e: PointerEvent) => {
      const dx = e.clientX - gesture.px;
      const dy = e.clientY - gesture.py;
      const box: LiveBox =
        gesture.mode === "move"
          ? { id: gesture.id, x: Math.max(0, gesture.ox + dx), y: Math.max(0, gesture.oy + dy), w: gesture.ow, h: gesture.oh }
          : { id: gesture.id, x: gesture.ox, y: gesture.oy, w: Math.max(180, gesture.ow + dx), h: Math.max(90, gesture.oh + dy) };
      liveRef.current = box;
      setLive(box);
    };
    const onUp = () => {
      const cur = liveRef.current;
      if (cur) {
        onPatchBoard((b) => {
          const win = b.windows.find((x) => x.id === cur.id);
          if (win) { win.x = cur.x; win.y = cur.y; win.w = cur.w; win.h = cur.h; }
        });
      }
      liveRef.current = null;
      setLive(null);
      setGesture(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [gesture, onPatchBoard]);

  const boxOf = (w: BWindow): { x: number; y: number; w: number; h: number } =>
    live && live.id === w.id ? { x: live.x, y: live.y, w: live.w, h: live.h } : { x: w.x, y: w.y, w: w.w, h: w.h };

  const startGesture = useCallback(
    (mode: "move" | "resize", win: BWindow, e: React.PointerEvent) => {
      e.preventDefault();
      onPatchBoard((b) => {
        const maxZ = Math.max(0, ...b.windows.map((x) => x.z));
        const w = b.windows.find((x) => x.id === win.id);
        if (w) w.z = maxZ + 1;
      });
      setGesture({ mode, id: win.id, px: e.clientX, py: e.clientY, ox: win.x, oy: win.y, ow: win.w, oh: win.h });
    },
    [onPatchBoard],
  );

  function patchWin(id: string, mut: (w: BWindow) => void) {
    onPatchBoard((b) => {
      const w = b.windows.find((x) => x.id === id);
      if (w) mut(w);
    });
  }
  function closeWin(id: string) {
    onPatchBoard((b) => {
      b.windows = b.windows.filter((w) => w.id !== id);
      b.links = b.links.filter((l) => l.from !== id && l.to !== id);
    });
  }
  function onWindowPick(id: string) {
    if (!linkMode) return;
    if (!linkFrom) {
      setLinkFrom(id);
      return;
    }
    if (linkFrom !== id) {
      onPatchBoard((b) => {
        if (!b.links.some((l) => (l.from === linkFrom && l.to === id) || (l.from === id && l.to === linkFrom))) {
          b.links.push({ id: `lk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`, from: linkFrom, to: id, label: "" });
        }
      });
    }
    setLinkFrom(null);
  }
  function removeLink(id: string) {
    onPatchBoard((b) => { b.links = b.links.filter((l) => l.id !== id); });
  }
  function setLinkLabel(id: string, label: string) {
    onPatchBoard((b) => { const l = b.links.find((x) => x.id === id); if (l) l.label = label; });
  }
  function addNote() {
    onPatchBoard((b) => {
      b.windows.push({
        id: `w_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        kind: "note",
        refId: null,
        x: 40,
        y: 40,
        w: 260,
        h: 180,
        z: Math.max(1, ...b.windows.map((w) => w.z)) + 1,
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
        <button
          onClick={() => { setLinkMode((v) => !v); setLinkFrom(null); }}
          style={{ padding: "3px 9px", fontSize: 10, borderColor: linkMode ? "var(--red)" : undefined, color: linkMode ? "var(--red-bright)" : undefined }}
          title="Click two windows to connect them with a red string"
        >
          🔗 {linkMode ? (linkFrom ? "pick target…" : "linking") : "Link"}
        </button>
        <button
          onClick={() => onPatchBoard((b) => { Object.assign(b, packBoard(b, typeof window !== "undefined" ? window.innerWidth : undefined)); })}
          style={{ padding: "3px 9px", fontSize: 10 }}
          title="Lay every window out in a clean grid, nothing overlapping"
        >
          ⊞ Arrange
        </button>
        <button onClick={() => onPatchState((s) => { s.missionBoard = autoLayoutBoard(s, s.missionBoard.activeMissionQuestId); })} style={{ padding: "3px 9px", fontSize: 10 }}>
          {board.windows.length ? "Rebuild" : "Build board"}
        </button>
        <button onClick={() => window.print()} style={{ padding: "3px 9px", fontSize: 10 }} title="Print / save the board as a case file">
          🖨 Case file
        </button>
        <button onClick={onClose} style={{ padding: "3px 9px", fontSize: 10 }}>Close (M)</button>
      </span>
    </div>
  );

  if (narrow) {
    return (
      <div className="board-shell board-stacked">
        <CaseFile state={state} />
        {header}
        <div style={{ padding: 12, display: "grid", gap: 10 }}>
          {board.windows
            .slice()
            .sort((a, b) => Number(b.pinned) - Number(a.pinned))
            .map((w) => (
              <div key={w.id} className={`board-window ${w.pinned ? "pinned" : ""}`} style={{ position: "static", width: "auto" }}>
                <WindowFrame w={w} state={state} isNew={w.createdAt > seenBefore} patchWin={patchWin} patchState={onPatchState} onClose={() => closeWin(w.id)} onGesture={() => {}} stacked />
              </div>
            ))}
        </div>
      </div>
    );
  }

  return (
    <div className="board-shell">
      <CaseFile state={state} />
      {header}
      <div className="board-canvas" key={board.blowUpAt}>
        <div className="board-grid" />
        <div className="board-scan" />
        <LinkLayer board={board} onRemove={removeLink} onLabel={setLinkLabel} />
        {board.windows.map((w, i) => {
          const box = boxOf(w);
          const dragging = live?.id === w.id;
          const isLinkSource = linkFrom === w.id;
          return (
            <div
              key={w.id}
              onClick={linkMode ? () => onWindowPick(w.id) : undefined}
              className={`board-window ${w.pinned ? "pinned" : ""} ${dragging ? "" : "board-in"}`}
              style={{
                left: box.x,
                top: box.y,
                width: box.w,
                zIndex: dragging ? 9999 : w.z,
                animationDelay: `${Math.min(i * 60, 600)}ms`,
                cursor: linkMode ? "crosshair" : undefined,
                outline: isLinkSource ? "2px solid var(--red-bright)" : undefined,
              }}
            >
              <WindowFrame
                w={w}
                box={box}
                state={state}
                isNew={w.createdAt > seenBefore}
                patchWin={patchWin}
                patchState={onPatchState}
                onClose={() => closeWin(w.id)}
                onGesture={linkMode ? () => {} : (mode, e) => startGesture(mode, w, e)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── link layer ────────────────────────────────────────────────────────────

function LinkLayer({
  board,
  onRemove,
  onLabel,
}: {
  board: Board;
  onRemove: (id: string) => void;
  onLabel: (id: string, label: string) => void;
}) {
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
        const my = (a.y + b.y) / 2;
        return (
          <g key={l.id}>
            <path d={`M ${a.x} ${a.y} C ${mx} ${a.y}, ${mx} ${b.y}, ${b.x} ${b.y}`} className="board-link-line" />
            <text
              x={mx}
              y={my - 6}
              className="board-link-label"
              textAnchor="middle"
              style={{ pointerEvents: "auto", cursor: "text" }}
              onClick={() => {
                const next = window.prompt("Connection label", l.label ?? "");
                if (next != null) onLabel(l.id, next);
              }}
            >
              {l.label || "— label —"}
            </text>
            <circle
              cx={mx}
              cy={my + 6}
              r={6}
              fill="var(--bg)"
              stroke="var(--red-bright)"
              style={{ pointerEvents: "auto", cursor: "pointer" }}
              onClick={() => onRemove(l.id)}
            />
            <text x={mx} y={my + 9} textAnchor="middle" fontSize={9} fill="var(--red-bright)" style={{ pointerEvents: "none" }}>
              ×
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── window frame (drag + resize + chrome) ─────────────────────────────────

function WindowFrame({
  w,
  box,
  state,
  isNew,
  patchWin,
  patchState,
  onClose,
  onGesture,
  stacked,
}: {
  w: BWindow;
  box?: { x: number; y: number; w: number; h: number };
  state: CampaignState;
  isNew: boolean;
  patchWin: (id: string, mut: (w: BWindow) => void) => void;
  patchState: (mut: (s: CampaignState) => void) => void;
  onClose: () => void;
  onGesture: (mode: "move" | "resize", e: React.PointerEvent) => void;
  stacked?: boolean;
}) {
  const title = windowTitle(w, state);
  const h = box?.h ?? w.h;

  return (
    <div className={`board-frame ${isNew ? "is-new" : ""}`}>
      <span className="reticle-tr board-bracket" />
      <span className="reticle-bl board-bracket" />
      <div
        className="board-frame-bar"
        onPointerDown={stacked ? undefined : (e) => onGesture("move", e)}
        style={{ cursor: stacked ? "default" : "grab", touchAction: "none" }}
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
        <div className="board-frame-body" style={{ maxHeight: stacked ? undefined : h }}>
          <WindowBody w={w} state={state} patchWin={patchWin} patchState={patchState} />
        </div>
      )}
      {!stacked && !w.collapsed && (
        <div className="board-resize" onPointerDown={(e) => { e.stopPropagation(); onGesture("resize", e); }} style={{ touchAction: "none" }} />
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
        <div style={{ fontSize: 11, display: "flex", gap: 8 }}>
          <PortraitUpload
            current={n.portrait}
            size={48}
            label={`${n.name} portrait`}
            onChange={(p) => patchState((s) => { const x = s.world.npcs.find((y) => y.id === n.id); if (x) x.portrait = p; })}
          />
          <div style={{ flex: 1 }}>
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
    case "connections":
      return <RelationshipGraph state={state} />;
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

          {state.campaignPlan?.generated && (
            <div style={{ marginTop: 6 }}>
              <b>Plan · Act {state.campaignPlan.currentAct}</b>
              {state.campaignPlan.acts.map((act) => (
                <div key={act.act} style={{ marginTop: 2, opacity: act.act === state.campaignPlan.currentAct ? 1 : 0.55 }}>
                  <span className="muted">Act {act.act} — {act.goal}</span>
                  {act.gigs.map((g) => (
                    <div
                      key={g.id}
                      className={g.status === "done" ? "board-declassified" : g.status === "locked" ? "board-redacted" : undefined}
                      style={{ marginLeft: 8 }}
                    >
                      {g.status === "locked"
                        ? "████ ███████ █████"
                        : `${g.status === "active" ? "▸ " : g.status === "done" ? "✓ " : "· "}${g.title} (${g.contact})`}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }
  }
}

/** Campaign-wide relationship graph — the board's links, laid out on a circle. */
function RelationshipGraph({ state }: { state: CampaignState }) {
  const board = state.missionBoard;
  const nodeIds = Array.from(new Set(board.links.flatMap((l) => [l.from, l.to]))).filter((id) =>
    board.windows.some((w) => w.id === id),
  );
  const label = (id: string) => {
    const w = board.windows.find((x) => x.id === id);
    if (!w) return "?";
    const t = windowTitle(w, state);
    return t.includes("—") ? t.split("—")[1].trim() : t;
  };

  if (nodeIds.length === 0) {
    return <div className="muted" style={{ fontSize: 11 }}>No connections yet. Use 🔗 Link in the toolbar to draw some.</div>;
  }

  const R = 46;
  const cx = 70;
  const cy = 62;
  const pos: Record<string, { x: number; y: number }> = {};
  nodeIds.forEach((id, i) => {
    const a = (i / nodeIds.length) * Math.PI * 2 - Math.PI / 2;
    pos[id] = { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) };
  });

  return (
    <svg viewBox="0 0 140 130" width="100%" height="140" style={{ overflow: "visible" }}>
      {board.links.map((l) => {
        const a = pos[l.from];
        const b = pos[l.to];
        if (!a || !b) return null;
        return (
          <g key={l.id}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--red-bright)" strokeWidth={0.7} opacity={0.6} />
            {l.label && (
              <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2} fontSize={4} fill="var(--red-bright)" textAnchor="middle">
                {l.label}
              </text>
            )}
          </g>
        );
      })}
      {nodeIds.map((id) => (
        <g key={id}>
          <circle cx={pos[id].x} cy={pos[id].y} r={3} fill="var(--cyan)" />
          <text x={pos[id].x} y={pos[id].y - 5} fontSize={5} fill="var(--text)" textAnchor="middle">
            {label(id)}
          </text>
        </g>
      ))}
    </svg>
  );
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
