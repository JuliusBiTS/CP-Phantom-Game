import { describe, it, expect } from "vitest";
import { ICE_CATALOG, findIce, CYBERDECK_INFO, alarmLevel, firewallBand, TRACE_CAP } from "./net";
import { applyDelta } from "../state/delta";
import { newCampaignState, type CampaignState } from "../state/campaignState";

function diving(): CampaignState {
  const s = newCampaignState({ id: "c", name: "T", mode: "gigs", character: { name: "V", stats: {}, hp_max: 30, hp_current: 30, ip_max: 20, ip_current: 8 } });
  s.mode = "netrun";
  s.netrun = {
    active: true,
    target: "Konpeki subnet",
    deck: "Standard",
    connection: "remote",
    trace: 80,
    alarm: 0,
    architecture: [
      { floor: 1, name: "Lobby", kind: "passthrough", ice: null, cleared: false },
      { floor: 2, name: "Datastore", kind: "file", ice: { name: "Watchdog ICE", firewall: 15, effect: "trace" }, loot: "the ledger", cleared: false },
    ],
    position: 0,
    daemons: [],
  };
  return s;
}

describe("net reference", () => {
  it("ICE catalog + fuzzy lookup", () => {
    expect(ICE_CATALOG).toHaveLength(6);
    expect(findIce("black ice")?.lethal).toBe(true);
    expect(findIce("Watchdog")?.firewall).toBe(15);
    expect(findIce("nope")).toBeUndefined();
  });
  it("deck regen + alarm + firewall bands", () => {
    expect(CYBERDECK_INFO.Military.ipRegen).toBe(3);
    expect(alarmLevel(3).name).toContain("Lockdown");
    expect(firewallBand("corpo")).toEqual([15, 20]);
  });
});

describe("applyDelta — netrun (§M7)", () => {
  it("moving a floor regens deck IP and advances position", () => {
    let s = diving();
    s = applyDelta(s, { netrun: { move: 1, clearFloor: 1 } });
    expect(s.netrun.position).toBe(1);
    expect(s.netrun.architecture[0].cleared).toBe(true);
    expect(s.character.ip_current).toBe(10); // 8 + Standard regen 2
  });

  it("trace hitting the cap spawns a grave consequence + logs", () => {
    let s = diving();
    s = applyDelta(s, { netrun: { traceChange: 25 } });
    expect(s.netrun.trace).toBe(TRACE_CAP);
    expect(s.consequences.some((c) => c.severity === "grave" && c.text.includes("physical location"))).toBe(true);
  });

  it("exit ends the dive and returns to exploration", () => {
    let s = diving();
    s = applyDelta(s, { netrun: { exit: true } });
    expect(s.netrun.active).toBe(false);
    expect(s.mode).toBe("exploration");
  });

  it("loot lands in inventory", () => {
    let s = diving();
    s = applyDelta(s, { netrun: { loot: ["the ledger"] } });
    expect(s.character.inventory).toContain("the ledger");
  });
});
