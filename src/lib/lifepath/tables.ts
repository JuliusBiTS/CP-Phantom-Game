/**
 * Life-path character creation tables — rulebook v12 §27 / §1-7.
 * SOLO_MODE_BUILD_PLAN.md §5.5. The player rolls every die physically; the
 * wizard presents the table, applies the numeric outcome, and journals the
 * narrative / choice-based parts for the player + GM to flesh out.
 */

export type StatDelta = Partial<Record<string, number>>;

export interface Origin {
  key: string;
  label: string;
  blurb: string;
  /** Stats set to 3 (everything else starts at 2). */
  namedStats: string[];
  hp: number;
  stamina: number;
  ip: number;
  humanity?: number;
  advantage: string;
  disadvantage: string;
  startItems: string;
}

export const ORIGINS: Origin[] = [
  {
    key: "corpo",
    label: "Corpo-Kind",
    blurb: "Corporate Zone. Privileged, shaped, boxed in.",
    namedStats: ["intelligence", "focus", "cool", "rep"],
    hp: 8, stamina: 8, ip: 8,
    advantage: "Corp contact from the start. +2 Rep in corp environments. Corporate Academy activity from age 8.",
    disadvantage: "Combat Zones / subcultures: −2 social until Rep 5+. No street connections.",
    startItems: "500 eb + smartwatch agent + 1 corp business card",
  },
  {
    key: "street",
    label: "Straßenkind",
    blurb: "Combat Zone. Day-to-day survival. The street raised you.",
    namedStats: ["agility", "reflexes", "stealth", "cool"],
    hp: 10, stamina: 10, ip: 0,
    advantage: "Night Market access. +3 gathering info on the street. Black-market contact.",
    disadvantage: "Int-based hacks: −1 PW until Intelligence 5. Corp zones: flagged on entry.",
    startItems: "Clothes + Knife (Light Melee +3) + 100 eb",
  },
  {
    key: "nomad",
    label: "Nomaden-Kind",
    blurb: "Caravan life, always moving. Family the only constant.",
    namedStats: ["grit", "drive", "senses", "speed"],
    hp: 12, stamina: 12, ip: 0,
    advantage: "Nomad contact. Vehicles & repair permanently −20%. Wilderness survival always passes.",
    disadvantage: "Megacities: −2 social & navigation until Cool 5+. No corp contact.",
    startItems: "Roadbike share + basic toolkit + 200 eb",
  },
  {
    key: "academy",
    label: "Akademie-Kind",
    blurb: "Science / tech family. Educated, curious, unworldly.",
    namedStats: ["intelligence", "focus", "creativity", "will"],
    hp: 7, stamina: 7, ip: 16,
    advantage: "Tech repair & hack rolls +2 permanently. Netrunning training from age 12. Science contact.",
    disadvantage: "Combat without training: −2 PW until Grit 4+.",
    startItems: "Laptop (basic cyberdeck) + special tech (500 eb value) + 300 eb",
  },
  {
    key: "underground",
    label: "Untergrund-Kind",
    blurb: "Subculture, art, counterculture, the hacking scene.",
    namedStats: ["creativity", "cool", "stealth", "intelligence"],
    hp: 8, stamina: 9, ip: 4,
    advantage: "Scene reputation: +3 social in underground settings. Fixer contact. Underground hacking from age 11.",
    disadvantage: "Corp zones & institutions: −2 on all rolls. No corp contact.",
    startItems: "Modified gear (1 item with a mod) + scene identity + 150 eb",
  },
  {
    key: "warzone",
    label: "Kriegsgebiet-Kind",
    blurb: "Grew up in active conflict. You survived — others didn't.",
    namedStats: ["strength", "grit", "reflexes", "senses"],
    hp: 11, stamina: 11, ip: 0, humanity: -2,
    advantage: "Can't be caught off guard: no initiative penalty on surprise. +2 survival. Military contact.",
    disadvantage: "−1 EMP permanent. −1 on all rolls vs. corp security & police.",
    startItems: "Heavy Pistol (+5) + trauma kit + 50 eb",
  },
];

// ── Phase 1: childhood imprint (2× W10) ────────────────────────────────────

export interface ChildhoodRow {
  roll: number;
  label: string;
  stats: StatDelta;
  note?: string;
}

