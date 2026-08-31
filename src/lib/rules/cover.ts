/**
 * Cover HP by material — rulebook v12 §18.2. Cover is binary (§18.1: you're
 * either fully behind it or not), but the cover itself has HP and degrades when
 * shot. At 0 it's gone; excess damage is lost (except explosives).
 */

export interface CoverMaterial {
  key: string;
  label: string;
  thick: number;
  thin: number;
  examples: string;
}

export const COVER_MATERIALS: CoverMaterial[] = [
  { key: "steel", label: "Steel", thick: 50, thin: 25, examples: "vault door, engine block, hydrant, car door (thin)" },
  { key: "stone", label: "Stone", thick: 40, thin: 20, examples: "boulder, concrete pillar, masonry" },
  { key: "ballistic-glass", label: "Ballistic glass", thick: 30, thin: 15, examples: "bank window, armoured windscreen" },
  { key: "concrete", label: "Concrete", thick: 25, thin: 10, examples: "concrete barricade, data terminal" },
  { key: "wood", label: "Wood", thick: 20, thin: 5, examples: "bar, wooden wall, flipped table (thin)" },
  { key: "plastic", label: "Plastic / foam", thick: 15, thin: 0, examples: "office cubicle, sofa (no real cover)" },
];

/** Look up a material by key or a loose label match. */
export function findCoverMaterial(name: string | undefined): CoverMaterial | undefined {
  if (!name) return undefined;
  const n = name.trim().toLowerCase();
  return (
    COVER_MATERIALS.find((m) => m.key === n) ??
    COVER_MATERIALS.find((m) => m.label.toLowerCase() === n) ??
    COVER_MATERIALS.find((m) => n.includes(m.key) || n.includes(m.label.toLowerCase()))
  );
}

/** Starting HP for a piece of cover. `thickness` defaults to "thick". */
export function coverHpFor(material: string | undefined, thickness: "thick" | "thin" = "thick"): number | null {
  const m = findCoverMaterial(material);
  if (!m) return null;
  return thickness === "thin" ? m.thin : m.thick;
}
