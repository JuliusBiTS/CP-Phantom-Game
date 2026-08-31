"use client";

/**
 * Phase 1 play screen — SOLO_MODE_BUILD_PLAN.md §12. Deliberately plain; the
 * point of Phase 1 is proving the consistency + dice architecture, not the UI.
 */

import { useEffect, useMemo, useState } from "react";
import { CampaignState, newCampaignState, CharacterSheet } from "@/lib/state/campaignState";
import { getStore } from "@/lib/storage/store";
import { pwDiceCaps } from "@/lib/dice/rollPW";
import { pcPwReference } from "@/lib/rules/live";
import { DictationButton } from "@/components/DictationButton";

type TurnResult =
  | { kind: "awaiting-player-roll"; state: CampaignState; prompt: PlayerRollPrompt; narrationSoFar: string }
  | { kind: "turn-complete"; state: CampaignState; narration: string; delta: unknown; rolls: EngineRoll[] };

interface PlayerRollPrompt {
  prompt: string;
  statPair: string;
  pw: number;
  diceInstruction: string;
  dv: number | null;
}
interface EngineRoll {
  actor: string;
  purpose: string;
  pw: number;
  dv: number | null;
  dice: number[];
  total: number | null;
  outcome: string;
  hit: boolean | null;
  damage?: number;
}

