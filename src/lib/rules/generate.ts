/**
 * On-demand NPC / enemy stat-block generation — ported from CP Phantom's
 * `computeAttributes` / `processGeneratedEnemy` (`index.html`).
 * SOLO_MODE_BUILD_PLAN.md §5.1 / §5.2 / §5.7: when an NPC first needs to roll,
 * the model picks the *concept* (tier + archetype + weapons) and the backend
 * generates the real numbers — never the LLM inventing a stat block.
 *
 * The attribute spread is deterministic (CP Phantom's `distribute` is a
 * largest-remainder apportionment, no RNG), so the same concept always yields
 * the same block. Weapon tech (Smart/Power) and attachment rolling — the RNG
 * parts of `processGeneratedEnemy` — are deferred to Phase 2; Phase 1 NPCs
 * carry base weapons.
 */

import { pwDiceCount } from "../dice/rollPW";
import { diceInstruction, matchWeaponName, ARMOR_TABLE, CYBERWARE_STAT_BONUS } from "./live";

export type Tier = "GRUNT" | "THREAT" | "BOSS";
export type Archetype = "BRUISER" | "GUNNER" | "SNIPER" | "NETRUNNER" | "STEALTH" | "SUPPORT" | "HEAVY";

const TIER_SCALE: Record<Tier, number> = { GRUNT: 0.55, THREAT: 1.0, BOSS: 2.0 };

interface ArchetypeDef {
  lead: { power: number; mobility: number; mind: number };
  power: Record<string, number>;
  mobility: Record<string, number>;
  mind: Record<string, number>;
}

const ARCHETYPES: Record<Archetype, ArchetypeDef> = {
  BRUISER: {
    lead: { power: 20, mobility: 12, mind: 14 },
    power: { strength: 0.35, dexterity: 0.2, grit: 0.3, drive: 0.1, core: 0.05 },
    mobility: { speed: 0.15, agility: 0.2, reflexes: 0.35, stealth: 0.1, senses: 0.2 },
    mind: { intelligence: 0.11, focus: 0.17, creativity: 0.11, will: 0.33, cool: 0.28 },
  },
  GUNNER: {
    lead: { power: 14, mobility: 20, mind: 12 },
    power: { strength: 0.15, dexterity: 0.35, grit: 0.25, drive: 0.15, core: 0.1 },
    mobility: { speed: 0.15, agility: 0.15, reflexes: 0.4, stealth: 0.1, senses: 0.2 },
    mind: { intelligence: 0.11, focus: 0.17, creativity: 0.11, will: 0.17, cool: 0.44 },
  },
  SNIPER: {
    lead: { power: 10, mobility: 18, mind: 18 },
    power: { strength: 0.1, dexterity: 0.3, grit: 0.3, drive: 0.15, core: 0.15 },
    mobility: { speed: 0.1, agility: 0.15, reflexes: 0.3, stealth: 0.15, senses: 0.3 },
    mind: { intelligence: 0.17, focus: 0.44, creativity: 0.11, will: 0.17, cool: 0.11 },
  },
  NETRUNNER: {
    lead: { power: 8, mobility: 12, mind: 26 },
    power: { strength: 0.1, dexterity: 0.2, grit: 0.2, drive: 0.2, core: 0.3 },
    mobility: { speed: 0.15, agility: 0.15, reflexes: 0.2, stealth: 0.25, senses: 0.25 },
    mind: { intelligence: 0.37, focus: 0.26, creativity: 0.21, will: 0.11, cool: 0.05 },
  },
  STEALTH: {
    lead: { power: 12, mobility: 24, mind: 10 },
    power: { strength: 0.15, dexterity: 0.35, grit: 0.15, drive: 0.2, core: 0.15 },
    mobility: { speed: 0.15, agility: 0.3, reflexes: 0.2, stealth: 0.25, senses: 0.1 },
    mind: { intelligence: 0.18, focus: 0.18, creativity: 0.18, will: 0.18, cool: 0.28 },
  },
  SUPPORT: {
    lead: { power: 10, mobility: 14, mind: 22 },
    power: { strength: 0.1, dexterity: 0.15, grit: 0.2, drive: 0.25, core: 0.3 },
    mobility: { speed: 0.15, agility: 0.15, reflexes: 0.2, stealth: 0.15, senses: 0.35 },
    mind: { intelligence: 0.28, focus: 0.22, creativity: 0.17, will: 0.22, cool: 0.11 },
  },
  HEAVY: {
    lead: { power: 22, mobility: 8, mind: 16 },
    power: { strength: 0.35, dexterity: 0.1, grit: 0.3, drive: 0.15, core: 0.1 },
    mobility: { speed: 0.15, agility: 0.1, reflexes: 0.25, stealth: 0.1, senses: 0.4 },
    mind: { intelligence: 0.11, focus: 0.5, creativity: 0.11, will: 0.17, cool: 0.11 },
  },
};

/** Largest-remainder apportionment, capped — CP Phantom's `distribute`. */
function distribute(pool: number, weights: Record<string, number>, cap: number): Record<string, number> {
  const keys = Object.keys(weights);
  const raw = keys.map((k) => pool * weights[k]);
  const floor = raw.map(Math.floor);
  const remainder = pool - floor.reduce((a, b) => a + b, 0);
  const order = keys.map((k, i) => ({ k, frac: raw[i] - floor[i] })).sort((a, b) => b.frac - a.frac);
  const result: Record<string, number> = {};
  keys.forEach((k, i) => (result[k] = floor[i]));
  for (let i = 0; i < remainder; i++) result[order[i].k]++;
  keys.forEach((k) => {
    if (result[k] > cap) result[k] = cap;
  });
  return result;
}

