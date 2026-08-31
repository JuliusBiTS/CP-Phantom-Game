import { describe, it, expect } from "vitest";
import { VEHICLE_TEMPLATES, findVehicleTemplate, vehicleStats, chaseDv, collisionDamageDice, BODY_SP } from "./vehicles";
import { applyDelta } from "../state/delta";
import { newCampaignState, type CampaignState } from "../state/campaignState";

describe("vehicle reference (§22)", () => {
  it("templates carry SDP / seats / speed", () => {
    expect(VEHICLE_TEMPLATES.find((v) => v.key === "sportscar")).toMatchObject({ sdp: 50, seats: 4, speed: 40 });
  });
  it("fuzzy template lookup", () => {
    expect(findVehicleTemplate("Military AV")?.key).toBe("military-av");
    expect(findVehicleTemplate("a beat-up compact car")?.key).toBe("compact");
    expect(findVehicleTemplate(undefined)).toBeUndefined();
  });
  it("vehicleStats resolves body-SP from class + honours overrides", () => {
    expect(vehicleStats("roadbike").bodySp).toBe(BODY_SP.light);
    expect(vehicleStats("compact", { bodyClass: "armored" }).bodySp).toBe(25);
    expect(vehicleStats("nonsense").template).toBe("compact"); // fallback
  });
  it("chase DV + collision dice", () => {
    expect(chaseDv("standard")).toBe(14);
    expect(chaseDv("elite")).toBe(17);
    expect(collisionDamageDice(15)).toBe("3d6");
    expect(collisionDamageDice(40)).toBe("5d6");
  });
});

function chasing(): CampaignState {
  const s = newCampaignState({ id: "c", name: "T", mode: "gigs", character: { name: "V", stats: {}, hp_max: 30, hp_current: 30 } });
  s.mode = "chase";
  s.chase = {
    active: true,
    spur: 3,
    round: 1,
    terrain: "highway",
    pcRole: "runner",
    pursuerTier: "standard",
    vehicles: [
      { id: "pc", name: "V's sportscar", template: "sportscar", role: "pc", sdp: 50, sdpMax: 50, bodySp: 13, speed: 40, seats: 4, occupants: ["V"], disabled: false },
      { id: "p1", name: "Militech SUV", template: "van", role: "pursuer", sdp: 60, sdpMax: 60, bodySp: 13, speed: 20, seats: 6, occupants: [], disabled: false },
    ],
  };
  return s;
}

describe("applyDelta — chase (§M8)", () => {
  it("spur clamps 0–6 and logs the endpoints", () => {
    let s = chasing();
    s = applyDelta(s, { chase: { spurChange: 5 } });
    expect(s.chase.spur).toBe(6);
    expect(s.sessionLog.some((l) => l.text.includes("shaken"))).toBe(true);
  });

  it("vehicle damage disables at 0 SDP and notes collision", () => {
    let s = chasing();
    s = applyDelta(s, { chase: { vehicleDamage: [{ id: "p1", amount: 70 }] } });
    const p1 = s.chase.vehicles.find((v) => v.id === "p1")!;
    expect(p1.sdp).toBe(0);
    expect(p1.disabled).toBe(true);
    expect(s.sessionLog.some((l) => l.text.includes("wrecked"))).toBe(true);
  });

  it("outcome / exit ends the chase and returns to exploration", () => {
    let s = chasing();
    s = applyDelta(s, { chase: { outcome: "escaped" } });
    expect(s.chase.active).toBe(false);
    expect(s.mode).toBe("exploration");
  });
});
