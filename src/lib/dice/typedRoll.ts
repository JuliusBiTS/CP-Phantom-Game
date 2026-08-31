/** Scoring for player-typed / spoken physical-dice results. Used by DicePad. */

import { pwDiceCaps } from "./rollPW";

const NUMBER_WORDS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
};

/** Parse "fourteen, twelve, seven" or "14 12 7" into an int list (1-20). */
export function parseSpokenDice(text: string): number[] {
  const out: number[] = [];
  for (const tok of text.toLowerCase().split(/[\s,]+/).filter(Boolean)) {
    if (/^\d{1,2}$/.test(tok)) {
      const n = parseInt(tok, 10);
      if (n >= 1 && n <= 20) out.push(n);
    } else if (tok in NUMBER_WORDS) {
      out.push(NUMBER_WORDS[tok]);
    }
  }
  return out;
}

/** Counted total + outcome from raw faces, mirroring rollPW's cap semantics. */
export function scoreTypedRoll(
  pw: number,
  dice: number[],
): { total: number; outcome: "crit-success" | "crit-fail" | "hit" | "miss" } {
  const caps = pwDiceCaps(pw);
  if (dice[0] === 1) return { total: 0, outcome: "crit-success" };
  if (dice[0] === 20) return { total: 0, outcome: "crit-fail" };
  let total = 0;
  dice.forEach((d, i) => {
    const cap = caps[i] ?? 20;
    if (i === 0) total += d <= cap ? d : 0;
    else if (d === 1) total += cap;
    else if (d === 20) total += 0;
    else total += d <= cap ? d : 0;
  });
  return { total, outcome: total > 0 ? "hit" : "miss" };
}
