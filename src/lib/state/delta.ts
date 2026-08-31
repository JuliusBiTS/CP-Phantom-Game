/**
 * Structured state delta — SOLO_MODE_BUILD_PLAN.md §5.2 steps 5–6.
 *
 * The model returns this ALONGSIDE its narration, as structured data, in the
 * same turn. We never parse narration text afterwards to guess what changed.
 * The backend then applies the delta to *this campaign's own* Campaign State
 * (never CP Phantom's live data — that path is the GM-gated changeset, §5.4).
 */

import { z } from "zod";
import type { CampaignState } from "./campaignState";

export const TurnDelta = z.object({
  /** HP change to the PC (negative = damage). Clamped to [0, hp_max]. */
  pcHpChange: z.number().optional(),
  pcStaminaChange: z.number().optional(),
  pcIpChange: z.number().optional(),
  pcHumanityChange: z.number().optional(),
  /** Status effects added to / removed from the PC by name. */
  addStatusEffects: z.array(z.string()).optional(),
  removeStatusEffects: z.array(z.string()).optional(),

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

  inGameDate: z.string().optional(),
});
export type TurnDelta = z.infer<typeof TurnDelta>;

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
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
    const effects: Array<{ name?: string; type?: string }> = Array.isArray(c.status_effects)
      ? c.status_effects
      : [];
    const remove = new Set((delta.removeStatusEffects ?? []).map((x) => x.toLowerCase()));
    const kept = effects.filter((e) => !remove.has(String(e.name ?? e.type ?? "").toLowerCase()));
    for (const name of delta.addStatusEffects ?? []) {
      if (!kept.some((e) => String(e.name ?? e.type ?? "").toLowerCase() === name.toLowerCase())) {
        kept.push({ name });
      }
    }
    c.status_effects = kept;
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
  s.meta.lastPlayedAt = Date.now();
  return s;
}
