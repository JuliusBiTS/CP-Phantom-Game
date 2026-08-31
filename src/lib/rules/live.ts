/**
 * Live PW computation for the PC — ported from CP Phantom's
 * `computeLiveWeaponStats` / `computeLiveReactionStats` / `getEffectiveStats`
 * family (`index.html`). SOLO_MODE_BUILD_PLAN.md §3.1 / §9 test 3: the PW the
 * tool tells the player to roll against must match what CP Phantom would show
 * for the same character + weapon.
 *
 * Order of operations (from `computeLiveWeaponStats`):
 *   1. effective stat pair sum (base stats + always-on cyberware bonus)
 *   2. + always-on talent PW mods (scope-matched to the weapon slot type)
 *   3. + Smart-tech PW bonus (unconditional per the rulebook)
 *   4. + "rallied" status buff
 *   5. × wound-state multiplier (floor) — applied LAST
 *
 * Phase 1 scope: CONDITIONAL talent/attachment mods (toggle-chip situational
 * bonuses in CP Phantom) are not auto-applied here — there's no toggle UI yet.
 * They're surfaced as `situational` text so the GM/model applies them per the
 * moment, same as distance/cover/autofire halving (§7.7, handled by resolvePw).
 */

import { pwDiceCount } from "../dice/rollPW";
import { getWoundState, type WoundInput, type WoundState } from "./woundState";
import { WEAPON_RANGES } from "./pw";

// ── Catalogs (ported verbatim from index.html) ──────────────────────────────

export const CYBERWARE_STAT_BONUS: Record<string, Record<string, number>> = {
  "reflex booster": { reflexes: 3 },
  "memory booster": { intelligence: 3 },
  cybereye: { senses: 1 },
  "cybereye (basis)": { senses: 1 },
  "cyberaudio suite": { senses: 1 },
  cyberleg: { speed: 2 },
  cyberarm: { strength: 2 },
  "titanium bones": { strength: 3 },
  "muscle & bone lace": { strength: 2, grit: 2 },
  "grafted muscles": { strength: 3 },
  "stamina booster": { drive: 4 },
  "grip strength": { strength: 2 },
};

interface WeaponEntry {
  bonus: number;
  pw: [string, string];
  label: string;
  mag?: number;
  tags?: string[];
  slotType: "firearm" | "melee" | "shield" | "exotic";
  rangeKey?: keyof typeof WEAPON_RANGES;
}

