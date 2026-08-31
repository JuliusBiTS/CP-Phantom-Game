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
    /** Portrait — a downscaled data URL (FEATURE_PLAN §M5). */
    portrait: z.string().optional(),
    /** Critical injuries — rulebook §13. Persist between sessions; don't heal on rest. */
    criticalInjuries: z
      .array(
        z.object({
          id: z.string(),
          table: z.enum(["body", "head"]),
          roll: z.number(),
          name: z.string(),
          effect: z.string(),
          fullFix: z.string().default(""),
          treatment: z.enum(["untreated", "quick-fixed", "healed"]).default("untreated"),
        }),
      )
      .optional(),
    /** Base Death Save penalty (§14.2), raised permanently by some critical injuries. */
    deathSavePenalty: z.number().optional(),
    /** Cyberware install / cyberpsychosis — §21. */
    lifestyle: z
      .object({
        tier: z.enum(["street", "cheap", "decent", "corpo"]).default("cheap"),
        rentPerMonth: z.number().default(0),
        paidThroughDay: z.number().default(0),
      })
      .optional(),
    debts: z
      .array(z.object({ id: z.string(), to: z.string(), amount: z.number(), note: z.string().default(""), dueDay: z.number().optional() }))
      .optional(),
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
  /** Portrait — a downscaled data URL (FEATURE_PLAN §M5). */
  portrait: z.string().optional(),
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

/** Structured combat state — SOLO_MODE_BUILD_PLAN.md §12 Phase 3. Everything
 *  tracked: initiative order, round, whose turn, per-target range/cover, ammo. */
export const CombatCombatant = z.object({
  id: z.string(), // "PC" for the player, else the world.npcs id
  name: z.string(),
  isPC: z.boolean(),
  /** FEATURE_PLAN §M6 — allies roll initiative and take turns too. */
  role: z.enum(["pc", "enemy", "ally", "neutral"]).default("enemy"),
  initiative: z.number(),
  initiativeOutcome: z.string(),
  /** Cover from the direction of incoming fire — v12 §18 (binary: behind or not). */
  cover: z.enum(["none", "behind"]).default("none"),
  coverMaterial: z.string().optional(),
  coverHp: z.number().nullable().default(null),
  /** Range in metres from the PC (for the PC's own attacks; NPC↔NPC is GM-narrated). */
  rangeFromPcM: z.number().nullable().default(null),
  /** Zone this combatant is in (FEATURE_PLAN §M6 zone map). */
  zoneId: z.string().nullable().default(null),
  /** GM's committed plan for this combatant this round (§M6 enemy intent). */
  intent: z.string().optional(),
});

/** A named area in the theater-of-mind zone map (§M6). */
export const CombatZone = z.object({
  id: z.string(),
  name: z.string(),
  note: z.string().optional(),
  coverMaterial: z.string().optional(),
});

/** An armed overwatch / Feuerbereitschaft (§4 / §7.5). */
export const Overwatch = z.object({
  id: z.string(),
  combatantId: z.string(),
  trigger: z.string(),
  weapon: z.string().optional(),
});

export const Combat = z.object({
  active: z.boolean().default(false),
  round: z.number().default(1),
  /** Index into `order` whose turn it is. */
  turnIndex: z.number().default(0),
  order: z.array(CombatCombatant).default([]),
  /** NPC id the PC is currently targeting. */
  pcTargetId: z.string().nullable().default(null),
  /** For "repeat last attack". */
  lastPcAction: z
    .object({ weapon: z.string(), mode: z.string(), targetId: z.string().nullable() })
    .nullable()
    .default(null),
  zones: z.array(CombatZone).default([]),
  overwatch: z.array(Overwatch).default([]),
  /** The PC's once-per-fight Flink (§4). */
  flinkUsed: z.boolean().default(false),
});
export type Combat = z.infer<typeof Combat>;

/** Mission Board — the "case wall" of intel windows. SOLO_MODE_BUILD_PLAN.md §13.
 *  Mostly a view over world.npcs / knownLocations / questLog / factions; this
 *  holds only layout + GM pins + player annotations + link graph. */
