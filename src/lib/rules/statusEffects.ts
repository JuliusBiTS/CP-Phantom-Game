/**
 * Status-effect engine — ported from CP Phantom's `applyAutoStatusEffect` /
 * `nextRound` tick (`index.html`). SOLO_MODE_BUILD_PLAN.md §12 Phase 3.
 *
 * "No hallucinations in fights" — DoT damage (Bleed/Burn/Poison) and per-round
 * talent regen tick DETERMINISTICALLY at each round boundary, in code, not by
 * the model remembering to mention them.
 */

export interface StatusEffect {
  type: string;
  name: string;
  /** rounds left. >0 counts down; -1 = "until treated"; 0 = expires after this tick. */
  rounds: number;
  stacks?: number;
  [k: string]: unknown;
}

export interface StatusSpec {
  type: string;
  name: string;
  rounds: number;
  stacks?: number;
  maxStacks?: number;
  [k: string]: unknown;
}

/** DoT per round, by type. Burn scales with stacks (§ Cyberware Malfunction et al). */
export function dotDamage(e: StatusEffect): number {
  if (e.type === "bleed") return 2;
  if (e.type === "burn") return (e.stacks ?? 1) >= 2 ? 4 : 2;
  if (e.type === "poison") return 3;
  return 0;
}

/** Add/refresh/stack an effect — CP Phantom's `applyAutoStatusEffect`. */
export function applyAutoStatusEffect(effects: StatusEffect[], spec: StatusSpec): StatusEffect[] {
  const out = (effects ?? []).map((e) => ({ ...e }));
  const idx = out.findIndex((e) => e.type === spec.type);
  if (idx >= 0) {
    const stacks = spec.maxStacks
      ? Math.min(spec.maxStacks, (out[idx].stacks ?? 1) + 1)
      : spec.stacks ?? out[idx].stacks ?? 1;
    out[idx] = { ...out[idx], ...spec, stacks };
  } else {
    out.push({ ...spec, stacks: spec.stacks ?? 1 });
  }
  return out;
}

export interface TickInput {
  status_effects?: StatusEffect[];
  hp_max?: number;
  hp_current?: number;
  stamina_max?: number;
  stamina_current?: number;
  ip_max?: number;
  ip_current?: number;
  stats?: Record<string, number>;
  talents?: Array<{ regen_stat?: string; regen_amount?: number; name?: string; lvl?: string }>;
}

export interface TickResult {
  status_effects: StatusEffect[];
  hp_current: number;
  stamina_current: number;
  ip_current: number;
  /** Human-readable summary lines for the combat log. Empty if nothing ticked. */
  log: string[];
}

function talentRegen(input: TickInput): { hp: number; stamina: number; ip: number; names: string[] } {
  let hp = 0, stamina = 0, ip = 0;
  const names: string[] = [];
  for (const t of input.talents ?? []) {
    if (!t.regen_stat || !t.regen_amount) continue;
    if (t.regen_stat === "hp") hp += t.regen_amount;
    else if (t.regen_stat === "stamina") stamina += t.regen_amount;
    else if (t.regen_stat === "ip") ip += t.regen_amount;
    else continue;
    if (t.name) names.push(t.name);
  }
  return { hp, stamina, ip, names };
}

/**
 * Run one round-boundary tick on a combatant — CP Phantom's `nextRound` inner
 * loop. DoT damage uses the CURRENT effects (before decrement), then durations
 * count down and expired effects drop.
 */
export function tickCombatant(input: TickInput, name = "combatant"): TickResult {
  const effects = input.status_effects ?? [];
  const hpMax = input.hp_max ?? 1;
  const staMax = input.stamina_max ?? 0;
  const ipMax = input.ip_max ?? 0;
  const grit = Number(input.stats?.grit) || 0;

  let dot = 0;
  const dotBits: string[] = [];
  for (const e of effects) {
    if (e.rounds > 0 || e.rounds === -1) {
      const d = dotDamage(e);
      if (d > 0) {
        dot += d;
        dotBits.push(`${e.name} ${d}`);
      }
    }
  }

  const regen = talentRegen(input);

  const hpBefore = input.hp_current ?? hpMax;
  const hp_current = Math.min(hpMax, Math.max(-grit, hpBefore - dot + regen.hp));
  const stamina_current = Math.min(staMax, (input.stamina_current ?? staMax) + regen.stamina);
  const ip_current = Math.min(ipMax, (input.ip_current ?? ipMax) + regen.ip);

  const status_effects = effects
    .map((e) => ({ ...e, rounds: e.rounds > 0 ? e.rounds - 1 : e.rounds }))
    .filter((e) => e.rounds !== 0);

  const log: string[] = [];
  if (dot > 0) log.push(`${name}: −${dot} HP (${dotBits.join(", ")})`);
  if (regen.hp > 0 || regen.stamina > 0 || regen.ip > 0) {
    const parts = [
      regen.hp ? `+${regen.hp} HP` : "",
      regen.stamina ? `+${regen.stamina} STA` : "",
      regen.ip ? `+${regen.ip} IP` : "",
    ].filter(Boolean);
    log.push(`${name}: ${parts.join(", ")} (${regen.names.join(", ")})`);
  }
  const expired = effects.filter((e) => e.rounds === 1).map((e) => e.name);
  if (expired.length) log.push(`${name}: ${expired.join(", ")} expired`);

  return { status_effects, hp_current, stamina_current, ip_current, log };
}
