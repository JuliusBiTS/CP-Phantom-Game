# CP Phantom Solo — Feature Plan (post-launch)

**Status:** approved by the user, not started. Companion to `SOLO_MODE_BUILD_PLAN.md` (which
covers the tool as it stands: turn loop + real dice, fact-compression, NPC generation, full
character sheet + catalogs, life-path creator, campaign bible, GM push-back, structured combat,
dice pad / quick actions / dictation, Mission Board). 96 tests, deployed on Vercel + Firebase.

This document is a handoff. A fresh session should be able to execute any milestone from this
doc plus the referenced source. Read §1 (architecture themes) before picking up any milestone —
several features share infrastructure and the order matters.

Rulebook: `CP_Regelwerk_v12_Cover_und_Distanzen.docx` in the repo root (German; extract with a
Node script over `word/document.xml` — no pandoc on the build machine). CP Phantom's
`../CP Phantom APP/index.html` has the generators/catalogs to port (vehicles, drones, ICE,
security). Port the code, don't re-derive from prose — see `SOLO_MODE_BUILD_PLAN.md` §3.1.

---

## 1. Architecture themes (build these first, they unlock the rest)

### 1.1 Sub-mode framework
Today the turn loop has two modes: exploration and `combat.active`. **Netrunning, vehicle
chases, downtime, and the apartment all need "we're in a different mode now" — different action
chips, a different UI panel, a different slice of system prompt.** Generalise:

- `state.mode: "exploration" | "combat" | "netrun" | "chase" | "downtime"` (combat stays driven
  by `combat.active`; the others are explicit).
- `src/lib/llm/modes/` — one file per mode exporting `{ promptFragment, contextSlice(state), tools? }`.
  `SYSTEM_PROMPT` composes the base + the active mode's fragment. `buildStateContext` appends the
  mode's slice.
- Frontend: `QuickActions` already branches on combat; extend to a `mode`-keyed chip set.
  `page.tsx` renders the mode's panel (netrun view / chase view / downtime view) where the
  combat tracker goes.
- Entering/leaving a mode is a `delta.mode` field (`{ enter: "netrun", ... }` / `{ exit: true }`),
  applied in `applyDelta`.

**Do this as part of M3 (Downtime is the simplest sub-mode — use it to shake out the pattern).**

### 1.2 Streaming turn endpoint
`/api/turn` is request/response today. Convert to SSE so narration streams as the model writes
it (M2), and so conversational mode (M9) can pipe partials to TTS.

- New `/api/turn/stream` (keep the old route until the client is switched). Uses
  `client.messages.stream()` inside `drive()`. Emit events: `text-delta`, `roll` (engine roll
  resolved), `awaiting-player-roll`, `turn-complete` (final state + delta).
- `turn.ts` `drive()` takes an optional `onEvent` callback; the route wires it to the SSE writer.
- `page.tsx` `sendTurn` reads the stream, appends deltas to a live narration buffer, swaps to the
  final state on `turn-complete`.
- The two-phase suspend (PC roll) still works: the stream ends with `awaiting-player-roll`, the
  resume is a second stream call.

### 1.3 State snapshot ring (Undo)
`state.history: Array<{ label: string; ts: number; snapshot: CampaignState-without-history }>`,
capped at ~15. Push a snapshot at the **start** of every `runTurn` and every manual `patch*`
in `page.tsx`. `undo()` pops and restores. Standalone, cheap — **M1**.

### 1.4 Usage accounting
Every `anthropic.messages.create/stream` in `turn.ts` / `bible.ts` / `compress.ts` returns
`response.usage`. Accumulate into `state.meta.usage: { inputTokens, outputTokens, cacheReadTokens,
turns }`. A tiny `estimateCost(usage, model)` helper (rates from the `claude-api` skill). Surface
in the HUD. **M1.**

---

## 2. Milestones

Effort key: **S** ≈ half a day, **M** ≈ 1–2 days, **L** ≈ 3–5 days. Independent milestones are
marked; otherwise assume sequential within a milestone.

---

## M1 — Trust & legibility  ·  independent  ·  S×4

The safety net. Do first — it makes everything after this easier to iterate on.

### Undo / rewind  ·  S
**What.** "Rewind last turn" when the GM misreads something.
**Data.** `state.history` ring (see §1.3). Exclude `history` and `transcript` from the snapshot
to keep size sane; on undo, keep the current `transcript` truncated to match.
**UI.** A `↶ Rewind` button in the HUD (disabled when history empty), tooltip shows the label
("undo: shot the ganger"). Hotkey `Ctrl+Z` guarded to not fire in inputs.
**Risks.** `transcript` / `pendingTurnMessages` desync — snapshot must capture the pending-roll
state too, so an undo mid-suspend is coherent.

### Proper transcript view  ·  S
**What.** Scroll back through all narration + rolls, not just the latest.
**Data.** none — `sessionLog` already holds it.
**UI.** A `TranscriptView` panel (button + hotkey `T`), full-screen like the board. Renders
`sessionLog` newest-or-oldest-first (toggle), grouping a turn's `action` → `roll`s → `narration`.
Search box. "Jump to" the compression boundary markers.

