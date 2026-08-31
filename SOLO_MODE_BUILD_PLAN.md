# Solo TTRPG Companion — Build Plan

**Status:** approved by the user, not yet started. This document is a complete handoff — it was written by a Claude Code session that spent an entire session building the reference tool (CP Phantom) and knows its internals in depth. A fresh chat should be able to execute this plan using only this document plus the referenced source files, without re-deriving anything from scratch.

**Read this whole document before writing any code.** Section 3 tells you exactly which files to open and which functions in them to study before designing your own version.

---

## 1. Vision

The user is the GM of a home Cyberpunk campaign built entirely on a homebrew ruleset ("CP Phantom" rules — the campaign is also called Night City Sprawl / Phantom V1 in-tool). His players are sometimes unavailable for months at a stretch. He wants a **solo play companion** — "AI Dungeon, but better" — where he plays his own PC (or a fresh one) through gigs or a full campaign, narrated by Claude, while the mechanics stay grounded in his actual ruleset instead of freeform improv.

The one-line pitch he approved: **a structured game-state object is the source of truth; the LLM narrates and adjudicates from it, it never has to "remember" via chat history.** That's the core idea this whole plan protects. AI Dungeon's failure mode — forgetting established facts, contradicting itself, plots that wander nowhere — comes from treating the transcript as memory. This tool must not do that.

Explicit requirements from the user, verbatim intent:
- Its own standalone tool, hosted **separately** from CP Phantom, for independent patching.
- The **full** experience — not a stripped-down demo. Best version he could ask for.
- **He still rolls his own physical dice — but only for his own PC.** For any action taken *by his character*, the tool tells him what to roll and against what DV/target, like a real GM would, and he types in the result — it never fabricates that number for him. **Every other roll in the game — every NPC, enemy, ally, companion, drone — is rolled by the tool itself, for real, via a genuine dice engine.** The LLM narrates what a roll means; it must never invent or fudge the number. This is not optional flavor: an enemy's attack roll, a reaction roll, a skill check for an NPC all need to come from actual RNG output the backend computed, the same way a physical d20 would, not from the model deciding narratively "the enemy hits." See Section 5.7.
- **Consistency is the top priority.** Explicitly: "AI Dungeon keeps forgetting things from before" — this must not happen here.
- **Import a character from CP Phantom.** Read access to his real character sheet.
- **Push changes back to CP Phantom — but GM-gated only.** Solo play must never write directly into the live campaign data. Every proposed change (XP, loot, injuries, etc.) needs human GM review and approval before it lands in the real character.
- **Character creation**, reusing the *actual* character-creation system from his rulebook (the life-path/age-based system), not a generic stat-buy form.
- **Campaign type selection at setup**: short episodic gigs/missions, or a longer campaign with a real, well-written macro-plot and twists.
- **Thematic, cool, and polished** — should look and feel like a finished product, not a prototype.
- **Hosting and any embedded tools/services must be free to use.** The only cost he's accepted is the Anthropic API usage itself (tokens/API key billing) — everything else (hosting, database, etc.) needs a genuine free tier.

---

## 2. What "better than AI Dungeon" concretely means here

Don't treat this as a vague aspiration — it decomposes into specific, buildable mechanisms:

| AI Dungeon failure | This tool's answer |
|---|---|
| Forgets established facts | A structured **Campaign State** object (Section 5.1) is read fresh every turn and updated explicitly after every resolved action. The LLM is never asked to recall from raw chat history. |
| Long sessions degrade / drift | Old turns get periodically **compressed into durable facts**, not kept verbatim forever (Section 5.3). Memory cost stays flat, not O(conversation length). |
| No mechanical grounding, numbers feel arbitrary | Every roll uses the **exact PW math** already built and tested in CP Phantom (Section 3.2) — same dice-pool sizing, same talent/wound/status modifiers, same as a live session with a human GM. |
| Plot wanders with no shape | Long-form ("Campaign") mode generates a private **campaign bible** once at setup (Section 5.6) — acts, antagonist, planted twists — that the LLM references every turn but doesn't necessarily reveal. This is what gives a solo game an actual throughline. |
| No real stakes / anything goes | Solo-generated changes are **never auto-applied** to the real character. A GM (human, the same user) reviews and approves a changeset before it touches live data (Section 5.4). |
| The model narrates a roll instead of a real one happening ("the guard swings and just barely misses" with no actual number behind it) | Every roll for an entity other than the player's own PC comes from a **real dice engine** the backend calls (Section 5.7), not the LLM's imagination. The model receives the engine's output as data and narrates *that* — it never gets to decide the number. |

---

## 3. Reference materials — read these before designing anything

### 3.1 The reference tool: CP Phantom