export const CHILDHOOD: ChildhoodRow[] = [
  { roll: 1, label: "Serious illness / injury — survived", stats: { grit: 2 }, note: "You don't go down easy anymore." },
  { roll: 2, label: "Early tech fascination", stats: { intelligence: 2 }, note: "Took things apart before you could read." },
  { roll: 3, label: "Early on the street", stats: { agility: 1, stealth: 1 } },
  { roll: 4, label: "Close family bond", stats: { humanity: 2 }, note: "Warmth, trust, real connection." },
  { roll: 5, label: "Early trauma (violence / loss)", stats: { reflexes: 1, humanity: -1 } },
  { roll: 6, label: "A special mentor", stats: { focus: 2 }, note: "Named contact — the mentor stays available." },
  { roll: 7, label: "Privileged surroundings", stats: { rep: 1 }, note: "+200 eb. A network formed on its own." },
  { roll: 8, label: "Physical activity", stats: { speed: 1, agility: 1 } },
  { roll: 9, label: "Early responsibility", stats: { will: 2 }, note: "Parents gone. You carried yourself and others." },
  { roll: 10, label: "A mysterious experience", stats: { creativity: 1, senses: 1 }, note: "Something you saw that you'll never forget." },
];

// ── Phase 2: the W20 activity-result table (rulebook §1) ───────────────────

export interface W20Outcome {
  band: string;
  /** Applied automatically given the activity's primary/secondary stat. */
  apply: (primary: string, secondary: string | null) => StatDelta;
  note?: string;
}

export function w20Outcome(roll: number): W20Outcome {
  if (roll === 1)
    return {
      band: "1 — Critical success",
      apply: (p) => ({ [p]: 5 }),
      note: "OR a talent straight to level 2, OR a special contact/item — your call with the GM.",
    };
  if (roll <= 9) return { band: `${roll} — Minor success`, apply: (p) => ({ [p]: 1 }) };
  if (roll <= 14)
    return { band: `${roll} — Success`, apply: (p) => ({ [p]: 2 }), note: "OR +1 to two stats instead." };
  if (roll <= 17)
    return { band: `${roll} — Good success`, apply: (p, s) => (s ? { [p]: 2, [s]: 1 } : { [p]: 2 }) };
  if (roll <= 19)
    return {
      band: `${roll} — Great success`,
      apply: (p, s) => (s ? { [p]: 2, [s]: 1 } : { [p]: 3 }),
      note: "Rulebook: +3 to distribute freely, OR +2 primary plus a bonus (talent L1 / contact / item). Applied as +2/+1 — adjust with the GM.",
    };
  return {
    band: "20 — Critical failure",
    apply: () => ({}),
    note: "No stat gains. Roll W10 on the consequence table.",
  };
}

// ── Crit-fail consequences (W10) ──────────────────────────────────────────

export interface ConsequenceRow {
  roll: number;
  label: string;
  stats: StatDelta;
  note?: string;
}

export const CRIT_FAIL_CONSEQUENCES: ConsequenceRow[] = [
  { roll: 1, label: "Injury: −1 to a physical stat, +1 Grit as compensation", stats: { grit: 1 }, note: "Pick which physical stat drops −1 (Strength/Dexterity/Reflexes/Speed/Agility)." },
  { roll: 2, label: "New enemy — someone hurt, humiliated or betrayed. They come back.", stats: {} },
  { roll: 3, label: "Debt: 500 eb to a shady party", stats: {} },
  { roll: 4, label: "Contact lost — an existing contact turns away or dies", stats: {} },
  { roll: 5, label: "Bad reputation: −1 Rep in that scene", stats: { rep: -1 } },
  { roll: 6, label: "Trauma: −1 base Humanity (therapy can restore it)", stats: { humanity: -1 } },
  { roll: 7, label: "Arrest — a police file. Corp-zone access gets harder.", stats: {} },
  { roll: 8, label: "Health consequences: −2 max HP permanent", stats: {}, note: "Apply −2 to hp bonus." },
  { roll: 9, label: "Lost time — this action counts as unplayed. No progress.", stats: {} },
  { roll: 10, label: "Double misfortune — roll twice more on this table", stats: {} },
];

// ── Phase 2: year-event tables (W10, one per age band) ────────────────────

export interface YearEventRow {
  roll: number;
  label: string;
  stats: StatDelta;
  note?: string;
}