### Session cost meter  ·  S  ·  depends: §1.4
**UI.** In the HUD, a small `≈ $0.14 · 23 turns` readout; click to expand token breakdown +
cache-hit rate. Note it's an estimate.

### GM-suggested actions  ·  S
**What.** 2–3 "you could…" options offered each turn (plan §5.2 step 1).
**Delta / tools.** `commit_turn` delta gains `suggestedActions: string[]` (0–3, short, concrete,
present-tense — "press Rook about the Militech job", "case the loading dock", "call your ripper").
**Prompt.** "End each `commit_turn` with 2–3 `suggestedActions` — real options the fiction offers
right now, not a menu of verbs. Omit in the middle of a fixed sequence."
**UI.** Render them as chips above the action box (alongside `QuickActions`); tap to pre-fill.

> **Built 2026-09-01** (114 tests, tsc/lint/build clean, browser-verified). Foundations:
> `lib/state/history.ts` (snapshot ring, cap 10, `state.history`), `lib/llm/cost.ts` (`addUsage`
> folds `response.usage` → `meta.usage`; `estimateCostUsd`). Schema: `meta.model`, `meta.usage`,
> `state.suggestedActions`, `state.history`. `runTurn` snapshots before each action turn + counts
> the turn; `drive` accumulates usage per model call. `delta.suggestedActions` (max 4, replaces
> each turn). UI: header `↶ Rewind (n)` + `Ctrl/Cmd+Z`, `Transcript (T)` overlay
> (`components/TranscriptView.tsx` — story/rolls/all filter, order toggle, search), `CostMeter`
> popover, suggested-action chip row above `QuickActions`. `localStore.save` sheds `history` on a
> quota error. Compression-pass tokens not yet counted (minor). Streaming (M2) still to do.

---

## M2 — Session feel  ·  S + M

### Streaming narration  ·  M  ·  depends: §1.2
See §1.2. The visible win: text appears as it's written instead of a 10–30s blank wait.
**Risks.** Vercel SSE on the Hobby tier — fine, but set `maxDuration` and flush frequently.
Keep the non-stream route as a fallback the client uses on stream error.

### "Previously on…"  ·  S
**What.** Auto cold-open when you load a campaign that has history.
**How.** On `store.load`, if `sessionLog` has narration and `meta.lastPlayedAt` is > ~1h ago,
call a new `/api/recap` (cheap, `max_tokens` ~500) with the compressed facts + last 2 narration
entries + active quests → a 3–5 sentence "Last time…" in the GM's voice. Show it in a styled
card above the narration, dismissable. Cache it on `state.meta.recap` so a reload doesn't re-bill.
**Rules.** none.

### Tone dials  ·  S
**What.** Set the campaign's register at creation; the GM respects it.
**Data.** `meta.tone: { grit: 1-5, lethality: 1-5, romance: "off"|"light"|"full", gore: 1-5,
humour: 1-5, hopePunk: 1-5 }` (or similar — keep to ~5 sliders).
**Prompt.** A `toneFragment(meta.tone)` prepended to `SYSTEM_PROMPT` — "Lethality 4/5: a bad roll
in a firefight should genuinely threaten death; don't pull punches." etc. Also nudges the dice
adjudication ("lethality high → crit-fails in combat cost blood").
**UI.** Sliders in `NewCampaignForm`; editable later from a small `meta` panel.

> **Built 2026-09-01** (125 tests, browser-verified).
> - **Streaming:** `drive()` uses `anthropic.messages.stream()` + `.finalMessage()`, emits
>   `TurnEvent` (`text` deltas, resolved `roll`s) through an optional sink. `POST /api/turn/stream`
>   wraps `runTurn` in an SSE `ReadableStream`; JSON for validation errors. `lib/llm/streamClient.ts`
>   reassembles frames across chunks; `page.tsx` shows narration live (blinking `.stream-caret`),
>   streams the roll feed, falls back to `POST /api/turn` on `StreamUnavailable`.
> - **Recap:** `POST /api/recap` (slim bible-free ctx, 400-token cap). Client caches on
>   `meta.recap`/`meta.recapForTs`, regenerates only when returning after a >30 min break with
>   newer narration. Dismissable card. Compression-pass tokens still not metered.
> - **Tone:** `meta.tone` — 5 dials 0–3 (`grit`/`lethality`/`gore`/`romance`/`wit`), `lib/llm/tone.ts`
>   maps each level to prose+adjudication guidance, `buildSystemPrompt(state)` appends it to the
>   cached prefix. `ToneEditor` in the new-campaign form + a header popover (applies next turn).

---

## M3 — Sub-mode framework + Downtime  ·  M  ·  builds §1.1

### Sub-mode framework  ·  M
See §1.1. Ship it with Downtime as the first consumer.