export const BoardWindowKind = z.enum(["dossier", "objective", "location", "faction", "note", "connections", "bible"]);

export const BoardWindow = z.object({
  id: z.string(),
  kind: BoardWindowKind,
  /** npc id / quest id / location name / faction name; null for note/connections/bible. */
  refId: z.string().nullable().default(null),
  x: z.number().default(40),
  y: z.number().default(40),
  w: z.number().default(280),
  h: z.number().default(200),
  z: z.number().default(1),
  collapsed: z.boolean().default(false),
  /** GM-featured ("key intel") — never auto-removed, gets the prominent frame. */
  pinned: z.boolean().default(false),
  /** One-line GM annotation ("the lead — press them on the Militech job"). */
  gmNote: z.string().optional(),
  /** Free player note text (the whole body for kind:"note"; an annotation otherwise). */
  noteText: z.string().default(""),
  createdAt: z.number(),
});

export const BoardLink = z.object({
  id: z.string(),
  from: z.string(), // window id
  to: z.string(),
  label: z.string().optional(),
});

export const MissionBoard = z.object({
  windows: z.array(BoardWindow).default([]),
  links: z.array(BoardLink).default([]),
  /** Quest id of the mission the board is currently framed around. */
  activeMissionQuestId: z.string().nullable().default(null),
  /** For the "NEW since you last looked" highlight. */
  lastOpenedAt: z.number().default(0),
  /** Bumped on mission-start so the UI can replay the blow-up animation once. */
  blowUpAt: z.number().default(0),
});
export type MissionBoard = z.infer<typeof MissionBoard>;

/** A loaded gun — something the PC did that will have a later cost. FEATURE_PLAN §M5.
 *  Distinct from ambient facts: these are tracked to be brought back. */
export const Consequence = z.object({
  id: z.string(),
  text: z.string(),
  severity: z.enum(["minor", "major", "grave"]).default("major"),
  kind: z.enum(["enemy", "debt", "witness", "reputation", "other"]).default("other"),
  refNpcId: z.string().optional(),
  refFactionId: z.string().optional(),
  status: z.enum(["armed", "resolved"]).default("armed"),
  resolvedNote: z.string().optional(),
  createdAt: z.number(),
});
export type Consequence = z.infer<typeof Consequence>;

/** One chronological beat for the timeline view. */
export const TimelineBeat = z.object({
  ts: z.number(),
  inGameDate: z.string().default(""),
  text: z.string(),
});
export type TimelineBeat = z.infer<typeof TimelineBeat>;

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

/** Cumulative Anthropic token spend for this campaign — surfaced as a cost
 *  meter (FEATURE_PLAN.md §1.4). Estimate only; rates live in lib/llm/cost.ts. */
export const Usage = z.object({
  inputTokens: z.number().default(0),
  outputTokens: z.number().default(0),
  cacheReadTokens: z.number().default(0),
  cacheWriteTokens: z.number().default(0),
  /** Player turns taken (one per action, not per model round-trip). */
  turns: z.number().default(0),
});
export type Usage = z.infer<typeof Usage>;

const USAGE_ZERO = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, turns: 0 };

/** Tone dials — FEATURE_PLAN.md §M2. Each 0–3; see lib/llm/tone.ts. */
export const Tone = z.object({
  grit: z.number().min(0).max(3).default(2),
  lethality: z.number().min(0).max(3).default(2),
  gore: z.number().min(0).max(3).default(1),
  romance: z.number().min(0).max(3).default(1),
  wit: z.number().min(0).max(3).default(1),
});
export type Tone = z.infer<typeof Tone>;

const TONE_DEFAULT = { grit: 2, lethality: 2, gore: 1, romance: 1, wit: 1 };

/** One undo point — the whole state (minus its own history) before a turn ran.
 *  FEATURE_PLAN.md §1.3. */
export const HistoryEntry = z.object({
  ts: z.number(),
  label: z.string(),
  snapshot: z.any(),
});
export type HistoryEntry = z.infer<typeof HistoryEntry>;