export const YEAR_EVENTS: Record<string, YearEventRow[]> = {
  "7-9": [
    { roll: 1, label: "Best friend for life", stats: { humanity: 1 }, note: "Note their name and one trait." },
    { roll: 2, label: "Playground accident", stats: {}, note: "W6: 1–3 visible scar; 4–6 a phobia (pick the trigger)." },
    { roll: 3, label: "A parent loses their job", stats: { grit: 1 } },
    { roll: 4, label: "First real violence", stats: { reflexes: 1 } },
    { roll: 5, label: "School conflict / bullying", stats: { will: 1 }, note: "OR +1 Stealth." },
    { roll: 6, label: "Discovered a passion", stats: {}, note: "Talent I, thematic — agree it with the GM, must fit your origin." },
    { roll: 7, label: "Family member vanished", stats: { humanity: -1, grit: 1 }, note: "GM notes where, why, whether it ever surfaces." },
    { roll: 8, label: "A special trip", stats: { senses: 1 }, note: "W6 5–6: an item or cyberware. Note the place — playable once as 'I know this area'." },
    { roll: 9, label: "First contact with cyberware", stats: { intelligence: 1 } },
    { roll: 10, label: "A quiet, good year", stats: {} },
  ],
  "10-12": [
    { roll: 1, label: "First real circle of friends", stats: { cool: 1 }, note: "Note 2–3 names." },
    { roll: 2, label: "First real fight", stats: { grit: 1 }, note: "OR the talent Kampferfahrung I. W6 4–6: a small police file." },
    { roll: 3, label: "Part of a loose clique", stats: { cool: 1 }, note: "Note the group name and a shared cause." },
    { roll: 4, label: "Discovered hacking / the NET", stats: { intelligence: 1 }, note: "Academy origin: +2 Intelligence instead." },
    { roll: 5, label: "Family crisis", stats: { will: 1 }, note: "Pick the cause: debt / addiction / corp / illness." },
    { roll: 6, label: "A mentor in school or the scene", stats: {}, note: "Talent I of the mentor's choice + a named contact." },
    { roll: 7, label: "A small criminal adventure", stats: { stealth: 1 }, note: "W6 1–2: an item or cyberware. Hook: contact / debt / you know something." },
    { roll: 8, label: "First crush", stats: { humanity: 1 }, note: "Note the person and how it ended." },
    { roll: 9, label: "Violence in the neighbourhood", stats: { senses: 1 } },
    { roll: 10, label: "An outstanding achievement", stats: { rep: 1 }, note: "GM notes who noticed. They're watching now." },
  ],
  "13-15": [
    { roll: 1, label: "An intense relationship", stats: { humanity: 1 }, note: "Note the person; W6 4–6 it ended badly — your call how." },
    { roll: 2, label: "Gang membership (serious)", stats: { cool: 1, grit: 1 }, note: "A technique: Staggering Strike or Grapple. Named enemy: a rival gang." },
    { roll: 3, label: "A corp encounter", stats: { rep: 1 }, note: "+1 Rep in corp settings. Offer, threat or job — and whether you took it." },
    { roll: 4, label: "A friend dies or vanishes", stats: { humanity: -1, will: 1 }, note: "GM notes a named NPC and the cause. You don't know everything." },
    { roll: 5, label: "First real job", stats: { drive: 1 }, note: "+200 eb. W6 5–6: an item or cyberware." },
    { roll: 6, label: "Confrontation with a cyberpsycho", stats: { senses: 1 }, note: "Talent: Situationsbewusstsein I." },
    { roll: 7, label: "Escape from a tight spot", stats: { speed: 1, stealth: 1 } },
    { roll: 8, label: "Let someone die", stats: {}, note: "A weapon or armour — it was theirs. GM notes who, the context, whether anyone saw." },
    { roll: 9, label: "Political awakening", stats: { will: 1, cool: 1 }, note: "Note: for what, against whom, who else was there." },
    { roll: 10, label: "A technological breakthrough", stats: { intelligence: 2 }, note: "OR +2 Focus." },
  ],
  "16-18": [
    { roll: 1, label: "A serious love relationship", stats: {}, note: "Roll W10 Tragic Love (CP Red table). The person exists somewhere — GM runs the outcome." },
    { roll: 2, label: "A real fight / life threat", stats: { reflexes: 2 }, note: "OR +2 Grit. A technique: Ansturm or Vernichtender Schlag I." },
    { roll: 3, label: "Corp job / internship, official", stats: { rep: 1, focus: 1 }, note: "Note what you saw or heard. Whether the corp knows: open." },
    { roll: 4, label: "Organised crime (for real)", stats: { cool: 2 }, note: "A weapon or armour. A criminal contact. The first step through the door always costs something." },
    { roll: 5, label: "Loss of an important person", stats: { humanity: -1, grit: 2 } },
    { roll: 6, label: "Your first own place", stats: { cool: 1, drive: 1 } },
    { roll: 7, label: "Military / paramilitary", stats: { strength: 2 }, note: "OR +2 Grit. A weapon or armour. Note the unit and one op you'd rather forget." },
    { roll: 8, label: "A technological masterpiece", stats: { intelligence: 2 }, note: "An item or cyberware." },
    { roll: 9, label: "Ideological crisis / turn", stats: { will: 1, cool: -1 }, note: "Or the reverse." },
    { roll: 10, label: "An extraordinary success", stats: { rep: 1 }, note: "+3 stats to distribute freely. An item or cyberware. GM notes: at whose expense. They know too." },
  ],
};