### Downtime mode  ·  M
**What.** A lighter loop for the stretch between gigs: shop, heal, train, hit up contacts, lie
low. Not turn-by-turn combat pacing — the GM narrates in bigger beats and time passes.
**Data.** `state.mode = "downtime"`, `state.downtime: { daysElapsed: number }`.
**Delta / tools.** `delta.mode = { enter: "downtime" } | { exit: true }`; `delta.advanceDays: N`
(feeds M4 upkeep + M5 rumor mill + wound recovery).
**Prompt (downtime fragment).** "Time moves in days, not rounds. Offer errands (buy gear from a
fixer/ripperdoc/black market, get patched up, train a skill toward a talent, chase a lead,
maintain a relationship). Resolve most with a single roll or none. Surface prices from the
catalog cost tiers. When the player starts a new gig or a fight breaks out, exit downtime."
**UI.** A `DowntimePanel` replacing the combat tracker: a day counter, a row of errand chips
(Shop / Ripperdoc / Train / Contact / Lie low / Take a gig), the eddies balance prominent.
**Rules.** §23.2 price categories, §6.6a-c consumables, §11.1 talent training, §20 medicine.

> **Built 2026-09-01** (125 tests, browser-verified). `state.mode`
> (`exploration`|`downtime`|`netrun`|`chase`) + `state.downtime.daysElapsed` (lifetime).
> `lib/llm/modes/` — `ModeDef {promptFragment, contextSlice?}` per mode, `index.ts` composes;
> netrun/chase are exit-me stubs. `buildSystemPrompt` + `buildStateContext` fold in the active
> mode. `delta.mode {enter?,exit?}` + `delta.advanceDays` (accrues + logs). `buildStateContext`
> renamed the campaign-type field to `meta.campaignType` to free up `mode`.
> UI: `DowntimePanel` (days/eddies/date + "Back to work"), gold `DOWNTIME` header badge + a
> `COMBAT` badge, `QuickActions` downtime chip set, mode-aware "what do you do?" heading.
> Downtime treatment flows (heal on rest, buy/install, upkeep) land with **M4**.

---

> **Cost pass done 2026-09-01** (before M4). Per-turn input was ~32k tokens, barely
> cached. Fixes: `stripStaleContext` drops the state-context blob from stored transcript
> messages after each turn (was growing O(n²)); `cache_control` breakpoints on the tool
> block + transcript prefix; campaign bible moved into the cached system prompt;
> fact-compression + recap + world-tick run on `claude-haiku-4-5` (`SOLO_COMPRESS_MODEL` /
> `SOLO_RECAP_MODEL` / `SOLO_WORLDTICK_MODEL`). The cost meter still doesn't count
> background (Haiku) calls — minor undercount that roughly offsets.

---

## M4 — Aftermath systems  ·  L  ·  depends: M3 (shares the Downtime surface)

All four plug into normal play (the GM applies them via delta) AND Downtime (where you treat
them). Build the data + delta + sheet display first, then the Downtime treatment flow.

### Critical injuries  ·  M
**What.** §13's 2d6 head/body tables, automated.
**Data.** `character.criticalInjuries: Array<{ id, table: "head"|"body", roll: number, name,
effect, treated: boolean, deathSavePenalty?: number }>`. Extract both tables from the rulebook
(§13.2 body 2d6, §13.3 head 2d6) into `src/lib/rules/criticalInjuries.ts`.
**Delta / tools.** trigger is §13.1 (crit-fail defence while Seriously Wounded+, or a called
head/leg shot that connects). New `roll_dice` `purpose: "critical-injury-<table>"` → backend
rolls 2d6, looks up the row, returns it; model narrates. `delta.pcCriticalInjury: { table, roll }`
or `{ removeId }` (on treatment).
**Prompt.** the §13.1 trigger conditions; "the backend rolls the table, you narrate the wound."
**UI.** A red section on the character sheet + a `⚠` badge on the HUD; each injury shows its
mechanical effect and whether it needs a Chirurg (surgeon) vs First Aid to clear.
**Rules.** §13 (all), §14.1 (Todgeweiht gets extra injuries), §14.2 stabilisation.

### Wound recovery / persistent injury  ·  S  ·  depends: Critical injuries, M3 advanceDays
**What.** Natural healing between scenes; injuries that don't just vanish.
**How.** In `applyDelta` on `advanceDays`: apply §14.4 (Full Rest 8h → all HP; Short Rest 1h →
half). Critical injuries **don't** heal on rest — they need treatment (Downtime: ripperdoc /
hospital / Feldmedizin talent). Hospital costs come from §20.2.
**Data.** none beyond the injury list; a `character.lastRestAt` for the GM's reference.