export const WEAPON_TABLE: Record<string, WeaponEntry> = {
  "Medium Pistol": { bonus: 3, pw: ["reflexes", "cool"], label: "Ref+Cool", mag: 5, slotType: "firearm", rangeKey: "pistol" },
  "Heavy Pistol": { bonus: 5, pw: ["reflexes", "cool"], label: "Ref+Cool", mag: 4, slotType: "firearm", rangeKey: "pistol" },
  "Very Heavy Pistol": { bonus: 8, pw: ["reflexes", "cool"], label: "Ref+Cool", mag: 3, slotType: "firearm", rangeKey: "pistol" },
  "Malorian Arms 3516": { bonus: 11, pw: ["reflexes", "cool"], label: "Ref+Cool", mag: 2, slotType: "firearm", rangeKey: "pistol" },
  SMG: { bonus: 3, pw: ["dexterity", "reflexes"], label: "Dex+Ref", tags: ["Autofire"], mag: 4, slotType: "firearm", rangeKey: "smg" },
  "Heavy SMG": { bonus: 5, pw: ["dexterity", "reflexes"], label: "Dex+Ref", tags: ["Autofire"], mag: 4, slotType: "firearm", rangeKey: "smg" },
  "Assault Rifle": { bonus: 11, pw: ["dexterity", "reflexes"], label: "Dex+Ref", tags: ["Autofire"], mag: 4, slotType: "firearm", rangeKey: "assaultRifle" },
  Shotgun: { bonus: 8, pw: ["strength", "reflexes"], label: "Str+Ref", mag: 2, slotType: "firearm", rangeKey: "shotgun" },
  "Sniper Rifle": { bonus: 14, pw: ["focus", "senses"], label: "Foc+Sen", mag: 2, slotType: "firearm", rangeKey: "sniper" },
  Knife: { bonus: 1, pw: ["dexterity", "reflexes"], label: "Dex+Ref", slotType: "melee" },
  "Big Knucks": { bonus: 3, pw: ["dexterity", "strength"], label: "Dex+Str", slotType: "melee" },
  "Mono-Filament Wire": { bonus: 1, pw: ["dexterity", "agility"], label: "Dex+Agi", slotType: "melee" },
  "Medium Melee": { bonus: 3, pw: ["dexterity", "strength"], label: "Dex+Str", slotType: "melee" },
  Rippers: { bonus: 3, pw: ["dexterity", "strength"], label: "Dex+Str", slotType: "melee" },
  "Mantis Blades": { bonus: 5, pw: ["dexterity", "strength"], label: "Dex+Str", slotType: "melee" },
  "Heavy Melee": { bonus: 5, pw: ["strength", "grit"], label: "Str+Grit", slotType: "melee" },
  "Kendachi Mono-Three": { bonus: 8, pw: ["dexterity", "agility"], label: "Dex+Agi", slotType: "melee" },
  "Ballistic Shield (Light)": { bonus: 1, pw: ["strength", "grit"], label: "Str+Grit", tags: ["Block-SP +6"], slotType: "shield" },
  "Riot Shield": { bonus: 2, pw: ["strength", "grit"], label: "Str+Grit", tags: ["Block-SP +10"], slotType: "shield" },
  "Ballistic Breacher (Heavy)": { bonus: 3, pw: ["strength", "grit"], label: "Str+Grit", tags: ["Block-SP +14", "-2 Dodge"], slotType: "shield" },
  "Grenade Launcher": { bonus: 18, pw: ["focus", "strength"], label: "Foc+Str", mag: 2, tags: ["AoE 10m×10m"], slotType: "exotic", rangeKey: "launcher" },
  "Rocket Launcher": { bonus: 11, pw: ["focus", "strength"], label: "Foc+Str", mag: 2, tags: ["AoE 5m"], slotType: "exotic", rangeKey: "launcher" },
  Flamethrower: { bonus: 11, pw: ["focus", "strength"], label: "Foc+Str", tags: ["Burn 2 HP/round"], slotType: "exotic" },
  "Cryo Thrower": { bonus: 11, pw: ["focus", "strength"], label: "Foc+Str", tags: ["Freeze −5 Speed/Agility"], slotType: "exotic" },
  Minigun: { bonus: 13, pw: ["strength", "focus"], label: "Str+Foc", tags: ["Autofire"], slotType: "exotic", rangeKey: "lmg" },
  "Anti-Materiel Rifle": { bonus: 16, pw: ["focus", "senses"], label: "Foc+Sen", mag: 1, slotType: "exotic", rangeKey: "sniper" },
};

export const ARMOR_TABLE: Record<string, { body: number; head?: number }> = {
  Leathers: { body: 4 },
  "Kevlar Vest": { body: 7 },
  "Body Weight Suit": { body: 11 },
  "Light Armorjack": { body: 11, head: 11 },
  "Medium Armorjack": { body: 13, head: 13 },
  "Heavy Armorjack": { body: 15, head: 15 },
  MetalGear: { body: 18, head: 18 },
};

const SMART_PW_BONUS: Record<number, number> = { 1: 4, 2: 6, 3: 8, 4: 10, 5: 0 };
const SMART_WB_PENALTY: Record<number, number> = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4 };