export function yearBand(age: number): keyof typeof YEAR_EVENTS {
  if (age <= 9) return "7-9";
  if (age <= 12) return "10-12";
  if (age <= 15) return "13-15";
  return "16-18";
}

// ── Activity catalog (curated — primary/secondary per rulebook §4) ────────

export interface Activity {
  key: string;
  label: string;
  category: "Physical" | "Mental" | "Social" | "Technical";
  fromAge: number;
  primary: string;
  secondary: string | null;
  bonus?: string;
}

export const ACTIVITIES: Activity[] = [
  { key: "sport", label: "Sport & training", category: "Physical", fromAge: 7, primary: "agility", secondary: "speed", bonus: "Talent: Parkour I or Kampferfahrung I" },
  { key: "combat-informal", label: "Combat training (informal)", category: "Physical", fromAge: 8, primary: "dexterity", secondary: "grit", bonus: "Talent: Kampferfahrung I (crit: L2)" },
  { key: "martial-arts", label: "Martial arts", category: "Physical", fromAge: 10, primary: "dexterity", secondary: "reflexes", bonus: "Pick a Martial Arts form" },
  { key: "parkour", label: "Parkour & street racing", category: "Physical", fromAge: 10, primary: "speed", secondary: "agility", bonus: "Talent: Parkour I/II" },
  { key: "hard-labour", label: "Hard physical work", category: "Physical", fromAge: 12, primary: "strength", secondary: "grit", bonus: "Contact: employer or scene" },
  { key: "military-youth", label: "Military training / youth brigade", category: "Physical", fromAge: 15, primary: "strength", secondary: "reflexes", bonus: "Kampferfahrung II + military contact" },
  { key: "street-fighting", label: "Street fighting (informal)", category: "Physical", fromAge: 11, primary: "grit", secondary: "dexterity", bonus: "A Brawling technique" },

  { key: "school", label: "Regular school", category: "Mental", fromAge: 7, primary: "intelligence", secondary: "focus" },
  { key: "corp-academy", label: "Corporate Academy (Corpo only)", category: "Mental", fromAge: 8, primary: "intelligence", secondary: "rep", bonus: "Corp contact + Focus" },
  { key: "self-study", label: "Self-study & books", category: "Mental", fromAge: 9, primary: "intelligence", secondary: "creativity" },
  { key: "hacking-electronics", label: "Hacking & electronics", category: "Mental", fromAge: 12, primary: "intelligence", secondary: "focus", bonus: "Talent: Netrunner baseline" },
  { key: "netrunning-training", label: "Netrunning training", category: "Mental", fromAge: 15, primary: "intelligence", secondary: "creativity", bonus: "1 Hack (crit: L2)" },
  { key: "medicine-interest", label: "Medical interest", category: "Mental", fromAge: 13, primary: "focus", secondary: "intelligence", bonus: "Medtech contact, pharma access" },
  { key: "philosophy", label: "Philosophy / languages", category: "Mental", fromAge: 10, primary: "will", secondary: "creativity", bonus: "A language; +1 base Humanity on crit" },

  { key: "friends", label: "Playing with friends", category: "Social", fromAge: 7, primary: "cool", secondary: "agility", bonus: "Contact: friend for life" },
  { key: "gang-loose", label: "Gang life (loose)", category: "Social", fromAge: 10, primary: "cool", secondary: "grit", bonus: "Gang contact (20 = rival-gang enemy)" },
  { key: "gang-serious", label: "Gang member (serious)", category: "Social", fromAge: 13, primary: "cool", secondary: "grit", bonus: "Fixer contact; GM notes obligations" },
  { key: "corp-network", label: "Build a corpo network", category: "Social", fromAge: 14, primary: "rep", secondary: "cool", bonus: "Corp job offer + corp contact" },
  { key: "music-subculture", label: "Music scene / subculture", category: "Social", fromAge: 11, primary: "creativity", secondary: "cool", bonus: "Scene contact (crit: Rep +1)" },
  { key: "underground-hacking", label: "Underground hacking scene", category: "Social", fromAge: 13, primary: "cool", secondary: "intelligence", bonus: "Fixer contact + black-market access" },
  { key: "petty-crime", label: "Petty crime", category: "Social", fromAge: 11, primary: "stealth", secondary: "agility", bonus: "A contact (crit: item; 20: arrest)" },
  { key: "corp-job", label: "Corp job (part-time / official)", category: "Social", fromAge: 16, primary: "rep", secondary: "focus", bonus: "Corp contact + 500 eb once" },

  { key: "tinkering", label: "Tinkering & mechanics", category: "Technical", fromAge: 9, primary: "intelligence", secondary: "focus", bonus: "Item: a home-built gadget" },
  { key: "drones", label: "Electronics & drones", category: "Technical", fromAge: 11, primary: "intelligence", secondary: "focus", bonus: "Item: basic drone; Talent: Pilot I" },
  { key: "weapons-lore", label: "Weapons lore", category: "Technical", fromAge: 13, primary: "focus", secondary: "dexterity", bonus: "Item: a weapon; Talent: ranged basics" },
  { key: "cybertech", label: "Cybertech internship", category: "Technical", fromAge: 15, primary: "intelligence", secondary: "focus", bonus: "Ripperdoc contact; first CW −20%" },
  { key: "vehicle-mechanic", label: "Vehicle mechanics", category: "Technical", fromAge: 12, primary: "drive", secondary: "intelligence", bonus: "Vehicle contact; repairs cheaper" },
  { key: "smuggling", label: "Smuggling & logistics", category: "Technical", fromAge: 14, primary: "drive", secondary: "cool", bonus: "Smuggling contact; restricted-item access" },
];