### Cyberware install flow  ·  M  ·  depends: M3
**What.** Installing chrome costs Humanity, needs a ripperdoc + a roll, and can tip you toward
cyberpsychosis — not just "add to the sheet".
**Data.** already have `cyberware[]` + `cyberwareImpact()`. Add `character.humanityDebt` tracking
recent losses, and `character.cyberpsychosisRisk` (derived: Humanity band per §21.4).
**Delta / tools.** a Downtime errand → `request_player_roll` (install roll) → on success
`delta.installCyberware: { name }` which in `applyDelta` appends to `cyberware`, subtracts the
Humanity impact from `humanity_current`, and if that crosses a §21.4 threshold, flags it.
**Prompt.** §21.3 impact, §21.4 bands, §21.6 Humanity checks under stress, §21.7 trauma.
**UI.** The Loadout tab's cyberware picker gains an "install (downtime)" path vs the current
free add (keep free-add behind an "edit mode" for imported characters). A Humanity meter with
band label (Stable / Detached / Cold / On the Edge) on the sheet + HUD.
**Rules.** §9, §21 (all).

### Economy / lifestyle  ·  M  ·  depends: M3 advanceDays
**What.** Rent, upkeep, the fixer's cut — so eddies mean something.
**Data.** `character.lifestyle: { tier: "street"|"cheap"|"decent"|"corpo", rentPerMonth,
paidThroughDay: number }`, `character.debts: Array<{ to, amount, note, dueDay? }>`.
**Delta / tools.** `delta.economy: { eddieChange, addDebt, clearDebtId, setLifestyle }`. On
`advanceDays` crossing a rent boundary in `applyDelta`: auto-deduct rent, or flag "you're behind
on rent" if broke. Gig payouts and the fixer's cut come through `eddieChange` at mission-end.
**Prompt.** "Gigs pay in eddies; the fixer takes 10–20%. Rent comes due monthly. Broke +
overdue = a consequence (M5)."
**UI.** Eddies + lifestyle tier on the HUD; a Finances section on the sheet (debts, rent
countdown). Debts also surface on the Mission Board as `?`-leads / consequences (M5).
**Rules.** §23.2, §23.3.

> **Built 2026-09-01.** `lib/rules/criticalInjuries.ts` (both §13 2d6 tables + "next row
> down" + surgery cost); `roll_critical_injury` tool (CSPRNG 2d6, records on target,
> returns row + the +5 HP for the model). `character.criticalInjuries` / `deathSavePenalty`;
> `delta.pcCriticalInjury {treatId,to}`. Wound recovery: `advanceDays` in downtime = full
> rest (HP/stamina restored, injuries persist). `delta.installCyberware {name,humanityLoss}`
> (appends chrome, drops Humanity) + `humanityBand()` (§21.4). Economy: `character.lifestyle`
> + `debts`; `delta.economy {eddieChange,setLifestyle,addDebt,clearDebtId}`; rent auto-deducts
> every 30 in-game days. UI: VitalsHud Humanity band + injury line; CharacterSheet lists
> injuries + debts.

---

## M5 — World in motion  ·  M  ·  extends Mission Board

### Consequences ledger  ·  S
**What.** A distinct list of loaded guns, separate from ambient facts.
**Data.** `state.consequences: Array<{ id, text, severity: "minor"|"major"|"grave",
kind: "enemy"|"debt"|"witness"|"reputation"|"other", refNpcId?, refFactionId?, armed: boolean,
resolvedNote?: string }>`.
**Delta / tools.** `delta.consequences: { add: [...], resolveId, escalateId }`. The GM adds one
whenever the PC does something that will come back (kill, betrayal, seen, big debt).
**Prompt.** "When the PC does something that should have a later cost — killed someone with
friends, was recognised, took on a serious debt, burned a bridge — record it in
`delta.consequences.add`. Reference these; bring them back at dramatic moments; resolve or
escalate them explicitly."
**UI.** A dedicated `CONSEQUENCES` window on the Mission Board (always present once non-empty),
red-framed, severity-sorted; also a compact count on the HUD. Links to the NPC/faction dossier.

### Rumor mill / world clock  ·  M  ·  depends: M3 advanceDays, campaign bible
**What.** Factions and the plot move while you're not looking.
**Data.** `state.worldClock: { day: number, pendingMoves: Array<{ atDay, factionOrNpc, move,
visibleAs?: string }> }`.
**How.** On mission-end and on `advanceDays`, a cheap `/api/world-tick` call: given the bible's
current act + acted-on consequences + faction standings, the GM decides 1–2 off-screen moves
("Militech tightens Watson checkpoints", "the fixer's rival makes a play"). Some are seeded as
future `pendingMoves`; some fire now as new facts / Mission Board updates / a `?`-lead.
**Prompt (world-tick).** "You are advancing the world between the player's scenes. Move the
antagonist and factions toward the bible. Prefer changes the player will *notice* next session.
Return structured moves; don't narrate."
**UI.** On resume, if the world moved, fold it into "Previously on…" ("While you were dark:
…"). New board windows glow NEW.
**Risks.** cost — keep it to one small call per session boundary, not per turn.

### Timeline window  ·  S  ·  Mission Board
**What.** Campaign events in chronological order.
**Data.** `sessionLog` entries of `type: "narration"|"system"` + a `beatSummary` the GM can
attach in `commit_turn` (`delta.timelineBeat?: string` — one line, "Met Rook. Took the Diaz gig.").
**UI.** A `TIMELINE` board window: a vertical line, entries as nodes, in-game date if known,
click a node → jump the transcript view there.

### Relationship graph + draw-your-own links  ·  M  ·  Mission Board
**What.** Tier 2 of the board.
**How.** Board windows already have `links`. Add a "link mode" toggle: click a window's edge
handle, drag to another window → creates a `BoardLink` with an editable label. Delete via the
link's midpoint dot. Plus a `GRAPH` window: a force-directed layout (hand-rolled or a tiny
lib — `d3-force` is ~small, or a simple spring sim) of all NPCs/factions/locations and their
links, campaign-wide, separate from the board's spatial layout.

