/**
 * Campaign State — the single source of truth. SOLO_MODE_BUILD_PLAN.md §5.1.
 *
 * This object is read fresh every turn and updated with an explicit structured
 * delta after every resolved action. The LLM is handed this (in full or in
 * slices) and is NEVER asked to recall anything from raw chat history. The UI
 * renders from this same object.
 *
 * Persisted under Firebase `soloCampaigns/{id}` — a top-level node kept fully
 * isolated from CP Phantom's `campaign/` data (see lib/firebase/soloDb.ts).
 */

import { z } from "zod";

export const NoteList = z.array(z.string());

/** A stat block in the SAME shape CP Phantom uses — §8.1. Loose on purpose:
 *  imported characters carry many optional mechanical fields. */
export const CharacterSheet = z
  .object({
    name: z.string(),
    isNPC: z.boolean().optional(),
    isAlly: z.boolean().optional(),
    isCompanion: z.boolean().optional(),
    isVehicle: z.boolean().optional(),
    isDrone: z.boolean().optional(),
    isSecurityUnit: z.boolean().optional(),
    stats: z.record(z.string(), z.number()).optional(),
    hp_max: z.number().optional(),
    hp_current: z.number().optional(),
    stamina_max: z.number().optional(),
    stamina_current: z.number().optional(),
    ip_max: z.number().optional(),
    ip_current: z.number().optional(),
    humanity_max: z.number().optional(),
    humanity_current: z.number().optional(),
    armor_body: z.any().optional(),
    armor_head: z.any().optional(),
    cyberware: z.array(z.string()).optional(),
    weapons: z.array(z.any()).optional(),
    talents: z.array(z.any()).optional(),
    techniques: z.array(z.any()).optional(),
    hacks: z.array(z.any()).optional(),
    abilities: z.array(z.any()).optional(),
    inventory: z.array(z.any()).optional(),
    status_effects: z.array(z.any()).optional(),
    eurodollar: z.number().optional(),
    notes: z.string().optional(),
  })
  .passthrough();
export type CharacterSheet = z.infer<typeof CharacterSheet>;

export const WorldNpc = z.object({
  id: z.string(),
  name: z.string(),
  disposition: z.string().default("unknown"),
  status: z.enum(["alive", "dead", "unknown"]).default("alive"),
  lastSeen: z.string().optional(),
  notableFacts: NoteList.default([]),
  /** Present only once this NPC actually has to roll for something. Generated
   *  on demand via CP Phantom's generator logic and cached here so the same
   *  NPC rolls consistently later. */
  sheet: CharacterSheet.optional(),
});
export type WorldNpc = z.infer<typeof WorldNpc>;

export const KnownLocation = z.object({
  name: z.string(),
  description: z.string().default(""),
  notableFacts: NoteList.default([]),
});

export const Faction = z.object({
  name: z.string(),
  standingWithPC: z.string().default("neutral"),
  notableFacts: NoteList.default([]),
});

export const QuestEntry = z.object({
  id: z.string(),
  title: z.string(),
  status: z.enum(["active", "completed", "failed"]).default("active"),
  summary: z.string().default(""),
  flags: z.record(z.string(), z.any()).default({}),
});
export type QuestEntry = z.infer<typeof QuestEntry>;

export const SessionLogEntry = z.object({
  ts: z.number(),
  type: z.enum(["narration", "action", "roll", "system"]),
  text: z.string(),
  /** True once this entry has been folded into durable facts (§5.3) and can be
   *  dropped from the model's recent-history window. */
  compressed: z.boolean().default(false),
  /** Populated for `type: "roll"` — the audit trail for §9 test 4. */
  roll: z
    .object({
      actor: z.string(),
      isPC: z.boolean(),
      pw: z.number().nullable(),
      dv: z.number().nullable(),
      dice: z.array(z.number()).optional(),
      total: z.number().nullable().optional(),
      outcome: z.string().optional(),
      source: z.enum(["engine", "player-typed"]),
    })
    .optional(),
});
export type SessionLogEntry = z.infer<typeof SessionLogEntry>;

export const CampaignBible = z.object({
  antagonist: z.string(),
  drivingConflict: z.string(),
  acts: z.array(z.object({ goal: z.string(), turningPoint: z.string() })),
  plantedTwists: z.array(z.object({ twist: z.string(), delivered: z.boolean().default(false) })),
  recurringNpcs: z.array(z.object({ name: z.string(), presents: z.string(), actualMotivation: z.string() })),
});
export type CampaignBible = z.infer<typeof CampaignBible>;

/** One line in the GM push-back review queue — §5.4. Never auto-applied. */
export const PendingChange = z.object({
  id: z.string(),
  kind: z.enum(["xp", "loot", "injury", "humanity", "talent", "note", "other"]),
  label: z.string(),
  /** The concrete write to apply to CP Phantom's character node if approved. */
  patch: z.record(z.string(), z.any()).optional(),
  createdAt: z.number(),
  reviewed: z.enum(["pending", "approved", "rejected"]).default("pending"),
});
export type PendingChange = z.infer<typeof PendingChange>;

export const CampaignState = z.object({
  schemaVersion: z.literal(1),
  meta: z.object({
    id: z.string(),
    name: z.string(),
    mode: z.enum(["gigs", "campaign"]),
    createdAt: z.number(),
    lastPlayedAt: z.number(),
    inGameDate: z.string().default(""),
  }),
  character: CharacterSheet,
  world: z.object({
    currentLocation: z.string().default(""),
    knownLocations: z.array(KnownLocation).default([]),
    npcs: z.array(WorldNpc).default([]),
    factions: z.array(Faction).default([]),
  }),
  questLog: z.array(QuestEntry).default([]),
  campaignBible: CampaignBible.optional(),
  sessionLog: z.array(SessionLogEntry).default([]),
  pendingChangeset: z.array(PendingChange).default([]),
  /** Set while a turn is suspended waiting for the player's physical roll. */
  pendingPlayerRoll: z
    .object({
      toolUseId: z.string(),
      prompt: z.string(),
      statPair: z.string(),
      pw: z.number(),
      diceInstruction: z.string(),
      dv: z.number().nullable(),
    })
    .nullable()
    .default(null),
  /** Raw Anthropic message history for the current turn, persisted only while
   *  the turn is suspended on a pending player roll so it can be resumed. */
  pendingTurnMessages: z.array(z.any()).nullable().default(null),
  /** Rolling window of recent turns' Anthropic messages. Older turns are
   *  compressed into durable facts (§5.3) and dropped from here. */
  transcript: z.array(z.any()).default([]),
  /** Turns since the last fact-compression pass. */
  turnsSinceCompression: z.number().default(0),
});
export type CampaignState = z.infer<typeof CampaignState>;

export function newCampaignState(args: {
  id: string;
  name: string;
  mode: "gigs" | "campaign";
  character: CharacterSheet;
}): CampaignState {
  const now = Date.now();
  return CampaignState.parse({
    schemaVersion: 1,
    meta: { id: args.id, name: args.name, mode: args.mode, createdAt: now, lastPlayedAt: now, inGameDate: "" },
    character: args.character,
    world: { currentLocation: "", knownLocations: [], npcs: [], factions: [] },
    questLog: [],
    sessionLog: [],
    pendingChangeset: [],
    pendingPlayerRoll: null,
    pendingTurnMessages: null,
    transcript: [],
    turnsSinceCompression: 0,
  });
}
