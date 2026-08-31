"use client";

/** Printable case file of the Mission Board — FEATURE_PLAN §M5. Hidden on
 *  screen; `@media print` (via the "Case file" button → window.print()) shows
 *  only this. Redactions stay redacted. */

import type { CampaignState } from "@/lib/state/campaignState";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 14, breakInside: "avoid" }}>
      <h2 style={{ fontSize: 13, borderBottom: "1px solid #000", margin: "0 0 4px" }}>{title}</h2>
      {children}
    </section>
  );
}

export function CaseFile({ state }: { state: CampaignState }) {
  const { world, questLog, missionBoard, timeline, consequences, campaignBible, meta } = state;
  const winTitle = (id: string) => {
    const w = missionBoard.windows.find((x) => x.id === id);
    if (!w) return "?";
    const parts: string[] = [];
    if (w.kind === "dossier") parts.push(world.npcs.find((n) => n.id === w.refId)?.name ?? "?");
    else if (w.kind === "objective") parts.push(questLog.find((q) => q.id === w.refId)?.title ?? "?");
    else parts.push(w.refId ?? w.kind);
    return parts.join(" ");
  };

  return (
    <div className="case-file">
      <header style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, letterSpacing: "0.3em" }}>CLASSIFIED · EYES ONLY</div>
        <h1 style={{ fontSize: 20, margin: "2px 0" }}>{meta.name} — Case File</h1>
        <div style={{ fontSize: 11 }}>
          {meta.inGameDate && <>In-game: {meta.inGameDate} · </>}
          Printed {new Date().toLocaleString()}
        </div>
      </header>

      <Section title="Objectives">
        {questLog.filter((q) => q.status === "active").map((q) => (
          <div key={q.id} style={{ marginBottom: 3 }}>
            <b>{q.title}</b> — {q.summary || "—"}
          </div>
        ))}
        {questLog.filter((q) => q.status === "active").length === 0 && <div>None active.</div>}
      </Section>

      <Section title="People">
        {world.npcs
          .filter((n) => n.notableFacts.length || n.sheet || n.status !== "alive")
          .map((n) => (
            <div key={n.id} style={{ marginBottom: 5, breakInside: "avoid" }}>
              <b>{n.name}</b> — {n.disposition}
              {n.status !== "alive" && ` (${n.status})`}
              <ul style={{ margin: "1px 0 1px 16px" }}>
                {n.notableFacts.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </div>
          ))}
      </Section>

      {world.knownLocations.length > 0 && (
        <Section title="Locations">
          {world.knownLocations.map((l) => (
            <div key={l.name} style={{ marginBottom: 3 }}>
              <b>{l.name}</b> — {l.description}
              {l.notableFacts.length > 0 && <> · {l.notableFacts.join("; ")}</>}
            </div>
          ))}
        </Section>
      )}

      {world.factions.length > 0 && (
        <Section title="Factions">
          {world.factions.map((f) => (
            <div key={f.name}>
              <b>{f.name}</b> — standing: {f.standingWithPC}
              {f.notableFacts.length > 0 && <> · {f.notableFacts.join("; ")}</>}
            </div>
          ))}
        </Section>
      )}

      {missionBoard.links.length > 0 && (
        <Section title="Connections">
          {missionBoard.links.map((l) => (
            <div key={l.id}>
              {winTitle(l.from)} — {l.label || "linked"} → {winTitle(l.to)}
            </div>
          ))}
        </Section>
      )}

      {consequences.some((c) => c.status === "armed") && (
        <Section title="Open threads">
          {consequences
            .filter((c) => c.status === "armed")
            .map((c) => (
              <div key={c.id}>
                [{c.severity}] {c.text}
              </div>
            ))}
        </Section>
      )}

      {timeline.length > 0 && (
        <Section title="Timeline">
          <ol style={{ margin: "0 0 0 16px" }}>
            {timeline.map((b, i) => (
              <li key={i}>
                {b.inGameDate ? `${b.inGameDate} — ` : ""}
                {b.text}
              </li>
            ))}
          </ol>
        </Section>
      )}

      {missionBoard.windows.some((w) => w.kind === "note" && w.noteText) && (
        <Section title="Notes">
          {missionBoard.windows
            .filter((w) => w.kind === "note" && w.noteText)
            .map((w) => (
              <div key={w.id} style={{ whiteSpace: "pre-wrap", marginBottom: 4 }}>
                {w.noteText}
              </div>
            ))}
        </Section>
      )}

      {campaignBible && (
        <Section title="Intel — eyes only">
          <div>
            <b>Antagonist:</b> {campaignBible.antagonist}
          </div>
          {campaignBible.plantedTwists.map((t, i) => (
            <div key={i}>{t.delivered ? `✓ ${t.twist}` : "█████ ████████ █████ ██████"}</div>
          ))}
        </Section>
      )}
    </div>
  );
}