/** Ambient play loop — FEATURE_PLAN.md §1.1 / §M3. `combat.active` is a
 *  separate layer that visually takes over regardless of `mode`. */
export const Mode = z.enum(["exploration", "downtime", "netrun", "chase"]);
export type Mode = z.infer<typeof Mode>;

/** Downtime bookkeeping — FEATURE_PLAN.md §M3. `daysElapsed` is lifetime, used
 *  later by upkeep / healing / the world clock. */
export const Downtime = z.object({
  daysElapsed: z.number().default(0),
});
export type Downtime = z.infer<typeof Downtime>;

/** NET dive — FEATURE_PLAN.md §M7. Active while `mode === "netrun"`. IP itself
 *  lives on the character sheet (ip_current / ip_max). */
export const NetArchFloor = z.object({
  floor: z.number(),
  name: z.string(),
  kind: z.enum(["passthrough", "file", "control", "ice", "blackwall"]).default("passthrough"),
  ice: z.object({ name: z.string(), firewall: z.number(), effect: z.string(), lethal: z.boolean().optional() }).nullable().default(null),
  loot: z.string().optional(),
  note: z.string().optional(),
  cleared: z.boolean().default(false),
});

/** Vehicle chase — FEATURE_PLAN.md §M8 / rulebook §22.5. Active while
 *  `mode === "chase"`. */
export const ChaseVehicle = z.object({
  id: z.string(),
  name: z.string(),
  template: z.string().default(""),
  role: z.enum(["pc", "ally", "pursuer", "quarry"]).default("pursuer"),
  sdp: z.number(),
  sdpMax: z.number(),
  bodySp: z.number().default(13),
  speed: z.number().default(20),
  seats: z.number().default(4),
  occupants: z.array(z.string()).default([]),
  driver: z.string().optional(),
  disabled: z.boolean().default(false),
});

export const Chase = z.object({
  active: z.boolean().default(false),
  /** §22.5 "Spur" — 0 (pursuer alongside → set-piece) … 6 (shaken / caught). */
  spur: z.number().default(2),
  round: z.number().default(1),
  terrain: z.enum(["highway", "backstreets", "badlands", "combat-zone", "air", "water"]).default("backstreets"),
  /** Is the PC running (spur 6 = escaped) or chasing (spur 6 = caught them)? */
  pcRole: z.enum(["runner", "pursuer"]).default("runner"),
  pursuerTier: z.enum(["standard", "elite"]).default("standard"),
  vehicles: z.array(ChaseVehicle).default([]),
});
export type Chase = z.infer<typeof Chase>;

export const Netrun = z.object({
  active: z.boolean().default(false),
  target: z.string().default(""),
  deck: z.enum(["Basic", "Standard", "Military", "Blackmarket"]).default("Standard"),
  connection: z.enum(["wired", "local", "remote"]).default("local"),
  /** 0–100; NetWatch / the system's runner responds at 100. */
  trace: z.number().default(0),
  /** §25.1 alarm ladder, 0–3. */
  alarm: z.number().default(0),
  architecture: z.array(NetArchFloor).default([]),
  position: z.number().default(0),
  daemons: z.array(z.string()).default([]),
});
export type Netrun = z.infer<typeof Netrun>;

