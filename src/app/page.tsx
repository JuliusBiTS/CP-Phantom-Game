"use client";

/**
 * Play screen. Phase 2: real new-campaign form (character import from CP
 * Phantom, campaign-bible generation), CP Phantom design-system skin.
 * Full visual pass (boot sequence, reticle) is still Phase 3.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { CampaignState, newCampaignState, CharacterSheet, type CampaignBible, type Tone } from "@/lib/state/campaignState";
import { getStore } from "@/lib/storage/store";
import { firebaseConfigured, listCpPhantomCharacters, readCpPhantomCharacter, type CpPhantomCharacterRef } from "@/lib/storage/firebase";
import { applyApprovedChanges, AUTO_APPLY_KINDS } from "@/lib/storage/pushback";
import { DictationButton } from "@/components/DictationButton";
import { LifePathWizard } from "@/components/LifePathWizard";
import { CombatTracker } from "@/components/CombatTracker";
import { VitalsHud } from "@/components/VitalsHud";
import { CharacterSheet as CharacterSheetPanel } from "@/components/CharacterSheet";
import { DicePad } from "@/components/DicePad";
import { QuickActions } from "@/components/QuickActions";
import { MissionBoard } from "@/components/MissionBoard";
import { TranscriptView } from "@/components/TranscriptView";
import { popHistory } from "@/lib/state/history";
import { estimateCostUsd, formatCostUsd } from "@/lib/llm/cost";
import { runTurnStream, StreamUnavailable } from "@/lib/llm/streamClient";
import { ToneEditor } from "@/components/ToneEditor";
import { DowntimePanel } from "@/components/DowntimePanel";
import { DEFAULT_TONE } from "@/lib/llm/tone";

type CharacterSheetType = CharacterSheet;

function pendingFromState(s: CampaignState): PlayerRollPrompt | null {
  const p = s.pendingPlayerRoll;
  if (!p) return null;
  return { prompt: p.prompt, statPair: p.statPair, pw: p.pw, diceInstruction: p.diceInstruction, dv: p.dv, kind: p.kind };
}

type TurnResult =
  | { kind: "awaiting-player-roll"; state: CampaignState; prompt: PlayerRollPrompt; narrationSoFar: string }
  | { kind: "turn-complete"; state: CampaignState; narration: string; delta: unknown; rolls: EngineRoll[] };

interface PlayerRollPrompt {
  prompt: string;
  statPair: string;
  pw: number;
  diceInstruction: string;
  dv: number | null;
  kind?: "action" | "initiative";
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
  const [pending, setPending] = useState<PlayerRollPrompt | null>(null);
  const [lastRolls, setLastRolls] = useState<EngineRoll[]>([]);
  const [streamText, setStreamText] = useState("");
  const [showSheet, setShowSheet] = useState(false);
  const [showBoard, setShowBoard] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [showTone, setShowTone] = useState(false);
  const [showRecap, setShowRecap] = useState(false);

  useEffect(() => {
    store.list().then(setCampaigns).catch(() => {});
  }, [store]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      const inField = !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT");
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z" && !e.shiftKey && !inField) {
        e.preventDefault();
        void undo();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (inField) return;
      const k = e.key.toLowerCase();
      if (k === "c") setShowSheet((v) => !v);
      else if (k === "m") setShowBoard((v) => !v);
      else if (k === "t") setShowTranscript((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  async function persist(s: CampaignState) {
    setState(s);
    await store.save(s);
    setCampaigns(await store.list());
  }

  function patchCharacter(mut: (c: CharacterSheetType) => void) {
    setState((prev) => {
      if (!prev) return prev;
      const next: CampaignState = structuredClone(prev);
      mut(next.character);
      next.meta.lastPlayedAt = Date.now();
      void store.save(next);
      return next;
    });
  }

  function patchCombat(mut: (c: CampaignState["combat"]) => void) {
    setState((prev) => {
      if (!prev) return prev;
      const next: CampaignState = structuredClone(prev);
      mut(next.combat);
      void store.save(next);
      return next;
    });
  }

  const patchState = useCallback(
    (mut: (s: CampaignState) => void) => {
      setState((prev) => {
        if (!prev) return prev;
        const next: CampaignState = structuredClone(prev);
        mut(next);
        void store.save(next);
        return next;
      });
    },
    [store],
  );

  /** Board-only patch — clones just `missionBoard`, not the whole (now large,
   *  history-carrying) state. Keeps drag/resize cheap. */
  const patchBoard = useCallback(
    (mut: (b: CampaignState["missionBoard"]) => void) => {
      setState((prev) => {
        if (!prev) return prev;
        const next: CampaignState = { ...prev, missionBoard: structuredClone(prev.missionBoard) };
        mut(next.missionBoard);
        void store.save(next);
        return next;
      });
    },
    [store],
  );

  async function undo() {
    setState((prev) => {
      if (!prev) return prev;
      const res = popHistory(prev);
      if (!res) return prev;
      setPending(pendingFromState(res.state));
      setLastRolls([]);
      setError(null);
      void store.save(res.state).then(() => store.list().then(setCampaigns));
      return res.state;
    });
  }

  /** "Previously on…" — show a cached recap, or generate one when returning after a break. */
  async function maybeRecap(s: CampaignState) {
    const lastNarr = [...s.sessionLog].reverse().find((l) => l.type === "narration");
    if (!lastNarr) {
      setShowRecap(false);
      return;
    }
    const fresh = s.meta.recap && s.meta.recapForTs === lastNarr.ts;
    if (fresh) {
      setShowRecap(true);
      return;
    }
    const backFromBreak = Date.now() - s.meta.lastPlayedAt > 30 * 60 * 1000;
    if (!backFromBreak) {
      setShowRecap(false);
      return;
    }
    try {
      const res = await fetch("/api/recap", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ state: s }),
      });
      const data = (await res.json()) as { recap?: string; error?: string };
      if (data.recap) {
        setState((prev) => {
          const target = prev && prev.meta.id === s.meta.id ? prev : s;
          const next: CampaignState = structuredClone(target);
          next.meta.recap = data.recap!;
          next.meta.recapForTs = lastNarr.ts;
          void store.save(next);
          return next;
        });
        setShowRecap(true);
      }
    } catch {
      /* recap is a nicety — never block loading on it */
    }
  }

  async function onCreated(s: CampaignState) {
    setShowNew(false);
    setPending(null);
    setLastRolls([]);
    await persist(s);
  }

  async function applyTurnResult(data: TurnResult) {
    await persist(data.state);
    if (data.kind === "awaiting-player-roll") {
      setPending(data.prompt);
      setLastRolls([]);
    } else {
      setPending(null);
      setLastRolls(data.rolls);
    }
  }

  async function sendTurnBlocking(input: unknown) {
    if (!state) return;
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
    await applyTurnResult(data);
  }

  async function sendTurn(input: unknown) {
    if (!state) return;
    setBusy(true);
    setError(null);
    setStreamText("");
    setLastRolls([]);
    const rolls: EngineRoll[] = [];
    let finalResult: TurnResult | null = null;
    try {
      await runTurnStream(
        { state, input },
        {
          onText: (d) => setStreamText((t) => t + d),
          onRoll: (r) => {
            rolls.push(r as EngineRoll);
            setLastRolls([...rolls]);
          },
          onDone: (data) => {
            finalResult = data as unknown as TurnResult;
          },
          onError: (m) => setError(m),
        },
      );
      if (finalResult) await applyTurnResult(finalResult);
    } catch (e) {
      if (e instanceof StreamUnavailable) {
        try {
          await sendTurnBlocking(input);
        } catch (e2) {
          setError((e2 as Error).message);
        }
      } else {
        setError((e as Error).message);
      }
    } finally {
      setBusy(false);
      setStreamText("");
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

  function submitRoll(total: number, dice: number[]) {
    if (!pending) return;
    sendTurn({ kind: "playerRoll", total, dice });
  }

  const c = state?.character;
  const combat = state?.combat;

  return (
    <main style={{ maxWidth: 940, margin: "0 auto", padding: "28px 20px 80px" }}>
      <h1>CP PHANTOM — SOLO</h1>
      <div className="muted" style={{ fontSize: 10, letterSpacing: "0.3em", marginTop: 4 }}>
        Night City Sprawl · Solo Companion
      </div>

      <section style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", margin: "18px 0" }}>
        <select
          value={state?.meta.id ?? ""}
          onChange={async (e) => {
            const s = await store.load(e.target.value);
            if (s) {
              setState(s);
              setShowNew(false);
              setPending(pendingFromState(s));
              setLastRolls([]);
              void maybeRecap(s);
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
            {state.meta.mode.toUpperCase()}
          </span>
        )}
        {state && state.mode !== "exploration" && !state.combat.active && (
          <span style={{ fontSize: 10, letterSpacing: "0.15em", color: "var(--gold-bright)", border: "1px solid var(--gold)", padding: "1px 6px" }}>
            {state.mode.toUpperCase()}
          </span>
        )}
        {state && state.combat.active && (
          <span style={{ fontSize: 10, letterSpacing: "0.15em", color: "var(--red-bright)", border: "1px solid var(--red)", padding: "1px 6px" }}>
            COMBAT
          </span>
        )}
        {state && (
          <span style={{ display: "flex", gap: 6, alignItems: "center", marginLeft: "auto" }}>
            <button
              onClick={undo}
              disabled={busy || (state.history?.length ?? 0) === 0}
              title={state.history?.length ? `Rewind: ${state.history[state.history.length - 1].label}` : "Nothing to undo"}
              style={{ padding: "3px 9px", fontSize: 10 }}
            >
              ↶ Rewind{state.history?.length ? ` (${state.history.length})` : ""}
            </button>
            <button onClick={() => setShowTranscript(true)} style={{ padding: "3px 9px", fontSize: 10 }}>
              Transcript (T)
            </button>
            <span style={{ position: "relative" }}>
              <button onClick={() => setShowTone((v) => !v)} style={{ padding: "3px 9px", fontSize: 10 }}>
                Tone
              </button>
              {showTone && (
                <div className="panel" style={{ position: "absolute", right: 0, top: "110%", zIndex: 50, width: 260 }}>
                  <div className="muted" style={{ fontSize: 9, letterSpacing: "0.15em", marginBottom: 6 }}>
                    TONE DIALS — applied next turn
                  </div>
                  <ToneEditor
                    tone={state.meta.tone}
                    compact
                    onChange={(t) => patchState((s) => { s.meta.tone = t; })}
                  />
                </div>
              )}
            </span>
            <CostMeter state={state} />
          </span>
        )}
      </section>

      {error && (
        <p className="panel panel-accent danger" style={{ fontSize: 12 }}>
          {error}
        </p>
      )}

      {showNew && <NewCampaignForm onCreated={onCreated} onError={setError} />}

      {!showNew && state && showBoard && (
        <MissionBoard state={state} onPatchState={patchState} onPatchBoard={patchBoard} onClose={() => setShowBoard(false)} />
      )}

      {!showNew && state && showTranscript && <TranscriptView state={state} onClose={() => setShowTranscript(false)} />}

      {!showNew && state && c && (
        <>
          <VitalsHud state={state} onPatch={patchCharacter} onOpenSheet={() => setShowSheet(true)} />

          <div style={{ display: "flex", gap: 8, margin: "0 0 4px" }}>
            <button onClick={() => setShowBoard(true)} style={{ padding: "3px 10px", fontSize: 10 }}>
              Mission Board (M)
              {state.missionBoard.windows.some((w) => w.createdAt > state.missionBoard.lastOpenedAt) && (
                <span className="board-new" style={{ marginLeft: 6 }}>NEW</span>
              )}
            </button>
          </div>

          {showSheet && (
            <CharacterSheetPanel character={c} onPatch={patchCharacter} onClose={() => setShowSheet(false)} />
          )}

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

          {state.mode === "downtime" && !combat?.active && (
            <DowntimePanel state={state} busy={busy} onExit={() => sendTurn({ kind: "action", text: "I'm done resting up — I want to get back to work." })} />
          )}

          {state.consequences.some((q) => q.status === "armed") && (
            <details className="panel panel-accent" style={{ borderColor: "var(--red)", margin: "12px 0" }}>
              <summary style={{ cursor: "pointer", color: "var(--red-bright)", fontFamily: "var(--font-display)", letterSpacing: "0.05em" }}>
                Consequences · {state.consequences.filter((q) => q.status === "armed").length} loaded
              </summary>
              <div style={{ marginTop: 6 }}>
                {state.consequences
                  .filter((q) => q.status === "armed")
                  .map((q) => (
                    <div key={q.id} style={{ display: "flex", gap: 8, alignItems: "baseline", padding: "3px 0", fontSize: 12 }}>
                      <span
                        style={{
                          fontSize: 9,
                          letterSpacing: "0.1em",
                          minWidth: 46,
                          color: q.severity === "grave" ? "var(--red-bright)" : q.severity === "major" ? "var(--gold-bright)" : "var(--text3)",
                        }}
                      >
                        {q.severity.toUpperCase()}
                      </span>
                      <span style={{ flex: 1 }}>{q.text}</span>
                      <button
                        onClick={() => patchState((s) => { const x = s.consequences.find((c) => c.id === q.id); if (x) x.status = "resolved"; })}
                        style={{ padding: "1px 7px", fontSize: 10 }}
                      >
                        resolved
                      </button>
                    </div>
                  ))}
              </div>
            </details>
          )}

          <CombatTracker state={state} onPatchCombat={patchCombat} />

          {showRecap && state.meta.recap && (
            <section className="panel panel-accent" style={{ margin: "14px 0", borderColor: "var(--cyan)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <h2 style={{ color: "var(--cyan)" }}>Previously on…</h2>
                <button
                  onClick={() => { setShowRecap(false); patchState((s) => { s.meta.recap = ""; }); }}
                  style={{ padding: "2px 8px", fontSize: 10 }}
                >
                  dismiss ✕
                </button>
              </div>
              <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.7, fontStyle: "italic", color: "var(--text2)" }}>
                {state.meta.recap}
              </div>
            </section>
          )}

          <section style={{ margin: "14px 0" }}>
            <h2>Narration{busy && <span className="muted" style={{ fontSize: 10, letterSpacing: "0.2em" }}> · LIVE</span>}</h2>
            <div className="panel" style={{ whiteSpace: "pre-wrap", minHeight: 90, lineHeight: 1.7 }}>
              {streamText ? (
                <>
                  {streamText}
                  <span className="stream-caret">▋</span>
                </>
              ) : busy ? (
                <span className="muted">GM is thinking…</span>
              ) : (
                [...state.sessionLog].reverse().find((l) => l.type === "narration")?.text ?? "—"
              )}
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
            <section className="panel panel-accent reticle">
              <span className="reticle-tr" />
              <span className="reticle-bl" />
              <h2 style={{ color: "var(--red-bright)" }}>
                {pending.kind === "initiative" ? "Roll initiative" : "Your roll"}
              </h2>
              <p style={{ margin: "4px 0" }}>{pending.prompt}</p>
              <p style={{ margin: "4px 0", fontFamily: "var(--font)" }}>
                <b>{pending.statPair}</b> · PW <span className="stat-num">{pending.pw}</span>
                {pending.dv != null && (
                  <>
                    {" · beat DV "}
                    <span className="stat-num">{pending.dv}</span>
                  </>
                )}
              </p>
              <DicePad key={`${pending.pw}-${pending.prompt}`} pw={pending.pw} dv={pending.dv} busy={busy} onSubmit={submitRoll} />
            </section>
          ) : (
            <section style={{ margin: "14px 0" }}>
              <h2>
                {combat?.active
                  ? `Round ${combat.round} — your turn`
                  : state.mode === "downtime"
                  ? "Downtime — what do you take care of?"
                  : "What do you do?"}
              </h2>
              {!combat?.active && state.suggestedActions.length > 0 && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "0 0 8px" }}>
                  {state.suggestedActions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => setAction((a) => (a ? a.trim() + " " : "") + s)}
                      style={{ padding: "4px 10px", fontSize: 11, textAlign: "left", borderColor: "var(--border2)" }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
              {c && (
                <QuickActions
                  combat={combat ?? null}
                  mode={state.mode}
                  weapons={(c.weapons as Array<{ name?: string }> | undefined)?.map((w) => w.name ?? "").filter(Boolean) ?? []}
                  onPick={(text) => setAction((a) => (a ? a.trim() + " " : "") + text)}
                />
              )}
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
                  holdKey="`"
                  onFinalText={(t) => {
                    setAction((a) => (a ? a + " " : "") + t);
                    setInterim("");
                  }}
                  onInterimText={setInterim}
                />
                <span className="muted" style={{ fontSize: 10 }}>
                  or hold <code>`</code> to talk
                </span>
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

// ── Session cost meter ─────────────────────────────────────────────────────

function CostMeter({ state }: { state: CampaignState }) {
  const [open, setOpen] = useState(false);
  const u = state.meta.usage;
  const usd = estimateCostUsd(u, state.meta.model);
  return (
    <span style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        title="Estimated Anthropic API spend this campaign"
        style={{ padding: "3px 9px", fontSize: 10, fontFamily: "var(--font)" }}
      >
        ≈ {formatCostUsd(usd)} · {u.turns} turn{u.turns === 1 ? "" : "s"}
      </button>
      {open && (
        <div
          className="panel"
          style={{ position: "absolute", right: 0, top: "110%", zIndex: 50, width: 230, fontSize: 11, fontFamily: "var(--font)" }}
        >
          <div className="muted" style={{ fontSize: 9, letterSpacing: "0.15em", marginBottom: 4 }}>
            TOKENS · {state.meta.model}
          </div>
          <Row k="input" v={u.inputTokens} />
          <Row k="output" v={u.outputTokens} />
          <Row k="cache read" v={u.cacheReadTokens} />
          <Row k="cache write" v={u.cacheWriteTokens} />
          <div style={{ borderTop: "1px solid var(--border)", marginTop: 4, paddingTop: 4 }}>
            <Row k="est. cost" v={formatCostUsd(usd)} />
          </div>
          <div className="muted" style={{ fontSize: 9, marginTop: 4 }}>Estimate — published per-token rates.</div>
        </div>
      )}
    </span>
  );
}

function Row({ k, v }: { k: string; v: number | string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span className="muted">{k}</span>
      <span className="stat-num">{typeof v === "number" ? v.toLocaleString() : v}</span>
    </div>
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
  const [tone, setTone] = useState<Tone>({ ...DEFAULT_TONE });
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
      s.meta.tone = tone;
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

      <details style={{ marginBottom: 10 }}>
        <summary style={{ cursor: "pointer" }}>
          <span className="muted" style={{ fontSize: 10, letterSpacing: "0.2em" }}>TONE</span>{" "}
          <span className="muted" style={{ fontSize: 10 }}>— how the GM pitches the fiction (change anytime)</span>
        </summary>
        <div style={{ marginTop: 8 }}>
          <ToneEditor tone={tone} onChange={setTone} />
        </div>
      </details>

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