- **Repo:** `https://github.com/JuliusBiTS/CP_Phantom` (GitHub, user `JuliusBiTS`)
- **Live:** `https://juliusbits.github.io/CP_Phantom/`
- **Local path (if this new chat has filesystem access to the same machine):** `C:\Users\JFCaesar\Documents\Claude\Projects\CP Phantom APP\index.html`
- **What it is:** a single-file HTML/CSS/JS app (~620K characters as of this writing), no build step, no framework. Backed by Firebase Realtime Database. Hosted on GitHub Pages (static — no backend, no LLM calls, which is exactly why it *could* stay static; the solo tool cannot follow this pattern, see Section 6).
- **Why it matters for this project:** it already implements the entire crunchy rules layer — weapon/hack/technique/reaction PW computation, wound states, talent/technique catalogs, status effects, NPC/enemy/vehicle/drone/security generators. Re-deriving this math from the rulebook a second time would be wasted, error-prone effort. **Port or directly reuse this logic**, don't reinvent it.

**Specific functions/constants worth reading directly in `index.html` before building the solo tool's rules engine** (search the file for these names):

- `computeLiveWeaponStats(c, w)` — full weapon PW/bonus computation given a character and a weapon object, folding in talent mods, attachments, wound-state penalty, "rallied" buffs.
- `computeLiveHackStats(c, h)` — same for hacks (netrunning), including IP cost discounts.
- `computeLiveTechniqueStats(c, weapon, t)` — techniques (melee/ranged combat maneuvers), which ride on top of a weapon's live stats.
- `computeLiveReactionStats(c)` — Drive+Reflexes reaction/dodge roll, with talent mods.
- `getWoundState(c)` — the automated wound-state system (Seriously Wounded ≤50% HP, Critically Wounded ≤25%, Flatlining ≤10% — this is a **house rule beyond the book**, not RAW; see the code comment for the reasoning about why the book's flat -2/-4 malus doesn't scale with this system's actual PW range).
- `getEffectiveStats(c)` — base stats + live cyberware bonuses.
- `getActiveTalentMods(c, appliesTo, weaponSlotType)` / `getActiveAttachmentMods` — the conditional-modifier engine (toggle-chip mods that only apply situationally, e.g. "when attacked in melee").
- `TALENT_CATALOG`, `TECHNIQUE_CATALOG`, `HACK_CATALOG`, `WEAPON_TABLE` / `matchWeaponName`, `ATTACHMENT_CATALOG` — the full data catalogs. These are large JS object literals with every talent/technique/hack/weapon in the ruleset, English UI text, structured `mods` arrays.
- `charTypeMeta(c)` — the character-type classification (PC/NPC/Ally/Companion/Drone/Vehicle/Security) used for color-coding and filtering; a solo tool importing a character needs the same classification logic.
- `calcDerived(...)`, `calcHumanityBase(...)` — derived-stat formulas (HP/Stamina/IP/Humanity from base stats).
- The **NPC/enemy/vehicle/drone/security generators** (search for `processGeneratedEnemy`, `genVehicleResultToCharacter`, `genDroneResultToCharacter`, `genSecurityUnitToCharacter`) — procedural content generation already exists and should be reused for on-demand solo-mode encounters (a mugger, a corp patrol, a rival ripperdoc) instead of asking the LLM to invent stat blocks from nothing.
- `applyAutoStatusEffect(target, spec)` — the status-effect apply/refresh/stack engine (Bleed, Burn, Poison, Malfunction, Marked, Rallied, etc.).

**Do not guess at any of this math from the rulebook text alone if the equivalent function already exists in `index.html` — read the actual implementation.** It has been extensively tested this session and encodes decisions (rounding, stacking rules, scope) that aren't always obvious from the rulebook prose alone.

### 3.2 The rulebook

- File: `CP_Regelwerk_v9_rebalanced.docx`, in the same folder as `index.html` (`C:\Users\JFCaesar\Documents\Claude\Projects\CP Phantom APP\`).
- **Confirm with the user this is still the current/authoritative version before relying on it** — during the CP Phantom build, a rulebook revision was referenced as "v12" at one point for research; it's unclear whether v9 in the folder is stale or whether "v12" was a mislabeling. Don't assume; ask, or check file modification dates against what's cited inside the document itself (section version markers, changelog if any).
- It's a `.docx` — use the `docx` skill (`pandoc -t markdown`, or the skill's read flow) to extract text. Don't try to open it as a zip by hand.
- Key sections already identified as relevant to this project during the CP Phantom build:
  - **§1** — Life-path character creation: age-based "Kernphase," 2 actions per year, W20 event tables, background-shaping choices. **This is what the character creator (Section 5.5) should implement.**
  - **§2** — Core dice mechanic: PW (Probewert) determines how many d20s you roll (1 per full 20 of PW, plus a capped remainder die), summed. This is why a flat modifier feels different at different power levels — already accounted for in `getWoundState`'s percentage-based malus, see the code comment there.
  - **§14.1** — Wound States (Seriously Wounded / Mortally Wounded / Death Save) — automated in CP Phantom as described above.
  - **§10** — Netrunning/hacking (already in `HACK_CATALOG`).
  - **§11-13** — Talents, Techniques, Critical Injuries.

### 3.3 This session's context (for background, not required reading)

The user and a previous Claude Code session spent an extended session on CP Phantom this same day: building the full talent/technique/reaction/hack automation layer, an automated wound-state system, a full visual redesign (tokens, typography, depth, a signature corner-bracket HUD motif, a boot-sequence intro animation), and fixing several bugs including a scroll-performance regression from the redesign. All of that is already live at the URL above. The visual design system from that work (Section 7) should be reused here so this feels like a sibling product.

---

## 4. Hard requirements checklist

Use this to sanity-check the build before calling any phase "done":

- [ ] For the player's own PC only: the system states what to roll (stat pair, PW, target/DV) and waits for a typed-in result — never rolls on the player's behalf.
- [ ] For literally every other entity (NPC, enemy, ally, companion, drone): the tool rolls for real, via an actual dice engine (Section 5.7) — never narrated or invented by the LLM.
- [ ] No fact stated as true in one session is ever contradicted or forgotten in a later session (this needs an actual test protocol — see Section 9).
- [ ] A character can be imported from the live CP Phantom Firebase data (read-only snapshot).
- [ ] Nothing solo play generates writes to the live CP Phantom character data without a human approving it first, item by item or in bulk.
- [ ] A brand-new character can be built from scratch using the rulebook's actual life-path system, not a generic point-buy form.
- [ ] At campaign setup, the player is asked to choose Gigs (episodic) vs Campaign (macro-plot) mode.
- [ ] Campaign mode has an actual planned structure (acts/antagonist/twists) established at creation, not improvised turn-by-turn.
- [ ] The tool is hosted on its own domain/repo, independent of CP Phantom's deploy.
- [ ] Every piece of infrastructure other than the Anthropic API itself is on a genuine free tier at solo-personal-use scale.
- [ ] Visual design matches CP Phantom's established system (Section 7), not a generic UI.
- [ ] The player can dictate an action by voice instead of typing (Section 5.2a), using a free browser-native speech API — no paid transcription service.

---

## 5. Architecture

### 5.1 Campaign State — the single source of truth

A persisted object (see Section 6 for where — Firebase Realtime Database is the natural choice, same technology CP Phantom already uses, so the user has zero new infra to learn operationally). Rough shape:

```
CampaignState {
  meta: { name, mode: 'gigs' | 'campaign', createdAt, lastPlayedAt, inGameDate }
  character: { ...full imported/created character sheet, same shape as CP Phantom's `characters/{id}` node (see Section 8.1) }
  world: {
    currentLocation: string,
    knownLocations: [{ name, description, notableFacts: [string] }],
    npcs: [{ id, name, disposition, status ('alive'|'dead'|'unknown'), lastSeen, notableFacts: [string],
             sheet: { ...minimal-or-full stat block in the SAME shape as Section 8.1, only present once the NPC actually needs to roll for something — generate it on demand via CP Phantom's generator logic (Section 3.1) rather than inventing ad hoc numbers, and cache it here once created so the same NPC rolls consistently later } }],
    factions: [{ name, standingWithPC, notableFacts: [string] }],
  },
  questLog: [{ id, title, status ('active'|'completed'|'failed'), summary, flags: {...} }],
  campaignBible: { ... see Section 5.6, only present in 'campaign' mode, treated as GM-only context },
  sessionLog: [{ timestamp, type: 'narration'|'action'|'roll'|'system', text, compressed: bool }],
  pendingChangeset: { ...see Section 5.4, only exists between sessions until GM review }
}
```

This is the object the LLM is handed, in full or in relevant slices, on every turn. It is also the object the UI renders (a "Status" panel showing current HP/location/active quests should always be visible during play — don't bury state entirely inside prose).

### 5.2 Turn loop

The critical branch in this loop is **who is rolling** — the player's own PC always rolls physically; every other entity is rolled by the backend's dice engine (Section 5.7), never by the LLM.

1. Player describes an action in free text (or picks from suggested actions — consider offering both).
2. Backend assembles a prompt containing: the character sheet (or the relevant slice — full sheet for anything mechanical), current location/NPCs present (with their cached `sheet` if they have one, generating one on demand via CP Phantom's generator logic if this is their first roll — Section 3.1), active quest flags, the campaign bible (if campaign mode), and a **compressed** recent history (not the raw full log — see 5.3).
3. Claude narrates the immediate situation and decides what needs to be rolled, by whom.
   - **If the roll belongs to the player's PC:** Claude states exactly what to roll (e.g. "Roll Reflexes + Dexterity — your PW is 17, roll 1×d20") **computed via the same PW logic as CP Phantom** (Section 3.1), and what result would succeed against the situation's DV. Turn pauses here.
   - **If the roll belongs to anyone/anything else** (an enemy's attack, an NPC's reaction, a companion's action, an environmental check): Claude requests a roll from the backend's dice engine (a tool-call / function-call, not something it computes itself) — passing the entity, the relevant PW, and the DV — and receives back a real, backend-generated result before it writes a single word of narration about the outcome. No pause; this resolves in the same turn.
4. **(PC rolls only)** Player rolls physically, types the result, and the turn continues from where it paused.
5. Claude adjudicates the outcome against whichever result now exists (the player's typed-in number, or the engine's returned number), narrates it, and returns a **structured state delta** alongside the narration (e.g. `{hp: -6, statusEffects: [+Bleed], questFlags: {...}, newFacts: [...]}`) — this is critical: don't parse narration text after the fact to guess what changed, have the model return the delta as structured data in the same turn.
6. Backend applies the delta to Campaign State immediately (this campaign's OWN state, not CP Phantom's live data — see 5.4 for the distinction) and appends a log entry, including the actual roll (whose, what it was, against what DV) for every roll that happened, PC or not — the player should be able to see "Ganger's attack: rolled 14 vs your DV 12 — hit" in the log, not just prose.
7. UI updates (HP bar, quest log, etc.) and shows the narration.

A multi-actor beat (e.g. a firefight with three enemies) may loop step 3's "someone else rolls" branch several times within a single turn before it's the player's turn to act or react again — don't force one roll per turn if the fiction calls for several.

### 5.2a Speech-to-text input (dictation)

The player must be able to **speak** an action instead of typing it (user request, 2026-08-31). This is a pure frontend input affordance on step 1 of the turn loop — it does not touch the architecture, the state object, or the prompt.

- **Implementation:** the browser-native **Web Speech API** (`SpeechRecognition` / `webkitSpeechRecognition`). Zero cost, no API key, no extra service, nothing to configure — it satisfies the "everything except the Anthropic API must be free" constraint for free. Audio is handled by the browser's own recognizer (Chrome/Edge → Google; Safari → Apple); the app never sees raw audio and never sends it anywhere itself.
- **Degradation:** if the API is absent (Firefox), the mic button renders disabled with an explanatory tooltip and typing is unaffected. Respect `prefers-reduced-motion` for any recording indicator animation.
- **Interim vs final:** show interim (unstable) transcription live in the input box; commit final segments to the action text. The player always reviews/edits the text before it's sent as a turn — dictation fills the box, it doesn't auto-submit.
- **Phase placement:** a basic mic-to-textbox button ships in **Phase 1** (it's a ~1 file component). A Phase 3 polish option is a local Whisper model via `transformers.js` for offline use / better accuracy — still free, but a ~40–200 MB model download, so it's opt-in, not the default.
- Implemented in Phase 1 as `src/components/DictationButton.tsx`.

### 5.3 Consistency mechanism — fact compression

Don't keep the full session log in every prompt forever. After each session (or every N turns), run a **summarization pass**: ask the model to extract durable facts from the recent log ("PC killed the fixer Rook in a firefight at the Coin bar," "Militech is now hostile toward the PC in Watson district") and merge them into `world.npcs[]`/`world.factions[]`/`questLog[]` as structured facts, not prose. The raw log entries that were compressed can then be dropped from the "recent history" window (kept in full in storage for the player to scroll back through, just not re-sent to the model every turn).

This is the single most important piece of engineering in the whole project for solving "AI Dungeon forgets things." Test it explicitly and often — see Section 9.

### 5.4 Character import & GM-gated push-back

**Import:** a one-time (or refresh-on-demand) **read-only** pull from CP Phantom's Firebase Realtime Database. CP Phantom's data lives at path `campaign/characters/{characterId}` (the `campaign` prefix comes from `dbPath()` in CP Phantom's source — confirm this hasn't changed by reading `dbPath()` directly). See Section 8.1 for the exact field shape to expect.

Import produces a **snapshot**, not a live link. The two tools must never write to the same live node simultaneously — that's a guaranteed corruption/race-condition source. Solo play works entirely against its own copy inside `CampaignState.character`.

**Push-back:** solo play never writes to CP Phantom's live Firebase data directly, under any circumstance. Instead:

1. Changes accumulate in `CampaignState.pendingChangeset` during play: XP gained, items looted, talents that became eligible, injuries sustained, Humanity changes, notes for the GM.
2. A **review screen** (in this tool, or optionally embedded back into CP Phantom later — start with it living in this tool) lists every pending change individually: `"+450 XP", "Militech Pistol added to inventory", "1 Critical Injury: Broken Ribs", "Notable event: killed a Militech patrol"`.
3. The GM (same user, different hat) can approve all, approve a subset, or reject each line.
4. Only approved lines get written to CP Phantom's live `campaign/characters/{id}` node, using the same field shape CP Phantom itself writes (reuse its `saveCharacter`/whitelist pattern as a reference for what's safe to touch — don't invent new fields CP Phantom doesn't already understand).
5. Once approved and written, clear that changeset from `pendingChangeset`.

This is a real moderation UI, not a formality — treat it with the same care as a merge-request review screen.

### 5.5 Character creation (life-path wizard)

Implement the rulebook's actual §1 life-path system: age-based progression, a fixed number of actions per "year" of backstory, W20 rolls against event tables that shape stats/relationships/possessions. The player should roll physically here too, same philosophy as in-play rolls — the wizard presents the table, the player rolls, types the result, the wizard applies the outcome and moves to the next step.

This produces a character in the exact same shape CP Phantom's own character records use (Section 8.1), so it can later be pushed into CP Phantom via the same approval pipeline as any other change, if the user ever wants to bring a solo-created character into the live group campaign.

### 5.6 Campaign setup & the campaign bible

At the start of a new campaign, ask the player:
- **Gigs mode**: episodic, self-contained missions. No persistent macro-plot required, though recurring NPCs/factions can still carry over between gigs via the normal state/fact system.
- **Campaign mode**: ongoing, with a real macro-plot.

For Campaign mode, generate a **campaign bible** once, at creation, before play starts:
- A core antagonist or driving conflict.
- A rough act structure (e.g. 3-5 acts, each with a goal/turning point).
- 2-3 planted twists — genuine surprises the model commits to in advance rather than improvising when it happens to feel dramatic.
- Key recurring NPCs and their real motivations (which may differ from what they present to the PC).

Store this as `CampaignState.campaignBible`, treated as **GM-only** context: it's included in every prompt so the model can write *toward* it, but the model should not directly reveal bible contents to the player except through in-fiction discovery. This is what gives long-form solo play an actual shape instead of aimless improv — the single biggest lever against "AI Dungeon plots go nowhere."

### 5.7 Dice engine — real rolls for everyone except the player's own PC

**This is a required backend component, not an optional nice-to-have.** The rule is exactly this:

- The **player's own PC**: never rolled by the tool. The tool states what to roll and against what, the player rolls a physical die and types the number in.
- **Every other entity in the game** — enemies, NPCs, allies, companions, drones, environmental/reaction checks the fiction calls for — the tool rolls **for real**, using an actual pseudo-random number generator, and hands the model the result as data. The model narrates what that result means; it does not get to choose or fudge the number, and it must not be allowed to describe a roll's outcome before the engine has actually produced one.

**Implementation:**

- A pure backend function, e.g. `rollPW(pw: number): { dice: number[], total: number, diceCount: number }`, implementing the rulebook's actual §2 mechanic: one full d20 per complete multiple of 20 in the PW, plus one capped remainder die for whatever's left over (a d20 that only counts up to the remainder value — see the rulebook example: PW 45 → two dice up to 20 each, one capped at 5; a roll of 14+12+7 only counts the 14 and 12, giving 26). Use the same `pwDiceCount`-equivalent sizing logic CP Phantom's own `pwDiceCount(pw)` uses (Section 3.1) so an NPC with a given PW rolls exactly like a player with the same PW would.
- Use a real RNG — `crypto.getRandomValues` (available in both browser and Node/Vercel serverless) is preferable to `Math.random` for a proper uniform distribution, though either is fine for a game; the point is it must be an actual computed random number, never something the LLM is asked to "pick."
- Exposed to the model as a **tool/function call** (Claude's tool-use feature) — the model calls `roll_for_npc(entityId, pwContext, dv)` (or similar) mid-turn, the backend executes the real roll and returns the structured result, and only then does the model continue narrating. This keeps the number-generation entirely outside the model's own token generation, which is the only way to guarantee it's a genuine roll and not a plausible-sounding hallucinated one.
- Every engine-rolled result gets logged in `sessionLog` with enough detail to audit later (who rolled, what PW, what dice came up, what the total was, what it was rolled against) — this also directly enables the roll-grounding test in Section 9.
- Reuse CP Phantom's live-PW computation (Section 3.1) to get the PW being rolled in the first place — an enemy's attack PW should come from `computeLiveWeaponStats` against their actual (generated or hand-authored) stat block, not a number the model invents on the spot.

---

## 6. Tech stack & hosting

**Requirement recap:** its own hosting, separate from CP Phantom; everything free except the Anthropic API itself.

CP Phantom can be static (GitHub Pages) because it never calls an LLM. This tool calls Claude on every turn, which means an API key has to live somewhere that isn't the client — **a static site cannot do this safely**. Recommended stack:

- **Frontend + serverless backend:** Vercel (free "Hobby" tier). Serverless functions hold `ANTHROPIC_API_KEY` as a server-side environment variable and proxy calls to the Anthropic Messages API. Free tier is generous enough for single-user solo play (this is not a multi-tenant product).
- **Database:** Firebase Realtime Database, free "Spark" plan — same technology CP Phantom already uses for its own data, so the user isn't learning new infra, and reading CP Phantom's data for character import is trivial (same SDK, same auth model, potentially even the same Firebase project with a separate top-level node like `soloCampaigns/{id}` alongside the existing `campaign/` node — evaluate whether reusing the *same* Firebase project vs. a separate one is cleaner; a separate project is probably safer for import/isolation, but ask the user).
- **Repo/CI:** a new GitHub repo, separate from `JuliusBiTS/CP_Phantom`. Vercel deploys from GitHub pushes, same "commit → auto-deploy" rhythm CP Phantom already uses via GitHub Pages.
- **API key handling:** never in client-side code, never committed to the repo. Vercel environment variable, server-side only.

**Alternative worth evaluating before committing:** Claude's Artifacts platform has a capability for a published page to directly ask Claude a question at runtime, without the page's author managing any API key or backend at all — it rides on the user's own Claude usage instead of separate Anthropic API billing. This could mean **zero additional API cost** beyond what the user already pays for Claude access, which is strictly better than what he asked for ("API costs... will not be free, but that's ok" — he's already accepted a cost that this path might avoid entirely). The tradeoff: it's less of a fully independent standalone product (it lives inside the Artifacts platform, with that platform's constraints — e.g., a strict Content Security Policy, no arbitrary external network calls, size limits), which cuts against "its own tool, hosted separately... work very well." Given the user's stated ambition (full standalone product, thematic, cool, works very well), **the Vercel + own-API-key path is the better match and the default recommendation** — but a new chat should present this alternative to the user explicitly before writing infrastructure code, since "zero extra cost" is a meaningfully different tradeoff he hasn't explicitly weighed yet.

---

## 7. Visual design system — reuse, don't reinvent

CP Phantom just went through a full visual redesign this session. Reuse its language directly so this reads as a sibling product:

**Color tokens** (exact current values from `index.html`'s `:root` — read the live file for anything that may have changed since):
```
--bg: #04060c;        --surface: #0a0f1e;     --surface2: #0d1424;   --surface3: #0f1729;
--border: #1c2540;    --border2: #2a3868;
--text: #e2eaf9;       --text2: #93a4cc;       --text3: #56638a;
--cyan: #22e0ff;        --cyan-dim: #0a8bb0;    --cyan-glow: rgba(34,224,255,0.22);
--red: #7a1428;         --red-bright: #ff3b5c;  --red-glow: rgba(255,59,92,0.25);
--gold: #7a5410;        --gold-bright: #ffb020; --gold-glow: rgba(255,176,32,0.2);
--green-bright: #29ffa8; --green-dim: #0d6b46;   --green-glow: rgba(41,255,168,0.18);
--purple: #8800cc;      --purple-bright: #cc44ff;
--blue: #2255cc;        --blue-bright: #4488ff;
```

**Typography:** two fonts doing two jobs — `'Bahnschrift', 'Segoe UI Semibold', 'Arial Narrow', sans-serif` (condensed, heavy, uppercase, wide-tracked) for every header/label/button; `'Cascadia Code', 'Consolas', 'Courier New', monospace` for anything numeric (stats, dice, HP). Bahnschrift ships with Windows by default — no font embedding needed on Windows; verify a reasonable fallback stack for other OSes since this will run on the user's own machine primarily but should degrade gracefully.

**Motifs established this session, reusable here:**
- Sharp corners, `border-radius` avoided on purpose — depth comes from layered `box-shadow`/glow, not rounding. This is a deliberate identity choice (see CP Phantom's own design notes) — don't default to rounded cards.
- A corner-bracket "targeting reticle" frame reserved for exactly one "this is the thing that matters right now" moment per screen (in CP Phantom: the active-turn combat card). Consider what the equivalent moment is here — maybe the current scene/location, or an active combat encounter.
- A one-time hacker-terminal boot sequence on first load (CP Phantom has one — typewriter terminal lines, a glitch transition, a glitched wordmark reveal) — worth an equivalent here, gated the same way (once per browser tab session via `sessionStorage`, always skippable, respects `prefers-reduced-motion`).
- **Performance lesson already paid for, don't re-learn it:** CP Phantom's redesign initially introduced `background-attachment: fixed`, an animated `background-position` sweep, and `mix-blend-mode` texture overlays — all three caused real scroll jank and had to be fixed to `transform`/opacity-based, non-fixed-attachment equivalents. Avoid these three patterns from the start here; prefer `transform`/`opacity` animations (GPU-compositable) over anything that animates `background-position`, `box-shadow` blur radius, or uses `mix-blend-mode` on frequently-rendered elements.

---

## 8. Data model reference

### 8.1 CP Phantom character record shape (for import/export compatibility)

Read from `campaign/characters/{id}` in CP Phantom's Firebase. Key fields (non-exhaustive — read `saveCharacter`'s field whitelist in `index.html` for the authoritative full list before writing any push-back code, since this list can drift):

```
{
  name, isNPC, isAlly, isCompanion, isVehicle, isDrone, isSecurityUnit,
  stats: { grit, core, drive, reflexes, speed, focus, creativity, intelligence,
            will, cool, rep, luck, senses, dexterity, strength, agility },
  hp_max, hp_current, stamina_max, stamina_current, ip_max, ip_current,
  humanity_max, humanity_current,
  origin_hp_bonus, origin_sta_bonus, origin_ip_bonus, origin_humanity_bonus,
  armor_body: { name, sp_base, sp_temp } | null,
  armor_head: { name, sp_base, sp_temp } | null,
  cyberware: [string],
  weapons: [{ name, bonus, pw/pwOverride, tags, attachments: [...], tech, magCurrent, ... }],
  talents: [{ name, lvl, desc, req, mods: [...], regen_stat?, regen_amount?, maxBonus?,
               usesPerFight?, statusGrant?, markBonus?, rallyBonus?, hackIpDiscount?, trigger? }],
  techniques: [{ name }],
  hacks: [{ name, ip, effect }],
  cyberdeck, firewall,
  abilities: [{ name, desc, usesMax, usesCurrent }],
  inventory: [{ name, qty, slots }],
  status_effects: [{ type, name, rounds, stacks, ...extra fields per type }],
  eurodollar, pin, notes,
  tier, loot: [...],
  treeXP: { power, mobility, mind }, treeBankedPoints: { power, mobility, mind },
  globalXP, talentPointsSpent,
  mission, owner_char_id, useOwnerStatsForPW,
}
```

Talents carry a rich set of optional mechanical fields (`regen_stat`/`regen_amount` for per-round regen, `maxBonus` for permanent pool increases, `usesPerFight` for limited-use abilities, `statusGrant`/`statusGrantChoice` for on-hit effects, `markBonus`/`rallyBonus` for team-wide buffs, `hackIpDiscount`, `trigger` for one-click resource trades) — these are all read by CP Phantom's live-computation functions (Section 3.1). If solo play needs to reason about "what does this talent actually do mechanically," read the matching entry in `TALENT_CATALOG` by name rather than re-deriving it from the talent's free-text `desc`.

### 8.2 What NOT to do with imported data

- Don't mutate the imported character in place during solo play — work against the `CampaignState.character` copy.
- Don't write partial/malformed character objects back to CP Phantom — the push-back pipeline should only ever write fields CP Phantom's own `saveCharacter` already understands, in the shapes it expects (e.g. a talent needs the full `{name, lvl, desc, req, mods}` shape, not just a name string).
- Don't let solo play invent new talents/weapons/hacks that don't exist in CP Phantom's catalogs unless the GM-review step makes that an explicit, visible decision (e.g. "this session invented a piece of gear that doesn't exist in your ruleset — approve as a one-off, or reject").

---

## 9. Testing & verification guidance

This project's core value proposition is consistency, so test that directly and adversarially, not just "does it run":

1. **Long-session memory test:** play (or script) a session of 40+ turns that establishes several facts early (an NPC's name and a promise made to them, an item picked up, a location visited) and then, 30+ turns later, take actions that would only make sense if those facts are still true. Confirm the model gets it right without the raw early turns still being in the prompt (i.e., confirm the compression pipeline, not just a lucky long context window).
2. **Cross-session memory test:** end a session, start a new one days "later" (simulate via a fresh conversation against the same Campaign State), and confirm state persisted correctly and the model picks it up from `CampaignState`, not from any lingering chat context.
3. **Roll-grounding test:** confirm the PW/DV the tool states for a given action matches what CP Phantom's own live computation would produce for the same character/weapon/situation (spot-check a few against the actual CP Phantom tool).
4. **Dice-engine integrity test:** confirm that for every non-PC roll, the number in the log actually came from the dice engine (crypto RNG call, real dice array, real capped-remainder-die logic per §2) and not from the model — e.g. instrument the engine to log each call, then audit a session transcript and confirm every non-PC roll narrated has a matching engine-call log entry with the same result. Also run a basic statistical sanity check (roll a fixed PW a few hundred times, confirm the distribution looks like real dice, not suspiciously average/dramatic).
5. **Roll-routing test:** confirm the tool never asks the player to roll for an NPC/enemy/ally/companion, and never silently auto-rolls for the player's own PC.
6. **Push-back safety test:** attempt (deliberately) to have solo play generate something absurd (a talent level the character couldn't legally have, negative HP that doesn't clamp) and confirm the GM-review screen surfaces it clearly rather than silently writing it, and that rejecting it leaves CP Phantom's live data untouched.
7. **Campaign bible adherence test (Campaign mode only):** confirm a planted twist from the bible actually gets delivered at a sensible point rather than the plot wandering away from it entirely.

---

## 10. Explicit non-goals (don't build these unless asked)

- No automated/simulated dice rolling **for the player's own PC** — that stays physical, always. (Every *other* entity is the opposite of a non-goal — see Section 5.7, it's required.)
- No letting the LLM narrate a roll's outcome before the dice engine has actually produced a result for it — that defeats the entire point of having a real engine.
- No live two-way sync between this tool and CP Phantom's Firebase data — import is a snapshot, push-back is GM-approved only.
- No multi-user/multi-tenant support — this is a single-user tool for one GM playing solo.
- No attempt to fully replace CP Phantom's own combat tracker for group sessions — this is a solo companion, not a CP Phantom replacement.

---

## 11. Open questions to confirm with the user before/during the build

A new chat should ask these, not assume:

1. Confirm which rulebook file/version is currently authoritative (Section 3.2).
2. Standalone web app + own Anthropic API key (recommended) vs. an Artifact using the "ask Claude" capability (zero extra API cost, more constrained platform) — Section 6.
3. Same Firebase project as CP Phantom (separate top-level node) vs. a fully separate Firebase project for the solo tool's data — Section 6.
4. Where should the GM-review/push-back screen live — inside this new tool, or eventually surfaced back inside CP Phantom itself? (Start with it in the new tool; revisit later if it'd be more natural for the user to review from inside CP Phantom where he already spends GM time.)
5. Confirm phase order/priorities below still match what he wants to see first.

---

## 12. Phased build plan

**Phase 1 — Core loop MVP.** New repo, Vercel + Firebase free-tier hosting wired up, the Campaign State schema, the turn loop (Section 5.2), **the real dice engine (Section 5.7) — this is core to the MVP, not deferred polish**, fact-compression (Section 5.3), a basic voice-dictation button (Section 5.2a), manual character import (paste a character JSON exported from CP Phantom, or hand-enter one — real live Firebase import can come in Phase 2), Gigs mode only (no campaign bible yet). Deliberately ugly UI. Goal: prove the consistency architecture holds up over a real multi-session play test *and* that every non-PC roll is genuinely engine-rolled, never narrated (Section 9, tests 1-5) before investing in anything else.

> **Phase 1 build status (2026-08-31):** scaffolded in repo `JuliusBiTS/CP-Phantom-Game`. Done: real dice engine (`src/lib/dice/rollPW.ts`) with 22 passing tests including the v12 §2.1 capped-remainder example and a CSPRNG distribution check; v12 §7.7 PW-halving-stack + range bands (`src/lib/rules/pw.ts`); ported `getWoundState` house rule; Campaign State zod schema + structured-delta applier; the two-phase turn loop with the three tools (`roll_dice` server-executed, `request_player_roll` suspends the turn, `commit_turn` carries narration+delta); fact-compression pass; Firebase layer hard-isolated to `soloCampaigns/` with a read-only CP Phantom character-import helper; localStorage fallback store; dictation button; minimal play UI; `/api/turn` route holding the API key server-side. Builds clean. **Not yet done / needs the user:** Vercel project + `ANTHROPIC_API_KEY` env var, Firebase config env vars + security rules for the `soloCampaigns/` node, a real end-to-end play test against the live API, PC-PW auto-computation surfaced into the prompt (currently the model reads raw stats). Narrator model defaults to `claude-sonnet-5` (env `SOLO_MODEL`) to keep per-turn cost down.

**Phase 2 — Real integration.** Live read-only import from CP Phantom's Firebase, the life-path character creator (Section 5.5), Campaign mode with campaign-bible generation (Section 5.6), the GM push-back review pipeline (Section 5.4) wired to actually write approved changes back to CP Phantom.

**Phase 3 — Polish.** Full visual design pass matching CP Phantom's system (Section 7), a boot-sequence intro, an embedded lightweight combat-tracker view for real fights (reusing CP Phantom's wound-state/PW display components rather than resolving combat purely through prose, since combat is exactly where "did HP actually track correctly" matters most), optional local-Whisper dictation upgrade (Section 5.2a), general UX polish.

Test with the real user between every phase — don't build all three before he's touched anything.
