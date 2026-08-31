/**
 * Vehicles & chases — rulebook v12 §22. Stat tables from §22.1, body-SP classes
 * from §22.2, the abstract chase ("Spur") from §22.5.
 */

export interface VehicleTemplate {
  key: string;
  name: string;
  kind: "land" | "air" | "water";
  sdp: number;
  seats: number;
  speed: number; // combat speed
  bodyClass: "light" | "standard" | "armored";
}

export const VEHICLE_TEMPLATES: VehicleTemplate[] = [
  { key: "roadbike", name: "Roadbike", kind: "land", sdp: 35, seats: 2, speed: 20, bodyClass: "light" },
  { key: "superbike", name: "Superbike", kind: "land", sdp: 35, seats: 2, speed: 60, bodyClass: "light" },
  { key: "compact", name: "Compact car", kind: "land", sdp: 50, seats: 4, speed: 20, bodyClass: "standard" },
  { key: "sportscar", name: "Sports car", kind: "land", sdp: 50, seats: 4, speed: 40, bodyClass: "standard" },
  { key: "supercar", name: "Supercar", kind: "land", sdp: 50, seats: 2, speed: 60, bodyClass: "standard" },
  { key: "van", name: "Van / SUV", kind: "land", sdp: 60, seats: 6, speed: 20, bodyClass: "standard" },
  { key: "apc", name: "Armoured APC", kind: "land", sdp: 90, seats: 8, speed: 15, bodyClass: "armored" },
  { key: "av4", name: "AV-4", kind: "air", sdp: 50, seats: 4, speed: 20, bodyClass: "standard" },
  { key: "military-av", name: "Military AV", kind: "air", sdp: 100, seats: 6, speed: 30, bodyClass: "armored" },
  { key: "jetski", name: "Jetski", kind: "water", sdp: 35, seats: 2, speed: 20, bodyClass: "light" },
  { key: "speedboat", name: "Speedboat", kind: "water", sdp: 50, seats: 4, speed: 20, bodyClass: "standard" },
];

export const BODY_SP: Record<VehicleTemplate["bodyClass"], number> = {
  light: 9,
  standard: 13,
  armored: 25,
};

export function findVehicleTemplate(name: string | undefined): VehicleTemplate | undefined {
  if (!name) return undefined;
  const n = name.trim().toLowerCase();
  return (
    VEHICLE_TEMPLATES.find((v) => v.key === n) ??
    VEHICLE_TEMPLATES.find((v) => v.name.toLowerCase() === n) ??
    VEHICLE_TEMPLATES.find((v) => n.includes(v.key) || v.name.toLowerCase().split(" ").some((w) => w.length > 3 && n.includes(w)))
  );
}

/** Resolve a concept into a stat block. */
export function vehicleStats(templateName: string | undefined, override?: Partial<VehicleTemplate>) {
  const t = findVehicleTemplate(templateName) ?? VEHICLE_TEMPLATES[2]; // compact car fallback
  const bodyClass = override?.bodyClass ?? t.bodyClass;
  return {
    template: t.key,
    name: override?.name ?? t.name,
    kind: t.kind,
    sdp: override?.sdp ?? t.sdp,
    seats: override?.seats ?? t.seats,
    speed: override?.speed ?? t.speed,
    bodySp: BODY_SP[bodyClass],
    bodyClass,
  };
}

// ── §22.5 abstract chase ────────────────────────────────────────────────────
export const SPUR_MIN = 0;
export const SPUR_MAX = 6;
export const SPUR_START = 2;

/** §22.5 step 2 — the DV the driver rolls Drive+Reflexes against. */
export function chaseDv(pursuerTier: "standard" | "elite"): number {
  return pursuerTier === "elite" ? 17 : 14;
}

/** §22.2 — collision damage when a vehicle hits 0 SDP. */
export function collisionDamageDice(speed: number): string {
  return speed > 20 ? "5d6" : "3d6";
}
