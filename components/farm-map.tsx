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

const VALVE_COLORS = ["#10b981", "#3b82f6", "#a855f7"] as const;

const HEALTH_COLOR = {
  healthy: "#22c55e",
  warning: "#f59e0b",
  infected: "#ef4444",
} as const;

const STAGE_COLOR: Record<string, string> = {
  planted:    "#94a3b8",
  vegetative: "#4ade80",
  flowering:  "#f9a8d4",
  fruiting:   "#fb923c",
  ripening:   "#f87171",
  harvest:    "#22c55e",
};

const STAGE_LABEL: Record<string, string> = {
  planted: "Planted", vegetative: "Vegetative", flowering: "Flowering",
  fruiting: "Fruiting", ripening: "Ripening", harvest: "Harvest",
};

const SOIL   = "#6a2d10";
const MULCH  = "#bfc3cb";
const MULCH2 = "#d6d9df";

export function FarmMap({ valves, beds, harvestKgByBed, highlightValves }: Props) {
  const [selected, setSelected]     = useState<string | null>(null);
  const [viewMode, setViewMode]     = useState<ViewMode>("health");
  const [perspective, setPerspective] = useState(true);

  const selectedBed = beds.find(b => b.id === selected);

  // SVG layout constants
  const W         = 420;
  const PAD_X     = 10;
  const BED_W     = W - PAD_X * 2;
  const STRIPE_W  = 4;
  const SOIL_GAP  = 8;
  const ZONE_H    = 32;
  const ZONE_GAP  = 14;

  // Build layout positions
  const layout = useMemo(() => {
    let y = 8;
    return valves.map((valve, vi) => {
      const zoneBeds = beds.filter(b => b.valveId === valve.id);
      const headerY = y;
      y += ZONE_H;
      const bedRows = zoneBeds.map(bed => {
        const h = Math.max(26, Math.round(bed.lengthM * 0.65));
        const bedY = y;
        y += h + SOIL_GAP;
        return { bed, y: bedY, h };
      });
      y += ZONE_GAP;
      return { valve, vi, headerY, bedRows };
    });
  }, [valves, beds]);

  const totalH = useMemo(() => {
    let y = 8;
    valves.forEach(valve => {
      y += ZONE_H;
      beds.filter(b => b.valveId === valve.id).forEach(bed => {
        y += Math.max(26, Math.round(bed.lengthM * 0.65)) + SOIL_GAP;
      });
      y += ZONE_GAP;
    });
    return y + 6;
  }, [valves, beds]);

  const maxYield = Math.max(...beds.map(b => harvestKgByBed[b.id] ?? 0), 1);

  function plantColor(bed: Bed): string {
    if (viewMode === "stage")  return STAGE_COLOR[bed.stage]  ?? "#94a3b8";
    if (viewMode === "yield") {
      const r = (harvestKgByBed[bed.id] ?? 0) / maxYield;
      if (r > 0.75) return "#14532d";
      if (r > 0.45) return "#16a34a";
      if (r > 0.15) return "#4ade80";
      return "#bbf7d0";
    }
    return HEALTH_COLOR[bed.health] ?? "#22c55e";
  }

  return (
    <div className="space-y-3">

      {/* ── Controls ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        {(["health", "yield", "stage"] as ViewMode[]).map(m => (
          <button
            key={m}
            onClick={() => setViewMode(m)}
            className={`text-[11px] px-3 py-1.5 rounded-full font-semibold transition-all border ${
              viewMode === m
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
            }`}
          >
            {m === "health" ? "🌿 Health" : m === "yield" ? "🌾 Yield" : "🌸 Stage"}
          </button>
        ))}
        <button
          onClick={() => setPerspective(p => !p)}
          className={`ml-auto text-[11px] px-3 py-1.5 rounded-full font-semibold border transition-all ${
            perspective
              ? "bg-indigo-600 text-white border-indigo-600"
              : "bg-white text-slate-600 border-slate-200"
          }`}
        >
          {perspective ? "◈ 3D" : "⬜ 2D"}
        </button>
      </div>

      {/* ── Map ───────────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-md bg-[#6a2d10]">
        <div style={perspective ? { perspective: "900px", perspectiveOrigin: "50% -10%" } : {}}>
          <div style={perspective ? {
            transform: "rotateX(22deg) scaleY(0.96)",
            transformOrigin: "50% 0%",
            transformStyle: "preserve-3d",
          } : {}}>
            <svg
              viewBox={`0 0 ${W} ${totalH}`}
              width="100%"
              style={{ display: "block" }}
            >
              <defs>
                {/* Silver plastic mulch — horizontal sheen lines */}
                <linearGradient id="mulchGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={MULCH2} />
                  <stop offset="40%"  stopColor={MULCH}  />
                  <stop offset="100%" stopColor="#a8acb4" />
                </linearGradient>
                <pattern id="mulchPat" width="1" height="5" patternUnits="userSpaceOnUse">
                  <rect width="1" height="5" fill="url(#mulchGrad)" />
                  <rect y="2.5" width="1" height="0.7" fill={MULCH2} opacity="0.5" />
                </pattern>

                {/* Ethiopian red soil */}
                <pattern id="soilPat" width="14" height="14" patternUnits="userSpaceOnUse">
                  <rect width="14" height="14" fill={SOIL} />
                  <circle cx="3"  cy="5"  r="1"   fill="#4e1f08" opacity="0.35" />
                  <circle cx="10" cy="10" r="0.8" fill="#4e1f08" opacity="0.28" />
                  <circle cx="7"  cy="2"  r="0.6" fill="#832512" opacity="0.2"  />
                </pattern>

                {/* Drip tape line */}
                <pattern id="dripPat" width="12" height="1" patternUnits="userSpaceOnUse">
                  <rect width="8" height="1" fill="#8899bb" opacity="0.55" />
                  <rect x="8" width="4" height="1" fill="transparent" />
                </pattern>

                {/* Infected pulse */}
                <style>{`
                  @keyframes mpulse { 0%,100%{opacity:.9} 50%{opacity:.3} }
                  .mpulse { animation: mpulse 1.4s ease-in-out infinite; }
                  @keyframes mring { 0%{r:5;opacity:.8} 100%{r:11;opacity:0} }
                  .mring { animation: mring 1.8s ease-out infinite; }
                `}</style>
              </defs>

              {/* Soil background */}
              <rect x="0" y="0" width={W} height={totalH} fill="url(#soilPat)" />

              {layout.map(({ valve, vi, headerY, bedRows }) => {
                const zc       = VALVE_COLORS[vi % 3];
                const isDimmed = highlightValves && !highlightValves.includes(valve.id);
                const totalKg  = bedRows.reduce((s, { bed }) => s + (harvestKgByBed[bed.id] ?? 0), 0);

                return (
                  <g key={valve.id} opacity={isDimmed ? 0.35 : 1}>

                    {/* ── Zone header bar ──────────────────────────────── */}
                    <rect x={PAD_X} y={headerY} width={BED_W} height={ZONE_H - 4}
                      rx="3" fill={zc} opacity="0.18" />
                    <rect x={PAD_X} y={headerY} width={STRIPE_W} height={ZONE_H - 4}
                      rx="2" fill={zc} />
                    <text x={PAD_X + 10} y={headerY + 13} fontSize="11" fontWeight="800" fill={zc}>
                      {valve.name}
                    </text>
                    <text x={PAD_X + 10} y={headerY + 24} fontSize="8" fill="#c4b5a8">
                      {bedRows.length} beds
                      {totalKg > 0 ? ` · 🌾 ${totalKg.toFixed(1)} kg today` : ""}
                      {` · ${valve.irrigationSchedule}`}
                    </text>

                    {/* ── Beds ─────────────────────────────────────────── */}
                    {bedRows.map(({ bed, y: bY, h: bH }) => {
                      const pColor   = plantColor(bed);
                      const isSelected = selected === bed.id;
                      const yieldKg  = harvestKgByBed[bed.id] ?? 0;
                      const readyFruit = bed.stage === "fruiting" || bed.stage === "ripening" || bed.stage === "harvest";

                      // How many plant columns fit?
                      const plantSpacing = 15;
                      const plantCols    = Math.floor((BED_W - STRIPE_W - 12) / plantSpacing);
                      const row1Y = bY + bH * 0.28;
                      const row2Y = bY + bH * 0.72;

                      return (
                        <g
                          key={bed.id}
                          className="cursor-pointer"
                          onClick={() => setSelected(isSelected ? null : bed.id)}
                        >
                          {/* Mulch bed */}
                          <rect
                            x={PAD_X} y={bY} width={BED_W} height={bH}
                            fill="url(#mulchPat)"
                            rx="2"
                          />

                          {/* Selection highlight */}
                          {isSelected && (
                            <rect x={PAD_X} y={bY} width={BED_W} height={bH}
                              rx="2" fill={zc} opacity="0.2"
                              stroke={zc} strokeWidth="1.5"
                            />
                          )}

                          {/* Health tint for infected/warning */}
                          {viewMode === "health" && bed.health !== "healthy" && (
                            <rect x={PAD_X} y={bY} width={BED_W} height={bH}
                              rx="2" fill={HEALTH_COLOR[bed.health]} opacity="0.14" />
                          )}

                          {/* Zone color left stripe */}
                          <rect x={PAD_X} y={bY} width={STRIPE_W} height={bH}
                            rx="1.5" fill={zc} opacity="0.85" />

                          {/* Drip irrigation tape (dashed center line) */}
                          <rect
                            x={PAD_X + STRIPE_W + 4} y={bY + bH / 2 - 0.5}
                            width={BED_W - STRIPE_W - 8} height="1"
                            fill="url(#dripPat)"
                          />

                          {/* ── Plant dots — 2 rows ──────────────────── */}
                          {Array.from({ length: plantCols }).map((_, ci) => {
                            const cx1 = PAD_X + STRIPE_W + 8 + ci * plantSpacing;
                            const cx2 = cx1 + plantSpacing * 0.5; // stagger row 2
                            if (cx2 >= PAD_X + BED_W - 4) return null;

                            return (
                              <g key={ci}>
                                {/* Row 1 */}
                                <circle cx={cx1} cy={row1Y} r="3.8" fill={pColor} opacity="0.88" />
                                {/* Red fruit dot for ripening/harvest */}
                                {readyFruit && ci % 2 === 0 && (
                                  <circle cx={cx1 + 4} cy={row1Y + 4} r="1.8" fill="#dc2626" opacity="0.9" />
                                )}

                                {/* Row 2 (staggered) */}
                                {cx2 < PAD_X + BED_W - 4 && (
                                  <>
                                    <circle cx={cx2} cy={row2Y} r="3.8" fill={pColor} opacity="0.78" />
                                    {readyFruit && ci % 2 === 1 && (
                                      <circle cx={cx2 + 4} cy={row2Y + 4} r="1.8" fill="#dc2626" opacity="0.9" />
                                    )}
                                  </>
                                )}
                              </g>
                            );
                          })}

                          {/* Infected pulse rings */}
                          {bed.health === "infected" && (
                            <>
                              <circle cx={PAD_X + BED_W / 2} cy={bY + bH / 2} r="5"
                                fill="#dc2626" className="mring" />
                              <circle cx={PAD_X + BED_W / 2} cy={bY + bH / 2} r="5.5"
                                fill="#dc2626" opacity="0.9" className="mpulse" />
                              <text x={PAD_X + BED_W / 2} y={bY + bH / 2 + 4}
                                textAnchor="middle" fontSize="8.5" fill="white" fontWeight="900">!</text>
                            </>
                          )}

                          {/* Harvest badge (top-right) */}
                          {yieldKg > 0 && (
                            <>
                              <rect x={PAD_X + BED_W - 46} y={bY + 2}
                                width="46" height="12" rx="6" fill="#0f172a" opacity="0.82" />
                              <text x={PAD_X + BED_W - 23} y={bY + 10.5}
                                textAnchor="middle" fontSize="7.5" fill="white" fontWeight="700">
                                🌾 {yieldKg.toFixed(1)} kg
                              </text>
                            </>
                          )}

                          {/* Bed ID label (bottom-right, subtle) */}
                          <text
                            x={PAD_X + BED_W - STRIPE_W - 4} y={bY + bH - 3}
                            textAnchor="end" fontSize="7" fill="#7a8a9a" fontWeight="600"
                          >
                            {bed.id.replace("-BED-", " ")}
                          </text>
                        </g>
                      );
                    })}
                  </g>
                );
              })}

              {/* ── Scale + compass ───────────────────────────────────── */}
              <g transform={`translate(${W - 36}, ${totalH - 36})`}>
                <circle r="16" fill="#0f172a" opacity="0.65" />
                <text y="-3"  textAnchor="middle" fontSize="7"   fontWeight="800" fill="#f87171">N</text>
                <text y="10"  textAnchor="middle" fontSize="5.5" fill="#94a3b8">S</text>
                <text x="9"   y="2.5" textAnchor="middle" fontSize="5.5" fill="#94a3b8">E</text>
                <text x="-9"  y="2.5" textAnchor="middle" fontSize="5.5" fill="#94a3b8">W</text>
              </g>
            </svg>
          </div>
        </div>

        {/* ── Legend strip ────────────────────────────────────────────── */}
        <div className="px-4 py-2.5 flex items-center gap-3 flex-wrap text-[10px] border-t border-white/10 bg-[#4a1e08]">
          {viewMode === "health" && (
            <>
              {Object.entries(HEALTH_COLOR).map(([k, v]) => (
                <span key={k} className="flex items-center gap-1.5 text-white/70 font-medium capitalize">
                  <span className="size-2.5 rounded-full inline-block" style={{ background: v }} />
                  {k}
                </span>
              ))}
              <span className="flex items-center gap-1.5 text-white/70 font-medium">
                <span className="size-2.5 rounded-full bg-red-500 inline-block animate-ping" />
                Infected
              </span>
            </>
          )}
          {viewMode === "stage" && (
            Object.entries(STAGE_LABEL).map(([k, label]) => (
              <span key={k} className="flex items-center gap-1.5 text-white/70 font-medium">
                <span className="size-2.5 rounded-full inline-block" style={{ background: STAGE_COLOR[k] }} />
                {label}
              </span>
            ))
          )}
          {viewMode === "yield" && (
            <>
              {[["#14532d","High yield"],["#16a34a","Med"],["#4ade80","Low"],["#bbf7d0","None"]].map(([c, l]) => (
                <span key={l} className="flex items-center gap-1.5 text-white/70 font-medium">
                  <span className="size-2.5 rounded-full inline-block" style={{ background: c }} />{l}
                </span>
              ))}
            </>
          )}
          <span className="ml-auto text-white/40 italic">Tap any bed to inspect</span>
        </div>
      </div>

      {/* ── Selected bed panel ──────────────────────────────────────── */}
      {selectedBed && (() => {
        const vi       = valves.findIndex(v => v.id === selectedBed.valveId);
        const zc       = VALVE_COLORS[vi % 3] ?? "#10b981";
        const yieldKg  = harvestKgByBed[selectedBed.id] ?? 0;
        return (
          <div
            className="rounded-2xl border bg-white shadow-md overflow-hidden"
            style={{ borderColor: `${zc}60` }}
          >
            <div className="h-1" style={{ background: `linear-gradient(90deg, ${zc}, ${zc}88)` }} />
            <div className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="font-bold text-slate-900 text-base">{selectedBed.id}</div>
                  <div className="text-sm text-slate-500">{selectedBed.variety}</div>
                  <div className="text-xs text-slate-400">{selectedBed.origin}</div>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="text-slate-400 text-xl leading-none hover:text-slate-600 transition-colors"
                >
                  ×
                </button>
              </div>

              <div className="grid grid-cols-4 gap-2 mb-3">
                {[
                  { label: "Length",  value: `${selectedBed.lengthM} m` },
                  { label: "Plants",  value: plantsInBed(selectedBed).toString() },
                  { label: "Stage",   value: STAGE_LABEL[selectedBed.stage] ?? selectedBed.stage },
                  { label: "Harvest", value: yieldKg > 0 ? `${yieldKg.toFixed(1)} kg` : "—" },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-slate-50 rounded-xl p-2 text-center">
                    <div className="text-sm font-black text-slate-800 leading-tight">{value}</div>
                    <div className="text-[9px] text-slate-400 mt-0.5 uppercase tracking-wide">{label}</div>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 mb-3">
                <span
                  className="text-[11px] font-bold px-2.5 py-1 rounded-full"
                  style={{
                    background: `${HEALTH_COLOR[selectedBed.health]}20`,
                    color: HEALTH_COLOR[selectedBed.health],
                    border: `1px solid ${HEALTH_COLOR[selectedBed.health]}50`,
                  }}
                >
                  ● {selectedBed.health.charAt(0).toUpperCase() + selectedBed.health.slice(1)}
                </span>
                <span
                  className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                  style={{ background: `${STAGE_COLOR[selectedBed.stage]}20`, color: STAGE_COLOR[selectedBed.stage], border: `1px solid ${STAGE_COLOR[selectedBed.stage]}50` }}
                >
                  {STAGE_LABEL[selectedBed.stage] ?? selectedBed.stage}
                </span>
                <span className="text-[10px] text-slate-400 ml-auto">
                  Planted {new Date(selectedBed.plantedDate).toLocaleDateString("en", { month: "short", day: "numeric" })}
                </span>
              </div>

              <Link
                href={`/beds/${selectedBed.id}`}
                className="block w-full text-center text-sm font-bold py-2.5 rounded-xl text-white transition-opacity hover:opacity-90"
                style={{ background: `linear-gradient(90deg, ${zc}, ${zc}cc)` }}
              >
                Open Bed Profile →
              </Link>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
