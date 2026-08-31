"use client";

/**
 * Context-aware action chips — SOLO_MODE_BUILD_PLAN.md §12 Phase 3. Tap to
 * pre-fill the action box (still editable) instead of typing "I shoot the
 * second ganger again" every round.
 */

import type { Combat, Mode } from "@/lib/state/campaignState";

const NETRUN_CHIPS: Array<[string, string]> = [
  ["Move down", "I move to the next floor."],
  ["Scan", "I run a Ping to map what's on this floor and ahead."],
  ["Crack ICE", "I attack the ICE on this floor — "],
  ["Grab the file", "I pull the data off this floor."],
  ["Slip past", "I try to slip past without triggering anything — "],
  ["Cover my tracks", "I run a Dead Drop to wipe the trace on me."],
  ["Jack out", "I jack out."],
];

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
  const inNetrun = !inCombat && mode === "netrun";
  const targets = (combat?.order ?? []).filter((o) => !o.isPC);
  const targetName =
    targets.find((t) => t.id === combat?.pcTargetId)?.name ?? targets[0]?.name ?? "the nearest enemy";
  const primary = weapons[0];

  const chips: Array<[string, string]> = inNetrun
    ? NETRUN_CHIPS
    : inDowntime
    ? DOWNTIME_CHIPS
    : inCombat
    ? [
        primary ? [`Attack ▸ ${targetName}`, `I attack ${targetName} with my ${primary}.`] : ["Attack", `I attack ${targetName}.`],
        ["Aimed shot", `I take an aimed shot at ${targetName} (called shot to the head).`],
        ["Autofire", `I open up on autofire${targets.length > 1 ? " across the group" : ` at ${targetName}`}.`],
        ["Reload", "I reload."],
        ["Take cover", "I break for the nearest cover and stay behind it."],
        ["Shoot the cover", `I put rounds into the cover ${targetName} is hiding behind.`],
        ["Dodge", `I stay light on my feet, ready to dodge incoming fire.`],
        ["Move", "I reposition — "],
        ["Melee", `I close the distance on ${targetName} and go in melee.`],
        ...(combat && !combat.flinkUsed ? ([["⚡ Flink", `I use my Flink — a snap second action: `]] as Array<[string, string]>) : []),
        ["Overwatch", "I hold my action on overwatch — I shoot the first enemy that "],
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
          style={{ padding: "3px 9px", fontSize: 10, borderColor: inCombat ? "var(--red)" : inDowntime ? "var(--gold)" : inNetrun ? "var(--cyan-dim)" : "var(--border2)" }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