// ── Phase 3: specialisation tracks (age 19-21, optional, 1 action/year) ────

export const SPECIALISATIONS = [
  "Netrunner", "Melee", "Ranged", "Tech (drones/vehicles/gadgets)", "Fixer / Broker",
  "Heavy Weapons", "Medtech / Ripperdoc", "Stealth / Infiltrator", "Media / Performer", "Nomad affiliation",
] as const;

// ── Abschluss (all W10, narrative only → notes) ───────────────────────────

export const PERSONALITY = [
  "Shy and withdrawn", "Rebellious, antisocial, violent", "Arrogant, proud, cold", "Impulsive and moody",
  "Pedantic, nervous, fussy", "Stable, serious, reliable", "Silly and shallow", "Sneaky and manipulative",
  "Intellectual and detached", "Friendly and open",
];

export const VALUES = [
  "Money", "Honour", "Your word", "Honesty", "Knowledge", "Revenge", "Love", "Power", "Family", "Friendship",
];

export const LIFE_GOALS = [
  "Shake a bad reputation.", "Gain power and control.", "Get off the street — any way possible.",
  "Show everyone what you are.", "Leave the past behind.", "Bring the ones responsible to account.",
  "Get what you're owed.", "Save someone important.", "Become famous or respected.", "Be feared and respected.",
];

export const CULTURES = [
  { region: "North America", languages: "English, Spanish, French, Cree" },
  { region: "South / Central America", languages: "Spanish, Portuguese, Guaraní, Maya" },
  { region: "Western Europe", languages: "German, English, French, Spanish, Italian" },
  { region: "Eastern Europe", languages: "Russian, Ukrainian, Polish, Romanian" },
  { region: "Middle East / North Africa", languages: "Arabic, Farsi, Hebrew, Turkish" },
  { region: "Sub-Saharan Africa", languages: "Swahili, Hausa, Yoruba, Amharic, French" },
  { region: "South Asia", languages: "Hindi, Urdu, Bengali, Tamil" },
  { region: "Southeast Asia", languages: "Indonesian, Vietnamese, Tagalog, Khmer" },
  { region: "East Asia", languages: "Mandarin, Japanese, Korean, Cantonese" },
  { region: "Oceania / Pacific", languages: "English, Maori, Hawaiian" },
];

// ── Free points (rulebook §7.1) ──────────────────────────────────────────
export const FREE_TREE_POINTS = 7; // = 14 stat points, 2 per tree point
export const STAT_POINTS_PER_TREE_POINT = 2;
export const MAX_STAT_POINTS_PER_TREE = 10;