const WEAPON_ALIASES: Record<string, string> = {
  pistol: "Medium Pistol",
  katana: "Medium Melee",
  sword: "Medium Melee",
  smg: "SMG",
  "assault rifle": "Assault Rifle",
  ar: "Assault Rifle",
  "sniper rifle": "Sniper Rifle",
  sniper: "Sniper Rifle",
  shotgun: "Shotgun",
};

export function matchWeaponName(name: string): WeaponEntry | null {
  const raw = String(name || "").trim();
  const direct = Object.keys(WEAPON_TABLE).find((k) => k.toLowerCase() === raw.toLowerCase());
  if (direct) return WEAPON_TABLE[direct];
  const alias = WEAPON_ALIASES[raw.toLowerCase()];
  return alias ? WEAPON_TABLE[alias] : null;
}

// ── Stat / talent helpers ──────────────────────────────────────────────────

export interface LiveWeapon {
  name?: string;
  bonus?: number;
  tech?: string;
  techLevel?: number;
  pwOverride?: [string, string];
  attachments?: Array<{ name?: string }>;
}

export interface LiveChar extends WoundInput {
  name?: string;
  stats?: Record<string, number>;
  cyberware?: string[];
  talents?: Array<{ name?: string; mods?: Array<{ appliesTo?: string; amount?: number; conditional?: boolean; scope?: string }> }>;
  status_effects?: Array<{ type?: string; name?: string; pwBonus?: number }>;
  weapons?: LiveWeapon[];
  armor_body?: { name?: string; sp_base?: number; sp_temp?: number } | null;
  armor_head?: { name?: string; sp_base?: number; sp_temp?: number } | null;
}

export function computeCyberwareStatBonus(c: LiveChar): Record<string, number> {
  const bonus: Record<string, number> = {};
  for (const cw of c.cyberware ?? []) {
    const entry = CYBERWARE_STAT_BONUS[String(cw).trim().toLowerCase()];
    if (entry) for (const [k, v] of Object.entries(entry)) bonus[k] = (bonus[k] ?? 0) + v;
  }
  return bonus;
}

export function getEffectiveStats(c: LiveChar): Record<string, number> {
  const base = { ...(c.stats ?? {}) };
  const bonus = computeCyberwareStatBonus(c);
  for (const [k, v] of Object.entries(bonus)) base[k] = (base[k] ?? 0) + v;
  return base;
}

function scopeMatches(modScope: string | undefined, slotType?: string): boolean {
  if (!modScope || modScope === "all") return true;
  if (modScope === "ranged") return slotType === "firearm" || slotType === "exotic";
  return modScope === slotType;
}

const SCOPE_GATED = new Set(["pw", "wb", "armorAblation"]);

/** Always-on (non-conditional) talent mods for a category. Returns the summed
 *  amount plus the names of matching talents (both always-on and conditional —
 *  conditional ones are named so the GM knows they *might* apply). */
function talentMods(c: LiveChar, appliesTo: string, slotType?: string) {
  let alwaysOn = 0;
  const alwaysOnNames: string[] = [];
  const situationalNames: string[] = [];
  for (const t of c.talents ?? []) {
    for (const m of t.mods ?? []) {
      if (m.appliesTo !== appliesTo) continue;
      if (SCOPE_GATED.has(appliesTo) && !scopeMatches(m.scope, slotType)) continue;
      if (m.conditional) {
        if (t.name) situationalNames.push(`${t.name} (${(m.amount ?? 0) >= 0 ? "+" : ""}${m.amount ?? 0} ${appliesTo.toUpperCase()}, situational)`);
      } else {
        alwaysOn += m.amount ?? 0;
        if (t.name) alwaysOnNames.push(t.name);
      }
    }
  }
  return { alwaysOn, alwaysOnNames, situationalNames };
}

function ralliedBonus(c: LiveChar): { amount: number; name: string } | null {
  const e = (c.status_effects ?? []).find((x) => x.type === "rallied");
  return e ? { amount: e.pwBonus ?? 0, name: e.name ?? "Rallied" } : null;
}

