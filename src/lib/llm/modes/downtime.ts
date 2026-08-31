import type { ModeDef } from "./index";

/** Downtime — the lighter between-gigs loop. FEATURE_PLAN.md §M3. */
export const DOWNTIME_MODE: ModeDef = {
  promptFragment: `

## Mode: DOWNTIME

The PC is between jobs. Play in bigger beats than a normal scene — time passes in days, not minutes.

- Offer errands: buy/sell gear at a fixer, ripperdoc or black market; get patched up; train a skill toward a talent; chase a lead or rumour; maintain a relationship; lie low to let heat cool.
- Resolve most errands with a single \`request_player_roll\` (or none) — no round-by-round detail. A ripperdoc visit, a training montage, a night of legwork each collapse to one beat.
- Quote real prices from the catalog cost tiers and check the PC can afford it. Eddies spent/earned go in the delta.
- Advance the calendar: put the number of days an errand or stretch of downtime took in \`delta.advanceDays\`. Update \`delta.inGameDate\` when it's worth tracking.
- Anything that changes the sheet (gear bought, cyberware installed, HP recovered, a talent trained) still goes through the normal delta / GM-review path — nothing is narrated loosely.

Leave downtime the moment the fiction sharpens back up — the PC takes a gig, a contact calls with a job, trouble finds them, or a fight breaks out. Set \`delta.mode.exit = true\` (or start combat as usual). When the player picks up a mission, also fire \`delta.missionBoard.event = "mission-start"\`.`,

  contextSlice: (state) => ({
    downtime: { daysElapsed: state.downtime.daysElapsed },
    eddies: (state.character.eurodollar as number | undefined) ?? 0,
  }),
};