### Portrait upload + generation  ·  M  ·  Mission Board + sheet
**What.** A face on every dossier.
**Upload.** `character` and `world.npcs[].portrait: string` (data URL). An "upload portrait"
button on the dossier window and the sheet; resize/crop client-side to ~256px, store as data
URL (localStorage) or Firebase Storage under `soloCampaigns/portraits/{campaignId}/{who}`
(keep the isolation rule — never CP Phantom's `portraits/` node).
**Generation (optional).** The NPC generator already emits `imagePrompt`. A "generate portrait"
button → a free image endpoint. Options: Pollinations.ai (`https://image.pollinations.ai/prompt/<enc>`,
no key, free) as the default; or the user's own key for a better model via a new
`/api/portrait` proxy. Cache the result as the data URL.
**UI.** Portrait shows on the dossier window header, the combat tracker card, and the sheet.

### Export board as a case file  ·  S  ·  Mission Board
**What.** A printable / PDF "case file" of the current board.
**How.** A print-only stylesheet + a `Print / Save PDF` button that opens a clean layout: title
page (mission + date), one section per window (dossiers, objectives, locations, factions,
notes, connections list, timeline), redactions kept as █████. `window.print()` → the user's
browser handles PDF. No server, no deps.

> **Built 2026-09-01.** `state.consequences[]` + `delta.consequences {add,resolveId,
> escalateId}` (armed ones ride in the per-turn context); `state.timeline[]` +
> `delta.timelineBeat`, surfaced as a transcript-view filter. MissionBoard: 🔗 Link mode
> (click two windows), deletable/labelled links, `connections` window is now a circular
> relationship graph. `character.portrait` / `WorldNpc.portrait` (data URLs, `lib/util/image.ts`
> downscales to 256px); `PortraitUpload` on VitalsHud + dossier windows. `CaseFile` +
> `@media print` + "Case file" button (redactions preserved). `POST /api/world-tick` (Haiku):
> "⟳ Let the city move" in DowntimePanel (campaign mode) → GM advances the world → delta +
> "while you were dark" recap card.

---

## M6 — Combat depth  ·  M  ·  extends structured combat

### Zone map (theater-of-mind positioning)  ·  M
**What.** A lightweight spatial layer — not a grid, a zone diagram.
**Data.** `combat.zones: Array<{ id, name, note?, coverMaterial?, x, y }>` and each combatant
gets `zoneId` + inter-zone distances (`combat.zoneDistances: Record<"a|b", number>` in metres,
or derive from zone x/y × a scale). Replaces the flat `rangeFromPcM` with "PC is in zone X;
target in zone Y; distance = zoneDistances".
**Delta / tools.** `start_combat` gains an optional `zones` + per-combatant `zoneId`; the GM
sets the scene ("the bar (you), the door 12m, the mezzanine 6m up"). `delta.combat.move:
{ combatantId, toZoneId }` each turn.
**Prompt.** "Frame the space as 2–5 named zones with distances. Put each combatant in a zone.
Movement changes zones; the backend recomputes range for the §7.7 PW-halving."
**UI.** A small top-down `ZoneMap` in the combat panel: zones as boxes, tokens as dots
(cyan = PC, red = hostile, green = ally), lines showing lines-of-fire, cover icons. Click a
zone to target everything in it / to declare a move.
**Rules.** §6.4a ranges, §7.7 distance, §18 cover, §3.4 movement.

### Enemy intent  ·  S  ·  depends: structured combat
**What.** The GM commits each enemy's plan at the top of the round.
**Data.** `combat.order[].intent?: string` ("lining up a sniper shot at you next turn",
"flanking left toward the mezzanine").
**Prompt.** "At the start of each round, before anyone acts, set `combat.order[].intent` for
each hostile — a short, readable tell. Then resolve turns; an enemy may deviate if the situation
changes, but say so."
**UI.** Intent shows on the combat tracker card, amber, above the weapon line. Feeds the
`Dodge` / `Take cover` quick actions ("Rook is lining up — dive for cover").

### Cover HP  ·  S  ·  depends: §18 data
**What.** Shot-up cover degrades and breaks.
**Data.** `combat.order[].coverHp` already exists (nullable). Populate from §18.2 material table
(`src/lib/rules/cover.ts` — steel 50/25, concrete 25/10, wood 20/5, etc.). 
**Delta / tools.** `delta.combat.coverDamage: [{ combatantId, amount }]`; at 0 → cover gone,
`cover: "none"`, excess damage lost (except explosives).
**UI.** A small HP pip on the "behind cover" control when cover has HP.

### Companions / allies in initiative  ·  S
**What.** Allies and the GREMLIN drone roll initiative too.
**How.** `start_combat` combatants can be `role: "ally"`; they get engine initiative and a slot
in `combat.order`. Their turns: the GM resolves them via `roll_dice` (they're not the PC). A
companion "acts right after its owner" convention (CP Phantom's rule) — optional flag
`actsWith: <ownerId>`.

### Flink / overwatch / snap shots (interrupt economy)  ·  M
**What.** §4 Flink (a declared reaction that resolves before the triggering action),
§7.5 Feuerbereitschaft (overwatch), Snap Shot / Killzone talents.
**Data.** `character.flinkUsed: boolean` (per fight), `combat.overwatch: Array<{ combatantId,
trigger: string, weapon }>`.
**Delta / tools.** When the PC declares Flink/overwatch, `request_player_roll` fires out of turn
order with a note. `delta.combat.overwatch` sets/clears watches; the GM checks them before each
triggering action.
**Prompt.** the §4 timing rules; "an armed overwatch fires one reaction shot before its trigger
resolves."
**UI.** A "⚡ Flink" / "Overwatch" button in the combat quick actions when available (Flink
greyed once used); armed watches show on the tracker.
**Rules.** §4 (all), §7.4–7.6, the Tactician/Sniper talent trees in the catalog.

> **Built 2026-09-01.** `CombatCombatant` gains `role` / `zoneId` / `intent`; `Combat` gains
> `zones` / `overwatch` / `flinkUsed`. `start_combat` takes `combatants[].role`, `zones`,
> `pcZoneId`, per-combatant `coverMaterial`. `delta.combat` gains `intents` / `zones` / `moves`
> / `setCover` / `coverDamage` / `overwatch{set,clearIds}` / `flinkUsed`; `end` clears the lot.
> `lib/rules/cover.ts` (§18.2 material table). CombatTracker: zone mini-grid with role-coloured
> dots, amber intent line, cover-HP pip, green allies, overwatch/flink status. `QuickActions`
> gains ⚡ Flink / Overwatch / Shoot the cover. Zone→range still flows through `rangeFromPcM`
> (the GM keeps it in sync) — no auto distance calc yet.

---

## M7 — Netrunning  ·  L  ·  depends: M1.1 sub-mode framework

The biggest missing subsystem. Netrunners are ~1/7 of the archetypes and the NET is a real
place in §10, not a die roll.

> **Built 2026-09-01.** v12's §10 is combat-hacking (firewall + IP + trace + duels), not a
> floor-crawl — so this is a hybrid: hacks work anywhere (prompt section + a "Known hacks"
> context block: name/category/IP/PW), and a deliberate dive is a light sub-mode.
> `lib/rules/net.ts` (ICE_CATALOG ×6, CYBERDECK_INFO, ALARM_LEVELS, firewall bands, TRACE_CAP).
> `state.netrun` (architecture floors, deck, connection, trace 0–100, alarm 0–3, position,
> daemons; IP stays on the sheet). `enter_netrun` tool: GM gives floor concept + ICE names,
> backend fills ICE stats + switches mode. `delta.netrun {move,clearFloor,ipChange,traceChange,
> alarmChange,addDaemon,loot,exit}` — moving a floor auto-regens deck IP; trace 100 → grave
> consequence + forced disconnect. `NetrunView` (floor stack, IP bar, trace gauge, alarm),
> netrun QuickActions chips. **No rigid ICE-combat engine** — the GM narrates ICE attacks via
> `roll_dice`.

**Data.**
```
state.netrun: {
  active: boolean,
  deckPw: number, firewall: number,          // from the PC's cyberdeck / sheet
  ip: { current, max },
  architecture: Array<{                        // the target system, top-down
    floor: number, name: string, kind: "passthrough"|"file"|"control"|"ice"|"blackwall",
    ice?: { name, dv, hp, effect },            // from ICE_DAEMON_CATALOG (port from index.html ~L9309)
    loot?: string, controls?: string[],
    cleared: boolean,
  }>,
  position: number,                            // current floor
  trace: number,                               // NetWatch trace %, rises each turn / on noise
  daemonsUploaded: string[],
}
```

**Rules & ports.** §10 (all — IP, Firewall, deck quality, Combat/Control/Utility/Environment
hacks, the netrunner duel, environment hacks), §25.5 (ICE & Daemons). Port `HACK_CATALOG` (done),
`ICE_DAEMON_CATALOG`, `NETRUNNER_*` tier tables and `rollNetrunnerHacks` from `index.html`.

**Delta / tools.**
- `enter_netrun` tool: the GM generates the architecture (concept → the backend builds floors +
  ICE from tier, like `generate_npc`), sets deck PW / firewall / IP from the PC sheet.
- In netrun mode `request_player_roll` is Int+Focus / Int+Creativity per §1.4; `roll_dice` for
  ICE attacking back.
- `delta.netrun: { move: floor, clearFloor: n, ipChange, traceChange, addDaemon, loot: [...],
  exit: true }`. IP regen (Jack In talent) ticks per netrun-turn in `applyDelta`, like the combat
  round tick.
- Trace at 100 → NetWatch responds (a consequence + forced disconnect + possible Black ICE).

**Prompt (netrun fragment).** the §10 loop: "You're in the NET. Each turn = one action (move a
floor, run a hack, fight ICE, grab a file). IP is your action economy — track it. Firewall is
the wall between floors. ICE bites back — `roll_dice` for it. Trace rises; at 100 NetWatch comes.
Black ICE and the Blackwall can flatline the runner for real. Exit voluntarily or on a bad trace."

**UI.** A `NetrunView` replacing the combat panel: the architecture as a vertical stack of floors
(current floor lit, cleared floors dimmed, ICE floors red), an IP bar, a trace gauge (fills
red), the runner's position, hack chips (from the PC's known hacks, greyed if IP too low —
uses `effectiveHackIp`). Data-flow line animation between floors. Very "diving" — cyan wireframe,
the Mission Board's `.reticle` on the active floor.

**Companion tie-in.** A netrunner ally / the PC's own deck can run while the meat-body is in
combat — the two modes coexist (combat + netrun both active); the UI shows both panels.

---

## M8 — Vehicles & chases  ·  M  ·  depends: M1.1

**Data.**
```
state.chase: {
  active: boolean,
  vehicles: Array<{ id, name, template, sdp, sp, speed, seats, driverId, weapons: [...],
                    occupants: [...], damage: number }>,
  gap: number,                                 // abstract "spur" distance, §22.5
  terrain: "highway"|"backstreets"|"badlands"|"combat-zone",
  round: number,
}
```

**Rules & ports.** §22 (all — vehicle stats, body SP, ramming, set-piece vehicle combat,
abstract chase), §22a (military vehicles/mechs). Port `VEHICLE_TEMPLATES`, `VEHICLE_WEAPON_TABLE`,
`processGeneratedVehicle`, `DRONE_TEMPLATES`, `processGeneratedDrone` from `index.html`.

**Delta / tools.**
- `generate_vehicle` tool (concept → named template stats, like `generate_npc`).
- `enter_chase` tool: sets up the vehicles + starting gap + terrain.
- Chase turns: `request_player_roll` for Drive-based manoeuvres (Drive+Reflexes), `roll_dice` for
  pursuers. `delta.chase: { gapChange, vehicleDamage: [...], occupantChange, terrainChange,
  outcome: "escaped"|"caught"|"crashed", exit: true }`.
- Vehicle weapons fire on the *operator's* stats (CP Phantom convention) — reuse `computeWeaponPw`
  with the operator's sheet.

**UI.** A `ChaseView`: two lanes of vehicle tokens with the gap between them as a widening/
narrowing bar, terrain banner, each vehicle's SDP/SP as pips, manoeuvre chips (Push it / Ram /
Hard turn / Shake them / Trade paint / Bail). Speed-line motion.

