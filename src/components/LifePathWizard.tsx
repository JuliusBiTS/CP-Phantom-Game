"use client";

/**
 * Life-path character creator — rulebook v12 §27. SOLO_MODE_BUILD_PLAN.md §5.5.
 * The player rolls every die physically and types the result; the wizard
 * presents the table, applies the numeric outcome, and journals the rest.
 */

import { useMemo, useState } from "react";
import type { CharacterSheet } from "@/lib/state/campaignState";
import { POWER_STATS, MOBILITY_STATS, MIND_STATS } from "@/lib/rules/derived";
import {
  ORIGINS, CHILDHOOD, w20Outcome, CRIT_FAIL_CONSEQUENCES, YEAR_EVENTS, yearBand, ACTIVITIES,
  PERSONALITY, VALUES, LIFE_GOALS, CULTURES,
  FREE_TREE_POINTS, STAT_POINTS_PER_TREE_POINT, MAX_STAT_POINTS_PER_TREE,
  type Activity,
} from "@/lib/lifepath/tables";
import {
  initFromOrigin, applyDelta, journal, finalizeBuild, emptyAllocation, allocationTotals,
  type LifePathBuild, type FreeAllocation,
} from "@/lib/lifepath/engine";

type Step = "origin" | "childhood" | "youth" | "free" | "finish";

const TREE_STATS: Record<string, readonly string[]> = { power: POWER_STATS, mobility: MOBILITY_STATS, mind: MIND_STATS };

function Die({ label, sides, onValue }: { label: string; sides: number; onValue: (n: number) => void }) {
  const [v, setV] = useState("");
  function submit() {
    const n = parseInt(v, 10);
    if (Number.isFinite(n) && n >= 1 && n <= sides) {
      onValue(n);
      setV("");
    }
  }
  return (
    <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
      <input
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder={`W${sides}`}
        style={{ width: 60 }}
        aria-label={label}
      />
      <button onClick={submit} style={{ padding: "4px 10px" }}>
        {label}
      </button>
    </span>
  );
}

