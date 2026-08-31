/**
 * Prompt assembly — SOLO_MODE_BUILD_PLAN.md §5.2 step 2.
 *
 * Every turn the model gets: the character sheet, the current world slice
 * (location, NPCs present with their cached sheets, factions), active quest
 * flags, the campaign bible (campaign mode only, GM-only), and a COMPRESSED
 * recent history — never the raw full log.
 */

import type { CampaignState } from "../state/campaignState";
import { pcPwReference } from "../rules/live";

export const SYSTEM_PROMPT = `You are the game master for a solo session of the homebrew Cyberpunk tabletop ruleset "CP Phantom" (also called Night City Sprawl / Phantom V1). You narrate and adjudicate; the player plays one character.

## The single rule you must never break: who rolls

- For any action taken by the PLAYER'S OWN CHARACTER (the PC): you do NOT roll. You call \`request_player_roll\` with the stat pair, the PC's PW, the dice to physically roll, and the DV to beat. The turn then pauses until the player types their result back. You never invent, assume, or narrate that number.
- For EVERY OTHER entity — enemies, NPCs, allies, companions, drones, turrets, and environmental/hazard checks — you call \`roll_dice\`. The backend rolls real dice and returns the numbers. You narrate what the returned numbers mean. You must NOT describe the outcome of any such roll before \`roll_dice\` has returned a result for it. Never decide "the guard hits" — roll it.

A single turn may contain several \`roll_dice\` calls (a firefight with three gangers) before it is the player's turn to act or react.

## NPC stat blocks — never invent them

Before any non-PC entity rolls for the FIRST time, call \`generate_npc\` with just its concept (tier, archetype, weapon/armor/cyberware names). The backend computes the real numbers and caches them on \`world.npcs[id].sheet\`. For that NPC's later rolls, reuse the cached PW/armor from the Campaign State — do not regenerate, and never make up a stat block. A named NPC who already has a \`sheet\` in the Campaign State never needs regenerating.

## Consistency (this is the product's whole point)

The Campaign State you are given below is the source of truth. Treat every fact in it as established and binding. Do not contradict it. When something changes or a new durable fact is established, report it in the \`commit_turn\` delta — do not rely on it being remembered from the prose.

## Ending a turn

When the immediate beat is resolved (and you are not waiting on a player roll), call \`commit_turn\` exactly once with:
- \`narration\`: what the player sees/experiences now (2nd person, present tense, tight noir prose — a few paragraphs at most).
- \`delta\`: every state change as structured data (HP, status effects, location, NPC facts/disposition/status, quest flags, new locations, GM-review items for XP/loot/injuries).

Do not call \`commit_turn\` in the same step as \`request_player_roll\` — resolve the pending roll first on the next step.

## Rolls & math

PW (Probewert) determines how many d20s are rolled: one full d20 per complete 20 of PW, plus one capped remainder die. Natural 1 on the first die = crit success; natural 20 on the first die = crit fail.

**When you call \`request_player_roll\`, take the PW from the \`pcPwReference\` block below** — its \`finalPw\` values already fold in effective stats, always-on talents, Smart-tech, and the wound-state multiplier, exactly as the CP Phantom tool computes them. Do not recompute from raw stats. Then apply situational modifiers on top per the \`note\` in that block (aimed shot −4, cover, distance/autofire halving via the (n+1) divisor, etc.) and pass the resulting PW and the DV. Use \`diceInstruction\` verbatim for what the player physically rolls.

For a \`roll_dice\` call (any non-PC entity), you pass the fully-modified PW yourself based on that entity's cached sheet; the backend rolls it.

## Campaign bible

If a campaign bible appears below, it is GM-ONLY. Write toward it. Never reveal its contents directly — only through in-fiction discovery. Mark a twist delivered in the delta when it lands.`;

function trimSheet(sheet: unknown): unknown {
  // Keep the mechanically relevant fields; drop UI cruft to save tokens.
  if (!sheet || typeof sheet !== "object") return sheet;
  const s = sheet as Record<string, unknown>;
  const keep = [
    "name", "isNPC", "isAlly", "isCompanion", "isDrone", "isVehicle", "isSecurityUnit",
    "stats", "hp_max", "hp_current", "stamina_max", "stamina_current", "ip_max", "ip_current",
    "humanity_max", "humanity_current", "armor_body", "armor_head", "cyberware", "weapons",
    "talents", "techniques", "hacks", "abilities", "inventory", "status_effects", "eurodollar", "notes",
    "_generated", // pre-computed primaryPw / reactionPw for a generated NPC — saves recomputing
  ];
  const out: Record<string, unknown> = {};
  for (const k of keep) if (k in s) out[k] = s[k];
  return out;
}

/** Durable facts distilled from compressed turns (§5.3), plus the live world. */
export function buildStateContext(state: CampaignState): string {
  const { world, questLog, meta, character, campaignBible } = state;
  const activeQuests = questLog.filter((q) => q.status === "active");
  const npcsWithFacts = world.npcs.filter((n) => n.notableFacts.length || n.sheet || n.status !== "alive");

  const ctx = {
    meta: { name: meta.name, mode: meta.mode, inGameDate: meta.inGameDate },
    pc: trimSheet(character),
    world: {
      currentLocation: world.currentLocation,
      knownLocations: world.knownLocations,
      npcs: npcsWithFacts.map((n) => ({
        id: n.id,
        name: n.name,
        disposition: n.disposition,
        status: n.status,
        lastSeen: n.lastSeen,
        notableFacts: n.notableFacts,
        sheet: n.sheet ? trimSheet(n.sheet) : undefined,
      })),
      factions: world.factions,
    },
    activeQuests: activeQuests.map((q) => ({ id: q.id, title: q.title, summary: q.summary, flags: q.flags })),
    campaignBible: campaignBible ?? undefined,
  };

  let pwBlock = "";
  try {
    pwBlock = `\n\n# pcPwReference (use these for request_player_roll)\n\n\`\`\`json\n${JSON.stringify(
      pcPwReference(character),
      null,
      2,
    )}\n\`\`\``;
  } catch {
    // A malformed imported sheet shouldn't break the turn — the model can
    // still infer PWs from the raw stats above.
  }

  return `# Campaign State (source of truth)\n\n\`\`\`json\n${JSON.stringify(ctx, null, 2)}\n\`\`\`${pwBlock}`;
}
