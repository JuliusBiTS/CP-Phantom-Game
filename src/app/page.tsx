"use client";

/**
 * Play screen. Phase 2: real new-campaign form (character import from CP
 * Phantom, campaign-bible generation), CP Phantom design-system skin.
 * Full visual pass (boot sequence, reticle) is still Phase 3.
 */

import { useEffect, useMemo, useState } from "react";
import { CampaignState, newCampaignState, CharacterSheet, type CampaignBible } from "@/lib/state/campaignState";
import { getStore } from "@/lib/storage/store";
import { pwDiceCaps } from "@/lib/dice/rollPW";
import { pcPwReference } from "@/lib/rules/live";
import { firebaseConfigured, listCpPhantomCharacters, readCpPhantomCharacter, type CpPhantomCharacterRef } from "@/lib/storage/firebase";
import { applyApprovedChanges, AUTO_APPLY_KINDS } from "@/lib/storage/pushback";
import { DictationButton } from "@/components/DictationButton";
import { LifePathWizard } from "@/components/LifePathWizard";

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
  const [showNew, setShowNew] = useState(false);
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

  async function onCreated(s: CampaignState) {
    setShowNew(false);
    setPending(null);
    setLastRolls([]);
    await persist(s);
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
      const data = (await res.json()) as TurnResult | { error: string };
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

  async function reviewChange(id: string, decision: "approved" | "rejected") {
    if (!state) return;
    const s: CampaignState = structuredClone(state);
    const row = s.pendingChangeset.find((p) => p.id === id);
    if (row) row.reviewed = decision;
    await persist(s);
  }

  async function pushApproved() {
    if (!state) return;
    const approved = state.pendingChangeset.filter((p) => p.reviewed === "approved");
    if (approved.length === 0) {
      setError("Approve some lines first.");
      return;
    }
    if (!state.meta.importedFromCpPhantomId) {
      setError("This campaign's PC wasn't imported from CP Phantom, so there's nowhere to push back to. Approved lines stay logged here.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const report = await applyApprovedChanges(state.meta.importedFromCpPhantomId, approved);
      const s: CampaignState = structuredClone(state);
      // Clear the lines that were actually written; leave skipped ones for manual handling.
      const writtenIds = new Set(report.applied.map((a) => a.id));
      s.pendingChangeset = s.pendingChangeset.filter((p) => !writtenIds.has(p.id));
      s.sessionLog.push({
        ts: Date.now(),
        type: "system",
        text:
          `Pushed to CP Phantom: ${report.applied.map((a) => `${a.label} (${a.field} ${a.before}→${a.after})`).join("; ") || "nothing"}` +
          (report.skipped.length ? ` — skipped: ${report.skipped.map((x) => `${x.label} (${x.reason})`).join("; ")}` : ""),
        compressed: false,
      });
      await persist(s);
      if (report.skipped.length) {
        setError(`Pushed ${report.applied.length}, skipped ${report.skipped.length} (review-only or bad patch) — see session log.`);
      }
    } catch (e) {
      setError("Push-back failed: " + (e as Error).message);
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
    const dice = rollInput.split(/[\s,+]+/).map((x) => parseInt(x, 10)).filter((n) => Number.isFinite(n));
    if (dice.length === 0) {
      setError("Enter your dice, e.g. '14 12 7'");
      return;
    }
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
  const woundPct = c?.hp_max && c.hp_current != null ? c.hp_current / c.hp_max : 1;
  const wound =
    woundPct <= 0.1 ? "FLATLINING" : woundPct <= 0.25 ? "CRITICALLY WOUNDED" : woundPct <= 0.5 ? "SERIOUSLY WOUNDED" : null;

  return (
    <main style={{ maxWidth: 940, margin: "0 auto", padding: "28px 20px 80px" }}>
      <h1>CP PHANTOM — SOLO</h1>
      <div className="muted" style={{ fontSize: 10, letterSpacing: "0.3em", marginTop: 4 }}>
        PHASE 2 · SOLO COMPANION
      </div>

      <section style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", margin: "18px 0" }}>
        <select
          value={state?.meta.id ?? ""}
          onChange={async (e) => {
            const s = await store.load(e.target.value);
            if (s) {
              setState(s);
              setShowNew(false);
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
        <button onClick={() => setShowNew((v) => !v)}>{showNew ? "Cancel" : "+ New campaign"}</button>
        {state && (
          <span className="muted" style={{ fontSize: 11, letterSpacing: "0.15em" }}>
            MODE: {state.meta.mode.toUpperCase()}
          </span>
        )}
      </section>

      {error && (
        <p className="panel panel-accent danger" style={{ fontSize: 12 }}>
          {error}
        </p>
      )}

      {showNew && <NewCampaignForm onCreated={onCreated} onError={setError} />}

      {!showNew && state && c && (
        <>
          <section className="panel">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
              <strong style={{ fontFamily: "var(--font-display)", fontSize: 15, letterSpacing: "0.05em" }}>
                {c.name}
              </strong>
              <span style={{ fontSize: 12 }}>
                HP <span className="stat-num">{c.hp_current ?? "?"}</span>/<span className="stat-num">{c.hp_max ?? "?"}</span>
                {c.stamina_max != null && (
                  <>
                    {"  ·  STA "}
                    <span className="stat-num">{c.stamina_current}</span>/<span className="stat-num">{c.stamina_max}</span>
                  </>
                )}
                {c.ip_max != null && (
                  <>
                    {"  ·  IP "}
                    <span className="stat-num">{c.ip_current}</span>/<span className="stat-num">{c.ip_max}</span>
                  </>
                )}
                {wound && <span className="danger"> {"  ·  "}{wound}</span>}
              </span>
            </div>
            <div style={{ marginTop: 6, fontSize: 12 }}>
              <span className="muted">LOCATION</span> {state.world.currentLocation || "—"}
            </div>
            <div style={{ fontSize: 12 }}>
              <span className="muted">QUESTS</span>{" "}
              {state.questLog.filter((q) => q.status === "active").map((q) => q.title).join(" · ") || "—"}
            </div>
            {state.pendingChangeset.filter((p) => p.reviewed === "pending").length > 0 && (
              <div style={{ fontSize: 12, color: "var(--gold-bright)" }}>
                GM REVIEW QUEUE: {state.pendingChangeset.filter((p) => p.reviewed === "pending").length} pending
              </div>
            )}
            {state.campaignBible && (
              <details style={{ marginTop: 8, fontSize: 12 }}>
                <summary style={{ cursor: "pointer" }}>Campaign bible (GM-only — spoilers)</summary>
                <div style={{ marginTop: 6, whiteSpace: "pre-wrap", color: "var(--text2)" }}>
                  <b>Antagonist:</b> {state.campaignBible.antagonist}
                  {"\n\n"}
                  <b>Conflict:</b> {state.campaignBible.drivingConflict}
                  {"\n\n"}
                  <b>Acts:</b>
                  {state.campaignBible.acts.map((a, i) => `\n  ${i + 1}. ${a.goal} → ${a.turningPoint}`).join("")}
                  {"\n\n"}
                  <b>Planted twists:</b>
                  {state.campaignBible.plantedTwists.map((t) => `\n  ${t.delivered ? "✓" : "·"} ${t.twist}`).join("")}
                </div>
              </details>
            )}
            <details style={{ marginTop: 8, fontSize: 12 }}>
              <summary style={{ cursor: "pointer" }}>PC PW reference (spot-check vs CP Phantom)</summary>
              {(() => {
                let ref;
                try {
                  ref = pcPwReference(c);
                } catch {
                  return <div className="muted">—</div>;
                }
                return (
                  <div style={{ fontFamily: "var(--font)", marginTop: 6, color: "var(--text2)" }}>
                    {ref.weapons.map((w) => (
                      <div key={w.weapon}>
                        {w.weapon} ({w.statPair}): PW <span className="stat-num">{w.finalPw}</span> · {w.diceInstruction} · WB {w.weaponBonus}
                        {w.woundMultiplier != null && ` · wound ×${w.woundMultiplier}`}
                      </div>
                    ))}
                    <div>
                      {ref.reaction.label} ({ref.reaction.statPair}): PW <span className="stat-num">{ref.reaction.finalPw}</span>
                    </div>
                    {ref.skills.map((s) => (
                      <div key={s.label}>
                        {s.label} ({s.statPair}): PW <span className="stat-num">{s.finalPw}</span>
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

          {state.pendingChangeset.some((p) => p.reviewed === "pending") && (
            <section className="panel" style={{ borderColor: "var(--gold)" }}>
              <h2 style={{ color: "var(--gold-bright)" }}>GM review — push-back to CP Phantom</h2>
              <p className="muted" style={{ fontSize: 11 }}>
                Nothing here touches your live character until you approve it and hit Push.
                {state.meta.importedFromCpPhantomId
                  ? " Target: CP Phantom character this PC was imported from."
                  : " This PC wasn't imported — approved lines just stay logged."}
              </p>
              {state.pendingChangeset
                .filter((p) => p.reviewed === "pending")
                .map((p) => (
                  <div key={p.id} style={{ display: "flex", gap: 8, alignItems: "center", padding: "4px 0", flexWrap: "wrap" }}>
                    <span style={{ fontSize: 10, letterSpacing: "0.1em", color: AUTO_APPLY_KINDS.has(p.kind) ? "var(--cyan)" : "var(--text3)", minWidth: 66 }}>
                      {p.kind.toUpperCase()}
                    </span>
                    <span style={{ flex: 1, fontSize: 12 }}>{p.label}</span>
                    <button onClick={() => reviewChange(p.id, "approved")} style={{ padding: "3px 9px" }}>
                      Approve
                    </button>
                    <button onClick={() => reviewChange(p.id, "rejected")} style={{ padding: "3px 9px" }}>
                      Reject
                    </button>
                  </div>
                ))}
              <div style={{ marginTop: 8 }}>
                <button onClick={pushApproved} disabled={busy || state.pendingChangeset.filter((p) => p.reviewed === "approved").length === 0}>
                  {busy ? "Pushing…" : `Push ${state.pendingChangeset.filter((p) => p.reviewed === "approved").length} approved`}
                </button>
              </div>
            </section>
          )}

          <section style={{ margin: "14px 0" }}>
            <h2>Narration</h2>
            <div className="panel" style={{ whiteSpace: "pre-wrap", minHeight: 90, lineHeight: 1.7 }}>
              {[...state.sessionLog].reverse().find((l) => l.type === "narration")?.text ?? "—"}
            </div>
          </section>

          {lastRolls.length > 0 && (
            <section style={{ margin: "14px 0" }}>
              <h2>Engine rolls this turn</h2>
              <div className="panel" style={{ fontSize: 12, fontFamily: "var(--font)" }}>
                {lastRolls.map((r, i) => (
                  <div key={i} className={r.hit ? "danger" : undefined}>
                    <b>{r.actor}</b> — {r.purpose}: PW {r.pw} → [{r.dice.join(", ")}]{" "}
                    {r.total != null ? `= ${r.total}` : r.outcome.toUpperCase()}
                    {r.dv != null && ` vs DV ${r.dv} → ${r.hit ? "HIT" : "MISS"}`}
                    {r.damage != null && ` · ${r.damage} dmg`}
                  </div>
                ))}
              </div>
            </section>
          )}

          <details style={{ margin: "14px 0", fontSize: 12 }}>
            <summary style={{ cursor: "pointer", fontSize: 13 }}>
              Session log ({state.sessionLog.length}) — roll audit
            </summary>
            <div className="log-scroll" style={{ marginTop: 6, fontFamily: "var(--font)" }}>
              {[...state.sessionLog].reverse().map((l, i) => (
                <div
                  key={i}
                  style={{
                    padding: "2px 0",
                    color:
                      l.type === "roll"
                        ? l.roll?.isPC
                          ? "var(--green-bright)"
                          : "var(--red-bright)"
                        : l.type === "system"
                          ? "var(--text3)"
                          : l.type === "action"
                            ? "var(--cyan)"
                            : "var(--text)",
                  }}
                >
                  <span className="muted">{new Date(l.ts).toLocaleTimeString()} </span>
                  {l.type === "roll" && l.roll
                    ? `[${l.roll.source === "engine" ? "ENGINE" : "PLAYER"}] ${l.text}`
                    : `[${l.type}] ${l.text.length > 240 ? l.text.slice(0, 240) + "…" : l.text}`}
                </div>
              ))}
            </div>
          </details>

          {pending ? (
            <section className="panel panel-accent">
              <h2 style={{ color: "var(--red-bright)" }}>Your roll</h2>
              <p style={{ margin: "4px 0" }}>{pending.prompt}</p>
              <p style={{ margin: "4px 0", fontFamily: "var(--font)" }}>
                <b>{pending.statPair}</b> · PW <span className="stat-num">{pending.pw}</span> · {pending.diceInstruction}
                {pending.dv != null && (
                  <>
                    {" · beat DV "}
                    <span className="stat-num">{pending.dv}</span>
                  </>
                )}
              </p>
              <p className="muted" style={{ fontSize: 11 }}>
                Roll physical dice, type the faces (e.g. <code>14 12 7</code>).
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={rollInput}
                  onChange={(e) => setRollInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitRoll()}
                  placeholder="dice faces"
                  style={{ width: 200 }}
                />
                <button onClick={submitRoll} disabled={busy}>
                  {busy ? "…" : "Submit roll"}
                </button>
              </div>
            </section>
          ) : (
            <section style={{ margin: "14px 0" }}>
              <h2>What do you do?</h2>
              <textarea
                value={action + (interim ? " " + interim : "")}
                onChange={(e) => {
                  setAction(e.target.value);
                  setInterim("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (!busy) submitAction();
                  }
                }}
                rows={3}
                style={{ width: "100%" }}
                placeholder="Describe your action…  (Enter to send · Shift+Enter for a new line)"
              />
              <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
                <button onClick={submitAction} disabled={busy}>
                  {busy ? "GM is thinking…" : "Act ⏎"}
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

      {!showNew && !state && (
        <p className="muted">Load a campaign, or start a new one. Setup: see SETUP.md.</p>
      )}
    </main>
  );
}

// ── New campaign form ──────────────────────────────────────────────────────

function NewCampaignForm({
  onCreated,
  onError,
}: {
  onCreated: (s: CampaignState) => void | Promise<void>;
  onError: (msg: string) => void;
}) {
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"gigs" | "campaign">("gigs");
  const [premise, setPremise] = useState("");
  const [source, setSource] = useState<"blank" | "paste" | "import" | "build">("blank");
  const [pasteJson, setPasteJson] = useState("");
  const [builtCharacter, setBuiltCharacter] = useState<CharacterSheet | null>(null);
  const [cpChars, setCpChars] = useState<CpPhantomCharacterRef[]>([]);
  const [importId, setImportId] = useState("");
  const [busy, setBusy] = useState(false);
  const hasFirebase = firebaseConfigured();

  useEffect(() => {
    if (source === "import" && hasFirebase && cpChars.length === 0) {
      listCpPhantomCharacters()
        .then((list) => setCpChars(list.filter((c) => !c.isVehicle && !c.isDrone)))
        .catch((e) => onError("Couldn't list CP Phantom characters: " + e.message));
    }
  }, [source, hasFirebase, cpChars.length, onError]);

  async function resolveCharacter(): Promise<CharacterSheet> {
    if (source === "build") {
      if (!builtCharacter) throw new Error("Finish the life-path wizard first.");
      return builtCharacter;
    }
    if (source === "paste") {
      return CharacterSheet.parse(JSON.parse(pasteJson));
    }
    if (source === "import") {
      if (!importId) throw new Error("Pick a character to import.");
      const raw = await readCpPhantomCharacter(importId);
      if (!raw) throw new Error("That character wasn't found in CP Phantom.");
      return CharacterSheet.parse(raw);
    }
    return CharacterSheet.parse({ name: name ? `${name} — Runner` : "New Runner", stats: {}, hp_max: 30, hp_current: 30 });
  }

  async function create() {
    if (!name.trim()) {
      onError("Name the campaign.");
      return;
    }
    setBusy(true);
    onError("");
    try {
      const character = await resolveCharacter();
      let bible: CampaignBible | undefined;
      if (mode === "campaign") {
        const res = await fetch("/api/bible", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ premise, character }),
        });
        const data = (await res.json()) as { bible?: CampaignBible; error?: string };
        if (!res.ok || data.error) throw new Error(data.error || "campaign bible generation failed");
        bible = data.bible;
      }
      const id = "c_" + Date.now().toString(36);
      const s = newCampaignState({
        id,
        name: name.trim(),
        mode,
        character,
        importedFromCpPhantomId: source === "import" ? importId : null,
      });
      if (bible) s.campaignBible = bible;
      await onCreated(s);
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel">
      <h2>New campaign</h2>
      <label style={{ display: "block", marginBottom: 10 }}>
        <span className="muted" style={{ fontSize: 10, letterSpacing: "0.2em" }}>NAME</span>
        <input value={name} onChange={(e) => setName(e.target.value)} style={{ width: "100%", marginTop: 3 }} placeholder="Night City Sprawl" />
      </label>

      <div style={{ marginBottom: 10 }}>
        <span className="muted" style={{ fontSize: 10, letterSpacing: "0.2em" }}>MODE</span>
        <div style={{ display: "flex", gap: 14, marginTop: 4 }}>
          <label style={{ display: "flex", gap: 5, alignItems: "center", cursor: "pointer" }}>
            <input type="radio" checked={mode === "gigs"} onChange={() => setMode("gigs")} /> Gigs (episodic)
          </label>
          <label style={{ display: "flex", gap: 5, alignItems: "center", cursor: "pointer" }}>
            <input type="radio" checked={mode === "campaign"} onChange={() => setMode("campaign")} /> Campaign (macro-plot)
          </label>
        </div>
      </div>

      {mode === "campaign" && (
        <label style={{ display: "block", marginBottom: 10 }}>
          <span className="muted" style={{ fontSize: 10, letterSpacing: "0.2em" }}>
            PREMISE (seeds the campaign bible — leave blank to let the GM invent one)
          </span>
          <textarea value={premise} onChange={(e) => setPremise(e.target.value)} rows={2} style={{ width: "100%", marginTop: 3 }} placeholder="A fixer I trusted sold me out. I want to know who's really pulling the strings." />
        </label>
      )}

      <div style={{ marginBottom: 10 }}>
        <span className="muted" style={{ fontSize: 10, letterSpacing: "0.2em" }}>CHARACTER</span>
        <div style={{ display: "flex", gap: 14, marginTop: 4, flexWrap: "wrap" }}>
          <label style={{ display: "flex", gap: 5, alignItems: "center", cursor: "pointer" }}>
            <input type="radio" checked={source === "blank"} onChange={() => setSource("blank")} /> Blank stub
          </label>
          <label style={{ display: "flex", gap: 5, alignItems: "center", cursor: "pointer" }}>
            <input type="radio" checked={source === "paste"} onChange={() => setSource("paste")} /> Paste JSON
          </label>
          <label style={{ display: "flex", gap: 5, alignItems: "center", cursor: hasFirebase ? "pointer" : "not-allowed", opacity: hasFirebase ? 1 : 0.5 }}>
            <input type="radio" checked={source === "import"} disabled={!hasFirebase} onChange={() => setSource("import")} /> Import from CP Phantom
          </label>
          <label style={{ display: "flex", gap: 5, alignItems: "center", cursor: "pointer" }}>
            <input type="radio" checked={source === "build"} onChange={() => setSource("build")} /> Build (life-path)
          </label>
        </div>
        {source === "paste" && (
          <textarea value={pasteJson} onChange={(e) => setPasteJson(e.target.value)} rows={3} style={{ width: "100%", marginTop: 6 }} placeholder="Paste a CP Phantom character JSON" />
        )}
        {source === "import" && (
          <select value={importId} onChange={(e) => setImportId(e.target.value)} style={{ marginTop: 6 }}>
            <option value="">— pick a CP Phantom character —</option>
            {cpChars.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
                {x.isNPC ? " (NPC)" : ""}
              </option>
            ))}
          </select>
        )}
        {source === "build" && builtCharacter && (
          <div className="ok" style={{ fontSize: 12, marginTop: 6 }}>
            ✓ Built: {builtCharacter.name} (HP {builtCharacter.hp_max}, IP {builtCharacter.ip_max}) — hit Create campaign.{" "}
            <button onClick={() => setBuiltCharacter(null)} style={{ padding: "2px 8px" }}>Redo</button>
          </div>
        )}
      </div>

      {source === "build" && !builtCharacter ? (
        <LifePathWizard onDone={setBuiltCharacter} onCancel={() => setSource("blank")} />
      ) : (
        <button onClick={create} disabled={busy}>
          {busy ? (mode === "campaign" ? "Generating campaign bible…" : "Creating…") : "Create campaign"}
        </button>
      )}
    </section>
  );
}
