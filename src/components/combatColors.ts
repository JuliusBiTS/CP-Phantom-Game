/** Shared combatant colors — kept in one place so the list view (CombatTracker)
 *  and the battle map render the same entity in the same color. */
import type { CombatantView } from "@/lib/rules/combatant";

export const TYPE_COLOR: Record<CombatantView["type"], string> = {
  PC: "var(--cyan)",
  NPC: "var(--red-bright)",
  Ally: "var(--green-bright)",
  Companion: "var(--blue-bright)",
  Drone: "var(--red-bright)",
  Security: "var(--red-bright)",
  Vehicle: "var(--gold-bright)",
};

export const ROLE_COLOR: Record<string, string> = {
  pc: "var(--cyan)",
  enemy: "var(--red-bright)",
  ally: "var(--green-bright)",
  neutral: "var(--text2)",
};
