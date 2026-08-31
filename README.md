# CP Phantom — Solo

A solo-play companion for the homebrew **CP Phantom** Cyberpunk tabletop ruleset.
"AI Dungeon, but it doesn't forget and the math is real."

Standalone sibling to [CP Phantom](https://github.com/JuliusBiTS/CP_Phantom) — separate repo, separate deploy. Full design: [`SOLO_MODE_BUILD_PLAN.md`](./SOLO_MODE_BUILD_PLAN.md).

## The core idea

A structured **Campaign State** object is the single source of truth. It is read fresh every turn and updated with an explicit structured delta after every resolved action. The LLM narrates and adjudicates *from it* — it is never asked to remember anything from chat history. Old turns are compressed into durable facts, so prompt cost stays flat.

## The dice rule

- **Your own PC** — the tool never rolls. It tells you the stat pair, PW, dice to roll, and DV; you roll physical dice and type the number in.
- **Everything else** — enemies, NPCs, allies, drones, environmental checks — the backend rolls for real via [`src/lib/dice/rollPW.ts`](./src/lib/dice/rollPW.ts) (real CSPRNG, rulebook v12 §2.1–2.2 capped-remainder-die + crit semantics, ported from CP Phantom's tested implementation). The model gets the numbers as data and narrates *that*.

## Status: Phase 1

| Area | State |
|---|---|
| Real dice engine + 22 tests | done — `npm test` |
| v12 §7.7 PW-halving stack, range bands | done |
| Wound-state house rule (ported) | done |
| Campaign State schema + delta applier | done |
| Two-phase turn loop (`roll_dice` / `request_player_roll` / `commit_turn`) | done |
| Fact compression | done |
| Firebase layer, hard-isolated to `soloCampaigns/` | done |
| Voice dictation (Web Speech API) | done |
| Minimal play UI + `/api/turn` | done |
| Live end-to-end play test | needs `ANTHROPIC_API_KEY` |
| Life-path creator, campaign bible, GM push-back | Phase 2 |
| Visual design pass | Phase 3 |

## Run locally

```bash
npm install
cp .env.example .env.local   # add your ANTHROPIC_API_KEY
npm run dev
```

Open http://localhost:3000, click **+ New campaign**, paste a CP Phantom character JSON (or leave blank for a stub), and act.

```bash
npm test        # dice engine + rules
npm run build   # production build
```

## Deploy

See [`SETUP.md`](./SETUP.md) for the Vercel + Firebase checklist.
