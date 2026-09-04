"use client";

/**
 * Abstract battle map — FEATURE_PLAN battle-map feature. A theater-of-mind
 * view over the existing combat.zones / combat.order data (see CombatTracker):
 * not a new source of truth, not a simulation. rangeFromPcM/cover still drive
 * every roll; this just shows where everyone roughly is and lets the player
 * click a token to target it, same as the list view does.
 *
 * Deliberately flat SVG (no filters, no animation) — the Mission Board's
 * animated background-position sweep and drop-shadow filters were a measured
 * perf regression; this view stays static so it stays cheap every render.
 */

import type { CampaignState } from "@/lib/state/campaignState";
import type { CombatantView } from "@/lib/rules/combatant";
import { layoutZones, adjacentPairs, type LaidOutZone } from "@/lib/rules/battleMapLayout";
import { ROLE_COLOR } from "./combatColors";

const CELL_W = 180;
const CELL_H = 132;
const PAD = 14;
const TOKEN_R = 13;

type Combat = CampaignState["combat"];
type Combatant = Combat["order"][number];

interface TokenSlot {
  x: number;
  y: number;
  /** Alternates per column so two tokens sharing a row don't merge their name labels. */
  labelDy: number;
}

function tokenPositions(count: number, w: number, h: number): TokenSlot[] {
  const cols = Math.max(1, Math.min(count, Math.ceil(Math.sqrt(count * (w / h)))));
  const rows = Math.ceil(count / cols);
  const stepX = w / (cols + 1);
  const stepY = h / (rows + 1);
  const out: TokenSlot[] = [];
  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    // A row with 2+ tokens crowds their name labels together horizontally —
    // stagger alternating columns lower so the text never overlaps.
    const labelDy = cols > 1 && col % 2 === 1 ? TOKEN_R + 22 : TOKEN_R + 12;
    out.push({ x: stepX * (col + 1), y: stepY * (row + 1), labelDy });
  }
  return out;
}

function Token({
  c,
  v,
  x,
  y,
  labelDy,
  active,
  targeted,
  onTarget,
}: {
  c: Combatant;
  v: CombatantView;
  x: number;
  y: number;
  labelDy: number;
  active: boolean;
  targeted: boolean;
  onTarget?: () => void;
}) {
  const color = ROLE_COLOR[c.isPC ? "pc" : c.role] ?? "var(--text2)";
  const dead = v.hpPct <= 0;
  return (
    <g
      transform={`translate(${x}, ${y})`}
      onClick={onTarget}
      style={{ cursor: onTarget ? "pointer" : "default" }}
    >
      {targeted && (
        <circle r={TOKEN_R + 4} fill="none" stroke="var(--gold-bright)" strokeWidth={1.5} />
      )}
      {active && (
        <>
          <path d={`M ${-TOKEN_R - 6} ${-TOKEN_R + 2} v -4 h 4`} stroke="var(--red-bright)" strokeWidth={1.5} fill="none" />
          <path d={`M ${TOKEN_R + 6} ${-TOKEN_R + 2} v -4 h -4`} stroke="var(--red-bright)" strokeWidth={1.5} fill="none" />
          <path d={`M ${-TOKEN_R - 6} ${TOKEN_R - 2} v 4 h 4`} stroke="var(--red-bright)" strokeWidth={1.5} fill="none" />
          <path d={`M ${TOKEN_R + 6} ${TOKEN_R - 2} v 4 h -4`} stroke="var(--red-bright)" strokeWidth={1.5} fill="none" />
        </>
      )}
      <circle
        r={TOKEN_R}
        fill={dead ? "var(--surface3)" : "var(--surface2)"}
        stroke={color}
        strokeWidth={dead ? 1 : 2}
        opacity={dead ? 0.45 : 1}
      />
      {!dead && v.hpPct < 1 && (
        <path
          d={describeArc(TOKEN_R - 3, v.hpPct)}
          fill="none"
          stroke={v.hpPct <= 0.25 ? "var(--red-bright)" : v.hpPct <= 0.5 ? "var(--gold-bright)" : "var(--green-bright)"}
          strokeWidth={2}
        />
      )}
      <text
        y={labelDy}
        textAnchor="middle"
        fontFamily="var(--font)"
        fontSize={9}
        fill={dead ? "var(--text3)" : "var(--text2)"}
        style={dead ? { textDecoration: "line-through" } : undefined}
      >
        {v.name.length > 14 ? v.name.slice(0, 13) + "…" : v.name}
      </text>
    </g>
  );
}

/** SVG arc path for an HP ring, starting at 12 o'clock, going clockwise. */
function describeArc(r: number, pct: number): string {
  const clamped = Math.max(0.001, Math.min(1, pct));
  const angle = clamped * 2 * Math.PI;
  const x = r * Math.sin(angle);
  const y = -r * Math.cos(angle);
  const largeArc = angle > Math.PI ? 1 : 0;
  return `M 0 ${-r} A ${r} ${r} 0 ${largeArc} 1 ${x} ${y}`;
}