// ── Public: weapon / reaction / skill PW ────────────────────────────────────

export interface WeaponPw {
  weapon: string;
  statPair: string;
  slotType: string;
  basePw: number;
  talentPwBonus: number;
  smartPwBonus: number;
  ralliedBonus: number;
  woundMultiplier: number | null;
  /** Fully-modified PW BEFORE any situational ±/halving the GM applies. */
  finalPw: number;
  diceCount: number;
  diceInstruction: string;
  weaponBonus: number;
  range?: { effectiveM: number; maxM: number };
  situational: string[];
}

export function diceInstruction(pw: number): string {
  const full = Math.floor(Math.max(pw, 0) / 20);
  const rem = Math.max(pw, 0) % 20;
  const parts: string[] = [];
  if (full > 0) parts.push(`${full}×d20 (counts to 20)`);
  if (rem > 0 || full === 0) parts.push(`1×d20 (counts to ${rem})`);
  return `roll ${parts.join(" + ")}`;
}

export function computeWeaponPw(c: LiveChar, weaponName: string, weaponOverride?: LiveWeapon): WeaponPw | null {
  const w = weaponOverride ?? (c.weapons ?? []).find((x) => x.name?.toLowerCase() === weaponName.toLowerCase());
  const entry = matchWeaponName(weaponName);
  if (!entry && !w?.pwOverride) return null;

  const stats = getEffectiveStats(c);
  const pair = w?.pwOverride ?? entry!.pw;
  const label = entry?.label ?? `${pair[0]}+${pair[1]}`;
  const slotType = entry?.slotType;

  let pw = (stats[pair[0]] ?? 0) + (stats[pair[1]] ?? 0);
  const basePw = pw;

  const tm = talentMods(c, "pw", slotType);
  pw += tm.alwaysOn;

  let smartPwBonus = 0;
  if (w?.tech === "smart" && w.techLevel && SMART_PW_BONUS[w.techLevel] != null) {
    smartPwBonus = SMART_PW_BONUS[w.techLevel];
    pw += smartPwBonus;
  }

  const rally = ralliedBonus(c);
  if (rally) pw += rally.amount;

  const wound = getWoundState(c);
  if (wound) pw = Math.floor(pw * wound.pwMult);

  let weaponBonus = (w?.bonus ?? entry?.bonus ?? 0) + talentMods(c, "wb", slotType).alwaysOn;
  if (w?.tech === "smart" && w.techLevel) weaponBonus = Math.max(0, weaponBonus - (SMART_WB_PENALTY[w.techLevel] ?? 0));

  const situational: string[] = [
    ...tm.situationalNames,
    ...(entry?.tags ?? []),
  ];
  if (w?.tech === "power") situational.push("Power weapon: ignores some cover (GM adjudicates)");
  if (w?.tech === "tech") situational.push("Tech weapon: charge to pierce armor (GM adjudicates)");

  const range = entry?.rangeKey ? { effectiveM: WEAPON_RANGES[entry.rangeKey].effective, maxM: WEAPON_RANGES[entry.rangeKey].max } : undefined;

  return {
    weapon: weaponName,
    statPair: label,
    slotType: slotType ?? "custom",
    basePw,
    talentPwBonus: tm.alwaysOn,
    smartPwBonus,
    ralliedBonus: rally?.amount ?? 0,
    woundMultiplier: wound ? wound.pwMult : null,
    finalPw: Math.max(1, pw),
    diceCount: pwDiceCount(Math.max(1, pw)),
    diceInstruction: diceInstruction(Math.max(1, pw)),
    weaponBonus,
    range,
    situational,
  };
}

export interface SimplePw {
  label: string;
  statPair: string;
  finalPw: number;
  diceInstruction: string;
  woundMultiplier: number | null;
}

