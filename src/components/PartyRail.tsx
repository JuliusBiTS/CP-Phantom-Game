"use client";

/**
 * Party rail — FEATURE_PLAN §M9. `state.character` is always the active PC;
 * the others sit on `state.party.bench`. Click a bench PC to swap them in.
 * One person drives the tool; the GM addresses everyone by name.
 */

import { useState } from "react";
import type { CampaignState, CharacterSheet } from "@/lib/state/campaignState";
import { CharacterSheet as SheetSchema } from "@/lib/state/campaignState";

const hpOf = (c: CharacterSheet) => `${c.hp_current ?? c.hp_max ?? "?"}/${c.hp_max ?? "?"}`;
const uid = () => `pc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

export function PartyRail({ state, onPatchState }: { state: CampaignState; onPatchState: (mut: (s: CampaignState) => void) => void }) {
  const bench = state.party.bench;
  const [adding, setAdding] = useState(false);
  const [paste, setPaste] = useState("");
  const [err, setErr] = useState<string | null>(null);

  if (bench.length === 0 && !adding) {
    return (
      <button onClick={() => setAdding(true)} style={{ padding: "3px 10px", fontSize: 10, margin: "0 0 4px" }}>
        + Party mode
      </button>
    );
  }

  function swapIn(id: string) {
    onPatchState((s) => {
      const i = s.party.bench.findIndex((m) => m.id === id);
      if (i < 0) return;
      const incoming = s.party.bench[i].sheet;
      s.party.bench[i] = { id: uid(), sheet: s.character };
      s.character = incoming;
      s.meta.lastPlayedAt = Date.now();
    });
  }

  function addStub() {
    onPatchState((s) => {
      s.party.bench.push({ id: uid(), sheet: { name: "New Runner", stats: {}, hp_max: 30, hp_current: 30 } });
    });
    setAdding(false);
  }

  function addPaste() {
    try {
      const sheet = SheetSchema.parse(JSON.parse(paste));
      onPatchState((s) => { s.party.bench.push({ id: uid(), sheet }); });
      setPaste("");
      setAdding(false);
      setErr(null);
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <div style={{ margin: "0 0 6px" }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "stretch" }}>
        <div
          style={{
            border: "1px solid var(--cyan)",
            padding: "4px 8px",
            fontSize: 10,
            fontFamily: "var(--font)",
            background: "var(--surface3)",
            minWidth: 90,
          }}
        >
          <div style={{ color: "var(--cyan)", letterSpacing: "0.1em" }}>▸ {state.character.name}</div>
          <div className="muted">HP {hpOf(state.character)} · playing</div>
        </div>
        {bench.map((m) => (
          <button
            key={m.id}
            onClick={() => swapIn(m.id)}
            title="Switch to this character"
            style={{ padding: "4px 8px", fontSize: 10, fontFamily: "var(--font)", textAlign: "left", textTransform: "none", letterSpacing: 0 }}
          >
            <div>{m.sheet.name}</div>
            <div className="muted" style={{ fontSize: 9 }}>HP {hpOf(m.sheet)} · switch in</div>
          </button>
        ))}
        <button onClick={() => setAdding((v) => !v)} style={{ padding: "4px 8px", fontSize: 10 }}>
          {adding ? "×" : "+ PC"}
        </button>
      </div>

      {adding && (
        <div className="panel" style={{ marginTop: 6, padding: 8 }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
            <button onClick={addStub} style={{ padding: "3px 9px", fontSize: 10 }}>+ Blank PC (edit via sheet)</button>
          </div>
          <textarea
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            rows={2}
            placeholder="…or paste a CP Phantom / exported character JSON"
            style={{ width: "100%", fontSize: 11 }}
          />
          {paste.trim() && (
            <button onClick={addPaste} style={{ padding: "3px 9px", fontSize: 10, marginTop: 4 }}>Add from JSON</button>
          )}
          {err && <div className="danger" style={{ fontSize: 10, marginTop: 4 }}>{err}</div>}
        </div>
      )}
    </div>
  );
}
