import type { ModeDef } from "./index";
import { CYBERDECK_INFO, CONNECTION_INFO } from "../../rules/net";

/** NET dive — rulebook §10 + FEATURE_PLAN §M7. */
export const NETRUN_MODE: ModeDef = {
  promptFragment: `

## Mode: NETRUN (§10)

The PC is jacked into an architecture. One action per netrun-turn: move a floor, run a hack, fight ICE, grab a file, or jack out.

- **IP is the action economy.** Each hack costs IP (from its catalog entry). IP regens each netrun-turn by deck (${Object.entries(CYBERDECK_INFO).map(([k, v]) => `${k} +${v.ipRegen}`).join(", ")}) — the backend applies this when \`delta.netrun.move\` or \`clearFloor\` is set. Connection: ${Object.entries(CONNECTION_INFO).map(([k, v]) => `${k} (${v.ipMod >= 0 ? "+" : ""}${v.ipMod} IP${v.traceable ? ", traceable" : ""})`).join(" · ")}.
- **PC hacks:** \`request_player_roll\` with Int+Focus (routine) or Int+Creativity (exotic) vs the floor's ICE Firewall (or the target's, §10.2: street 8–12, corpo 15–20, elite 22–30). Apply the hack's effect from its catalog text.
- **ICE bites back:** \`roll_dice\` for an active ICE's attack. Watchdog raises trace each round; Hellhound deals neural damage; **Black ICE on a runner crit-fail can flatline them for real** — narrate the stakes.
- **Trace** rises on traceable hacks and passive ICE — track it with \`delta.netrun.traceChange\`. At 100 the system's runner / NetWatch has a full physical trace: the PC's meat body is now a target (add a \`consequences.add\` and force a disconnect).
- **Alarm** (\`delta.netrun.alarmChange\`, 0–3): Sentinel and noisy hacks push it; at 3 the physical site goes into lockdown.
- Move between floors with \`delta.netrun.move\` (set position); mark a floor done with \`clearFloor\`; picked-up files/eddies go in \`delta.netrun.loot\`.
- Jack out (voluntary, or forced by Kraken/trace/HP): \`delta.netrun.exit = true\`. IP fully regenerates once out of combat.

The player sees the architecture as a stack of floors, the IP bar, the trace gauge and the alarm level.`,

  contextSlice: (state) => {
    const n = state.netrun;
    if (!n.active) return undefined;
    return {
      netrun: {
        target: n.target,
        deck: n.deck,
        connection: n.connection,
        trace: n.trace,
        alarm: n.alarm,
        position: n.position,
        ip: { current: state.character.ip_current, max: state.character.ip_max },
        daemons: n.daemons,
        architecture: n.architecture.map((f) => ({ floor: f.floor, name: f.name, kind: f.kind, ice: f.ice, loot: f.loot, cleared: f.cleared })),
      },
    };
  },
};