> **Built 2026-09-01.** Implemented v12's §22.5 abstract chase (the "Spur" 0–6, not a gap bar).
> `lib/rules/vehicles.ts` (VEHICLE_TEMPLATES ×11 from §22.1, BODY_SP classes, chaseDv,
> collisionDamageDice). `state.chase` (spur, round, terrain, pcRole runner|pursuer, pursuerTier,
> vehicles[] with SDP/body-SP/speed/occupants). `generate_vehicle` (stat block, cached on
> world.npcs like an NPC) + `enter_chase` tools. `delta.chase {spurChange,round,terrainChange,
> vehicleDamage,outcome,exit}` — spur clamps 0–6 and logs the endpoints, 0 SDP disables a
> vehicle + notes collision damage. `ChaseView` (spur track, per-vehicle SDP bars), chase
> QuickActions chips. A stationary vehicle shoot-out is just `start_combat` with the vehicles.

---

> **Built 2026-09-01 — V1.** All four:
> - **Conversational mode:** `lib/tts/useSpeaker.ts` (speechSynthesis, sentence-queued so
>   streaming narration speaks as it arrives), `ConversationHud` ("🎙 Hands-free" toggle) —
>   GM reads aloud, mic opens (Web Speech), spoken action → turn, spoken roll parsed +
>   submitted. Firefox: TTS out + tap-to-talk.
> - **The apartment:** `state.apartment` (owned/tier/upgrades/stash/safehouse/visitors),
>   `delta.apartment`, `ApartmentView` (hotkey `H`), prompt section.
> - **Campaign generator:** `generateCampaignPlan()` + `POST /api/generate-campaign` (bible +
>   1–3 gigs/act), `state.campaignPlan`, "generate full campaign" form checkbox,
>   `delta.campaignPlan`, redacted plan in the bible board window.
> - **Party mode:** `state.party.bench` (non-active PCs; `state.character` stays the active
>   one so nothing else changes), `PartyRail` swap. Full in-combat party integration deferred.
>
> **V1 polish pass:** removed the Mission Board `.board-scan` sweep (animated background-position
> — the perf drain) + link marching-ants/drop-shadow; board drag now moves via `transform`;
> undo snapshots drop `transcript`; `combatantView` handles vehicles. Also fixed the batched-
> tool-call 400 (see M7 note). **179→181 tests, browser-verified end to end.**

