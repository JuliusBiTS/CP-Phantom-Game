import type { ModeDef } from "./index";

/** Vehicle chase — rulebook §22 + FEATURE_PLAN §M8. Filled in with M8. */
export const CHASE_MODE: ModeDef = {
  promptFragment: `

## Mode: CHASE (§22)

This subsystem isn't wired yet — run the chase narratively with normal rolls, or set \`delta.mode.exit = true\`.`,
};
