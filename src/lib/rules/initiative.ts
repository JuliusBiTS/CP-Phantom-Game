/**
 * Initiative — CP Phantom's `rollInitiative` / `rollInitiativeFor`. Initiative
 * is just a PW roll (Drive+Reflexes, §3), sorted:
 *   crit success → always first
 *   hit          → by rolled total, high first
 *   miss         → by raw initiative PW, high first
 *   crit fail    → always last
 */

import { rollPW, type RollPwOptions } from "../dice/rollPW";

const CATEGORY = { "crit-success": 0, hit: 1, miss: 2, "crit-fail": 3 } as const;

export interface InitiativeEntry {
  id: string;
  name: string;
  isPC: boolean;
  pw: number;
  dice: number[];
  outcome: "crit-success" | "crit-fail" | "hit" | "miss";
  /** Sort key within the outcome bucket. */
  value: number;
}

export function rollInitiativeFor(
  args: { id: string; name: string; isPC: boolean; pw: number },
  opts: RollPwOptions = {},
): InitiativeEntry {
  const r = rollPW(Math.max(1, args.pw), opts);
  return {
    id: args.id,
    name: args.name,
    isPC: args.isPC,
    pw: args.pw,
    dice: r.dice,
    outcome: r.outcome,
    value: r.outcome === "hit" ? r.total ?? args.pw : args.pw,
  };
}

/** Sort into turn order. Stable within a bucket by `value` desc. */
export function buildInitiativeOrder(entries: InitiativeEntry[]): InitiativeEntry[] {
  return [...entries].sort((a, b) => {
    const ca = CATEGORY[a.outcome];
    const cb = CATEGORY[b.outcome];
    if (ca !== cb) return ca - cb;
    return b.value - a.value;
  });
}

export function initiativeLabel(e: InitiativeEntry): string {
  if (e.outcome === "crit-success") return "CRIT — goes first";
  if (e.outcome === "crit-fail") return "CRIT FAIL — goes last";
  if (e.outcome === "hit") return `rolled ${e.value}`;
  return `miss (init ${e.pw})`;
}