## M9 — Signature builds  ·  L each  ·  mostly independent

### Fully conversational mode  ·  M  ·  depends: M2 streaming
**What.** GM narration read aloud + your voice in = hands-free play.
**How.** TTS out: free options — the browser `speechSynthesis` API (zero cost, decent, works in
Firefox), or a `/api/tts` proxy to a paid voice if the user wants quality. As narration streams
(M2), feed completed sentences to `speechSynthesis.speak()`. Input: auto-arm dictation after the
GM finishes speaking; a VAD (voice-activity) or a simple "tap once to start, silence ends it".
A "Conversation mode" toggle that: hides the text-heavy UI, shows a big listening/speaking
indicator, auto-submits dictated actions after a 2s confirm window, auto-reads replies.
**Risks.** the PC physical-roll pause breaks the flow — in conversation mode, prompt for the
roll aloud and accept a spoken result ("I got a fourteen and a seven").

### The apartment / home base  ·  M
**What.** A persistent place: your stash, where you heal, where contacts come to you.
**Data.** `state.apartment: { tier, district, upgrades: string[], stash: Inventory[],
safehouse: boolean, visitors: Array<{ npcId, reason }> }`. Ties to M4 lifestyle (rent), M3
downtime (this is where downtime happens), M5 (a contact drops by with a lead).
**UI.** An `ApartmentView` (hotkey `H`): a stylised floor-plan or a set of "stations" (workbench
= crafting, medbay = healing, terminal = jack in / research, safe = stash, door = who's here),
each a panel. Upgrades bought in downtime unlock stations.
**Rules.** §6.8 fabricator (workbench), §20 (medbay), lifestyle §23.

### Campaign generator  ·  M  ·  depends: campaign bible
**What.** "Make me a 5-act campaign about a stolen military AI" → a playable structure.
**How.** Extends `generateCampaignBible`. A `/api/generate-campaign` (bigger `max_tokens`,
`effort: "high"`) that produces: the bible (have) + **per-act: 1–3 gigs** each with a hook,
the fixer/contact, the opposition (as `generate_npc` concepts), the location, the twist it
advances, and the payout. Stored as `state.campaignPlan: { acts: [{ gigs: [...] }] }`; gigs
become `questLog` entries as they're offered. The GM pulls the next gig from the plan when the
player's ready, adapting to what's happened.
**Prompt.** "You have a campaign plan. Offer gigs from the current act in an order that fits the
fiction. Adapt hooks to the player's history and consequences. When an act's turning point
lands, advance. Don't railroad — the plan is a spine, not a script."
**UI.** A `CampaignPlan` view (GM-only, redacted like the bible): acts as columns, gigs as
cards, current position marked; gigs un-redact as they're played.

### Party mode  ·  L  ·  architecturally invasive — do last / when committed
**What.** More than one PC — your real group, solo-GM'd, or you running two.
**Data model change.** `state.character` → `state.party: { characters: Record<id, CharacterSheet>,
activePcId: string }`. `combat.order` PC entries become per-character. `pcPwReference`, the HUD,
the sheet, the dice pad, push-back all become per-active-PC. `request_player_roll` names which
PC rolls.
**Effort.** L — touches nearly every file. Worth a dedicated branch. The `activePcId` indirection
keeps most call sites unchanged if done carefully (a `currentCharacter(state)` accessor).
**UI.** A party rail (portraits + HP bars) to switch the active PC; the GM addresses PCs by name;
in combat, the order interleaves all PCs and NPCs.

---

## 3. Suggested order

```
M1  Trust & legibility        (independent, unblocks iteration)      ~2 days
M2  Session feel              (streaming is a prereq for M9 convo)   ~2 days
M3  Sub-mode framework + Downtime                                    ~2 days
M4  Aftermath systems         (needs M3)                             ~4 days
M5  World in motion           (needs M3 for advanceDays)             ~3 days
M6  Combat depth              (independent of M3–M5)                 ~3 days
M7  Netrunning                (needs M1.1)                           ~5 days
M8  Vehicles & chases         (needs M1.1)                           ~3 days
M9  Signature builds          (convo needs M2; others independent)   L each
```

M6 can be pulled forward if combat is where the playtest hurts most. M7 (Netrunning) is the
single highest-value rules addition — consider it right after M3 if the player runs a netrunner.

## 4. Testing

Each milestone keeps the bar: `tsc` / `build` / `lint` clean, vitest green, browser-verified.
New pure logic (injury tables, cover HP, IP economy, chase gap, world-tick move resolution,
economy upkeep, recap prompt shaping) gets unit tests. The sub-mode framework gets a test that
each mode's `promptFragment` + `contextSlice` compose without collision. Streaming gets a test
that a mocked stream reassembles to the same final state as the non-stream path.
