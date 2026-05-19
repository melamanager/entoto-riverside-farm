"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import type { Bed, Valve } from "@/lib/types";
import { plantsInBed } from "@/lib/data";

type ViewMode = "health" | "yield" | "stage";

interface Props {
  valves: Valve[];
  beds: Bed[];
  harvestKgByBed: Record<string, number>;
  highlightValves?: string[];
}

// ─── Oblique projection constants ────────────────────────────────────────
const ORIG_X  = 80;
const ORIG_Y  = 500;
const LX      = 5.0;
const LY      = 0.22;
const DX      = -5;
const DY      = 18;
const HY      = 22;

const BED_DEPTH   = 0.68;
const BED_HEIGHT  = 1.0;
const ROW_SPACING = 1.0;
const ZONE_EXTRA  = 0.8;

// Ethiopian farm palette
const SOIL      = "#6b3015";
const MULCH_TOP = "#c4c8d0";
const MULCH_FNT = "#8a8e96";
const MULCH_END = "#636870";
const SHINE     = "#dde1e9";

const VALVE_COLORS = ["#10b981", "#3b82f6", "#a855f7"] as const;
const HEALTH_COLOR = { healthy: "#22c55e", warning: "#f59e0b", infected: "#ef4444" } as const;
const STAGE_COLOR: Record<string, string> = {
  planted: "#94a3b8", vegetative: "#4ade80", flowering: "#f9a8d4",
  fruiting: "#fb923c", ripening: "#f87171", harvest: "#22c55e",
};
const STAGE_LABEL: Record<string, string> = {
  planted: "Planted", vegetative: "Vegetative", flowering: "Flowering",
  fruiting: "Fruiting", ripening: "Ripening", harvest: "Harvest",
};

function iso(len: number, row: number, h: number) {
  return {
    x: ORIG_X + len * LX + row * DX,
    y: ORIG_Y + len * LY - row * DY - h * HY,
  };
}
function pts(ps: { x: number; y: number }[]) {
  return ps.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
}