export const CampaignState = z.object({
  schemaVersion: z.literal(1),
  meta: z.object({
    id: z.string(),
    name: z.string(),
    mode: z.enum(["gigs", "campaign"]),
    createdAt: z.number(),
    lastPlayedAt: z.number(),
    inGameDate: z.string().default(""),
    /** CP Phantom `campaign/characters/{id}` key this PC was imported from —
     *  the target for GM-approved push-back (§5.4). null = not imported. */
    importedFromCpPhantomId: z.string().nullable().default(null),
    /** Model that actually ran the turns (from SOLO_MODEL) — for cost estimates. */
    model: z.string().default("claude-sonnet-5"),
    usage: Usage.default(USAGE_ZERO),
    tone: Tone.default(TONE_DEFAULT),
    /** Cached "Previously on…" cold-open + the narration ts it was built from. */
    recap: z.string().default(""),
    recapForTs: z.number().default(0),
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
  missionBoard: MissionBoard.default({ windows: [], links: [], activeMissionQuestId: null, lastOpenedAt: 0, blowUpAt: 0 }),
  combat: Combat.default({ active: false, round: 1, turnIndex: 0, order: [], pcTargetId: null, lastPcAction: null, zones: [], overwatch: [], flinkUsed: false }),
  mode: Mode.default("exploration"),
  downtime: Downtime.default({ daysElapsed: 0 }),
  netrun: Netrun.default({ active: false, target: "", deck: "Standard", connection: "local", trace: 0, alarm: 0, architecture: [], position: 0, daemons: [] }),
  chase: Chase.default({ active: false, spur: 2, round: 1, terrain: "backstreets", pcRole: "runner", pursuerTier: "standard", vehicles: [] }),
  consequences: z.array(Consequence).default([]),
  timeline: z.array(TimelineBeat).default([]),
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
      /** "action" = normal PC roll; "initiative" = resume builds the turn order. */
      kind: z.enum(["action", "initiative"]).default("action"),
    })
    .nullable()
    .default(null),
  /** NPC initiative rolls held while the PC rolls theirs (combat start). */
  pendingInitiative: z.any().nullable().default(null),
  /** Raw Anthropic message history for the current turn, persisted only while
   *  the turn is suspended on a pending player roll so it can be resumed. */
  pendingTurnMessages: z.array(z.any()).nullable().default(null),
  /** Rolling window of recent turns' Anthropic messages. Older turns are
   *  compressed into durable facts (§5.3) and dropped from here. */
  transcript: z.array(z.any()).default([]),
  /** Turns since the last fact-compression pass. */
  turnsSinceCompression: z.number().default(0),
  /** GM-offered "you could…" options, refreshed every turn. FEATURE_PLAN.md §M1. */
  suggestedActions: z.array(z.string()).default([]),
  /** Undo ring — newest last, capped in lib/state/history.ts. FEATURE_PLAN.md §1.3. */
  history: z.array(HistoryEntry).default([]),
});
export type CampaignState = z.infer<typeof CampaignState>;

export function newCampaignState(args: {
  id: string;
  name: string;
  mode: "gigs" | "campaign";
  character: CharacterSheet;
  importedFromCpPhantomId?: string | null;
}): CampaignState {
  const now = Date.now();
  return CampaignState.parse({
    schemaVersion: 1,
    meta: {
      id: args.id,
      name: args.name,
      mode: args.mode,
      createdAt: now,
      lastPlayedAt: now,
      inGameDate: "",
      importedFromCpPhantomId: args.importedFromCpPhantomId ?? null,
      model: "claude-sonnet-5",
      usage: USAGE_ZERO,
      tone: TONE_DEFAULT,
      recap: "",
      recapForTs: 0,
    },
    character: args.character,
    world: { currentLocation: "", knownLocations: [], npcs: [], factions: [] },
    questLog: [],
    missionBoard: { windows: [], links: [], activeMissionQuestId: null, lastOpenedAt: 0, blowUpAt: 0 },
    combat: { active: false, round: 1, turnIndex: 0, order: [], pcTargetId: null, lastPcAction: null, zones: [], overwatch: [], flinkUsed: false },
    mode: "exploration",
    downtime: { daysElapsed: 0 },
    netrun: { active: false, target: "", deck: "Standard", connection: "local", trace: 0, alarm: 0, architecture: [], position: 0, daemons: [] },
    chase: { active: false, spur: 2, round: 1, terrain: "backstreets", pcRole: "runner", pursuerTier: "standard", vehicles: [] },
    consequences: [],
    timeline: [],
    sessionLog: [],
    pendingChangeset: [],
    pendingPlayerRoll: null,
    pendingInitiative: null,
    pendingTurnMessages: null,
    transcript: [],
    turnsSinceCompression: 0,
    suggestedActions: [],
    history: [],
  });
}
