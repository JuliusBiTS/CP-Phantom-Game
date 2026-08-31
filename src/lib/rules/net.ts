/**
 * Netrunning reference — rulebook v12 §10 + §25. Ported from CP Phantom's
 * ICE_DAEMON_CATALOG / ALARM_LEVELS / CYBERDECK_INFO.
 *
 * The NET dive (FEATURE_PLAN §M7) layers a "real space" on top of the book's
 * hack rules: the GM lays out an architecture of floors, the backend fills in
 * ICE stats and tracks IP / trace / alarm.
 */

export type DeckQuality = "Basic" | "Standard" | "Military" | "Blackmarket";

export const CYBERDECK_INFO: Record<DeckQuality, { slots: number; ipRegen: number; neuralSpikeArmor: number }> = {
  Basic: { slots: 2, ipRegen: 1, neuralSpikeArmor: 5 },
  Standard: { slots: 4, ipRegen: 2, neuralSpikeArmor: 10 },
  Military: { slots: 6, ipRegen: 3, neuralSpikeArmor: 15 },
  Blackmarket: { slots: 8, ipRegen: 4, neuralSpikeArmor: 20 },
};

export interface IceEntry {
  name: string;
  firewall: number;
  effect: string;
  counter: string;
  lethal?: boolean;
}

export const ICE_CATALOG: IceEntry[] = [
  { name: "Watchdog ICE", firewall: 15, effect: "Passive. On intrusion: +10 Trace/round until defeated or you disconnect.", counter: "Hack vs Firewall 15 to shut it down, or get in and out fast." },
  { name: "Hellhound ICE", firewall: 18, effect: "Active. Attacks the runner: (2× roll − runner's Firewall) neural damage / round.", counter: "A Faraday Helm blocks it, or destroy the Hellhound first." },
  { name: "Kraken ICE", firewall: 22, effect: "Locks the runner into the system (no disconnect for 2 rounds), then neural damage.", counter: "Only a duel victory. Very dangerous — no retreat." },
  { name: "Wisp Daemon", firewall: 12, effect: "Disrupts hacks: the runner's next hack is −4 PW.", counter: "Ignore it, or shut it down (Firewall 12)." },
  { name: "Sentinel Daemon", firewall: 16, effect: "Alerts instantly: Alarm +1 per runner action in the system.", counter: "Shut it down first (Firewall 16), or everything escalates fast." },
  { name: "Black ICE", firewall: 25, lethal: true, effect: "LETHAL. On a runner crit-fail: 2× roll neural damage, ignores Firewall. Can cause brain death.", counter: "Elite runners only. A Blackwall Fragment softens it. Extremely rare." },
];

export function findIce(name: string | undefined): IceEntry | undefined {
  if (!name) return undefined;
  const n = name.trim().toLowerCase();
  return ICE_CATALOG.find((i) => i.name.toLowerCase() === n) ?? ICE_CATALOG.find((i) => n.includes(i.name.toLowerCase().replace(/ ice| daemon/g, "")));
}

/** §25.1 Alarm ladder — GM-advanced. */
export const ALARM_LEVELS = [
  { level: 0, name: "Green — Undetected", desc: "Normal operations." },
  { level: 1, name: "Yellow — Suspicion", desc: "A sensor picked something up. 1 round to verification." },
  { level: 2, name: "Orange — Alarm", desc: "Confirmed intruders. Turrets active, doors lock, security in 1d3 rounds." },
  { level: 3, name: "Red — Lockdown", desc: "Full lockdown. Turrets fire, ICE active, reinforcements in 1d6 rounds." },
];

export function alarmLevel(n: number) {
  return ALARM_LEVELS[Math.max(0, Math.min(3, Math.round(n)))];
}

/** §10.2 firewall band for a target concept — for the GM's convenience. */
export function firewallBand(tier: "street" | "corpo" | "elite"): [number, number] {
  return tier === "street" ? [8, 12] : tier === "corpo" ? [15, 20] : [22, 30];
}

/** §10.5b connection type → IP modifier + traceability. */
export const CONNECTION_INFO: Record<string, { ipMod: number; traceable: boolean; note: string }> = {
  wired: { ipMod: -1, traceable: false, note: "direct jack — −1 IP on all hacks, untraceable, unlocks environment hacks" },
  local: { ipMod: 0, traceable: false, note: "local net (≤50m) — standard, untraceable" },
  remote: { ipMod: 2, traceable: true, note: "remote (>50m) — +2 IP, always traceable" },
};

/** NetWatch responds at this trace. */
export const TRACE_CAP = 100;
