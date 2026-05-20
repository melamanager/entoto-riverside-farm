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

// Palette
const MULCH_TOP = "#c6cad4";
const MULCH_FNT = "#8a8e97";
const MULCH_END = "#5e6269";
const SHINE     = "#e2e6f0";

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
const STAGE_TEXT_COLOR: Record<string, string> = {
  planted: "#475569", vegetative: "#15803d", flowering: "#be185d",
  fruiting: "#c2410c", ripening: "#b91c1c", harvest: "#15803d",
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

  const minX = Math.min(topLeft.x, bottomLeft.x) - 44;
  const maxX = Math.max(topRight.x, botRight.x)  + 28;
  const rawMinY = topLeft.y - 16;
  const skyH = 86;
  const minY = rawMinY - skyH;
  const maxY = Math.max(bottomLeft.y, botRight.y) + 46;

  const VW = maxX - minX;
  const VH = maxY - minY;
  const viewBox = `${minX.toFixed(0)} ${minY.toFixed(0)} ${VW.toFixed(0)} ${VH.toFixed(0)}`;

  const horizonY = rawMinY + 4;
  const sunX = maxX - VW * 0.16;
  const sunY = horizonY - 22;

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
            className={`text-[11px] px-3.5 py-1.5 rounded-full font-semibold transition-all shadow-sm ${
              viewMode === m
                ? "bg-stone-800 text-white shadow-stone-900/30"
                : "bg-white text-stone-600 border border-stone-200 hover:border-stone-400 hover:shadow"
            }`}>
            {m === "health" ? "🌿 Health" : m === "yield" ? "🌾 Yield" : "🌸 Stage"}
          </button>
        ))}
        <span className="ml-auto text-[10px] text-stone-400 hidden sm:block">Tap any bed for details</span>
      </div>

      {/* Map canvas */}
      <div className="overflow-x-auto rounded-2xl border border-stone-300 shadow-2xl">
        <div style={{ minWidth: Math.max(320, VW) }}>
          <svg viewBox={viewBox} width="100%" style={{ display: "block" }}>
            <defs>
              {/* Sky gradient — deep blue → golden horizon */}
              <linearGradient id="fmSky" gradientUnits="userSpaceOnUse"
                x1="0" y1={minY} x2="0" y2={horizonY}>
                <stop offset="0%"   stopColor="#1a4a8c" />
                <stop offset="28%"  stopColor="#2a7bd0" />
                <stop offset="62%"  stopColor="#78b6e8" />
                <stop offset="85%"  stopColor="#c4dcf0" />
                <stop offset="100%" stopColor="#f2c96c" />
              </linearGradient>
              {/* Sun radial glow */}
              <radialGradient id="fmSunGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%"   stopColor="#fff9d0" stopOpacity="0.95" />
                <stop offset="35%"  stopColor="#ffd04a" stopOpacity="0.5"  />
                <stop offset="100%" stopColor="#ff9820" stopOpacity="0"    />
              </radialGradient>
              {/* Soil texture */}
              <pattern id="fmSoil" width="32" height="32" patternUnits="userSpaceOnUse">
                <rect width="32" height="32" fill="#5a2210" />
                <rect width="32" height="32" fill="#6b3318" opacity="0.65" />
                <circle cx="6"  cy="9"  r="2.2" fill="#3c1404" opacity="0.44" />
                <circle cx="20" cy="20" r="1.7" fill="#3c1404" opacity="0.32" />
                <circle cx="14" cy="4"  r="1.2" fill="#7a2e12" opacity="0.26" />
                <circle cx="26" cy="13" r="1.9" fill="#4a1a08" opacity="0.36" />
                <circle cx="2"  cy="25" r="1.4" fill="#7a2e12" opacity="0.22" />
                <rect x="8"  y="17" width="5"   height="0.8" rx="0.4" fill="#280c04" opacity="0.26" transform="rotate(-15 10 17)" />
                <rect x="19" y="6"  width="3.5" height="0.7" rx="0.3" fill="#280c04" opacity="0.2"  transform="rotate(20 20 6)"   />
              </pattern>
              {/* Silver plastic mulch — diagonal sheen with double stripe */}
              <pattern id="fmMulch" width="14" height="14" patternUnits="userSpaceOnUse"
                patternTransform="rotate(42)">
                <rect width="14" height="14" fill={MULCH_TOP} />
                <rect x="0" width="3"   height="14" fill={SHINE} opacity="0.52" />
                <rect x="7" width="1.5" height="14" fill={SHINE} opacity="0.22" />
              </pattern>
              {/* Animations */}
              <style>{`
                @keyframes fmpulse { 0%,100%{opacity:.92} 50%{opacity:.18} }
                .fmpulse { animation: fmpulse 1.6s ease-in-out infinite; }
                @keyframes fmberry { 0%,100%{transform:scale(1)} 50%{transform:scale(1.22)} }
                .fmberry { animation: fmberry 2.4s ease-in-out infinite; transform-box:fill-box; transform-origin:center; }
                @keyframes fmwarn { 0%,100%{opacity:1} 50%{opacity:.62} }
                .fmwarn { animation: fmwarn 1.1s ease-in-out infinite; }
              `}</style>
            </defs>

            {/* ── Sky ─────────────────────────────────────────────────────── */}
            <rect x={minX} y={minY} width={VW + 24} height={horizonY - minY + 8} fill="url(#fmSky)" />

            {/* Sun glow + disc */}
            <ellipse cx={sunX} cy={sunY} rx="38" ry="24" fill="url(#fmSunGlow)" />
            <circle  cx={sunX} cy={sunY} r="7"   fill="#fff9a0" opacity="0.9" />
            <circle  cx={sunX} cy={sunY} r="4.5" fill="#fffde8" opacity="0.98" />

            {/* Clouds — fluffy overlapping ellipses */}
            {[
              { cx: minX + VW * 0.21, cy: minY + 22 },
              { cx: minX + VW * 0.57, cy: minY + 14 },
            ].map((cloud, ci) => (
              <g key={ci} opacity="0.84">
                <ellipse cx={cloud.cx - 18} cy={cloud.cy + 6}  rx="18" ry="7"  fill="white" />
                <ellipse cx={cloud.cx}      cy={cloud.cy}       rx="24" ry="11" fill="white" />
                <ellipse cx={cloud.cx + 20} cy={cloud.cy + 7}  rx="17" ry="7"  fill="white" />
                <ellipse cx={cloud.cx + 6}  cy={cloud.cy + 5}  rx="14" ry="8"  fill="white" />
                <ellipse cx={cloud.cx - 10} cy={cloud.cy + 10} rx="11" ry="5"  fill="#ddeef8" />
              </g>
            ))}

            {/* Distant misty hills */}
            <path
              d={`M${minX},${horizonY+2}
                C${minX+VW*0.10},${horizonY-24} ${minX+VW*0.22},${horizonY-16} ${minX+VW*0.32},${horizonY-30}
                C${minX+VW*0.41},${horizonY-40} ${minX+VW*0.50},${horizonY-32} ${minX+VW*0.57},${horizonY-44}
                C${minX+VW*0.64},${horizonY-52} ${minX+VW*0.73},${horizonY-34} ${minX+VW*0.82},${horizonY-42}
                C${minX+VW*0.91},${horizonY-22} ${minX+VW*0.97},${horizonY-10} ${maxX+24},${horizonY+2} Z`}
              fill="#2a5040" opacity="0.32" />
            {/* Near hills */}
            <path
              d={`M${minX},${horizonY+5}
                C${minX+VW*0.06},${horizonY-10} ${minX+VW*0.18},${horizonY-5} ${minX+VW*0.28},${horizonY-18}
                C${minX+VW*0.38},${horizonY-26} ${minX+VW*0.46},${horizonY-20} ${minX+VW*0.53},${horizonY-28}
                C${minX+VW*0.60},${horizonY-33} ${minX+VW*0.70},${horizonY-17} ${minX+VW*0.80},${horizonY-24}
                C${minX+VW*0.89},${horizonY-13} ${minX+VW*0.95},${horizonY-6} ${maxX+24},${horizonY+5} Z`}
              fill="#1e5228" opacity="0.78" />
            {/* Hill highlight ridge */}
            <path
              d={`M${minX},${horizonY+5}
                C${minX+VW*0.06},${horizonY-10} ${minX+VW*0.18},${horizonY-5} ${minX+VW*0.28},${horizonY-18}
                C${minX+VW*0.38},${horizonY-26} ${minX+VW*0.46},${horizonY-20} ${minX+VW*0.53},${horizonY-28}
                C${minX+VW*0.60},${horizonY-33} ${minX+VW*0.70},${horizonY-17} ${minX+VW*0.80},${horizonY-24}
                C${minX+VW*0.89},${horizonY-13} ${minX+VW*0.95},${horizonY-6} ${maxX+24},${horizonY+5}`}
              fill="none" stroke="#4a8838" strokeWidth="1.3" opacity="0.5" />

            {/* ── Soil background ──────────────────────────────────────────── */}
            <rect x={minX} y={horizonY} width={VW + 24} height={maxY - horizonY + 24} fill="url(#fmSoil)" />

            {/* ── Zone flags ───────────────────────────────────────────────── */}
            {zoneStarts.map(({ valve, vi, rowStart }) => {
              const zc       = VALVE_COLORS[vi % 3];
              const postBase = iso(-0.6, rowStart + BED_DEPTH * 0.5, 0);
              const postTop  = iso(-0.6, rowStart + BED_DEPTH * 0.5, BED_HEIGHT + 2.5);
              const lp       = iso(-1.4, rowStart + BED_DEPTH * 0.5, BED_HEIGHT + 1.2);
              return (
                <g key={valve.id}>
                  {/* Post — dark core + light edge */}
                  <line x1={postBase.x} y1={postBase.y} x2={postTop.x} y2={postTop.y}
                    stroke="#6a4620" strokeWidth="2.4" />
                  <line x1={postBase.x} y1={postBase.y} x2={postTop.x} y2={postTop.y}
                    stroke="#c09460" strokeWidth="0.9" opacity="0.38" />
                  {/* Rectangular flag body */}
                  <rect x={postTop.x} y={postTop.y - 1.5} width="19" height="11"
                    rx="2" fill={zc} opacity="0.96" />
                  {/* Flag sheen */}
                  <rect x={postTop.x} y={postTop.y - 1.5} width="19" height="5"
                    rx="2" fill="white" opacity="0.18" />
                  {/* Zone label */}
                  <text x={lp.x - 24} y={lp.y + 4}
                    fontSize="9" fontWeight="800" fill={zc} opacity="0.96" textAnchor="end">
                    {valve.name}
                  </text>
                </g>
              );
            })}

            {/* ── Lateral supply lines ─────────────────────────────────────── */}
            {zoneStarts.map(({ vi, rowStart }) => {
              const zc    = VALVE_COLORS[vi % 3];
              const left  = iso(-0.4, rowStart, 0);
              const right = iso(maxLen + 0.3, rowStart, 0);
              return (
                <g key={vi}>
                  <line x1={left.x} y1={left.y + 2} x2={right.x} y2={right.y + 2}
                    stroke="#280e04" strokeWidth="4.2" opacity="0.72" />
                  <line x1={left.x} y1={left.y + 2} x2={right.x} y2={right.y + 2}
                    stroke={zc} strokeWidth="1.5" opacity="0.6" />
                </g>
              );
            })}

            {/* ── Beds (back → front, painter's algorithm) ─────────────────── */}
            {paintOrder.map(({ bed, rowStart, vi }) => {
              const L        = bed.lengthM;
              const rowEnd   = rowStart + BED_DEPTH;
              const zc       = VALVE_COLORS[vi % 3];
              const isDimmed = highlightValves && !highlightValves.includes(bed.valveId);
              const pc       = plantColor(bed);
              const isSel    = selected === bed.id;
              const yieldKg  = harvestKgByBed[bed.id] ?? 0;
              const infected = bed.health === "infected";
              const warn     = bed.health === "warning";
              const hasBerry = bed.stage === "fruiting" || bed.stage === "ripening" || bed.stage === "harvest";
              const berryClr = bed.stage === "ripening" || bed.stage === "harvest" ? "#c81010" : "#e05020";

              // 8 box corners
              const A = iso(0, rowStart, 0);
              const B = iso(L, rowStart, 0);
              const C = iso(L, rowEnd,   0);
              const D = iso(0, rowEnd,   0);
              const E = iso(0, rowStart, BED_HEIGHT);
              const F = iso(L, rowStart, BED_HEIGHT);
              const G = iso(L, rowEnd,   BED_HEIGHT);
              const H = iso(0, rowEnd,   BED_HEIGHT);

              // Zone colour strip along near edge
              const stripeLen = Math.min(2.8, L);
              const Es = iso(stripeLen, rowStart, BED_HEIGHT);
              const Hs = iso(stripeLen, rowEnd,   BED_HEIGHT);

              // Plant positions (2 staggered rows)
              const nPlants = Math.max(3, Math.floor(L / 3.2));
              const plants  = Array.from({ length: nPlants }, (_, i) => {
                const t = (i + 0.5) / nPlants;
                return {
                  p1: iso(t * L,                      rowStart + BED_DEPTH * 0.27, BED_HEIGHT),
                  p2: iso(t * L + L / nPlants * 0.5,  rowStart + BED_DEPTH * 0.73, BED_HEIGHT),
                  hasBerry1: hasBerry && i % 3 !== 0,
                  hasBerry2: hasBerry && i % 3 === 0,
                };
              });

              // Drip tape
              const dt1 = iso(0, rowStart + BED_DEPTH * 0.5, BED_HEIGHT);
              const dt2 = iso(L, rowStart + BED_DEPTH * 0.5, BED_HEIGHT);

              // Infected plants look sickly yellow-brown
              const plantFill = infected ? "#b09820" : pc;

              return (
                <g key={bed.id} opacity={isDimmed ? 0.27 : 1}
                  className="cursor-pointer"
                  onClick={() => setSelected(isSel ? null : bed.id)}>

                  {/* Front face */}
                  <polygon points={pts([A, B, F, E])}
                    fill={isSel ? zc : MULCH_FNT}
                    opacity={isSel ? 0.88 : 1}
                    stroke={isSel ? zc : "#3e424a"}
                    strokeWidth={isSel ? "2" : "0.5"} />
                  {/* Top-edge shine */}
                  <line x1={E.x} y1={E.y} x2={F.x} y2={F.y}
                    stroke={SHINE} strokeWidth="1.7" opacity="0.72" />
                  {/* Bottom-edge shadow */}
                  <line x1={A.x} y1={A.y} x2={B.x} y2={B.y}
                    stroke="#0e0400" strokeWidth="1.4" opacity="0.82" />
                  {/* Bed label */}
                  <text x={(E.x + F.x) / 2} y={(E.y + A.y) / 2 + 3.5}
                    textAnchor="middle" fontSize="6.5" fontWeight="700"
                    fill={isSel ? "white" : "#ced2da"} opacity="0.95">
                    {bed.id.replace("-BED-", " ")} · {L}m
                  </text>

                  {/* Right end-cap */}
                  <polygon points={pts([B, C, G, F])}
                    fill={MULCH_END} stroke="#2a2d34" strokeWidth="0.45" />
                  <line x1={F.x} y1={F.y} x2={G.x} y2={G.y}
                    stroke="#88909a" strokeWidth="0.8" opacity="0.55" />

                  {/* Top face — silver plastic mulch */}
                  <polygon points={pts([E, F, G, H])}
                    fill="url(#fmMulch)" stroke="#90949c" strokeWidth="0.5" />

                  {/* Zone colour strip */}
                  <polygon points={pts([E, Es, Hs, H])} fill={zc} opacity="0.8" />
                  <polygon points={pts([E, Es, Hs, H])} fill="white" opacity="0.13" />

                  {/* Health tint overlay */}
                  {viewMode === "health" && bed.health !== "healthy" && (
                    <polygon points={pts([E, F, G, H])}
                      fill={HEALTH_COLOR[bed.health]} opacity="0.2" />
                  )}

                  {/* Drip tape */}
                  <line x1={dt1.x} y1={dt1.y} x2={dt2.x} y2={dt2.y}
                    stroke="#182850" strokeWidth="1" strokeDasharray="5,3.5" opacity="0.44" />

                  {/* ── Plant rosettes ────────────────────────────────────── */}
                  {plants.map(({ p1, p2, hasBerry1, hasBerry2 }, pi) => (
                    <g key={pi}>
                      {/* Row 1 — drop shadow + rosette */}
                      <ellipse cx={p1.x} cy={p1.y + 1} rx="5" ry="1.5" fill="black" opacity="0.2" />
                      <circle  cx={p1.x} cy={p1.y}     r="4.6"          fill="#0a0200" opacity="0.52" />
                      {Array.from({ length: 5 }, (_, j) => {
                        const a = j * (Math.PI * 2 / 5) - Math.PI / 2;
                        return (
                          <circle key={j}
                            cx={p1.x + Math.cos(a) * 2.6} cy={p1.y + Math.sin(a) * 2.6}
                            r="2.1" fill={plantFill}
                            opacity={infected ? 0.68 : 0.92}
                            className={infected ? "fmpulse" : undefined} />
                        );
                      })}
                      <circle cx={p1.x} cy={p1.y} r="1.6" fill="#0d3e07" opacity="0.95" />
                      {hasBerry1 && (
                        <>
                          <circle cx={p1.x + 1.8} cy={p1.y + 1.8} r="1.5"
                            fill={berryClr} opacity="0.97" className="fmberry" />
                          <circle cx={p1.x + 2.5} cy={p1.y + 1.1} r="0.5"
                            fill="white"    opacity="0.7" />
                        </>
                      )}

                      {/* Row 2 — drop shadow + rosette */}
                      <ellipse cx={p2.x} cy={p2.y + 0.9} rx="4.4" ry="1.3" fill="black" opacity="0.17" />
                      <circle  cx={p2.x} cy={p2.y}        r="4"            fill="#0a0200" opacity="0.46" />
                      {Array.from({ length: 5 }, (_, j) => {
                        const a = j * (Math.PI * 2 / 5) - Math.PI / 2;
                        return (
                          <circle key={j}
                            cx={p2.x + Math.cos(a) * 2.3} cy={p2.y + Math.sin(a) * 2.3}
                            r="1.9" fill={plantFill}
                            opacity={infected ? 0.62 : 0.84}
                            className={infected ? "fmpulse" : undefined} />
                        );
                      })}
                      <circle cx={p2.x} cy={p2.y} r="1.45" fill="#0d3e07" opacity="0.88" />
                      {hasBerry2 && (
                        <>
                          <circle cx={p2.x + 1.6} cy={p2.y + 1.6} r="1.35"
                            fill={berryClr} opacity="0.93" className="fmberry" />
                          <circle cx={p2.x + 2.2} cy={p2.y + 1.0} r="0.45"
                            fill="white"    opacity="0.65" />
                        </>
                      )}
                    </g>
                  ))}

                  {/* Infected / Warning compact badge */}
                  {(infected || warn) && (() => {
                    const bp  = iso(L * 0.9, rowStart + BED_DEPTH * 0.28, BED_HEIGHT + 0.55);
                    const clr = infected ? "#dc2626" : "#d97706";
                    return (
                      <g className={infected ? "fmwarn" : undefined}>
                        <circle cx={bp.x} cy={bp.y} r="9"  fill={clr} opacity="0.96" />
                        <circle cx={bp.x} cy={bp.y} r="9"  fill="white" opacity="0.14" />
                        <text x={bp.x} y={bp.y + 3.5}
                          textAnchor="middle" fontSize="9" fontWeight="900" fill="white">
                          {infected ? "!" : "▲"}
                        </text>
                      </g>
                    );
                  })()}

                  {/* Harvest badge */}
                  {yieldKg > 0 && (() => {
                    const bp = iso(L * 0.58, rowStart + BED_DEPTH * 0.44, BED_HEIGHT + 0.52);
                    return (
                      <>
                        <rect x={bp.x - 23} y={bp.y - 7.5} width="46" height="15"
                          rx="7.5" fill="#052e16" opacity="0.93" />
                        <rect x={bp.x - 23} y={bp.y - 7.5} width="46" height="15"
                          rx="7.5" fill="#16a34a" opacity="0.22" />
                        <text x={bp.x} y={bp.y + 3}
                          textAnchor="middle" fontSize="7" fontWeight="800" fill="#86efac">
                          🌾 {yieldKg.toFixed(1)} kg
                        </text>
                      </>
                    );
                  })()}

                  {/* Selection outline */}
                  {isSel && (
                    <>
                      <polygon points={pts([A, B, C, D])}
                        fill={`${zc}20`} stroke={zc} strokeWidth="2.5"
                        strokeDasharray="6,3" opacity="0.8" />
                      <polygon points={pts([E, F, G, H])}
                        fill={`${zc}18`} stroke={zc} strokeWidth="1.5" opacity="0.5" />
                    </>
                  )}
                </g>
              );
            })}

            {/* ── Length ruler ─────────────────────────────────────────────── */}
            {[0, 10, 20, 30, maxLen].filter((v, i, a) => a.indexOf(v) === i).map(m => {
              const p0 = iso(m, 0, 0);
              return (
                <g key={m} opacity="0.58">
                  <line x1={p0.x} y1={p0.y + 7} x2={p0.x} y2={p0.y + 15}
                    stroke="#c8aa80" strokeWidth="1.1" />
                  <text x={p0.x} y={p0.y + 24}
                    textAnchor="middle" fontSize="7.5" fontWeight="600" fill="#d4b890">{m}m</text>
                </g>
              );
            })}
            <line
              x1={iso(0, 0, 0).x}      y1={iso(0, 0, 0).y + 10}
              x2={iso(maxLen, 0, 0).x} y2={iso(maxLen, 0, 0).y + 10}
              stroke="#b09070" strokeWidth="1" opacity="0.5" />

            {/* ── Compass ──────────────────────────────────────────────────── */}
            {(() => {
              const cx = maxX - 26;
              const cy = minY + skyH * 0.56;
              return (
                <g>
                  <circle cx={cx} cy={cy} r="18" fill="#0a0f1e" opacity="0.56" />
                  <circle cx={cx} cy={cy} r="18" fill="none" stroke="white" strokeWidth="0.8" opacity="0.22" />
                  <line x1={cx} y1={cy - 14} x2={cx} y2={cy + 14} stroke="white" strokeWidth="0.7" opacity="0.28" />
                  <line x1={cx - 14} y1={cy} x2={cx + 14} y2={cy} stroke="white" strokeWidth="0.7" opacity="0.28" />
                  <polygon points={`${cx},${cy - 14} ${cx - 4.5},${cy + 1} ${cx + 4.5},${cy + 1}`}
                    fill="white" opacity="0.95" />
                  <polygon points={`${cx},${cy + 14} ${cx - 4.5},${cy - 1} ${cx + 4.5},${cy - 1}`}
                    fill="#475569" opacity="0.55" />
                  <text x={cx} y={cy - 17}
                    textAnchor="middle" fontSize="6" fontWeight="900" fill="white" opacity="0.88">N</text>
                </g>
              );
            })()}

          </svg>
        </div>

        {/* Legend bar */}
        <div className="px-4 py-2.5 flex items-center gap-3 flex-wrap text-[10px]"
          style={{ background: "linear-gradient(135deg,#2a1208 0%,#1a2812 100%)" }}>
          {viewMode === "health" && Object.entries(HEALTH_COLOR).map(([k, v]) => (
            <span key={k} className="flex items-center gap-1.5 text-white/75 font-semibold capitalize">
              <span className="size-2.5 rounded-full inline-block" style={{ background: v }} />{k}
            </span>
          ))}
          {viewMode === "stage" && Object.entries(STAGE_LABEL).map(([k, label]) => (
            <span key={k} className="flex items-center gap-1.5 text-white/75 font-semibold">
              <span className="size-2.5 rounded-full inline-block" style={{ background: STAGE_COLOR[k] }} />{label}
            </span>
          ))}
          {viewMode === "yield" && [
            ["#14532d", "High"], ["#16a34a", "Med"], ["#4ade80", "Low"], ["#bbf7d0", "None"],
          ].map(([c, l]) => (
            <span key={l} className="flex items-center gap-1.5 text-white/75 font-semibold">
              <span className="size-2.5 rounded-full inline-block" style={{ background: c }} />{l}
            </span>
          ))}
          <span className="ml-auto text-white/32 text-[9px]">
            Colour strip = zone · Length = bed size
          </span>
        </div>
      </div>

      {/* Selected bed info card */}
      {selectedBed && (() => {
        const vi      = valves.findIndex(v => v.id === selectedBed.valveId);
        const zc      = VALVE_COLORS[vi % 3] ?? "#10b981";
        const yieldKg = harvestKgByBed[selectedBed.id] ?? 0;
        const hClr    = HEALTH_COLOR[selectedBed.health];
        const stClr   = STAGE_TEXT_COLOR[selectedBed.stage] ?? "#475569";
        const stBg    = STAGE_COLOR[selectedBed.stage] ?? "#94a3b8";
        return (
          <div className="rounded-2xl border-2 bg-white shadow-xl overflow-hidden"
            style={{ borderColor: `${zc}45` }}>
            <div className="h-1.5" style={{ background: `linear-gradient(90deg,${zc},${zc}60,transparent)` }} />
            <div className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="font-black text-slate-900 text-lg leading-tight tracking-tight">
                    {selectedBed.id.replace("-BED-", " — ")}
                  </div>
                  <div className="text-sm font-semibold text-slate-600 mt-0.5">{selectedBed.variety}</div>
                  <div className="text-xs text-slate-400">{selectedBed.origin}</div>
                </div>
                <button onClick={() => setSelected(null)}
                  className="size-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 font-bold text-lg transition-colors">
                  ×
                </button>
              </div>

              <div className="grid grid-cols-4 gap-2 mb-3">
                {[
                  { label: "Length",  value: `${selectedBed.lengthM} m`,           icon: "📏" },
                  { label: "Plants",  value: plantsInBed(selectedBed).toString(),   icon: "🌿" },
                  { label: "Stage",   value: STAGE_LABEL[selectedBed.stage] ?? selectedBed.stage, icon: "🌱" },
                  { label: "Harvest", value: yieldKg > 0 ? `${yieldKg.toFixed(1)} kg` : "—",     icon: "🌾" },
                ].map(({ label, value, icon }) => (
                  <div key={label} className="bg-slate-50 rounded-xl p-2.5 text-center border border-slate-100">
                    <div className="text-base mb-0.5">{icon}</div>
                    <div className="text-sm font-black text-slate-800 leading-tight">{value}</div>
                    <div className="text-[9px] text-slate-400 mt-0.5 uppercase tracking-wider">{label}</div>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 mb-3">
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full border"
                  style={{ background: `${hClr}14`, color: hClr, borderColor: `${hClr}40` }}>
                  ● {selectedBed.health.charAt(0).toUpperCase() + selectedBed.health.slice(1)}
                </span>
                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full border"
                  style={{ background: `${stBg}18`, color: stClr, borderColor: `${stBg}40` }}>
                  {STAGE_LABEL[selectedBed.stage]}
                </span>
              </div>

              <Link href={`/beds/${selectedBed.id}`}
                className="flex items-center justify-center gap-2 w-full text-sm font-bold py-2.5 rounded-xl text-white transition-opacity hover:opacity-90"
                style={{ background: `linear-gradient(135deg,${zc},${zc}aa)` }}>
                Open Bed Profile →
              </Link>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
