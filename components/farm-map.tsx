"use client";

import Link from "next/link";
import { useState } from "react";
import type { Bed, Valve } from "@/lib/types";
import { plantsInBed } from "@/lib/data";

interface Props {
  valves: Valve[];
  beds: Bed[];
  harvestKgByBed: Record<string, number>;
  /** Optional: highlight only beds for this supervisor's valves */
  highlightValves?: string[];
}

// Health → fill/stroke palette
const HEALTH = {
  healthy:  { fill: "#22c55e", fillLight: "#dcfce7", stroke: "#16a34a", label: "Healthy",  dot: "#16a34a" },
  warning:  { fill: "#f59e0b", fillLight: "#fef9c3", stroke: "#d97706", label: "Warning",  dot: "#d97706" },
  infected: { fill: "#ef4444", fillLight: "#fee2e2", stroke: "#dc2626", label: "Infected", dot: "#dc2626" },
};

// Stage labels
const STAGE_ICONS: Record<string, string> = {
  planted: "🌱", vegetative: "🌿", flowering: "🌸", fruiting: "🍓", ripening: "🍓", harvest: "🍓",
};

const VALVE_COLORS = ["#10b981","#3b82f6","#a855f7"] as const;

export function FarmMap({ valves, beds, harvestKgByBed, highlightValves }: Props) {
  const [hovered, setHovered] = useState<Bed | null>(null);
  const [hoveredPos, setHoveredPos] = useState({ x: 0, y: 0 });

  // Layout constants
  const W = 960, H = 380;
  const HEADER_H = 22;
  const PAD = { top: 38, bottom: 18, left: 14, right: 14 };
  const VALVE_GAP = 14;
  const totalValveW = (W - VALVE_GAP * (valves.length - 1));

  return (
    <div className="relative w-full select-none">
      {/* Mobile scroll hint */}
      <div className="md:hidden flex items-center justify-center gap-1.5 text-[11px] text-slate-400 mb-2">
        <span>←</span>
        <span>Scroll to explore the farm map</span>
        <span>→</span>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div style={{ minWidth: 640 }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        style={{ display: "block", minWidth: 640 }}
      >
        <defs>
          {/* Ground pattern */}
          <pattern id="soil" width="8" height="8" patternUnits="userSpaceOnUse">
            <rect width="8" height="8" fill="#f5ede0" />
            <circle cx="2" cy="6" r="0.7" fill="#d6b896" opacity="0.5" />
            <circle cx="6" cy="2" r="0.7" fill="#d6b896" opacity="0.4" />
          </pattern>

          {/* Path/walkway */}
          <pattern id="path" width="12" height="12" patternUnits="userSpaceOnUse">
            <rect width="12" height="12" fill="#e9e0d4"/>
            <rect y="6" width="12" height="1" fill="#d6c9b8" opacity="0.4"/>
          </pattern>

          {/* Subtle overlay for dimmed beds */}
          <filter id="dim">
            <feColorMatrix type="saturate" values="0.3" />
          </filter>

          {/* Glow effect for infected */}
          <filter id="redglow">
            <feGaussianBlur stdDeviation="2" result="blur"/>
            <feComposite in="SourceGraphic" in2="blur" operator="over"/>
          </filter>

          {/* Bed shadow */}
          <filter id="bshadow" x="-10%" y="-10%" width="120%" height="130%">
            <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" floodColor="#00000030"/>
          </filter>

          {/* Valve zone gradient overlays */}
          {valves.map((v, i) => (
            <linearGradient key={v.id} id={`valveBg${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={VALVE_COLORS[i % 3]} stopOpacity="0.06"/>
              <stop offset="100%" stopColor={VALVE_COLORS[i % 3]} stopOpacity="0.02"/>
            </linearGradient>
          ))}

          {/* Plastic mulch texture */}
          <pattern id="plastic" width="4" height="4" patternUnits="userSpaceOnUse">
            <rect width="4" height="4" fill="white"/>
            <line x1="0" y1="2" x2="4" y2="2" stroke="#e2e8f0" strokeWidth="0.5"/>
          </pattern>
        </defs>

        {/* ─── BACKGROUND ─── */}
        <rect x="0" y="0" width={W} height={H} fill="url(#soil)" />

        {/* Mountain silhouette (decorative top) */}
        <path d={`M0,${H*0.18} Q${W*0.15},${H*0.04} ${W*0.3},${H*0.14} Q${W*0.45},${H*0.02} ${W*0.6},${H*0.12} Q${W*0.8},${H*0.0} ${W},${H*0.10} L${W},0 L0,0Z`}
          fill="#f0f7ee" opacity="0.4"/>

        {/* Bottom walkway */}
        <rect x="0" y={H - 44} width={W} height={44} fill="url(#path)" />
        <line x1="0" y1={H-44} x2={W} y2={H-44} stroke="#c9bfb0" strokeWidth="1"/>
        {/* Walkway centre line */}
        <line x1="0" y1={H-22} x2={W} y2={H-22} stroke="#c9bfb0" strokeWidth="0.5" strokeDasharray="8 6" opacity="0.6"/>

        {/* ─── IRRIGATION MAIN PIPE ─── */}
        <rect x="0" y={HEADER_H + 30} width={W} height={4} rx="2" fill="#94a3b8" opacity="0.4"/>
        {/* Pipe highlight */}
        <rect x="0" y={HEADER_H + 30} width={W} height={1.5} rx="1" fill="white" opacity="0.4"/>

        {/* ─── VALVE ZONES ─── */}
        {valves.map((valve, vi) => {
          const vW = Math.floor((W - (valves.length - 1) * VALVE_GAP) / valves.length);
          const vX = vi * (vW + VALVE_GAP);
          const vY = HEADER_H;
          const vH = H - HEADER_H - 44;

          const vBeds = beds.filter(b => b.valveId === valve.id);
          const bedCount = vBeds.length;
          const isDimmed = highlightValves && !highlightValves.includes(valve.id);

          // Bed layout: vertical parallel strips
          const BED_COLS = bedCount;
          const BED_PAD_L = PAD.left, BED_PAD_R = PAD.right;
          const BED_TOP = PAD.top + 12, BED_BOT = PAD.bottom + 4;
          const bedAreaW = vW - BED_PAD_L - BED_PAD_R;
          const bedAreaH = vH - BED_TOP - BED_BOT;
          const bedW = Math.floor(bedAreaW / BED_COLS) - 4;
          const bedGap = Math.floor((bedAreaW - bedW * BED_COLS) / Math.max(BED_COLS - 1, 1));

          // Valve pipe connector
          const pipeX = vX + vW / 2;

          return (
            <g key={valve.id} filter={isDimmed ? "url(#dim)" : undefined}>
              {/* Zone background */}
              <rect x={vX} y={vY} width={vW} height={vH} fill={`url(#valveBg${vi})`} rx="4"/>
              <rect x={vX} y={vY} width={vW} height={vH} fill="none" rx="4"
                stroke={VALVE_COLORS[vi % 3]} strokeWidth="1.5" strokeDasharray="5 4" opacity="0.4"/>

              {/* Valve symbol */}
              <line x1={pipeX} y1={HEADER_H + 30} x2={pipeX} y2={vY + PAD.top - 8}
                stroke={VALVE_COLORS[vi % 3]} strokeWidth="2" opacity="0.5"/>
              <circle cx={pipeX} cy={vY + PAD.top - 10} r="6"
                fill={VALVE_COLORS[vi % 3]} opacity="0.9"/>
              <text x={pipeX} y={vY + PAD.top - 7} textAnchor="middle" fontSize="7" fill="white" fontWeight="800">
                {valve.name.split(" ")[1]}
              </text>

              {/* Zone label */}
              <text x={vX + 10} y={vY + 14} fontSize="10" fontWeight="700" fill={VALVE_COLORS[vi % 3]} opacity="0.8">
                {valve.name}
              </text>
              <text x={vX + 10} y={vY + 24} fontSize="7.5" fill="#64748b">
                {vBeds.length} beds · {vBeds.reduce((s,b)=>s+plantsInBed(b),0).toLocaleString()} plants
              </text>

              {/* ── BEDS ── */}
              {vBeds.map((bed, bi) => {
                const bX = vX + BED_PAD_L + bi * (bedW + bedGap);
                const bH = Math.round(bedAreaH * (bed.lengthM / 45));
                const bY = vY + vH - BED_BOT - bH - 2;
                const h = HEALTH[bed.health];
                const ready = bed.stage === "ripening" || bed.stage === "harvest";
                const todayKg = harvestKgByBed[bed.id] ?? 0;
                const isHovered = hovered?.id === bed.id;

                return (
                  <Link key={bed.id} href={`/beds/${bed.id}`}>
                    <g
                      className="cursor-pointer"
                      onMouseEnter={e => {
                        setHovered(bed);
                        const svg = (e.currentTarget as SVGGElement).closest("svg")!;
                        const pt = svg.createSVGPoint();
                        pt.x = e.clientX; pt.y = e.clientY;
                        const svgPt = pt.matrixTransform(svg.getScreenCTM()!.inverse());
                        setHoveredPos({ x: svgPt.x, y: svgPt.y });
                      }}
                      onMouseLeave={() => setHovered(null)}
                    >
                      {/* Bed shadow/base */}
                      <rect x={bX - 1} y={bY + 2} width={bedW + 2} height={bH} rx="2"
                        fill="#00000018" />

                      {/* Bed body — plastic mulch */}
                      <rect x={bX} y={bY} width={bedW} height={bH} rx="2"
                        fill="url(#plastic)"
                        stroke={h.stroke} strokeWidth={isHovered ? 2 : 1}
                      />

                      {/* Health colour overlay */}
                      <rect x={bX} y={bY} width={bedW} height={bH} rx="2"
                        fill={h.fill} opacity={isHovered ? 0.35 : 0.22}/>

                      {/* Drip tape lines */}
                      {[0.2, 0.5, 0.8].map(p => (
                        <line key={p}
                          x1={bX + 2} y1={bY + bH * p}
                          x2={bX + bedW - 2} y2={bY + bH * p}
                          stroke={VALVE_COLORS[vi % 3]} strokeWidth="0.5" opacity="0.35"
                        />
                      ))}

                      {/* Plant rows (dots) */}
                      {Array.from({ length: Math.min(8, Math.floor(bH / 7)) }).map((_, pi) => (
                        <circle key={pi}
                          cx={bX + bedW / 2}
                          cy={bY + 5 + pi * (bH - 10) / Math.max(7, 1)}
                          r="1.5"
                          fill={h.fill} opacity="0.7"
                        />
                      ))}

                      {/* Health indicator bar (left edge) */}
                      <rect x={bX} y={bY} width="3" height={bH} rx="1.5"
                        fill={h.fill} opacity="0.9"/>

                      {/* Status icon center */}
                      {bed.health === "infected" && (
                        <>
                          <circle cx={bX + bedW/2} cy={bY + bH/2} r="7"
                            fill="#dc2626" opacity="0.9" filter="url(#redglow)"/>
                          <text x={bX + bedW/2} y={bY + bH/2 + 3.5}
                            textAnchor="middle" fontSize="8" fill="white" fontWeight="900">!</text>
                        </>
                      )}
                      {bed.health === "warning" && (
                        <>
                          <circle cx={bX + bedW/2} cy={bY + bH/2} r="6" fill="#f59e0b" opacity="0.85"/>
                          <text x={bX + bedW/2} y={bY + bH/2 + 3} textAnchor="middle" fontSize="7" fill="white" fontWeight="800">!</text>
                        </>
                      )}
                      {ready && bed.health === "healthy" && (
                        <text x={bX + bedW/2} y={bY + bH/2 + 4} textAnchor="middle" fontSize="10">🍓</text>
                      )}

                      {/* Today harvest badge */}
                      {todayKg > 0 && (
                        <g>
                          <rect x={bX + 1} y={bY + 1} width={bedW - 2} height="10" rx="1.5"
                            fill="#0f172a" opacity="0.82"/>
                          <text x={bX + bedW/2} y={bY + 8.5}
                            textAnchor="middle" fontSize="6" fill="white" fontWeight="700">
                            {todayKg.toFixed(1)}kg
                          </text>
                        </g>
                      )}

                      {/* Bed label below */}
                      <text x={bX + bedW/2} y={bY + bH + 10}
                        textAnchor="middle" fontSize="6.5" fill="#64748b" fontWeight="600">
                        {bed.id.replace("-BED-","")}
                      </text>
                    </g>
                  </Link>
                );
              })}

              {/* Irrigation lateral lines */}
              {vBeds.map((bed, bi) => {
                const bX = vX + BED_PAD_L + bi * (bedW + bedGap) + bedW / 2;
                const topY = vY + PAD.top + 4;
                return (
                  <line key={bed.id}
                    x1={bX} y1={topY + 8}
                    x2={bX} y2={vY + PAD.top - 8}
                    stroke={VALVE_COLORS[vi % 3]} strokeWidth="1" strokeDasharray="2 2" opacity="0.25"/>
                );
              })}
            </g>
          );
        })}

        {/* ─── HOVER TOOLTIP ─── */}
        {hovered && (() => {
          const h = HEALTH[hovered.health];
          const tx = Math.min(hoveredPos.x + 14, W - 165);
          const ty = Math.max(hoveredPos.y - 80, 4);
          return (
            <g>
              <rect x={tx} y={ty} width="160" height="78" rx="6"
                fill="#0f172a" opacity="0.95"
                filter="url(#bshadow)"/>
              <rect x={tx} y={ty} width="3" height="78" rx="1.5" fill={h.fill}/>
              <text x={tx+10} y={ty+14} fontSize="10" fontWeight="800" fill="white">{hovered.id}</text>
              <text x={tx+10} y={ty+25} fontSize="8" fill="#94a3b8">{hovered.variety}</text>
              <text x={tx+10} y={ty+37} fontSize="8" fill="#94a3b8">{hovered.origin}</text>
              <g>
                <circle cx={tx+12} cy={ty+48} r="4" fill={h.fill}/>
                <text x={tx+20} y={ty+51} fontSize="7.5" fill={h.fillLight} fontWeight="600">{h.label.charAt(0).toUpperCase() + h.label.slice(1)}</text>
              </g>
              <text x={tx+10} y={ty+62} fontSize="7.5" fill="#64748b">
                {`📏 ${hovered.lengthM}m · 🌱 ${plantsInBed(hovered)} plants · ${STAGE_ICONS[hovered.stage]} ${hovered.stage}`}
              </text>
              <text x={tx+10} y={ty+73} fontSize="7.5" fill="#64748b">
                {`Planted ${new Date(hovered.plantedDate).toLocaleDateString("en",{month:"short",day:"numeric"})}`}
              </text>
            </g>
          );
        })()}

        {/* ─── COMPASS ─── */}
        <g transform={`translate(${W - 28}, ${H - 34})`}>
          <circle r="16" fill="white" stroke="#e2e8f0" strokeWidth="1"/>
          <text y="-3" textAnchor="middle" fontSize="7" fontWeight="800" fill="#dc2626">N</text>
          <text y="10" textAnchor="middle" fontSize="5.5" fill="#94a3b8">S</text>
          <text x="9" y="2" textAnchor="middle" fontSize="5.5" fill="#94a3b8">E</text>
          <text x="-9" y="2" textAnchor="middle" fontSize="5.5" fill="#94a3b8">W</text>
          <line x1="0" y1="-12" x2="0" y2="12" stroke="#e2e8f0" strokeWidth="0.5"/>
          <line x1="-12" y1="0" x2="12" y2="0" stroke="#e2e8f0" strokeWidth="0.5"/>
        </g>

        {/* ─── SCALE BAR ─── */}
        <g transform={`translate(18, ${H - 30})`}>
          <rect x="0" y="4" width="40" height="4" fill="none" stroke="#94a3b8" strokeWidth="1"/>
          <rect x="0" y="4" width="20" height="4" fill="#94a3b8" opacity="0.5"/>
          <line x1="0" y1="0" x2="0" y2="8" stroke="#94a3b8" strokeWidth="1"/>
          <line x1="40" y1="0" x2="40" y2="8" stroke="#94a3b8" strokeWidth="1"/>
          <text x="20" y="16" textAnchor="middle" fontSize="6.5" fill="#94a3b8">≈ 20m</text>
        </g>

        {/* ─── TITLE BAR ─── */}
        <rect x="0" y="0" width={W} height={HEADER_H - 2} fill="#f8fafc"/>
        <text x="14" y="14" fontSize="10" fontWeight="700" fill="#1e293b">ENTOTO Riverside Farm — Field Plan</text>
        <text x={W - 14} y="14" textAnchor="end" fontSize="8.5" fill="#94a3b8">2026 · Addis Ababa, Ethiopia · 2800m</text>
        <line x1="0" y1={HEADER_H - 2} x2={W} y2={HEADER_H - 2} stroke="#e2e8f0" strokeWidth="1"/>
      </svg>

      {/* ─── LEGEND ─── */}
      <div className="flex items-center gap-4 px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex-wrap">
        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mr-1">Legend</span>
        {Object.entries(HEALTH).map(([k, v]) => (
          <span key={k} className="flex items-center gap-1.5 text-[11px] text-slate-600">
            <span className="size-3 rounded" style={{background: v.fill, opacity: 0.9}}/>
            {v.label}
          </span>
        ))}
        <span className="flex items-center gap-1.5 text-[11px] text-slate-600"><span>🍓</span>Ready to harvest</span>
        <span className="flex items-center gap-1.5 text-[11px] text-slate-600 ml-auto">Click any bed to open profile</span>
      </div>
      </div>{/* /minWidth wrapper */}
      </div>{/* /overflow-x-auto */}
    </div>
  );
}