/** CP Phantom's `computeAttributes` — deterministic. */
export function computeAttributes(tier: Tier, archetype: Archetype): Record<string, number> {
  const scale = TIER_SCALE[tier] ?? 1.0;
  const arch = ARCHETYPES[archetype] ?? ARCHETYPES.GUNNER;
  const lead = {
    power: Math.max(1, Math.round(arch.lead.power * scale)),
    mobility: Math.max(1, Math.round(arch.lead.mobility * scale)),
    mind: Math.max(1, Math.round(arch.lead.mind * scale)),
  };
  return {
    power: lead.power,
    mobility: lead.mobility,
    mind: lead.mind,
    ...distribute(lead.power * 2, arch.power, lead.power),
    ...distribute(lead.mobility * 2, arch.mobility, lead.mobility),
    ...distribute(lead.mind * 2, arch.mind, lead.mind),
    rep: 0,
    luck: 0,
  };
}

const FALLBACK_WEAPON_BONUS: Record<Tier, number> = { GRUNT: 3, THREAT: 8, BOSS: 12 };
const FALLBACK_ARMOR_SP: Record<Tier, number> = { GRUNT: 6, THREAT: 12, BOSS: 16 };

export interface NpcSpec {
  id: string;
  name: string;
  tier: Tier;
  archetype: Archetype;
  weapons?: string[];
  cyberware?: string[];
  armorName?: string;
  role?: "enemy" | "ally" | "neutral";
}

export interface GeneratedNpcWeapon {
  name: string;
  statPair: string;
  pw: number;
  diceCount: number;
  diceInstruction: string;
  weaponBonus: number;
}

export interface GeneratedNpc {
  sheet: { name: string; isNPC: true } & Record<string, unknown>;
  summary: {
    tier: Tier;
    archetype: Archetype;
    stats: Record<string, number>;
    hp_max: number;
    stamina_max: number;
    ip_max: number;
    armorSP: number;
    reactionPw: number;
    weapons: GeneratedNpcWeapon[];
  };
}

export function generateNpcSheet(spec: NpcSpec): GeneratedNpc {
  const tier: Tier = ["GRUNT", "THREAT", "BOSS"].includes(spec.tier) ? spec.tier : "THREAT";
  let archetype: Archetype = ARCHETYPES[spec.archetype] ? spec.archetype : "GUNNER";
  if (archetype === "HEAVY" && tier === "GRUNT") archetype = "GUNNER"; // HEAVY is THREAT/BOSS only

  const attrs = computeAttributes(tier, archetype);

  // Cyberware stat bonuses (Subdermal Armor → +4 SP instead of a stat).
  let subdermal = 0;
  for (const cw of spec.cyberware ?? []) {
    const norm = String(cw).trim().toLowerCase();
    if (norm === "subdermal armor") {
      subdermal += 4;
      continue;
    }
    const bonus = CYBERWARE_STAT_BONUS[norm];
    if (bonus) for (const [k, v] of Object.entries(bonus)) attrs[k] = (attrs[k] ?? 0) + v;
  }

  const hp_max = Math.round((attrs.grit + attrs.core) * 1.5);
  const stamina_max = Math.round((attrs.drive + attrs.core) * 1.5);
  const ip_max =
    Math.floor((attrs.intelligence + attrs.focus + attrs.creativity + attrs.will + attrs.cool) / 5) * 2;
  const reactionPw = (attrs.drive ?? 0) + (attrs.reflexes ?? 0);

  const weapons: GeneratedNpcWeapon[] = (spec.weapons ?? []).map((wname) => {
    const entry = matchWeaponName(wname);
    if (entry) {
      const pw = (attrs[entry.pw[0]] ?? 0) + (attrs[entry.pw[1]] ?? 0);
      return {
        name: wname,
        statPair: entry.label,
        pw,
        diceCount: pwDiceCount(pw),
        diceInstruction: diceInstruction(pw),
        weaponBonus: entry.bonus,
      };
    }
    const pw = (attrs.dexterity ?? 0) + (attrs.reflexes ?? 0);
    return {
      name: wname,
      statPair: "Dex+Ref",
      pw,
      diceCount: pwDiceCount(pw),
      diceInstruction: diceInstruction(pw),
      weaponBonus: FALLBACK_WEAPON_BONUS[tier],
    };
  });

  const armorMatch = spec.armorName ? ARMOR_TABLE[spec.armorName] : undefined;
  const armorSP = (armorMatch ? armorMatch.body : FALLBACK_ARMOR_SP[tier]) + subdermal;

  const sheet = {
    name: spec.name,
    isNPC: true as const,
    isAlly: spec.role === "ally",
    stats: attrs,
    hp_max,
    hp_current: hp_max,
    stamina_max,
    stamina_current: stamina_max,
    ip_max,
    ip_current: ip_max,
    armor_body: { name: spec.armorName ?? "Improvised Armor", sp_base: armorSP, sp_temp: armorSP },
    cyberware: spec.cyberware ?? [],
    weapons: weapons.map((w) => ({ name: w.name, bonus: w.weaponBonus })),
    status_effects: [],
    _generated: { tier, archetype, primaryPw: weapons[0]?.pw ?? null, reactionPw },
  };

  return {
    sheet,
    summary: {
      tier,
      archetype,
      stats: attrs,
      hp_max,
      stamina_max,
      ip_max,
      armorSP,
      reactionPw,
      weapons,
    },
  };
}