export default function Home() {
  const store = useMemo(() => getStore(), []);
  const [campaigns, setCampaigns] = useState<Array<{ id: string; name: string; lastPlayedAt: number }>>([]);
  const [state, setState] = useState<CampaignState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState("");
  const [interim, setInterim] = useState("");
  const [rollInput, setRollInput] = useState("");
  const [pending, setPending] = useState<PlayerRollPrompt | null>(null);
  const [lastRolls, setLastRolls] = useState<EngineRoll[]>([]);

  useEffect(() => {
    store.list().then(setCampaigns).catch(() => {});
  }, [store]);

  async function persist(s: CampaignState) {
    setState(s);
    await store.save(s);
    setCampaigns(await store.list());
  }

  async function createCampaign() {
    const name = window.prompt("Campaign name?")?.trim();
    if (!name) return;
    const mode = window.confirm("OK = Campaign (macro-plot).  Cancel = Gigs (episodic).") ? "campaign" : "gigs";
    const raw = window.prompt("Paste a CP Phantom character JSON (or leave blank for a stub PC):");
    let character: CharacterSheet;
    try {
      character = raw?.trim()
        ? CharacterSheet.parse(JSON.parse(raw))
        : CharacterSheet.parse({ name: "New Runner", stats: {}, hp_max: 30, hp_current: 30 });
    } catch (e) {
      setError("Character JSON didn't parse: " + (e as Error).message);
      return;
    }
    const id = "c_" + Date.now().toString(36);
    const s = newCampaignState({ id, name, mode: mode as "gigs" | "campaign", character });
    await persist(s);
    setPending(null);
    setLastRolls([]);
  }

  async function sendTurn(input: unknown) {
    if (!state) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/turn", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ state, input }),
      });
      const data = (await res.json()) as TurnResult | { error: string; detail?: unknown };
      if (!res.ok || "error" in data) {
        setError(("error" in data && data.error) || "turn failed");
        return;
      }
      await persist(data.state);
      if (data.kind === "awaiting-player-roll") {
        setPending(data.prompt);
        setLastRolls([]);
      } else {
        setPending(null);
        setLastRolls(data.rolls);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function submitAction() {
    const text = (action + " " + interim).trim();
    if (!text) return;
    setAction("");
    setInterim("");
    sendTurn({ kind: "action", text });
  }

  function submitRoll() {
    if (!pending) return;
    const dice = rollInput
      .split(/[\s,+]+/)
      .map((x) => parseInt(x, 10))
      .filter((n) => Number.isFinite(n));
    if (dice.length === 0) {
      setError("Enter your dice, e.g. '14 12 7'");
      return;
    }
    // Per v12 §2.1: count each die only up to its cap; first-die nat 1/20 = crit.
    const caps = pwDiceCaps(pending.pw);
    let total = 0;
    dice.forEach((d, i) => {
      const cap = caps[i] ?? 20;
      if (i === 0) total += d <= cap ? d : 0;
      else if (d === 1) total += cap;
      else if (d === 20) total += 0;
      else total += d <= cap ? d : 0;
    });
    setRollInput("");
    sendTurn({ kind: "playerRoll", total, dice });
  }

  const c = state?.character;
  const wound =
    c?.hp_max != null && c.hp_current != null
      ? c.hp_current / c.hp_max <= 0.1
        ? "FLATLINING"
        : c.hp_current / c.hp_max <= 0.25
          ? "CRITICALLY WOUNDED"
          : c.hp_current / c.hp_max <= 0.5
            ? "SERIOUSLY WOUNDED"
            : null
      : null;

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: 24, fontFamily: "system-ui, sans-serif", lineHeight: 1.5 }}>
      <h1 style={{ fontSize: 20, letterSpacing: 1 }}>CP PHANTOM — SOLO (Phase 1)</h1>

      <section style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", margin: "12px 0" }}>
        <select
          value={state?.meta.id ?? ""}
          onChange={async (e) => {
            const s = await store.load(e.target.value);
            if (s) {
              setState(s);
              setPending(
                s.pendingPlayerRoll
                  ? {
                      prompt: s.pendingPlayerRoll.prompt,
                      statPair: s.pendingPlayerRoll.statPair,
                      pw: s.pendingPlayerRoll.pw,
                      diceInstruction: s.pendingPlayerRoll.diceInstruction,
                      dv: s.pendingPlayerRoll.dv,
                    }
                  : null,
              );
              setLastRolls([]);
            }
          }}
        >
          <option value="">— load campaign —</option>
          {campaigns.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </select>
        <button onClick={createCampaign}>+ New campaign</button>
        {state && <span style={{ fontSize: 12, opacity: 0.7 }}>mode: {state.meta.mode}</span>}
      </section>

      {error && <p style={{ color: "#b00020", border: "1px solid #b00020", padding: 8 }}>{error}</p>}

      {state && c && (
        <>
          <section style={{ border: "1px solid #ccc", padding: 12, margin: "12px 0", fontSize: 14 }}>
            <strong>{c.name}</strong>
            {" — "}HP {c.hp_current ?? "?"}/{c.hp_max ?? "?"}
            {c.stamina_max != null && (
              <>
                {" "}
                · STA {c.stamina_current}/{c.stamina_max}
              </>
            )}
            {c.ip_max != null && (
              <>
                {" "}
                · IP {c.ip_current}/{c.ip_max}
              </>
            )}
            {wound && (
              <>
                {" "}
                · <span style={{ color: "#b00020" }}>{wound}</span>
              </>
            )}
            <div>Location: {state.world.currentLocation || "—"}</div>
            <div>
              Active quests:{" "}
              {state.questLog
                .filter((q) => q.status === "active")
                .map((q) => q.title)
                .join(", ") || "—"}
            </div>
            {state.pendingChangeset.length > 0 && (
              <div style={{ color: "#7a5410" }}>
                GM review queue: {state.pendingChangeset.filter((p) => p.reviewed === "pending").length} pending
              </div>
            )}
            <details style={{ marginTop: 8 }}>
              <summary style={{ cursor: "pointer" }}>PC PW reference (spot-check vs CP Phantom)</summary>
              {(() => {
                let ref;
                try {
                  ref = pcPwReference(c);
                } catch {
                  return <div style={{ opacity: 0.6 }}>—</div>;
                }
                return (
                  <div style={{ fontSize: 12, fontFamily: "ui-monospace, monospace", marginTop: 6 }}>
                    {ref.weapons.map((w) => (
                      <div key={w.weapon}>
                        {w.weapon} ({w.statPair}): PW {w.finalPw} · {w.diceInstruction} · WB {w.weaponBonus}
                        {w.woundMultiplier != null && ` · wound ×${w.woundMultiplier}`}
                      </div>
                    ))}
                    <div>
                      {ref.reaction.label} ({ref.reaction.statPair}): PW {ref.reaction.finalPw}
                    </div>
                    {ref.skills.map((s) => (
                      <div key={s.label}>
                        {s.label} ({s.statPair}): PW {s.finalPw}
                      </div>
                    ))}
                    <div>
                      Armor SP: body {ref.armorSP.body}, head {ref.armorSP.head}
                    </div>
                  </div>
                );
              })()}
            </details>
          </section>

          <section style={{ margin: "12px 0" }}>
            <h2 style={{ fontSize: 15 }}>Narration</h2>
            <div
              style={{
                whiteSpace: "pre-wrap",
                border: "1px solid #eee",
                padding: 12,
                minHeight: 80,
                background: "#fafafa",
              }}
            >
              {[...state.sessionLog].reverse().find((l) => l.type === "narration")?.text ?? "—"}
            </div>
          </section>

          {lastRolls.length > 0 && (
            <section style={{ margin: "12px 0", fontSize: 13 }}>
              <h2 style={{ fontSize: 15 }}>Engine rolls this turn</h2>
              <ul>
                {lastRolls.map((r, i) => (
                  <li key={i}>
                    <strong>{r.actor}</strong> — {r.purpose}: PW {r.pw} → [{r.dice.join(", ")}]{" "}
                    {r.total != null ? `= ${r.total}` : r.outcome.toUpperCase()}
                    {r.dv != null && (
                      <>
                        {" "}
                        vs DV {r.dv} → {r.hit ? "HIT" : "MISS"}
                      </>
                    )}
                    {r.damage != null && <> · {r.damage} dmg</>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {pending ? (
            <section style={{ border: "2px solid #7a1428", padding: 12, margin: "12px 0" }}>
              <h2 style={{ fontSize: 15, marginTop: 0 }}>Your roll</h2>
              <p style={{ margin: "4px 0" }}>{pending.prompt}</p>
              <p style={{ margin: "4px 0" }}>
                <strong>{pending.statPair}</strong> · PW {pending.pw} · {pending.diceInstruction}
                {pending.dv != null && <> · beat DV {pending.dv}</>}
              </p>
              <p style={{ fontSize: 12, opacity: 0.7 }}>
                Roll your physical dice and type the faces (e.g. <code>14 12 7</code>).
              </p>
              <input
                value={rollInput}
                onChange={(e) => setRollInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitRoll()}
                placeholder="dice faces"
                style={{ padding: 6, width: 200 }}
              />
              <button onClick={submitRoll} disabled={busy} style={{ marginLeft: 8 }}>
                {busy ? "…" : "Submit roll"}
              </button>
            </section>
          ) : (
            <section style={{ margin: "12px 0" }}>
              <h2 style={{ fontSize: 15 }}>What do you do?</h2>
              <textarea
                value={action + (interim ? " " + interim : "")}
                onChange={(e) => {
                  setAction(e.target.value);
                  setInterim("");
                }}
                rows={3}
                style={{ width: "100%", padding: 8, boxSizing: "border-box" }}
                placeholder="Describe your action…"
              />
              <div style={{ display: "flex", gap: 8, marginTop: 6, alignItems: "center" }}>
                <button onClick={submitAction} disabled={busy}>
                  {busy ? "GM is thinking…" : "Act"}
                </button>
                <DictationButton
                  onFinalText={(t) => {
                    setAction((a) => (a ? a + " " : "") + t);
                    setInterim("");
                  }}
                  onInterimText={setInterim}
                />
              </div>
            </section>
          )}
        </>
      )}

      {!state && <p style={{ opacity: 0.7 }}>Create or load a campaign to start. See README for setup.</p>}
    </main>
  );
}
