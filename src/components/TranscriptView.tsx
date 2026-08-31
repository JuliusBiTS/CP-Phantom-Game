"use client";

/**
 * Transcript view — scroll back through the whole session, not just the last
 * narration. FEATURE_PLAN.md §M1. Hotkey `T`. Reads sessionLog; no state writes.
 */

import { useMemo, useState } from "react";
import type { CampaignState, SessionLogEntry } from "@/lib/state/campaignState";

type Filter = "story" | "rolls" | "timeline" | "all";

const TYPE_COLOR: Record<SessionLogEntry["type"], string> = {
  narration: "var(--text)",
  action: "var(--cyan)",
  roll: "var(--text2)",
  system: "var(--text3)",
};

export function TranscriptView({ state, onClose }: { state: CampaignState; onClose: () => void }) {
  const [filter, setFilter] = useState<Filter>("story");
  const [order, setOrder] = useState<"newest" | "oldest">("oldest");
  const [q, setQ] = useState("");

  const timelineRows = useMemo(() => {
    const beats = state.timeline.map((b, i) => ({
      l: { ts: b.ts, type: "system" as const, text: `${b.inGameDate ? b.inGameDate + " — " : ""}${b.text}`, compressed: false },
      i,
    }));
    return order === "newest" ? [...beats].reverse() : beats;
  }, [state.timeline, order]);

  const rows = useMemo(() => {
    if (filter === "timeline") return timelineRows;
    let list = state.sessionLog.filter((l) => {
      if (filter === "story") return l.type === "narration" || l.type === "action";
      if (filter === "rolls") return l.type === "roll";
      return true;
    });
    if (q.trim()) {
      const needle = q.toLowerCase();
      list = list.filter((l) => l.text.toLowerCase().includes(needle));
    }
    const indexed = list.map((l, i) => ({ l, i }));
    return order === "newest" ? indexed.reverse() : indexed;
  }, [state.sessionLog, filter, order, q, timelineRows]);

  return (
    <div className="board-shell">
      <div className="board-toolbar">
        <span className="board-title">{"// TRANSCRIPT"}</span>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {(["story", "rolls", "timeline", "all"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{ padding: "3px 9px", fontSize: 10, borderColor: filter === f ? "var(--cyan)" : undefined }}
            >
              {f.toUpperCase()}
            </button>
          ))}
          <button onClick={() => setOrder((o) => (o === "newest" ? "oldest" : "newest"))} style={{ padding: "3px 9px", fontSize: 10 }}>
            {order === "newest" ? "NEWEST ↑" : "OLDEST ↓"}
          </button>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="search…"
            style={{ fontSize: 11, padding: "3px 6px", width: 140 }}
          />
          <button onClick={onClose} style={{ padding: "3px 10px" }}>Close (T)</button>
        </div>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "16px 20px", maxWidth: 860, margin: "0 auto", width: "100%" }}>
        {rows.length === 0 && <p className="muted">Nothing logged yet.</p>}
        {rows.map(({ l, i }) => (
          <div key={i} style={{ padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
            <div className="muted" style={{ fontSize: 9, letterSpacing: "0.12em", display: "flex", gap: 8 }}>
              <span>{new Date(l.ts).toLocaleString()}</span>
              <span>{l.type.toUpperCase()}</span>
              {l.compressed && <span title="folded into durable facts">· COMPRESSED</span>}
            </div>
            <div
              style={{
                whiteSpace: "pre-wrap",
                lineHeight: 1.6,
                fontSize: l.type === "narration" ? 13 : 12,
                fontFamily: l.type === "roll" ? "var(--font)" : undefined,
                color: TYPE_COLOR[l.type],
              }}
            >
              {l.type === "roll" && l.roll ? `[${l.roll.source === "engine" ? "ENGINE" : "PLAYER"}] ${l.text}` : l.text}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
