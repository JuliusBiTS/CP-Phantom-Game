/**
 * Battle map auto-layout — FEATURE_PLAN battle-map feature.
 *
 * The GM's start_combat call may set a rough gx/gy (0-4) per zone reflecting
 * relative layout. Older saves and any call that omits them have none. This
 * assigns every zone a definite, deterministic grid cell — packing zones
 * missing coordinates into the first free cells — so the map always renders,
 * never overlaps, and is stable across re-renders (no randomness, no clock).
 *
 * Pure and side-effect free: no rules math depends on this. It's a view over
 * combat.zones, not a new source of truth.
 */

export interface ZoneLike {
  id: string;
  gx?: number;
  gy?: number;
}

export interface LaidOutZone {
  id: string;
  gx: number;
  gy: number;
}

const GRID_W = 3;
const GRID_CAP = 5; // clamp explicit GM coords into a sane 0-4 board

function clampCoord(n: number): number {
  return Math.max(0, Math.min(GRID_CAP - 1, Math.round(n)));
}

export function layoutZones(zones: ZoneLike[]): LaidOutZone[] {
  const taken = new Set<string>();
  const placed = new Map<string, LaidOutZone>();
  const needsAuto: ZoneLike[] = [];

  for (const z of zones) {
    if (typeof z.gx === "number" && typeof z.gy === "number") {
      const gx = clampCoord(z.gx);
      const gy = clampCoord(z.gy);
      const key = `${gx},${gy}`;
      // A duplicate explicit cell (two zones asked for the same spot) still
      // needs to land somewhere visible — fall through to auto-placement.
      if (!taken.has(key)) {
        taken.add(key);
        placed.set(z.id, { id: z.id, gx, gy });
        continue;
      }
    }
    needsAuto.push(z);
  }

  let cursor = 0;
  for (const z of needsAuto) {
    let gx = cursor % GRID_W;
    let gy = Math.floor(cursor / GRID_W);
    while (taken.has(`${gx},${gy}`)) {
      cursor++;
      gx = cursor % GRID_W;
      gy = Math.floor(cursor / GRID_W);
    }
    taken.add(`${gx},${gy}`);
    placed.set(z.id, { id: z.id, gx, gy });
    cursor++;
  }

  return zones.map((z) => placed.get(z.id)!);
}

/** Two zones are drawn connected when they're orthogonally adjacent on the
 *  laid-out grid — a light visual cue, not new state. */
export function adjacentPairs(laidOut: LaidOutZone[]): Array<[LaidOutZone, LaidOutZone]> {
  const pairs: Array<[LaidOutZone, LaidOutZone]> = [];
  for (let i = 0; i < laidOut.length; i++) {
    for (let j = i + 1; j < laidOut.length; j++) {
      const a = laidOut[i];
      const b = laidOut[j];
      const dx = Math.abs(a.gx - b.gx);
      const dy = Math.abs(a.gy - b.gy);
      if (dx + dy === 1) pairs.push([a, b]);
    }
  }
  return pairs;
}