export function FarmMap({ valves, beds, harvestKgByBed, highlightValves }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("health");

  const selectedBed = beds.find(b => b.id === selected);
  const maxLen      = Math.max(...beds.map(b => b.lengthM), 1);
  const maxYield    = Math.max(...beds.map(b => harvestKgByBed[b.id] ?? 0), 1);

  const bedLayout = useMemo(() => {
    const out: Array<{ bed: Bed; rowStart: number; vi: number }> = [];
    let row = 0;
    valves.forEach((valve, vi) => {
      beds.filter(b => b.valveId === valve.id).forEach(bed => {
        out.push({ bed, rowStart: row, vi });
        row += ROW_SPACING;
      });
      row += ZONE_EXTRA;
    });
    return out;
  }, [valves, beds]);

  const paintOrder = useMemo(() => [...bedLayout].reverse(), [bedLayout]);

  const zoneStarts = useMemo(() => {
    const out: Array<{ valve: Valve; vi: number; rowStart: number }> = [];
    let row = 0;
    valves.forEach((valve, vi) => {
      out.push({ valve, vi, rowStart: row });
      beds.filter(b => b.valveId === valve.id).forEach(() => { row += ROW_SPACING; });
      row += ZONE_EXTRA;
    });
    return out;
  }, [valves, beds]);

  const totalRows = useMemo(() => {
    let r = 0;
    valves.forEach(valve => {
      beds.filter(b => b.valveId === valve.id).forEach(() => { r += ROW_SPACING; });
      r += ZONE_EXTRA;
    });
    return r;
  }, [valves, beds]);

  const topLeft    = iso(0,      totalRows + BED_DEPTH, BED_HEIGHT);
  const bottomLeft = iso(0,      0, 0);
  const topRight   = iso(maxLen, totalRows, BED_HEIGHT);
  const botRight   = iso(maxLen, 0, 0);

  const minX = Math.min(topLeft.x, bottomLeft.x) - 36;
  const maxX = Math.max(topRight.x, botRight.x)  + 24;
  const rawMinY = topLeft.y - 16;
  const skyH = 70; // sky above the farm
  const minY = rawMinY - skyH;
  const maxY = Math.max(bottomLeft.y, botRight.y) + 40;

  const VW = maxX - minX;
  const VH = maxY - minY;
  const viewBox = `${minX.toFixed(0)} ${minY.toFixed(0)} ${VW.toFixed(0)} ${VH.toFixed(0)}`;

  // Where sky meets soil in SVG coords
  const horizonY = rawMinY + 4;

  function plantColor(bed: Bed): string {
    if (viewMode === "stage") return STAGE_COLOR[bed.stage] ?? "#4ade80";
    if (viewMode === "yield") {
      const r = (harvestKgByBed[bed.id] ?? 0) / maxYield;
      return r > 0.75 ? "#14532d" : r > 0.45 ? "#16a34a" : r > 0.1 ? "#4ade80" : "#bbf7d0";
    }
    return HEALTH_COLOR[bed.health] ?? "#22c55e";
  }

  return (
    <div className="space-y-3">

      {/* View mode controls */}
      <div className="flex items-center gap-2 flex-wrap">
        {(["health", "yield", "stage"] as ViewMode[]).map(m => (
          <button key={m} onClick={() => setViewMode(m)}
            className={`text-[11px] px-3 py-1.5 rounded-full font-semibold border transition-all ${
              viewMode === m
                ? "bg-stone-800 text-white border-stone-800"
                : "bg-white text-stone-600 border-stone-200 hover:border-stone-400"
            }`}>
            {m === "health" ? "🌿 Health" : m === "yield" ? "🌾 Yield" : "🌸 Stage"}
          </button>
        ))}
      </div>

      {/* Map canvas */}
      <div className="overflow-x-auto rounded-2xl border border-stone-300 shadow-xl">
        <div style={{ minWidth: Math.max(320, VW) }}>
          <svg viewBox={viewBox} width="100%" style={{ display: "block" }}>
            <defs>
              {/* Sky gradient */}
              <linearGradient id="fmSky" gradientUnits="userSpaceOnUse"
                x1="0" y1={minY} x2="0" y2={horizonY}>
                <stop offset="0%" stopColor="#4a8ec2" />
                <stop offset="55%" stopColor="#b8d4e8" />
                <stop offset="100%" stopColor="#c9a87c" />
              </linearGradient>
              {/* Soil texture */}
              <pattern id="fmSoil" width="30" height="30" patternUnits="userSpaceOnUse">
                <rect width="30" height="30" fill={SOIL} />
                <circle cx="6"  cy="9"  r="2"   fill="#3d1505" opacity="0.38" />
                <circle cx="20" cy="20" r="1.4" fill="#3d1505" opacity="0.28" />
                <circle cx="14" cy="4"  r="1"   fill="#7a2e12" opacity="0.22" />
                <circle cx="26" cy="13" r="1.7" fill="#4a1a08" opacity="0.3"  />
                <circle cx="2"  cy="25" r="1.2" fill="#7a2e12" opacity="0.18" />
                <rect x="8"  y="17" width="4" height="0.7" rx="0.3" fill="#2a0e04" opacity="0.2" transform="rotate(-15 10 17)"/>
                <rect x="19" y="6"  width="3" height="0.6" rx="0.3" fill="#2a0e04" opacity="0.15" transform="rotate(20 20 6)"/>
              </pattern>
              {/* Silver plastic mulch — diagonal sheen */}
              <pattern id="fmMulch" width="12" height="12" patternUnits="userSpaceOnUse"
                patternTransform="rotate(45)">
                <rect width="12" height="12" fill={MULCH_TOP} />
                <rect width="3.5" height="12" fill={SHINE} opacity="0.42" />
              </pattern>
              {/* Animations */}
              <style>{`
                @keyframes fmpulse { 0%,100%{opacity:.9} 50%{opacity:.15} }
                .fmpulse { animation: fmpulse 1.4s ease-in-out infinite; }
                @keyframes fmberry { 0%,100%{transform:scale(1)} 50%{transform:scale(1.18)} }
                .fmberry { animation: fmberry 2.2s ease-in-out infinite; transform-box:fill-box; transform-origin:center; }
              `}</style>
            </defs>

            {/* ── Sky ─────────────────────────────────────────────────── */}
            <rect x={minX} y={minY} width={VW + 20} height={horizonY - minY + 6}
              fill="url(#fmSky)" />

            {/* Clouds */}
            {[
              { cx: minX + VW * 0.25, cy: minY + 18, r: 10 },
              { cx: minX + VW * 0.26, cy: minY + 22, r: 14 },
              { cx: minX + VW * 0.28, cy: minY + 20, r: 11 },
              { cx: minX + VW * 0.6,  cy: minY + 14, r: 8  },
              { cx: minX + VW * 0.61, cy: minY + 17, r: 11 },
              { cx: minX + VW * 0.63, cy: minY + 15, r: 9  },
            ].map((c, i) => (
              <ellipse key={i} cx={c.cx} cy={c.cy} rx={c.r * 1.5} ry={c.r * 0.7}
                fill="white" opacity="0.55" />
            ))}

            {/* Distant green hills */}
            <path
              d={`M${minX},${horizonY + 3}
                 C${minX + VW * 0.08},${horizonY - 10}
                  ${minX + VW * 0.2},${horizonY - 6}
                  ${minX + VW * 0.3},${horizonY - 14}
                 C${minX + VW * 0.38},${horizonY - 20}
                  ${minX + VW * 0.47},${horizonY - 17}
                  ${minX + VW * 0.54},${horizonY - 23}
                 C${minX + VW * 0.61},${horizonY - 27}
                  ${minX + VW * 0.7},${horizonY - 13}
                  ${minX + VW * 0.79},${horizonY - 19}
                 C${minX + VW * 0.88},${horizonY - 10}
                  ${minX + VW * 0.95},${horizonY - 4}
                  ${maxX + 20},${horizonY + 3} Z`}
              fill="#2a5218" opacity="0.62" />
            {/* Hill highlight ridge */}
            <path
              d={`M${minX},${horizonY + 3}
                 C${minX + VW * 0.08},${horizonY - 10}
                  ${minX + VW * 0.2},${horizonY - 6}
                  ${minX + VW * 0.3},${horizonY - 14}
                 C${minX + VW * 0.38},${horizonY - 20}
                  ${minX + VW * 0.47},${horizonY - 17}
                  ${minX + VW * 0.54},${horizonY - 23}
                 C${minX + VW * 0.61},${horizonY - 27}
                  ${minX + VW * 0.7},${horizonY - 13}
                  ${minX + VW * 0.79},${horizonY - 19}
                 C${minX + VW * 0.88},${horizonY - 10}
                  ${minX + VW * 0.95},${horizonY - 4}
                  ${maxX + 20},${horizonY + 3}`}
              fill="none" stroke="#3d7028" strokeWidth="1" opacity="0.4" />

            {/* ── Soil background (farm area) ──────────────────────────── */}
            <rect x={minX} y={horizonY} width={VW + 20} height={maxY - horizonY + 20}
              fill="url(#fmSoil)" />

            {/* ── Zone flags (behind beds) ─────────────────────────────── */}
            {zoneStarts.map(({ valve, vi, rowStart }) => {
              const zc       = VALVE_COLORS[vi % 3];
              const postBase = iso(-0.6, rowStart + BED_DEPTH * 0.5, 0);
              const postTop  = iso(-0.6, rowStart + BED_DEPTH * 0.5, BED_HEIGHT + 2.2);
              const lp       = iso(-1.2, rowStart + BED_DEPTH * 0.5, BED_HEIGHT + 1.0);
              return (
                <g key={valve.id}>
                  {/* Post */}
                  <line x1={postBase.x} y1={postBase.y} x2={postTop.x} y2={postTop.y}
                    stroke="#8a6030" strokeWidth="1.6" />
                  {/* Flag */}
                  <polygon
                    points={`${postTop.x},${postTop.y} ${postTop.x + 16},${postTop.y + 5} ${postTop.x},${postTop.y + 11}`}
                    fill={zc} opacity="0.92" />
                  {/* Zone label */}
                  <text x={lp.x - 20} y={lp.y + 3.5}
                    fontSize="8" fontWeight="800" fill={zc} opacity="0.9" textAnchor="end">
                    {valve.name}
                  </text>
                </g>
              );
            })}

            {/* ── Main lateral supply lines (one per zone, along front row) */}
            {zoneStarts.map(({ vi, rowStart }) => {
              const zc    = VALVE_COLORS[vi % 3];
              const left  = iso(-0.4, rowStart, 0);
              const right = iso(maxLen + 0.3, rowStart, 0);
              return (
                <g key={vi}>
                  <line x1={left.x} y1={left.y + 2} x2={right.x} y2={right.y + 2}
                    stroke="#3a2a14" strokeWidth="3.5" opacity="0.6" />
                  <line x1={left.x} y1={left.y + 2} x2={right.x} y2={right.y + 2}
                    stroke={zc} strokeWidth="1.2" opacity="0.55" />
                </g>
              );
            })}

            {/* ── Beds (back → front, painter's algorithm) ─────────────── */}
            {paintOrder.map(({ bed, rowStart, vi }) => {
              const L        = bed.lengthM;
              const rowEnd   = rowStart + BED_DEPTH;
              const zc       = VALVE_COLORS[vi % 3];
              const isDimmed = highlightValves && !highlightValves.includes(bed.valveId);
              const pc       = plantColor(bed);
              const isSel    = selected === bed.id;
              const yieldKg  = harvestKgByBed[bed.id] ?? 0;
              const infected = bed.health === "infected";
              const hasBerry = bed.stage === "fruiting" || bed.stage === "ripening" || bed.stage === "harvest";
              const berryClr = bed.stage === "ripening" || bed.stage === "harvest" ? "#cc1a1a" : "#e05520";

              // 8 box corners
              const A = iso(0, rowStart, 0);
              const B = iso(L, rowStart, 0);
              const C = iso(L, rowEnd,   0);
              const E = iso(0, rowStart,  BED_HEIGHT);
              const F = iso(L, rowStart,  BED_HEIGHT);
              const G = iso(L, rowEnd,    BED_HEIGHT);
              const H = iso(0, rowEnd,    BED_HEIGHT);

              // Zone colour strip along near edge of top face
              const stripeLen = Math.min(2.5, L);
              const Es = iso(stripeLen, rowStart, BED_HEIGHT);
              const Hs = iso(stripeLen, rowEnd,   BED_HEIGHT);

              // Plant positions (2 staggered rows on top face)
              const nPlants = Math.max(3, Math.floor(L / 3.2));
              const plants  = Array.from({ length: nPlants }, (_, i) => {
                const t = (i + 0.5) / nPlants;
                return {
                  p1: iso(t * L,                          rowStart + BED_DEPTH * 0.27, BED_HEIGHT),
                  p2: iso(t * L + L / nPlants * 0.5,     rowStart + BED_DEPTH * 0.73, BED_HEIGHT),
                  hasBerry1: hasBerry && i % 3 !== 0,
                  hasBerry2: hasBerry && i % 3 === 0,
                };
              });

              // Drip tape (along centre of bed top)
              const dt1 = iso(0, rowStart + BED_DEPTH * 0.5, BED_HEIGHT);
              const dt2 = iso(L, rowStart + BED_DEPTH * 0.5, BED_HEIGHT);

              return (
                <g key={bed.id} opacity={isDimmed ? 0.32 : 1}
                  className="cursor-pointer"
                  onClick={() => setSelected(isSel ? null : bed.id)}>

                  {/* Front face */}
                  <polygon points={pts([A, B, F, E])}
                    fill={isSel ? zc : MULCH_FNT}
                    opacity={isSel ? 0.82 : 1}
                    stroke={isSel ? zc : "#44484f"}
                    strokeWidth={isSel ? "1.5" : "0.5"} />
                  <line x1={E.x} y1={E.y} x2={F.x} y2={F.y}
                    stroke={SHINE} strokeWidth="1.3" opacity="0.65" />
                  <line x1={A.x} y1={A.y} x2={B.x} y2={B.y}
                    stroke="#1a0700" strokeWidth="1.1" opacity="0.75" />
                  {/* Bed label on front face */}
                  <text x={(E.x + F.x) / 2} y={(E.y + A.y) / 2 + 3.5}
                    textAnchor="middle" fontSize="6.5" fontWeight="700"
                    fill="#cdd1d9" opacity="0.9">
                    {bed.id.replace("-BED-", " ")} · {L}m
                  </text>

                  {/* Right end-cap */}
                  <polygon points={pts([B, C, G, F])}
                    fill={MULCH_END} stroke="#303540" strokeWidth="0.4" />
                  <line x1={F.x} y1={F.y} x2={G.x} y2={G.y}
                    stroke="#80858e" strokeWidth="0.7" opacity="0.5" />

                  {/* Top face — silver plastic mulch */}
                  <polygon points={pts([E, F, G, H])}
                    fill="url(#fmMulch)" stroke="#989ca3" strokeWidth="0.5" />

                  {/* Zone colour strip at near edge */}
                  <polygon points={pts([E, Es, Hs, H])} fill={zc} opacity="0.72" />

                  {/* Health tint */}
                  {viewMode === "health" && bed.health !== "healthy" && (
                    <polygon points={pts([E, F, G, H])}
                      fill={HEALTH_COLOR[bed.health]} opacity="0.18" />
                  )}

                  {/* Drip tape */}
                  <line x1={dt1.x} y1={dt1.y} x2={dt2.x} y2={dt2.y}
                    stroke="#1e3460" strokeWidth="0.9"
                    strokeDasharray="4,3" opacity="0.4" />

                  {/* ── Plant rosettes ────────────────────────────────── */}
                  {plants.map(({ p1, p2, hasBerry1, hasBerry2 }, pi) => (
                    <g key={pi}>
                      {/* Row 1 plant */}
                      <circle cx={p1.x} cy={p1.y} r="4.3" fill="#0c0301" opacity="0.58" />
                      {Array.from({ length: 5 }, (_, j) => {
                        const a = j * (Math.PI * 2 / 5) - Math.PI / 2;
                        return (
                          <circle key={j}
                            cx={p1.x + Math.cos(a) * 2.5} cy={p1.y + Math.sin(a) * 2.5}
                            r="2.05" fill={pc} opacity={infected ? 0.65 : 0.9}
                            className={infected ? "fmpulse" : undefined} />
                        );
                      })}
                      <circle cx={p1.x} cy={p1.y} r="1.55" fill="#134a09" opacity="0.92" />
                      {hasBerry1 && (
                        <circle cx={p1.x + 1.7} cy={p1.y + 1.7} r="1.45"
                          fill={berryClr} opacity="0.94" className="fmberry" />
                      )}

                      {/* Row 2 plant */}
                      <circle cx={p2.x} cy={p2.y} r="3.9" fill="#0c0301" opacity="0.52" />
                      {Array.from({ length: 5 }, (_, j) => {
                        const a = j * (Math.PI * 2 / 5) - Math.PI / 2;
                        return (
                          <circle key={j}
                            cx={p2.x + Math.cos(a) * 2.2} cy={p2.y + Math.sin(a) * 2.2}
                            r="1.85" fill={pc} opacity={infected ? 0.6 : 0.82}
                            className={infected ? "fmpulse" : undefined} />
                        );
                      })}
                      <circle cx={p2.x} cy={p2.y} r="1.4" fill="#134a09" opacity="0.85" />
                      {hasBerry2 && (
                        <circle cx={p2.x + 1.5} cy={p2.y + 1.5} r="1.3"
                          fill={berryClr} opacity="0.9" className="fmberry" />
                      )}
                    </g>
                  ))}

                  {/* Infected alert */}
                  {infected && (() => {
                    const mid = iso(L * 0.5, rowStart + BED_DEPTH * 0.5, BED_HEIGHT);
                    return (
                      <>
                        <circle cx={mid.x} cy={mid.y} r="10"
                          fill="#dc2626" opacity="0.2" className="fmpulse" />
                        <circle cx={mid.x} cy={mid.y} r="5.5"
                          fill="#dc2626" opacity="0.88" className="fmpulse" />
                        <text x={mid.x} y={mid.y + 3.5}
                          textAnchor="middle" fontSize="8" fontWeight="900" fill="white">!</text>
                      </>
                    );
                  })()}

                  {/* Harvest badge */}
                  {yieldKg > 0 && (() => {
                    const bp = iso(L * 0.65, rowStart + BED_DEPTH * 0.45, BED_HEIGHT + 0.45);
                    return (
                      <>
                        <rect x={bp.x - 23} y={bp.y - 7} width="46" height="13"
                          rx="6.5" fill="#0f172a" opacity="0.88" />
                        <text x={bp.x} y={bp.y + 2.5}
                          textAnchor="middle" fontSize="7.5" fontWeight="700" fill="white">
                          🌾 {yieldKg.toFixed(1)} kg
                        </text>
                      </>
                    );
                  })()}

                  {/* Selection glow */}
                  {isSel && (
                    <polygon points={pts([A, B, C, { x: iso(0, rowEnd, 0).x, y: iso(0, rowEnd, 0).y }])}
                      fill="none" stroke={zc} strokeWidth="2" opacity="0.6" />
                  )}
                </g>
              );
            })}

            {/* ── Length ruler ─────────────────────────────────────────── */}
            {[0, 10, 20, 30, maxLen].filter((v, i, a) => a.indexOf(v) === i).map(m => {
              const p0 = iso(m, 0, 0);
              return (
                <g key={m} opacity="0.48">
                  <line x1={p0.x} y1={p0.y + 6} x2={p0.x} y2={p0.y + 13}
                    stroke="#b89a7a" strokeWidth="1" />
                  <text x={p0.x} y={p0.y + 22}
                    textAnchor="middle" fontSize="7" fill="#c8aa8a">{m}m</text>
                </g>
              );
            })}
            <line
              x1={iso(0, 0, 0).x} y1={iso(0, 0, 0).y + 9}
              x2={iso(maxLen, 0, 0).x} y2={iso(maxLen, 0, 0).y + 9}
              stroke="#a08060" strokeWidth="0.8" opacity="0.42" />

            {/* ── Compass ──────────────────────────────────────────────── */}
            {(() => {
              const cx = maxX - 22;
              const cy = minY + skyH * 0.5;
              return (
                <g opacity="0.75">
                  <circle cx={cx} cy={cy} r="15" fill="#0f172a" opacity="0.52" />
                  <line x1={cx} y1={cy - 12} x2={cx} y2={cy + 12}
                    stroke="white" strokeWidth="0.7" opacity="0.35" />
                  <line x1={cx - 12} y1={cy} x2={cx + 12} y2={cy}
                    stroke="white" strokeWidth="0.7" opacity="0.35" />
                  <polygon points={`${cx},${cy - 12} ${cx - 3.5},${cy + 1} ${cx + 3.5},${cy + 1}`}
                    fill="white" opacity="0.9" />
                  <polygon points={`${cx},${cy + 12} ${cx - 3.5},${cy - 1} ${cx + 3.5},${cy - 1}`}
                    fill="#64748b" opacity="0.55" />
                  <text x={cx} y={cy - 15}
                    textAnchor="middle" fontSize="5.5" fontWeight="900" fill="white">N</text>
                </g>
              );
            })()}

          </svg>
        </div>

        {/* Legend */}
        <div className="px-4 py-2 flex items-center gap-3 flex-wrap text-[10px] border-t border-white/10"
          style={{ background: "#3d1a08" }}>
          {viewMode === "health" && Object.entries(HEALTH_COLOR).map(([k, v]) => (
            <span key={k} className="flex items-center gap-1.5 text-white/70 font-medium capitalize">
              <span className="size-2.5 rounded-full inline-block" style={{ background: v }} />{k}
            </span>
          ))}
          {viewMode === "stage" && Object.entries(STAGE_LABEL).map(([k, label]) => (
            <span key={k} className="flex items-center gap-1.5 text-white/70 font-medium">
              <span className="size-2.5 rounded-full inline-block" style={{ background: STAGE_COLOR[k] }} />{label}
            </span>
          ))}
          {viewMode === "yield" && [
            ["#14532d", "High"], ["#16a34a", "Med"], ["#4ade80", "Low"], ["#bbf7d0", "None"],
          ].map(([c, l]) => (
            <span key={l} className="flex items-center gap-1.5 text-white/70 font-medium">
              <span className="size-2.5 rounded-full inline-block" style={{ background: c }} />{l}
            </span>
          ))}
          <span className="ml-auto text-white/40 text-[9px] italic">
            Length = bed size · Tap any bed
          </span>
        </div>
      </div>

      {/* Selected bed card */}
      {selectedBed && (() => {
        const vi      = valves.findIndex(v => v.id === selectedBed.valveId);
        const zc      = VALVE_COLORS[vi % 3] ?? "#10b981";
        const yieldKg = harvestKgByBed[selectedBed.id] ?? 0;
        return (
          <div className="rounded-2xl border bg-white shadow-md overflow-hidden"
            style={{ borderColor: `${zc}60` }}>
            <div className="h-1" style={{ background: `linear-gradient(90deg,${zc},${zc}88)` }} />
            <div className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="font-bold text-slate-900 text-base">{selectedBed.id}</div>
                  <div className="text-sm text-slate-500">{selectedBed.variety}</div>
                  <div className="text-xs text-slate-400">{selectedBed.origin}</div>
                </div>
                <button onClick={() => setSelected(null)}
                  className="text-slate-400 text-xl leading-none hover:text-slate-600">×</button>
              </div>
              <div className="grid grid-cols-4 gap-2 mb-3">
                {[
                  { label: "Length", value: `${selectedBed.lengthM} m` },
                  { label: "Plants", value: plantsInBed(selectedBed).toString() },
                  { label: "Stage",  value: STAGE_LABEL[selectedBed.stage] ?? selectedBed.stage },
                  { label: "Today",  value: yieldKg > 0 ? `${yieldKg.toFixed(1)} kg` : "—" },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-slate-50 rounded-xl p-2 text-center">
                    <div className="text-sm font-black text-slate-800 leading-tight">{value}</div>
                    <div className="text-[9px] text-slate-400 mt-0.5 uppercase tracking-wide">{label}</div>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full"
                  style={{
                    background: `${HEALTH_COLOR[selectedBed.health]}20`,
                    color: HEALTH_COLOR[selectedBed.health],
                    border: `1px solid ${HEALTH_COLOR[selectedBed.health]}50`,
                  }}>
                  ● {selectedBed.health.charAt(0).toUpperCase() + selectedBed.health.slice(1)}
                </span>
                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                  style={{
                    background: `${STAGE_COLOR[selectedBed.stage]}20`,
                    color: STAGE_COLOR[selectedBed.stage],
                    border: `1px solid ${STAGE_COLOR[selectedBed.stage]}50`,
                  }}>
                  {STAGE_LABEL[selectedBed.stage]}
                </span>
              </div>
              <Link href={`/beds/${selectedBed.id}`}
                className="block w-full text-center text-sm font-bold py-2.5 rounded-xl text-white hover:opacity-90 transition-opacity"
                style={{ background: `linear-gradient(90deg,${zc},${zc}cc)` }}>
                Open Bed Profile →
              </Link>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
