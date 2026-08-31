/**
 * Structured state delta — SOLO_MODE_BUILD_PLAN.md §5.2 steps 5–6.
 *
 * The model returns this ALONGSIDE its narration, as structured data, in the
 * same turn. We never parse narration text afterwards to guess what changed.
 * The backend then applies the delta to *this campaign's own* Campaign State
 * (never CP Phantom's live data — that path is the GM-gated changeset, §5.4).
 */

import { z } from "zod";
import type { CampaignState, MissionBoard } from "./campaignState";
import { applyAutoStatusEffect, tickCombatant, type StatusEffect, type StatusSpec } from "../rules/statusEffects";
import { matchWeaponName } from "../rules/live";
import { autoLayoutBoard, syncBoard } from "../board/layout";

export const TurnDelta = z.object({
  /** HP change to the PC (negative = damage). Clamped to [0, hp_max]. */
  pcHpChange: z.number().optional(),
  pcStaminaChange: z.number().optional(),
  pcIpChange: z.number().optional(),
  pcHumanityChange: z.number().optional(),
  /** Status effects added to / removed from the PC. A string is a bare name;
   *  an object carries the mechanical spec (type drives DoT: bleed/burn/poison). */
  addStatusEffects: z.array(z.union([z.string(), z.record(z.string(), z.any())])).optional(),
  removeStatusEffects: z.array(z.string()).optional(),

  /** Combat: per-NPC HP + status, tracked exactly like the PC (§ "no
   *  hallucinations in fights"). id = the world.npcs id. */
  npcHpChanges: z
    .array(z.object({ id: z.string(), hpChange: z.number(), staminaChange: z.number().optional() }))
    .optional(),
  npcStatusEffects: z
    .array(
      z.object({
        id: z.string(),
        add: z.array(z.union([z.string(), z.record(z.string(), z.any())])).optional(),
        remove: z.array(z.string()).optional(),
      }),
    )
    .optional(),

  /** Combat structure updates. `round` incremented → backend ticks DoT/regen. */
  combat: z
    .object({
      turnIndex: z.number().optional(),
      round: z.number().optional(),
      removeCombatantIds: z.array(z.string()).optional(),
      end: z.boolean().optional(),
    })
    .optional(),

  moveToLocation: z.string().optional(),
  addKnownLocation: z
    .object({ name: z.string(), description: z.string().default("") })
    .optional(),

  /** Upsert NPCs by id — merges facts, disposition, status, cached sheet. */
  upsertNpcs: z
    .array(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        disposition: z.string().optional(),
        status: z.enum(["alive", "dead", "unknown"]).optional(),
        addFacts: z.array(z.string()).optional(),
        sheet: z.any().optional(),
      }),
    )
    .optional(),

  upsertFactions: z
    .array(
      z.object({
        name: z.string(),
        standingWithPC: z.string().optional(),
        addFacts: z.array(z.string()).optional(),
      }),
    )
    .optional(),

  upsertQuests: z
    .array(
      z.object({
        id: z.string(),
        title: z.string().optional(),
        status: z.enum(["active", "completed", "failed"]).optional(),
        summary: z.string().optional(),
        setFlags: z.record(z.string(), z.any()).optional(),
      }),
    )
    .optional(),

  /** Twist ids from the campaign bible that were delivered this turn. */
  twistsDelivered: z.array(z.number()).optional(),

  /** New entries for the GM push-back queue — never auto-applied to CP Phantom. */
  pendingChanges: z
    .array(
      z.object({
        kind: z.enum(["xp", "loot", "injury", "humanity", "talent", "note", "other"]),
        label: z.string(),
        patch: z.record(z.string(), z.any()).optional(),
      }),
    )
    .optional(),

  /** Ammo — tracked, not narrated. Rounds spent this turn per weapon (autofire
   *  = 2), and weapons reloaded (magazine refills to max). */
  pcAmmoSpent: z.array(z.object({ weapon: z.string(), rounds: z.number() })).optional(),
  pcReload: z.array(z.string()).optional(),

  /** Mission Board — SOLO_MODE_BUILD_PLAN.md §13. Facts/NPCs/locations flow
   *  through the fields above and appear on the board automatically; this is
   *  just the extra signals. */
  missionBoard: z
    .object({
      /** "mission-start" triggers the auto-layout blow-up around focusQuestId. */
      event: z.enum(["mission-start", "mission-end"]).optional(),
      focusQuestId: z.string().optional(),
      /** Feature specific intel as a prominent, never-auto-tidied window. */
      pin: z
        .array(
          z.object({
            kind: z.enum(["dossier", "objective", "location", "faction", "note"]),
            refId: z.string().optional(),
            note: z.string().optional(),
          }),
        )
        .optional(),
      /** Red-string connections between windows, resolved from kind+refId. */
      addLinks: z
        .array(
          z.object({
            fromKind: z.enum(["dossier", "objective", "location", "faction"]),
            fromRefId: z.string(),
            toKind: z.enum(["dossier", "objective", "location", "faction"]),
            toRefId: z.string(),
            label: z.string().optional(),
          }),
        )
        .optional(),
    })
    .optional(),

  inGameDate: z.string().optional(),
});
export type TurnDelta = z.infer<typeof TurnDelta>;

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