/** Reaction / dodge — CP Phantom uses Drive+Reflexes (RW), not the book's
 *  Speed+Reflexes. Follow the code (§3.1). */
export function computeReactionPw(c: LiveChar): SimplePw {
  const stats = getEffectiveStats(c);
  let pw = (stats.drive ?? 0) + (stats.reflexes ?? 0);
  pw += talentMods(c, "reaction").alwaysOn;
  const rally = ralliedBonus(c);
  if (rally) pw += rally.amount;
  const wound = getWoundState(c);
  if (wound) pw = Math.floor(pw * wound.pwMult);
  pw = Math.max(1, pw);
  return { label: "Reaction / Dodge", statPair: "Drive+Reflexes", finalPw: pw, diceInstruction: diceInstruction(pw), woundMultiplier: wound ? wound.pwMult : null };
}

const SKILL_PAIRS: Record<string, [string, string, string]> = {
  persuade: ["Persuade", "creativity", "cool"],
  intimidate: ["Intimidate", "will", "cool"],
  perception: ["Perception", "focus", "senses"],
  hackRoutine: ["Hack (routine)", "intelligence", "focus"],
  hackExotic: ["Hack (exotic)", "intelligence", "creativity"],
  stealth: ["Stealth", "agility", "stealth"],
  athletics: ["Athletics", "strength", "agility"],
  resist: ["Resist / Willpower", "will", "will"],
};

export function computeSkillPws(c: LiveChar): SimplePw[] {
  const stats = getEffectiveStats(c);
  const wound = getWoundState(c);
  return Object.values(SKILL_PAIRS).map(([label, a, b]) => {
    let pw = (stats[a] ?? 0) + (stats[b] ?? 0);
    if (wound) pw = Math.floor(pw * wound.pwMult);
    pw = Math.max(1, pw);
    return {
      label,
      statPair: `${a[0].toUpperCase()}${a.slice(1)}+${b[0].toUpperCase()}${b.slice(1)}`,
      finalPw: pw,
      diceInstruction: diceInstruction(pw),
      woundMultiplier: wound ? wound.pwMult : null,
    };
  });
}

export function resolveArmorSP(c: LiveChar, slot: "body" | "head" = "body"): number {
  const worn = slot === "head" ? c.armor_head : c.armor_body;
  if (worn) {
    if (typeof worn.sp_temp === "number") return worn.sp_temp;
    if (typeof worn.sp_base === "number") return worn.sp_base;
    const byName = worn.name ? ARMOR_TABLE[worn.name] : undefined;
    if (byName) return slot === "head" ? byName.head ?? 0 : byName.body;
  }
  return 0;
}

export interface PcPwReference {
  note: string;
  weapons: WeaponPw[];
  reaction: SimplePw;
  skills: SimplePw[];
  armorSP: { body: number; head: number };
  woundState: WoundState | null;
}

/** The block injected into the turn prompt so the model's request_player_roll
 *  PWs are exactly what CP Phantom would compute. */
export function pcPwReference(c: LiveChar): PcPwReference {
  const weaponNames = new Set<string>();
  for (const w of c.weapons ?? []) if (w.name) weaponNames.add(w.name);
  const weapons = [...weaponNames]
    .map((n) => computeWeaponPw(c, n))
    .filter((x): x is WeaponPw => x !== null);

  return {
    note:
      "These PWs already include effective stats (base + cyberware), always-on talent mods, Smart-tech, and the current wound-state multiplier. Apply on TOP of finalPw, per the moment: aimed shot −4, cover, marks, and any 'situational' talent listed. Then count halving sources (distance beyond effective range, autofire, blindfire, snap shot): with n of them, divide by (n+1), floor once, min 1.",
    weapons,
    reaction: computeReactionPw(c),
    skills: computeSkillPws(c),
    armorSP: { body: resolveArmorSP(c, "body"), head: resolveArmorSP(c, "head") },
    woundState: getWoundState(c),
  };
}
