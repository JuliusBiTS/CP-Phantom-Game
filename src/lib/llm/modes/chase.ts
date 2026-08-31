import type { ModeDef } from "./index";

/** Abstract vehicle chase — rulebook §22.5 + FEATURE_PLAN §M8. */
export const CHASE_MODE: ModeDef = {
  promptFragment: `

## Mode: CHASE (§22.5 — abstract "Spur")

A distance chase: the Spur runs 0–6, starting at 2. Play in rounds:

1. Describe a terrain beat and one immediate complication.
2. The lead driver (the PC if runner; the pursuer if the PC is chasing) — \`request_player_roll\` Drive+Reflexes vs the chase DV (${"standard 14, elite 17"}), OR \`roll_dice\` if it's an NPC driver.
3. Each passenger takes one action: shoot, hack (Vehicle Override etc.), drone, repair, treat, make an obstacle, spot.
4. A successful passenger action gives **+2 to the driver's result** OR cancels this round's complication.
5. Resolve: driver wins → the runner gains ground (\`delta.chase.spurChange = +1\` when the PC is the runner, \`-1\` when the PC is the pursuer). Driver loses → the opposite. Tie → no movement, the complication lands.

- **Spur 6:** the PC (as runner) has shaken the chase / (as pursuer) has caught the quarry → \`delta.chase.outcome = "escaped"\` and \`exit = true\`.
- **Spur 0:** a pursuer pulls alongside or blocks → \`delta.chase.outcome = "caught"\`; drop into normal combat (\`start_combat\`) for the final confrontation, or \`exit\` if it just ends.
- **Vehicle damage:** shots at a vehicle hit its SDP (\`delta.chase.vehicleDamage = [{ id, amount }]\`, amount already after body-SP). A vehicle at 0 SDP crashes — occupants take collision damage (3d6 at speed ≤20, 5d6 above; \`roll_dice\` it, then \`pcHpChange\` / \`npcHpChanges\`).
- Set up the chase with \`enter_chase\`; generate any vehicle stat block with \`generate_vehicle\`.`,

  contextSlice: (state) => {
    const ch = state.chase;
    if (!ch.active) return undefined;
    return {
      chase: {
        spur: ch.spur,
        round: ch.round,
        terrain: ch.terrain,
        pcRole: ch.pcRole,
        pursuerTier: ch.pursuerTier,
        vehicles: ch.vehicles.map((v) => ({ id: v.id, name: v.name, role: v.role, sdp: `${v.sdp}/${v.sdpMax}`, bodySp: v.bodySp, speed: v.speed, disabled: v.disabled, driver: v.driver, occupants: v.occupants })),
      },
    };
  },
};