/** Normalise a delta status entry (string | spec object) into a StatusSpec. */
function toSpec(entry: string | Record<string, unknown>): StatusSpec {
  if (typeof entry === "string") {
    const type = entry.toLowerCase().split(/\s|\(/)[0];
    return { type, name: entry, rounds: -1 };
  }
  const e = entry as Record<string, unknown>;
  return {
    type: String(e.type ?? e.name ?? "effect").toLowerCase(),
    name: String(e.name ?? e.type ?? "effect"),
    rounds: typeof e.rounds === "number" ? e.rounds : -1,
    ...(typeof e.stacks === "number" ? { stacks: e.stacks } : {}),
    ...(typeof e.maxStacks === "number" ? { maxStacks: e.maxStacks } : {}),
  };
}

function mutateStatus(
  current: unknown,
  add?: Array<string | Record<string, unknown>>,
  remove?: string[],
): StatusEffect[] {
  let effects: StatusEffect[] = Array.isArray(current) ? (current as StatusEffect[]) : [];
  if (remove?.length) {
    const rm = new Set(remove.map((x) => x.toLowerCase()));
    effects = effects.filter(
      (e) => !rm.has(String(e.name ?? "").toLowerCase()) && !rm.has(String(e.type ?? "").toLowerCase()),
    );
  }
  for (const entry of add ?? []) effects = applyAutoStatusEffect(effects, toSpec(entry));
  return effects;
}

/** Pure: returns a new state with the delta applied. */
export function applyDelta(state: CampaignState, delta: TurnDelta): CampaignState {
  const s: CampaignState = structuredClone(state);
  const c = s.character;

  if (delta.pcHpChange != null && c.hp_max != null) {
    c.hp_current = clamp((c.hp_current ?? c.hp_max) + delta.pcHpChange, 0, c.hp_max);
  }
  if (delta.pcStaminaChange != null && c.stamina_max != null) {
    c.stamina_current = clamp((c.stamina_current ?? c.stamina_max) + delta.pcStaminaChange, 0, c.stamina_max);
  }
  if (delta.pcIpChange != null && c.ip_max != null) {
    c.ip_current = clamp((c.ip_current ?? c.ip_max) + delta.pcIpChange, 0, c.ip_max);
  }
  if (delta.pcHumanityChange != null && c.humanity_max != null) {
    c.humanity_current = clamp((c.humanity_current ?? c.humanity_max) + delta.pcHumanityChange, 0, c.humanity_max);
  }

  if (delta.addStatusEffects?.length || delta.removeStatusEffects?.length) {
    c.status_effects = mutateStatus(c.status_effects, delta.addStatusEffects, delta.removeStatusEffects);
  }

  // ── Combat: NPC HP + status, tracked like the PC ──────────────────────────
  const npcById = (id: string) => s.world.npcs.find((n) => n.id === id);
  for (const ch of delta.npcHpChanges ?? []) {
    const npc = npcById(ch.id);
    const sheet = npc?.sheet as { hp_max?: number; hp_current?: number; stamina_max?: number; stamina_current?: number } | undefined;
    if (!sheet?.hp_max) continue;
    sheet.hp_current = Math.max(-((npc!.sheet as { stats?: Record<string, number> })?.stats?.grit ?? 0), Math.min(sheet.hp_max, (sheet.hp_current ?? sheet.hp_max) + ch.hpChange));
    if (ch.staminaChange != null && sheet.stamina_max != null) {
      sheet.stamina_current = clamp((sheet.stamina_current ?? sheet.stamina_max) + ch.staminaChange, 0, sheet.stamina_max);
    }
    if (npc && sheet.hp_current <= 0) npc.status = "dead";
  }
  for (const se of delta.npcStatusEffects ?? []) {
    const npc = npcById(se.id);
    if (!npc?.sheet) continue;
    (npc.sheet as { status_effects?: unknown }).status_effects = mutateStatus(
      (npc.sheet as { status_effects?: unknown }).status_effects,
      se.add,
      se.remove,
    );
  }

  // ── Combat structure + deterministic round tick ──────────────────────────
  if (delta.combat) {
    const combat = s.combat;
    if (delta.combat.end) {
      combat.active = false;
      combat.order = [];
      combat.pcTargetId = null;
      combat.lastPcAction = null;
    } else {
      if (delta.combat.removeCombatantIds?.length) {
        const rm = new Set(delta.combat.removeCombatantIds);
        combat.order = combat.order.filter((o) => !rm.has(o.id));
      }
      if (delta.combat.turnIndex != null && combat.order.length) {
        combat.turnIndex = ((delta.combat.turnIndex % combat.order.length) + combat.order.length) % combat.order.length;
      }
      if (delta.combat.round != null && delta.combat.round > combat.round) {
        const roundsPassed = delta.combat.round - combat.round;
        combat.round = delta.combat.round;
        for (let r = 0; r < roundsPassed; r++) {
          for (const entry of combat.order) {
            const target =
              entry.id === "PC"
                ? (c as Parameters<typeof tickCombatant>[0])
                : (npcById(entry.id)?.sheet as Parameters<typeof tickCombatant>[0] | undefined);
            if (!target) continue;
            const res = tickCombatant(target, entry.name);
            target.hp_current = res.hp_current;
            target.stamina_current = res.stamina_current;
            if (target.ip_current != null || res.ip_current) target.ip_current = res.ip_current;
            target.status_effects = res.status_effects;
            for (const line of res.log) {
              s.sessionLog.push({ ts: Date.now(), type: "system", text: `Round tick — ${line}`, compressed: false });
            }
            const npc = npcById(entry.id);
            if (npc && (target.hp_current ?? 1) <= 0) npc.status = "dead";
          }
        }
      }
    }
  }

  // ── Ammo ────────────────────────────────────────────────────────────────
  if (delta.pcAmmoSpent?.length || delta.pcReload?.length) {
    const weapons = Array.isArray(c.weapons) ? (c.weapons as Array<{ name?: string; magCurrent?: number }>) : [];
    const maxMag = (name?: string) => matchWeaponName(name ?? "")?.mag;
    for (const spent of delta.pcAmmoSpent ?? []) {
      const w = weapons.find((x) => x.name?.toLowerCase() === spent.weapon.toLowerCase());
      const max = maxMag(w?.name);
      if (w && max != null) {
        w.magCurrent = Math.max(0, (w.magCurrent ?? max) - spent.rounds);
      }
    }
    for (const name of delta.pcReload ?? []) {
      const w = weapons.find((x) => x.name?.toLowerCase() === name.toLowerCase());
      const max = maxMag(w?.name);
      if (w && max != null) w.magCurrent = max;
    }
  }

  if (delta.moveToLocation) s.world.currentLocation = delta.moveToLocation;
  if (delta.addKnownLocation) {
    const exists = s.world.knownLocations.find((l) => l.name === delta.addKnownLocation!.name);
    if (!exists) {
      s.world.knownLocations.push({
        name: delta.addKnownLocation.name,
        description: delta.addKnownLocation.description ?? "",
        notableFacts: [],
      });
    }
  }

  for (const up of delta.upsertNpcs ?? []) {
    let npc = s.world.npcs.find((n) => n.id === up.id);
    if (!npc) {
      npc = { id: up.id, name: up.name ?? up.id, disposition: "unknown", status: "alive", notableFacts: [] };
      s.world.npcs.push(npc);
    }
    if (up.name) npc.name = up.name;
    if (up.disposition) npc.disposition = up.disposition;
    if (up.status) npc.status = up.status;
    if (up.sheet) npc.sheet = up.sheet;
    for (const f of up.addFacts ?? []) if (!npc.notableFacts.includes(f)) npc.notableFacts.push(f);
  }

  for (const up of delta.upsertFactions ?? []) {
    let fac = s.world.factions.find((f) => f.name === up.name);
    if (!fac) {
      fac = { name: up.name, standingWithPC: "neutral", notableFacts: [] };
      s.world.factions.push(fac);
    }
    if (up.standingWithPC) fac.standingWithPC = up.standingWithPC;
    for (const f of up.addFacts ?? []) if (!fac.notableFacts.includes(f)) fac.notableFacts.push(f);
  }

  for (const up of delta.upsertQuests ?? []) {
    let q = s.questLog.find((x) => x.id === up.id);
    if (!q) {
      q = { id: up.id, title: up.title ?? up.id, status: "active", summary: "", flags: {} };
      s.questLog.push(q);
    }
    if (up.title) q.title = up.title;
    if (up.status) q.status = up.status;
    if (up.summary) q.summary = up.summary;
    if (up.setFlags) q.flags = { ...q.flags, ...up.setFlags };
  }

  if (delta.twistsDelivered?.length && s.campaignBible) {
    for (const i of delta.twistsDelivered) {
      if (s.campaignBible.plantedTwists[i]) s.campaignBible.plantedTwists[i].delivered = true;
    }
  }

  for (const pc of delta.pendingChanges ?? []) {
    s.pendingChangeset.push({
      id: `pc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      kind: pc.kind,
      label: pc.label,
      patch: pc.patch,
      createdAt: Date.now(),
      reviewed: "pending",
    });
  }

  if (delta.inGameDate) s.meta.inGameDate = delta.inGameDate;

  // ── Mission Board ────────────────────────────────────────────────────────
  applyBoardDelta(s, delta.missionBoard);
  s.missionBoard = syncBoard(s); // spawn windows for anything newly mentioned

  s.meta.lastPlayedAt = Date.now();
  return s;
}

type BoardKind = MissionBoard["windows"][number]["kind"];

function ensureBoardWindow(board: MissionBoard, kind: BoardKind, refId: string | null): MissionBoard["windows"][number] {
  let w = board.windows.find((x) => x.kind === kind && x.refId === refId);
  if (!w) {
    const n = board.windows.length;
    w = {
      id: `w_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      kind,
      refId,
      x: 24 + (n % 3) * 324,
      y: 24 + Math.floor(n / 3) * 234,
      w: 300,
      h: 210,
      z: 1,
      collapsed: false,
      pinned: false,
      noteText: "",
      createdAt: Date.now(),
    };
    board.windows.push(w);
  }
  return w;
}

function applyBoardDelta(s: CampaignState, mb: TurnDelta["missionBoard"]): void {
  if (!mb) return;

  if (mb.event === "mission-start") {
    s.missionBoard = autoLayoutBoard(s, mb.focusQuestId ?? null);
  } else if (mb.event === "mission-end") {
    s.missionBoard.activeMissionQuestId = null;
  }

  for (const p of mb.pin ?? []) {
    const w = ensureBoardWindow(s.missionBoard, p.kind, p.refId ?? null);
    w.pinned = true;
    if (p.note) w.gmNote = p.note;
  }

  for (const l of mb.addLinks ?? []) {
    const a = ensureBoardWindow(s.missionBoard, l.fromKind, l.fromRefId);
    const b = ensureBoardWindow(s.missionBoard, l.toKind, l.toRefId);
    if (!s.missionBoard.links.some((x) => (x.from === a.id && x.to === b.id) || (x.from === b.id && x.to === a.id))) {
      s.missionBoard.links.push({ id: `lk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`, from: a.id, to: b.id, label: l.label });
    }
  }
}
