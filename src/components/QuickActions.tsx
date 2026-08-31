"use client";

/**
 * Context-aware action chips — SOLO_MODE_BUILD_PLAN.md §12 Phase 3. Tap to
 * pre-fill the action box (still editable) instead of typing "I shoot the
 * second ganger again" every round.
 */

import type { Combat, Mode } from "@/lib/state/campaignState";

const DOWNTIME_CHIPS: Array<[string, string]> = [
  ["Shop", "I hit up a fixer / vendor to buy gear — "],
  ["Ripperdoc", "I go see my ripperdoc — "],
  ["Sell", "I move some gear I don't need — "],
  ["Train", "I spend the time training toward "],
  ["Chase a lead", "I put the word out on the street and chase a lead about "],
  ["See a contact", "I check in with "],
  ["Lie low", "I keep my head down and let the heat cool for a few days."],
  ["Take a gig", "I tell my fixer I'm ready for the next job."],
  ["End downtime", "I'm done resting up — back to work."],
];

export function QuickActions({
  combat,
  mode = "exploration",
  weapons,
  onPick,
}: {
  combat: Combat | null;
  mode?: Mode;
  weapons: string[];
  onPick: (text: string) => void;
}) {
  const inCombat = !!combat?.active;
  const inDowntime = !inCombat && mode === "downtime";
  const targets = (combat?.order ?? []).filter((o) => !o.isPC);
  const targetName =
    targets.find((t) => t.id === combat?.pcTargetId)?.name ?? targets[0]?.name ?? "the nearest enemy";
  const primary = weapons[0];

  const chips: Array<[string, string]> = inDowntime
    ? DOWNTIME_CHIPS
    : inCombat
    ? [
        primary ? [`Attack ▸ ${targetName}`, `I attack ${targetName} with my ${primary}.`] : ["Attack", `I attack ${targetName}.`],
        ["Aimed shot", `I take an aimed shot at ${targetName} (called shot to the head).`],
        ["Autofire", `I open up on autofire${targets.length > 1 ? " across the group" : ` at ${targetName}`}.`],
        ["Reload", "I reload."],
        ["Take cover", "I break for the nearest cover and stay behind it."],
        ["Dodge", `I stay light on my feet, ready to dodge incoming fire.`],
        ["Move", "I reposition — "],
        ["Melee", `I close the distance on ${targetName} and go in melee.`],
      ]
    : [
        ["Look around", "I take a slow look around, reading the room."],
        ["Search", "I search the area — "],
        ["Talk to", "I approach and talk to "],
        ["Sneak", "I move quietly, staying out of sight — "],
        ["Hack", "I jack in and try to hack "],
        ["Check my gear", "I take stock of what I'm carrying."],
      ];

  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "0 0 8px" }}>
      {chips.map(([label, text]) => (
        <button
          key={label}
          onClick={() => onPick(text)}
          style={{ padding: "3px 9px", fontSize: 10, borderColor: inCombat ? "var(--red)" : inDowntime ? "var(--gold)" : "var(--border2)" }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
