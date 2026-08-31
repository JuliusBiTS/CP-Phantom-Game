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
import { critInjuryRow } from "../rules/criticalInjuries";
import { coverHpFor } from "../rules/cover";
import { CYBERDECK_INFO, TRACE_CAP } from "../rules/net";
import { SPUR_MIN, SPUR_MAX } from "../rules/vehicles";

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
      /** §M6 enemy intent — set at the top of each round. */
      intents: z.array(z.object({ combatantId: z.string(), intent: z.string() })).optional(),
      /** §M6 zone map — replace the zone list / move combatants between zones. */
      zones: z.array(z.object({ id: z.string(), name: z.string(), note: z.string().optional(), coverMaterial: z.string().optional() })).optional(),
      moves: z.array(z.object({ combatantId: z.string(), toZoneId: z.string() })).optional(),
      /** §18 cover HP — set a combatant's cover material (hp auto-filled from the
       *  §18.2 table if omitted) and shoot it down. */
      setCover: z.array(z.object({ combatantId: z.string(), material: z.string().nullable(), thickness: z.enum(["thick", "thin"]).optional(), hp: z.number().optional() })).optional(),
      coverDamage: z.array(z.object({ combatantId: z.string(), amount: z.number() })).optional(),
      /** §4 / §7.5 interrupt economy. */
      overwatch: z
        .object({
          set: z.array(z.object({ combatantId: z.string(), trigger: z.string(), weapon: z.string().optional() })).optional(),
          clearIds: z.array(z.string()).optional(),
        })
        .optional(),
      flinkUsed: z.boolean().optional(),
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

  /** 2–3 concrete "you could…" options for the player, from the current fiction.
   *  Replaces the previous set each turn. FEATURE_PLAN.md §M1. */
  suggestedActions: z.array(z.string()).max(4).optional(),

  /** Switch the ambient play loop. FEATURE_PLAN.md §M3. */
  mode: z
    .object({
      enter: z.enum(["exploration", "downtime", "netrun", "chase"]).optional(),
      exit: z.boolean().optional(),
    })
    .optional(),

  /** NET dive updates — FEATURE_PLAN.md §M7. */
  netrun: z
    .object({
      move: z.number().optional(),
      clearFloor: z.number().optional(),
      ipChange: z.number().optional(),
      traceChange: z.number().optional(),
      alarmChange: z.number().optional(),
      addDaemon: z.string().optional(),
      removeDaemon: z.string().optional(),
      loot: z.array(z.string()).optional(),
      exit: z.boolean().optional(),
    })
    .optional(),

  /** Vehicle chase updates — FEATURE_PLAN.md §M8 / §22.5. */
  chase: z
    .object({
      spurChange: z.number().optional(),
      round: z.number().optional(),
      terrainChange: z.enum(["highway", "backstreets", "badlands", "combat-zone", "air", "water"]).optional(),
      vehicleDamage: z.array(z.object({ id: z.string(), amount: z.number() })).optional(),
      outcome: z.enum(["escaped", "caught", "crashed"]).optional(),
      exit: z.boolean().optional(),
    })
    .optional(),
  /** Days that passed this beat (downtime). Accrues on downtime.daysElapsed. */
  advanceDays: z.number().optional(),

  /** Critical-injury treatment (§13.4). Injuries are ADDED by the
   *  roll_critical_injury tool, not here — this only records treatment. */
  pcCriticalInjury: z
    .object({
      treatId: z.string(),
      to: z.enum(["quick-fixed", "healed"]),
    })
    .optional(),

  /** Cyberware installed this beat (§21). Appends to cyberware[] and drops
   *  current Humanity by the impact. */
  installCyberware: z.object({ name: z.string(), humanityLoss: z.number().optional() }).optional(),

  /** Consequences ledger — FEATURE_PLAN §M5. Record a loaded gun; bring it back later. */
  consequences: z
    .object({
      add: z
        .array(
          z.object({
            text: z.string(),
            severity: z.enum(["minor", "major", "grave"]).optional(),
            kind: z.enum(["enemy", "debt", "witness", "reputation", "other"]).optional(),
            refNpcId: z.string().optional(),
            refFactionId: z.string().optional(),
          }),
        )
        .optional(),
      resolveId: z.string().optional(),
      resolveNote: z.string().optional(),
      escalateId: z.string().optional(),
    })
    .optional(),

  /** One line for the timeline view — "Met Rook. Took the Diaz gig." */
  timelineBeat: z.string().optional(),

  /** Money / lifestyle (house rule — see FEATURE_PLAN §M4). */
  economy: z
    .object({
      eddieChange: z.number().optional(),
      setLifestyle: z.object({ tier: z.enum(["street", "cheap", "decent", "corpo"]).optional(), rentPerMonth: z.number().optional() }).optional(),
      addDebt: z.object({ to: z.string(), amount: z.number(), note: z.string().optional(), dueDay: z.number().optional() }).optional(),
      clearDebtId: z.string().optional(),
    })
    .optional(),
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
    const dc = delta.combat;
    const cbById = (id: string) => combat.order.find((o) => o.id === id);
    if (dc.end) {
      combat.active = false;
      combat.order = [];
      combat.pcTargetId = null;
      combat.lastPcAction = null;
      combat.zones = [];
      combat.overwatch = [];
      combat.flinkUsed = false;
    } else {
      // §M6 zone map
      if (dc.zones) combat.zones = dc.zones.map((z) => ({ id: z.id, name: z.name, note: z.note, coverMaterial: z.coverMaterial }));
      for (const mv of dc.moves ?? []) {
        const cb = cbById(mv.combatantId);
        if (cb) cb.zoneId = mv.toZoneId;
      }
      // §M6 enemy intent
      for (const it of dc.intents ?? []) {
        const cb = cbById(it.combatantId);
        if (cb) cb.intent = it.intent;
      }
      // §18 cover HP
      for (const sc of dc.setCover ?? []) {
        const cb = cbById(sc.combatantId);
        if (!cb) continue;
        if (sc.material == null) {
          cb.coverMaterial = undefined;
          cb.coverHp = null;
          cb.cover = "none";
        } else {
          cb.coverMaterial = sc.material;
          cb.coverHp = sc.hp ?? coverHpFor(sc.material, sc.thickness ?? "thick");
          cb.cover = "behind";
        }
      }
      for (const cd of dc.coverDamage ?? []) {
        const cb = cbById(cd.combatantId);
        if (!cb || cb.coverHp == null) continue;
        cb.coverHp = Math.max(0, cb.coverHp - Math.max(0, cd.amount));
        if (cb.coverHp === 0) {
          s.sessionLog.push({ ts: Date.now(), type: "system", text: `${cb.name}'s cover (${cb.coverMaterial}) is shot to pieces.`, compressed: false });
          cb.coverMaterial = undefined;
          cb.coverHp = null;
          cb.cover = "none";
        }
      }
      // §4 / §7.5 interrupt economy
      if (dc.overwatch?.set) {
        for (const ow of dc.overwatch.set) {
          combat.overwatch.push({ id: `ow_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`, combatantId: ow.combatantId, trigger: ow.trigger, weapon: ow.weapon });
        }
      }
      if (dc.overwatch?.clearIds?.length) {
        const rm = new Set(dc.overwatch.clearIds);
        combat.overwatch = combat.overwatch.filter((o) => !rm.has(o.id) && !rm.has(o.combatantId));
      }
      if (dc.flinkUsed != null) combat.flinkUsed = dc.flinkUsed;

      if (dc.removeCombatantIds?.length) {
        const rm = new Set(dc.removeCombatantIds);
        combat.order = combat.order.filter((o) => !rm.has(o.id));
        combat.overwatch = combat.overwatch.filter((o) => !rm.has(o.combatantId));
      }
      if (dc.turnIndex != null && combat.order.length) {
        combat.turnIndex = ((dc.turnIndex % combat.order.length) + combat.order.length) % combat.order.length;
      }
      if (dc.round != null && dc.round > combat.round) {
        const roundsPassed = dc.round - combat.round;
        combat.round = dc.round;
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
  if (delta.suggestedActions) s.suggestedActions = delta.suggestedActions.slice(0, 4);

  // ── Consequences ledger ────────────────────────────────────────────────
  if (delta.consequences) {
    const cq = delta.consequences;
    for (const a of cq.add ?? []) {
      s.consequences.push({
        id: `cq_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        text: a.text,
        severity: a.severity ?? "major",
        kind: a.kind ?? "other",
        refNpcId: a.refNpcId,
        refFactionId: a.refFactionId,
        status: "armed",
        createdAt: Date.now(),
      });
    }
    if (cq.resolveId) {
      const q = s.consequences.find((x) => x.id === cq.resolveId);
      if (q) {
        q.status = "resolved";
        if (cq.resolveNote) q.resolvedNote = cq.resolveNote;
      }
    }
    if (cq.escalateId) {
      const q = s.consequences.find((x) => x.id === cq.escalateId);
      if (q) q.severity = q.severity === "minor" ? "major" : "grave";
    }
  }

  // ── Timeline ───────────────────────────────────────────────────────────
  if (delta.timelineBeat) {
    s.timeline.push({ ts: Date.now(), inGameDate: s.meta.inGameDate, text: delta.timelineBeat });
  }

  // ── Critical-injury treatment (§13.4) ──────────────────────────────────
  if (delta.pcCriticalInjury) {
    const ci = (c.criticalInjuries ?? []).find((x) => x.id === delta.pcCriticalInjury!.treatId);
    if (ci) {
      ci.treatment = delta.pcCriticalInjury.to;
      if (delta.pcCriticalInjury.to === "healed") {
        // Refund any Death Save penalty this injury added.
        const row = critInjuryRow(ci.table, ci.roll);
        if (row.deathSavePenalty) c.deathSavePenalty = Math.max(0, (c.deathSavePenalty ?? 0) - row.deathSavePenalty);
      }
      s.sessionLog.push({ ts: Date.now(), type: "system", text: `Critical injury ${ci.name} — ${ci.treatment}.`, compressed: false });
    }
  }

  // ── Cyberware install (§21) ─────────────────────────────────────────────
  if (delta.installCyberware) {
    c.cyberware = [...(c.cyberware ?? []), delta.installCyberware.name];
    const loss = delta.installCyberware.humanityLoss ?? 0;
    if (loss > 0 && c.humanity_current != null) {
      c.humanity_current = Math.max(0, c.humanity_current - loss);
    }
    s.sessionLog.push({
      ts: Date.now(),
      type: "system",
      text: `Installed ${delta.installCyberware.name}${loss ? ` (−${loss} Humanity → ${c.humanity_current})` : ""}.`,
      compressed: false,
    });
  }

  // ── Economy / lifestyle (house rule) ───────────────────────────────────
  if (delta.economy) {
    const e = delta.economy;
    if (e.eddieChange != null) c.eurodollar = Math.max(0, (c.eurodollar ?? 0) + e.eddieChange);
    if (e.setLifestyle) {
      const cur = c.lifestyle ?? { tier: "cheap" as const, rentPerMonth: 0, paidThroughDay: s.downtime.daysElapsed };
      c.lifestyle = {
        tier: e.setLifestyle.tier ?? cur.tier,
        rentPerMonth: e.setLifestyle.rentPerMonth ?? cur.rentPerMonth,
        paidThroughDay: cur.paidThroughDay,
      };
    }
    if (e.addDebt) {
      c.debts = [...(c.debts ?? []), { id: `d_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`, to: e.addDebt.to, amount: e.addDebt.amount, note: e.addDebt.note ?? "", dueDay: e.addDebt.dueDay }];
    }
    if (e.clearDebtId) c.debts = (c.debts ?? []).filter((d) => d.id !== e.clearDebtId);
  }

  // ── NET dive (§M7) ─────────────────────────────────────────────────────
  if (delta.netrun) {
    const n = s.netrun;
    const dn = delta.netrun;
    if (dn.exit) {
      n.active = false;
      if (s.mode === "netrun") s.mode = "exploration";
      s.sessionLog.push({ ts: Date.now(), type: "system", text: `Jacked out of ${n.target || "the system"} (trace ${n.trace}, alarm ${n.alarm}).`, compressed: false });
    } else {
      const advanced = dn.move != null || dn.clearFloor != null;
      if (dn.move != null) n.position = Math.max(0, Math.min(n.architecture.length - 1, Math.round(dn.move)));
      if (dn.clearFloor != null) {
        const f = n.architecture.find((x) => x.floor === dn.clearFloor);
        if (f) f.cleared = true;
      }
      // Deck IP regen per netrun-turn + connection modifier.
      if (advanced && c.ip_max != null) {
        const regen = CYBERDECK_INFO[n.deck]?.ipRegen ?? 2;
        c.ip_current = Math.min(c.ip_max, (c.ip_current ?? c.ip_max) + regen);
      }
      if (dn.ipChange != null && c.ip_max != null) {
        c.ip_current = Math.max(0, Math.min(c.ip_max, (c.ip_current ?? c.ip_max) + dn.ipChange));
      }
      if (dn.traceChange != null) {
        n.trace = Math.max(0, n.trace + dn.traceChange);
        if (n.trace >= TRACE_CAP) {
          n.trace = TRACE_CAP;
          s.consequences.push({
            id: `cq_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
            text: `NetWatch / ${n.target || "the system"}'s runner has your physical location — the meat body is a target`,
            severity: "grave",
            kind: "enemy",
            status: "armed",
            createdAt: Date.now(),
          });
          s.sessionLog.push({ ts: Date.now(), type: "system", text: "TRACE COMPLETE — full physical trace. Forced disconnect imminent.", compressed: false });
        }
      }
      if (dn.alarmChange != null) n.alarm = Math.max(0, Math.min(3, n.alarm + dn.alarmChange));
      if (dn.addDaemon && !n.daemons.includes(dn.addDaemon)) n.daemons.push(dn.addDaemon);
      if (dn.removeDaemon) n.daemons = n.daemons.filter((d) => d !== dn.removeDaemon);
      for (const l of dn.loot ?? []) {
        c.inventory = [...(Array.isArray(c.inventory) ? c.inventory : []), l];
        s.sessionLog.push({ ts: Date.now(), type: "system", text: `Netrun loot — ${l}`, compressed: false });
      }
    }
  }

  // ── Vehicle chase (§M8 / §22.5) ────────────────────────────────────────
  if (delta.chase) {
    const ch = s.chase;
    const dc = delta.chase;
    if (dc.terrainChange) ch.terrain = dc.terrainChange;
    if (dc.round != null) ch.round = dc.round;
    if (dc.spurChange != null) {
      ch.spur = Math.max(SPUR_MIN, Math.min(SPUR_MAX, ch.spur + dc.spurChange));
      if (ch.spur === SPUR_MAX) s.sessionLog.push({ ts: Date.now(), type: "system", text: ch.pcRole === "runner" ? "Spur 6 — you've shaken them." : "Spur 6 — you've run them down.", compressed: false });
      if (ch.spur === SPUR_MIN) s.sessionLog.push({ ts: Date.now(), type: "system", text: "Spur 0 — a pursuer pulls alongside. This is the moment it goes loud.", compressed: false });
    }
    for (const vd of dc.vehicleDamage ?? []) {
      const v = ch.vehicles.find((x) => x.id === vd.id);
      if (!v) continue;
      v.sdp = Math.max(0, v.sdp - Math.max(0, vd.amount));
      if (v.sdp === 0 && !v.disabled) {
        v.disabled = true;
        s.sessionLog.push({ ts: Date.now(), type: "system", text: `${v.name} is wrecked — SDP 0. Occupants take collision damage (${v.speed > 20 ? "5d6" : "3d6"}).`, compressed: false });
      }
    }
    if (dc.outcome || dc.exit) {
      ch.active = false;
      if (s.mode === "chase") s.mode = "exploration";
      s.sessionLog.push({ ts: Date.now(), type: "system", text: `Chase over${dc.outcome ? ` — ${dc.outcome}` : ""}.`, compressed: false });
    }
  }

  // ── Mode + downtime clock ───────────────────────────────────────────────
  if (delta.mode?.exit) {
    s.mode = "exploration";
    if (s.netrun.active) s.netrun.active = false;
    if (s.chase.active) s.chase.active = false;
  }
  if (delta.mode?.enter) s.mode = delta.mode.enter;
  if (delta.advanceDays && delta.advanceDays > 0) {
    s.downtime.daysElapsed += delta.advanceDays;
    const lines = [`${delta.advanceDays} day${delta.advanceDays === 1 ? "" : "s"} pass — day ${s.downtime.daysElapsed}.`];

    // §14.4 natural healing — a safe stretch of downtime is a full rest.
    if (s.mode === "downtime" && c.hp_max != null && (c.hp_current ?? c.hp_max) < c.hp_max) {
      c.hp_current = c.hp_max;
      if (c.stamina_max != null) c.stamina_current = c.stamina_max;
      lines.push(`Rested up — HP restored to ${c.hp_max}. (Critical injuries persist.)`);
    }

    // Rent (§M4 house rule): due every 30 days.
    if (c.lifestyle && c.lifestyle.rentPerMonth > 0) {
      const due = Math.floor((s.downtime.daysElapsed - c.lifestyle.paidThroughDay) / 30);
      if (due > 0) {
        const owed = due * c.lifestyle.rentPerMonth;
        const paid = Math.min(owed, c.eurodollar ?? 0);
        c.eurodollar = Math.max(0, (c.eurodollar ?? 0) - paid);
        c.lifestyle.paidThroughDay += due * 30;
        lines.push(
          paid >= owed
            ? `Rent paid: ${owed} eb (${c.lifestyle.tier}).`
            : `Rent due ${owed} eb — only ${paid} eb paid. You're behind.`,
        );
      }
    }

    s.sessionLog.push({ ts: Date.now(), type: "system", text: lines.join(" "), compressed: false });
  }

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