export function BattleMap({
  combat,
  viewFor,
  onPatchCombat,
}: {
  combat: Combat;
  viewFor: (id: string) => CombatantView | null;
  onPatchCombat: (mut: (c: Combat) => void) => void;
}) {
  if (combat.zones.length === 0) return null;

  const laidOut = layoutZones(combat.zones);
  const byId = new Map<string, LaidOutZone>(laidOut.map((z) => [z.id, z]));
  const links = adjacentPairs(laidOut);

  const maxGx = Math.max(0, ...laidOut.map((z) => z.gx));
  const maxGy = Math.max(0, ...laidOut.map((z) => z.gy));
  const width = (maxGx + 1) * CELL_W;
  const height = (maxGy + 1) * CELL_H;

  const inZone = (zoneId: string) => combat.order.filter((c) => c.zoneId === zoneId);
  const unplaced = combat.order.filter((c) => !c.zoneId || !byId.has(c.zoneId));

  const isTargetable = (c: Combatant) => !c.isPC && c.role !== "ally";
  const target = (id: string) => onPatchCombat((cm) => { cm.pcTargetId = id; });

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 9, letterSpacing: "0.12em", color: "var(--text3)", marginBottom: 4 }}>
        BATTLE MAP
      </div>
      <div
        style={{
          border: "1px solid var(--border2)",
          background: "var(--surface2)",
          overflow: "auto",
          padding: 8,
        }}
      >
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width="100%"
          style={{ display: "block", minWidth: Math.min(width, 480), maxHeight: 380 }}
        >
          <defs>
            <pattern id="bm-grid" width={24} height={24} patternUnits="userSpaceOnUse">
              <path d="M 24 0 L 0 0 0 24" fill="none" stroke="var(--cyan-glow)" strokeWidth={0.5} />
            </pattern>
          </defs>
          <rect x={0} y={0} width={width} height={height} fill="url(#bm-grid)" />

          {links.map(([a, b]) => (
            <line
              key={`${a.id}-${b.id}`}
              x1={a.gx * CELL_W + CELL_W / 2}
              y1={a.gy * CELL_H + CELL_H / 2}
              x2={b.gx * CELL_W + CELL_W / 2}
              y2={b.gy * CELL_H + CELL_H / 2}
              stroke="var(--red-bright)"
              strokeWidth={1}
              strokeDasharray="3 4"
              opacity={0.35}
            />
          ))}

          {laidOut.map((z) => {
            const zone = combat.zones.find((c) => c.id === z.id)!;
            const occupants = inZone(z.id);
            const x0 = z.gx * CELL_W + PAD;
            const y0 = z.gy * CELL_H + PAD;
            const w = CELL_W - PAD * 2;
            const h = CELL_H - PAD * 2;
            const positions = tokenPositions(occupants.length, w, h - 34);
            return (
              <g key={z.id}>
                <rect
                  x={x0}
                  y={y0}
                  width={w}
                  height={h}
                  rx={4}
                  fill="var(--surface)"
                  stroke="var(--border2)"
                  strokeWidth={1}
                />
                <text x={x0 + 8} y={y0 + 14} fontFamily="var(--font-display)" fontSize={10} letterSpacing="0.06em" fill="var(--cyan)">
                  {zone.name.toUpperCase()}
                </text>
                {zone.coverMaterial && (
                  <text x={x0 + 8} y={y0 + 26} fontFamily="var(--font)" fontSize={9} fill="var(--gold-bright)">
                    ▚ {zone.coverMaterial}
                  </text>
                )}
                {occupants.map((c, i) => {
                  const v = viewFor(c.id);
                  if (!v) return null;
                  const slot = positions[i];
                  return (
                    <Token
                      key={c.id}
                      c={c}
                      v={v}
                      x={x0 + slot.x}
                      y={y0 + 20 + slot.y}
                      labelDy={slot.labelDy}
                      active={combat.order[combat.turnIndex]?.id === c.id}
                      targeted={combat.pcTargetId === c.id}
                      onTarget={isTargetable(c) ? () => target(c.id) : undefined}
                    />
                  );
                })}
              </g>
            );
          })}
        </svg>
      </div>

      {unplaced.length > 0 && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 6, fontSize: 9, color: "var(--text3)" }}>
          <span style={{ letterSpacing: "0.1em" }}>ELSEWHERE:</span>
          {unplaced.map((c) => (
            <span
              key={c.id}
              onClick={isTargetable(c) ? () => target(c.id) : undefined}
              style={{
                color: ROLE_COLOR[c.isPC ? "pc" : c.role] ?? "var(--text2)",
                cursor: isTargetable(c) ? "pointer" : undefined,
                textDecoration: combat.pcTargetId === c.id ? "underline" : undefined,
              }}
            >
              {c.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