export function LifePathWizard({
  onDone,
  onCancel,
}: {
  onDone: (sheet: CharacterSheet) => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState<Step>("origin");
  const [build, setBuild] = useState<LifePathBuild | null>(null);
  const [name, setName] = useState("");

  // childhood
  const [childRolls, setChildRolls] = useState<number[]>([]);
  // youth
  const [age, setAge] = useState(7);
  const [yearActs, setYearActs] = useState<[string, string]>(["", ""]);
  const [actRolls, setActRolls] = useState<number[]>([]);
  const [critFailPending, setCritFailPending] = useState(false);
  // free points
  const [alloc, setAlloc] = useState<FreeAllocation>(emptyAllocation());
  // finish
  const [personality, setPersonality] = useState("");
  const [value, setValue] = useState("");
  const [lifeGoal, setLifeGoal] = useState("");
  const [culture, setCulture] = useState("");
  const [language, setLanguage] = useState("");

  const totals = useMemo(() => (build ? allocationTotals(alloc) : null), [alloc, build]);

  function pickOrigin(key: string) {
    setBuild(initFromOrigin(key));
    setStep("childhood");
  }

  function applyChildhood(roll: number) {
    if (!build || childRolls.length >= 2) return;
    const row = CHILDHOOD.find((r) => r.roll === roll)!;
    let b = applyDelta(build, row.stats);
    b = journal(b, "Phase 1 — Childhood", `W10 ${roll}: ${row.label}${row.note ? ` — ${row.note}` : ""}`);
    setBuild(b);
    setChildRolls([...childRolls, roll]);
  }

  const activitiesForAge = (a: number) => ACTIVITIES.filter((x) => x.fromAge <= a);

  function applyActivityRoll(roll: number) {
    if (!build) return;
    const idx = actRolls.length;
    const act = ACTIVITIES.find((x) => x.key === yearActs[idx]);
    if (!act) return;
    const out = w20Outcome(roll);
    let b = applyDelta(build, out.apply(act.primary, act.secondary));
    b = journal(
      b,
      `Phase 2 — Age ${age}`,
      `${act.label}: W20 ${roll} (${out.band})${out.note ? ` — ${out.note}` : ""}${act.bonus ? ` [activity bonus available: ${act.bonus}]` : ""}`,
    );
    setBuild(b);
    setActRolls([...actRolls, roll]);
    if (roll === 20) setCritFailPending(true);
  }

  function applyCritFail(roll: number) {
    if (!build) return;
    const row = CRIT_FAIL_CONSEQUENCES.find((r) => r.roll === roll)!;
    let b = applyDelta(build, row.stats);
    b = journal(b, `Phase 2 — Age ${age}`, `Crit-fail consequence W10 ${roll}: ${row.label}${row.note ? ` — ${row.note}` : ""}`);
    setBuild(b);
    setCritFailPending(false);
  }

  function applyYearEvent(roll: number) {
    if (!build) return;
    const band = yearBand(age);
    const row = YEAR_EVENTS[band].find((r) => r.roll === roll)!;
    let b = applyDelta(build, row.stats);
    b = journal(b, `Phase 2 — Age ${age}`, `Year event W10 ${roll}: ${row.label}${row.note ? ` — ${row.note}` : ""}`);
    setBuild(b);
    // advance year
    if (age >= 18) {
      setStep("free");
    } else {
      setAge(age + 1);
      setYearActs(["", ""]);
      setActRolls([]);
    }
  }

  function skipRemainingYears() {
    if (age < 18 && build) {
      setBuild(journal(build, `Phase 2 — Age ${age}-18`, "Remaining youth years skipped (fill in later with the GM if you want the full spread)."));
    }
    setStep("free");
  }

  function setAllocCell(tree: keyof FreeAllocation, stat: string, delta: number) {
    setAlloc((prev) => {
      const next = structuredClone(prev);
      next[tree][stat] = Math.max(0, (next[tree][stat] ?? 0) + delta);
      return next;
    });
  }

  function finish() {
    if (!build) return;
    onDone(
      finalizeBuild(build, name, alloc, {
        personality, value, lifeGoal,
        culture, language,
      }),
    );
  }

  return (
    <section className="panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h2>Life-path character creator</h2>
        <button onClick={onCancel} style={{ padding: "3px 9px" }}>Cancel</button>
      </div>
      <div className="muted" style={{ fontSize: 10, letterSpacing: "0.2em", marginBottom: 10 }}>
        {step.toUpperCase()} · you roll every die yourself
      </div>

      {step === "origin" && (
        <div style={{ display: "grid", gap: 8 }}>
          <p className="muted" style={{ fontSize: 12 }}>Phase 0 — your social context. Named stats start at 3, everything else at 2.</p>
          {ORIGINS.map((o) => (
            <button key={o.key} onClick={() => pickOrigin(o.key)} style={{ textAlign: "left", padding: 10, textTransform: "none", letterSpacing: 0 }}>
              <b style={{ fontFamily: "var(--font-display)", letterSpacing: "0.05em" }}>{o.label}</b>
              <span className="muted"> — {o.blurb}</span>
              <div style={{ fontSize: 11, marginTop: 3 }} className="muted">
                {o.namedStats.join(", ")} · HP {o.hp} · STA {o.stamina} · IP +{o.ip}
              </div>
            </button>
          ))}
        </div>
      )}

      {step === "childhood" && build && (
        <div>
          <p className="muted" style={{ fontSize: 12 }}>Phase 1 — age 0-6. Roll W10 twice on the childhood-imprint table.</p>
          <div className="log-scroll" style={{ maxHeight: 200, marginBottom: 10 }}>
            {CHILDHOOD.map((r) => (
              <div key={r.roll} style={{ padding: "1px 0" }}>
                <span className="stat-num">{r.roll}</span> {r.label}
                <span className="muted"> — {Object.entries(r.stats).map(([k, v]) => `${(v ?? 0) > 0 ? "+" : ""}${v ?? 0} ${k}`).join(", ") || "narrative"}</span>
              </div>
            ))}
          </div>
          {childRolls.length < 2 ? (
            <Die label={`Roll ${childRolls.length + 1} of 2`} sides={10} onValue={applyChildhood} />
          ) : (
            <button onClick={() => { setStep("youth"); }}>Continue to Phase 2 →</button>
          )}
        </div>
      )}

      {step === "youth" && build && (
        <div>
          <p className="muted" style={{ fontSize: 12 }}>
            Phase 2 — age <b className="stat-num">{age}</b> of 18. Pick 2 activities, roll W20 for each, then roll W10 for the year event.
          </p>
          {[0, 1].map((i) => (
            <div key={i} style={{ margin: "6px 0" }}>
              <select
                value={yearActs[i]}
                onChange={(e) => {
                  const next: [string, string] = [...yearActs];
                  next[i] = e.target.value;
                  setYearActs(next);
                }}
                disabled={actRolls.length > i}
              >
                <option value="">— activity {i + 1} —</option>
                {activitiesForAge(age)
                  .filter((a) => yearActs[1 - i] !== a.key)
                  .map((a: Activity) => (
                    <option key={a.key} value={a.key}>
                      {a.category[0]} · {a.label} ({a.primary}
                      {a.secondary ? `/${a.secondary}` : ""})
                    </option>
                  ))}
              </select>
              {actRolls[i] != null && <span className="muted" style={{ fontSize: 11 }}> → W20 {actRolls[i]}: {w20Outcome(actRolls[i]).band}</span>}
            </div>
          ))}

          {critFailPending ? (
            <div style={{ margin: "8px 0" }}>
              <p className="danger" style={{ fontSize: 12 }}>Crit fail — roll W10 on the consequence table:</p>
              <div className="log-scroll" style={{ maxHeight: 140, marginBottom: 6 }}>
                {CRIT_FAIL_CONSEQUENCES.map((r) => (
                  <div key={r.roll}><span className="stat-num">{r.roll}</span> {r.label}</div>
                ))}
              </div>
              <Die label="Consequence W10" sides={10} onValue={applyCritFail} />
            </div>
          ) : actRolls.length < 2 ? (
            yearActs[actRolls.length] ? (
              <Die label={`W20 for activity ${actRolls.length + 1}`} sides={20} onValue={applyActivityRoll} />
            ) : (
              <p className="muted" style={{ fontSize: 11 }}>Pick activity {actRolls.length + 1} to roll.</p>
            )
          ) : (
            <div style={{ margin: "8px 0" }}>
              <p className="muted" style={{ fontSize: 12 }}>Year event — roll W10 (table for age {age}):</p>
              <div className="log-scroll" style={{ maxHeight: 160, marginBottom: 6 }}>
                {YEAR_EVENTS[yearBand(age)].map((r) => (
                  <div key={r.roll}>
                    <span className="stat-num">{r.roll}</span> {r.label}
                    <span className="muted"> — {Object.entries(r.stats).map(([k, v]) => `${(v ?? 0) > 0 ? "+" : ""}${v ?? 0} ${k}`).join(", ") || "narrative"}</span>
                  </div>
                ))}
              </div>
              <Die label={`Year-event W10 (age ${age})`} sides={10} onValue={applyYearEvent} />
            </div>
          )}

          <div style={{ marginTop: 12 }}>
            <button onClick={skipRemainingYears} style={{ padding: "3px 9px" }} className="muted">
              Skip remaining years →
            </button>
          </div>
        </div>
      )}

      {step === "free" && build && totals && (
        <div>
          <p className="muted" style={{ fontSize: 12 }}>
            Free points — {FREE_TREE_POINTS} tree points = {FREE_TREE_POINTS * STAT_POINTS_PER_TREE_POINT} stat points
            ({STAT_POINTS_PER_TREE_POINT} per tree point). Max {MAX_STAT_POINTS_PER_TREE} per tree.
          </p>
          <p style={{ fontSize: 12 }}>
            Spent: <span className={totals.all > FREE_TREE_POINTS * STAT_POINTS_PER_TREE_POINT ? "danger" : "ok"}>{totals.all}</span> / {FREE_TREE_POINTS * STAT_POINTS_PER_TREE_POINT}
          </p>
          {(["power", "mobility", "mind"] as const).map((tree) => (
            <div key={tree} style={{ margin: "8px 0" }}>
              <div className="muted" style={{ fontSize: 10, letterSpacing: "0.2em" }}>
                {tree.toUpperCase()} — {totals[tree]}/{MAX_STAT_POINTS_PER_TREE}
                {totals[tree] > MAX_STAT_POINTS_PER_TREE && <span className="danger"> over cap</span>}
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 3 }}>
                {TREE_STATS[tree].map((s) => (
                  <span key={s} style={{ fontSize: 12, display: "inline-flex", gap: 4, alignItems: "center" }}>
                    {s} <span className="stat-num">{(build.stats[s] ?? 0) + (alloc[tree][s] ?? 0)}</span>
                    <button onClick={() => setAllocCell(tree, s, -1)} style={{ padding: "0 6px" }}>−</button>
                    <button onClick={() => setAllocCell(tree, s, 1)} style={{ padding: "0 6px" }}>+</button>
                  </span>
                ))}
              </div>
            </div>
          ))}
          <button
            onClick={() => setStep("finish")}
            disabled={totals.all > FREE_TREE_POINTS * STAT_POINTS_PER_TREE_POINT || totals.power > MAX_STAT_POINTS_PER_TREE || totals.mobility > MAX_STAT_POINTS_PER_TREE || totals.mind > MAX_STAT_POINTS_PER_TREE}
          >
            Continue →
          </button>
        </div>
      )}

      {step === "finish" && build && (
        <div style={{ display: "grid", gap: 8 }}>
          <label>
            <span className="muted" style={{ fontSize: 10, letterSpacing: "0.2em" }}>NAME</span>
            <input value={name} onChange={(e) => setName(e.target.value)} style={{ width: "100%", marginTop: 3 }} placeholder="Runner name" />
          </label>
          {[
            { label: "Personality (W10)", opts: PERSONALITY, val: personality, set: setPersonality },
            { label: "Values most (W10)", opts: VALUES, val: value, set: setValue },
            { label: "Life goal (W10)", opts: LIFE_GOALS, val: lifeGoal, set: setLifeGoal },
          ].map((row) => (
            <label key={row.label}>
              <span className="muted" style={{ fontSize: 10, letterSpacing: "0.2em" }}>{row.label}</span>
              <select value={row.val} onChange={(e) => row.set(e.target.value)} style={{ display: "block", marginTop: 3 }}>
                <option value="">— roll W10 & pick —</option>
                {row.opts.map((o, i) => (
                  <option key={o} value={o}>
                    {i + 1}. {o}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <label>
            <span className="muted" style={{ fontSize: 10, letterSpacing: "0.2em" }}>Cultural origin (W10) — a language at level 4</span>
            <select
              value={culture}
              onChange={(e) => {
                setCulture(e.target.value);
                setLanguage("");
              }}
              style={{ display: "block", marginTop: 3 }}
            >
              <option value="">— roll W10 & pick —</option>
              {CULTURES.map((c, i) => (
                <option key={c.region} value={c.region}>
                  {i + 1}. {c.region}
                </option>
              ))}
            </select>
          </label>
          {culture && (
            <label>
              <span className="muted" style={{ fontSize: 10, letterSpacing: "0.2em" }}>Language</span>
              <select value={language} onChange={(e) => setLanguage(e.target.value)} style={{ display: "block", marginTop: 3 }}>
                <option value="">— pick —</option>
                {(CULTURES.find((c) => c.region === culture)?.languages ?? "").split(", ").map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
          )}

          <details style={{ fontSize: 12 }}>
            <summary style={{ cursor: "pointer" }}>Life-path journal ({build.journal.length} entries)</summary>
            <div className="log-scroll" style={{ marginTop: 6 }}>
              {build.journal.map((j, i) => (
                <div key={i}>
                  <span className="muted">[{j.phase}]</span> {j.text}
                </div>
              ))}
            </div>
          </details>

          <button onClick={finish}>Create this character</button>
        </div>
      )}
    </section>
  );
}
