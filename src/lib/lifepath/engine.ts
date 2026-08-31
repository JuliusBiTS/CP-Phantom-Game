/**
 * Life-path accumulator — applies each rolled outcome to a running build and
 * finalizes it into a CP Phantom-shaped CharacterSheet. Rulebook v12 §27.
 */

import { calcDerived, ALL_STATS, POWER_STATS, MOBILITY_STATS, MIND_STATS } from "../rules/derived";
import type { CharacterSheet } from "../state/campaignState";
import { ORIGINS, type Origin, type StatDelta } from "./tables";

export interface JournalEntry {
  phase: string;
  text: string;
}

export interface LifePathBuild {
  originKey: string;
  stats: Record<string, number>;
  hpBonus: number;
  staBonus: number;
  ipBonus: number;
  humanityBonus: number;
  initiativeBonus: number;
  eurodollar: number;
  journal: JournalEntry[];
}

export function originByKey(key: string): Origin {
  const o = ORIGINS.find((x) => x.key === key);
  if (!o) throw new Error(`unknown origin ${key}`);
  return o;
}

/** Named stats → 3, all others → 2 (rulebook §2). */
export function initFromOrigin(originKey: string): LifePathBuild {
  const origin = originByKey(originKey);
  const stats: Record<string, number> = {};
  for (const k of ALL_STATS) stats[k] = origin.namedStats.includes(k) ? 3 : 2;
  return {
    originKey,
    stats,
    hpBonus: origin.hp,
    staBonus: origin.stamina,
    ipBonus: origin.ip,
    humanityBonus: origin.humanity ?? 0,
    initiativeBonus: 0,
    eurodollar: 0,
    journal: [
      { phase: "Phase 0 — Origin", text: `${origin.label}. ${origin.blurb}` },
      { phase: "Phase 0 — Origin", text: `Advantage: ${origin.advantage}` },
      { phase: "Phase 0 — Origin", text: `Disadvantage: ${origin.disadvantage}` },
      { phase: "Phase 0 — Origin", text: `Starting gear: ${origin.startItems}` },
    ],
  };
}

/** Apply a numeric outcome. `humanity` → humanityBonus, `hp` → hpBonus,
 *  everything else → the stat directly (never below 0). */
export function applyDelta(build: LifePathBuild, delta: StatDelta): LifePathBuild {
  const b = structuredClone(build);
  for (const [k, v] of Object.entries(delta)) {
    if (!v) continue;
    if (k === "humanity") b.humanityBonus += v;
    else if (k === "hp") b.hpBonus += v;
    else if (k === "stamina") b.staBonus += v;
    else if (k === "ip") b.ipBonus += v;
    else if (k === "eb" || k === "eurodollar") b.eurodollar += v;
    else b.stats[k] = Math.max(0, (b.stats[k] ?? 0) + v);
  }
  return b;
}

export function journal(build: LifePathBuild, phase: string, text: string): LifePathBuild {
  const b = structuredClone(build);
  b.journal.push({ phase, text });
  return b;
}

export interface FreeAllocation {
  power: Record<string, number>;
  mobility: Record<string, number>;
  mind: Record<string, number>;
}

export function emptyAllocation(): FreeAllocation {
  const zero = (keys: readonly string[]) => Object.fromEntries(keys.map((k) => [k, 0]));
  return { power: zero(POWER_STATS), mobility: zero(MOBILITY_STATS), mind: zero(MIND_STATS) };
}

export function allocationTotals(alloc: FreeAllocation) {
  const sum = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0);
  return { power: sum(alloc.power), mobility: sum(alloc.mobility), mind: sum(alloc.mind), all: sum(alloc.power) + sum(alloc.mobility) + sum(alloc.mind) };
}

/** Fold the free-point allocation into a copy of the build's stats. */
export function withAllocation(build: LifePathBuild, alloc: FreeAllocation): Record<string, number> {
  const stats = { ...build.stats };
  for (const tree of [alloc.power, alloc.mobility, alloc.mind]) {
    for (const [k, v] of Object.entries(tree)) stats[k] = (stats[k] ?? 0) + (v || 0);
  }
  return stats;
}

/** Produce the final CP Phantom character record. */
export function finalizeBuild(
  build: LifePathBuild,
  name: string,
  alloc: FreeAllocation,
  extras: { personality?: string; value?: string; lifeGoal?: string; culture?: string; language?: string } = {},
): CharacterSheet {
  const stats = withAllocation(build, alloc);
  const derived = calcDerived(stats, {
    hp: build.hpBonus,
    stamina: build.staBonus,
    ip: build.ipBonus,
    humanity: build.humanityBonus,
    initiative: build.initiativeBonus,
  });

  const notesLines = [
    `— Created via the life-path wizard (rulebook v12 §27) —`,
    extras.personality && `Personality: ${extras.personality}`,
    extras.value && `Values most: ${extras.value}`,
    extras.lifeGoal && `Life goal: ${extras.lifeGoal}`,
    (extras.culture || extras.language) && `Cultural origin: ${extras.culture ?? "?"}${extras.language ? ` — speaks ${extras.language} (4), plus Night City streetslang` : ""}`,
    "",
    "Life-path journal:",
    ...build.journal.map((j) => `  · [${j.phase}] ${j.text}`),
  ].filter(Boolean);

  return {
    name: name.trim() || "New Runner",
    stats,
    hp_max: derived.hp_max,
    hp_current: derived.hp_max,
    stamina_max: derived.stamina_max,
    stamina_current: derived.stamina_max,
    ip_max: derived.ip_max,
    ip_current: derived.ip_max,
    humanity_max: derived.humanity_max,
    humanity_current: derived.humanity_max,
    origin_hp_bonus: build.hpBonus,
    origin_sta_bonus: build.staBonus,
    origin_ip_bonus: build.ipBonus,
    origin_humanity_bonus: build.humanityBonus,
    initiative: derived.initiative,
    eurodollar: build.eurodollar,
    cyberware: [],
    weapons: [],
    talents: [],
    techniques: [],
    hacks: [],
    abilities: [],
    inventory: [],
    status_effects: [],
    treeXP: { power: 0, mobility: 0, mind: 0 },
    treeBankedPoints: { power: 0, mobility: 0, mind: 0 },
    globalXP: 0,
    talentPointsSpent: 0,
    notes: notesLines.join("\n"),
  } as CharacterSheet;
}
