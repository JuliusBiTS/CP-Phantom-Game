/**
 * Tone dials — FEATURE_PLAN.md §M2. Set at campaign creation (editable later);
 * folded into the system prompt so the GM writes and adjudicates to taste.
 *
 * Each dial is 0–3. 0 = dial it out entirely; 2 ≈ classic Night City noir.
 */

export interface Tone {
  grit: number;
  lethality: number;
  gore: number;
  romance: number;
  wit: number;
}

export const DEFAULT_TONE: Tone = { grit: 2, lethality: 2, gore: 1, romance: 1, wit: 1 };

export interface ToneDial {
  key: keyof Tone;
  label: string;
  help: string;
  /** Index 0–3 → prompt guidance for that level. */
  levels: [string, string, string, string];
}

export const TONE_DIALS: ToneDial[] = [
  {
    key: "grit",
    label: "Grit",
    help: "how bleak and hard-edged the world feels",
    levels: [
      "Keep it pulpy and heroic — Night City is dangerous but the PC is a legend in the making.",
      "Grounded but not grim; hope is real.",
      "Classic noir: the city grinds people down, wins cost something, trust is scarce.",
      "Unrelenting. Everyone has an angle, nothing is clean, the best outcome is 'survived'.",
    ],
  },
  {
    key: "lethality",
    label: "Lethality",
    help: "how hard the dice and the fiction punish mistakes",
    levels: [
      "Forgiving — telegraph danger, let bad rolls glance off, near-death is rare and cinematic.",
      "Fair — mistakes hurt, but there's usually a way out.",
      "Dangerous — a lost firefight can genuinely kill the PC; don't pull punches on crit-fails.",
      "Brutal — one bad decision or roll in combat can end the run. Consequences are immediate and physical.",
    ],
  },
  {
    key: "gore",
    label: "Gore",
    help: "how graphic violence and injury are on the page",
    levels: [
      "Bloodless — cuts away, keeps it PG.",
      "Restrained — violence lands but isn't lingered on.",
      "Visceral — describe wounds, blood, the sound of it, without wallowing.",
      "Explicit — full body-horror detail on injury, cyberware trauma, and death.",
    ],
  },
  {
    key: "romance",
    label: "Romance",
    help: "how much space intimate/relationship beats get",
    levels: [
      "None — keep NPC relationships strictly professional.",
      "Background — attraction can exist but stays understated; fade to black.",
      "A real thread — let the PC pursue connection; give NPCs chemistry and wants.",
      "Foreground — relationships are a core storyline, with on-page intimacy handled tastefully.",
    ],
  },
  {
    key: "wit",
    label: "Wit",
    help: "how much humour and banter colours the prose",
    levels: [
      "Straight — no jokes, deadpan delivery.",
      "Dry — the occasional wry line.",
      "Snappy — banter, gallows humour, NPCs with comic edges.",
      "Irreverent — lean into the absurdity of Night City; comedy is a load-bearing tone.",
    ],
  },
];

function clampLevel(n: number): 0 | 1 | 2 | 3 {
  return (Math.max(0, Math.min(3, Math.round(n))) || 0) as 0 | 1 | 2 | 3;
}

/** Prompt block appended to the system prompt. Stable per campaign, so it stays
 *  inside the cached prefix. */
export function toneFragment(tone: Partial<Tone> | undefined): string {
  const t = { ...DEFAULT_TONE, ...(tone ?? {}) };
  const lines = TONE_DIALS.map((d) => `- ${d.label} ${clampLevel(t[d.key])}/3 — ${d.levels[clampLevel(t[d.key])]}`);
  return `\n\n## Tone (player-set — honour these in prose and adjudication)\n\n${lines.join("\n")}`;
}
