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

const VALVE_COLORS   = ["#10b981", "#3b82f6", "#a855f7"] as const;
const HEALTH_COLOR   = { healthy: "#22c55e", warning: "#f59e0b", infected: "#ef4444" } as const;
const STAGE_COLOR: Record<string, string> = {
  planted: "#94a3b8", vegetative: "#4ade80", flowering: "#f9a8d4",
  fruiting: "#fb923c", ripening:  "#f87171", harvest:   "#22c55e",
};
const STAGE_LABEL: Record<string, string> = {
  planted: "Planted", vegetative: "Vegetative", flowering: "Flowering",
  fruiting: "Fruiting", ripening: "Ripening", harvest: "Harvest",
};

// ─── Realistic earth tones (Ethiopian red volcanic soil)
const SOIL_BG     = "#6a2d10";  // ground between beds
const MULCH_TOP   = "#c2c6cf";  // silver plastic mulch top face
const MULCH_FRONT = "#8e9299";  // front raised-edge face (in shadow)
const MULCH_END   = "#6d7078";  // right end-cap face (deepest shadow)
const MULCH_SHINE = "#dde1e8";  // highlight stripe on mulch

export function FarmMap({ valves, beds, harvestKgByBed, highlightValves }: Props) {
  const [selected,    setSelected]    = useState<string | null>(null);
  const [viewMode,    setViewMode]    = useState<ViewMode>("health");
  const [perspective, setPerspective] = useState(true);

  const selectedBed = beds.find(b => b.id === selected);
  const maxLen      = Math.max(...beds.map(b => b.lengthM), 1);
  const maxYield    = Math.max(...beds.map(b => harvestKgByBed[b.id] ?? 0), 1);

  // ─── SVG constants ────────────────────────────────────────────────────────
  const W          = 440;       // viewBox width
  const PAD_L      = 10;        // left padding
  const PAD_R      = 22;        // right padding (extra for end caps)
  const MAX_BED_W  = W - PAD_L - PAD_R;  // max usable width for longest bed
  const BED_H      = 22;        // mulch surface strip height (represents bed WIDTH ~1m)
  const FRONT_H    = 16;        // raised-edge front face height (exaggerated for visibility)
  const END_W      = 10;        // right end-cap width
  const SOIL_GAP   = 10;        // soil gap between beds (≥ FRONT_H is fine; front face overlaps it)
  const ZONE_HDR   = 34;        // zone header height
  const ZONE_GAP   = 16;        // gap between zones

  // ─── Layout ───────────────────────────────────────────────────────────────
  const layout = useMemo(() => {
    let y = 10;
    return valves.map((valve, vi) => {
      const zoneBeds = beds.filter(b => b.valveId === valve.id);
      const headerY  = y;
      y += ZONE_HDR;
      const bedRows  = zoneBeds.map(bed => {
        // Each bed starts AFTER the soil gap so its front face can use that gap
        const bedY = y;
        y += BED_H + SOIL_GAP;
        // Bed visual width proportional to actual length
        const bedW = Math.round((bed.lengthM / maxLen) * MAX_BED_W);
        return { bed, y: bedY, bedW };
      });
      y += ZONE_GAP;
      return { valve, vi, headerY, bedRows };
    });
  }, [valves, beds, maxLen]);

  const totalH = useMemo(() => {
    let y = 10;
    valves.forEach(valve => {
      y += ZONE_HDR;
      beds.filter(b => b.valveId === valve.id).forEach(() => { y += BED_H + SOIL_GAP; });
      y += ZONE_GAP;
    });
    return y + 6;
  }, [valves, beds]);

  function plantColor(bed: Bed): string {
    if (viewMode === "stage") return STAGE_COLOR[bed.stage] ?? "#94a3b8";
    if (viewMode === "yield") {
      const r = (harvestKgByBed[bed.id] ?? 0) / maxYield;
      if (r > 0.75) return "#14532d";
      if (r > 0.45) return "#16a34a";
      if (r > 0.15) return "#4ade80";
      return "#bbf7d0";
    }
    return HEALTH_COLOR[bed.health] ?? "#22c55e";
  }

  // ─── Ruler marks for longest bed ─────────────────────────────────────────
  const rulerMarks = [0, 10, 20, 30, 40, maxLen].filter((v, i, a) => a.indexOf(v) === i && v <= maxLen);

  return (
    <div className="space-y-3">

      {/* ── Controls ────────────────────────────────────────────────────── */}
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
            perspective ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200"
          }`}
        >
          {perspective ? "◈ 3D" : "⬜ 2D"}
        </button>
      </div>

      {/* ── Map ─────────────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-lg bg-[#6a2d10]">

        {/* 3D perspective wrapper — rotates SVG around TOP edge so near beds appear at bottom */}
        <div style={perspective ? { perspective: "860px", perspectiveOrigin: "50% 0%" } : {}}>
          <div style={perspective ? {
            transform: "rotateX(28deg)",
            transformOrigin: "50% 0%",
            transformStyle: "preserve-3d",
          } : {}}>

            <svg viewBox={`0 0 ${W} ${totalH}`} width="100%" style={{ display: "block" }}>
              <defs>
                {/* Horizontal sheen lines on mulch (like the plastic in the photos) */}
                <pattern id="mulchLines" width="1" height="4" patternUnits="userSpaceOnUse">
                  <rect width="1" height="4" fill={MULCH_TOP} />
                  <rect y="1.5" width="1" height="0.8" fill={MULCH_SHINE} opacity="0.55" />
                </pattern>

                {/* Soil texture */}
                <pattern id="soilTex" width="18" height="18" patternUnits="userSpaceOnUse">
                  <rect width="18" height="18" fill={SOIL_BG} />
                  <circle cx="4"  cy="6"  r="1.1" fill="#4e1f08" opacity="0.4" />
                  <circle cx="13" cy="13" r="0.8" fill="#4e1f08" opacity="0.3" />
                  <circle cx="9"  cy="2"  r="0.6" fill="#832512" opacity="0.2" />
                </pattern>

                {/* Drip tape dashes */}
                <pattern id="dripTape" width="14" height="1" patternUnits="userSpaceOnUse">
                  <rect width="9" height="1" fill="#7a8899" opacity="0.6" />
                </pattern>

                {/* Infected pulse */}
                <style>{`
                  @keyframes mpulse { 0%,100%{opacity:.9} 50%{opacity:.25} }
                  .mpulse { animation: mpulse 1.4s ease-in-out infinite; }
                  @keyframes mring { 0%{r:4;opacity:.8} 100%{r:11;opacity:0} }
                  .mring { animation: mring 1.8s ease-out infinite; }
                `}</style>
              </defs>

              {/* Soil background */}
              <rect x="0" y="0" width={W} height={totalH} fill="url(#soilTex)" />

              {layout.map(({ valve, vi, headerY, bedRows }) => {
                const zc       = VALVE_COLORS[vi % 3];
                const isDimmed = highlightValves && !highlightValves.includes(valve.id);
                const todayKg  = bedRows.reduce((s, { bed }) => s + (harvestKgByBed[bed.id] ?? 0), 0);

                return (
                  <g key={valve.id} opacity={isDimmed ? 0.35 : 1}>

                    {/* ── Zone header ───────────────────────────────────── */}
                    <rect x={PAD_L} y={headerY} width={W - PAD_L - 4} height={ZONE_HDR - 6}
                      rx="3" fill={zc} opacity="0.2" />
                    <rect x={PAD_L} y={headerY} width="4" height={ZONE_HDR - 6} rx="2" fill={zc} />
                    <text x={PAD_L + 10} y={headerY + 13} fontSize="11" fontWeight="800" fill={zc}>
                      {valve.name}
                    </text>
                    <text x={PAD_L + 10} y={headerY + 25} fontSize="8" fill="#c4b5a8">
                      {bedRows.length} beds
                      {todayKg > 0 ? ` · 🌾 ${todayKg.toFixed(1)} kg today` : ""}
                      {" · "}
                      {valve.irrigationSchedule}
                    </text>

                    {/* ── Beds ─────────────────────────────────────────── */}
                    {bedRows.map(({ bed, y: bY, bedW }) => {
                      const pColor     = plantColor(bed);
                      const isSelected = selected === bed.id;
                      const yieldKg    = harvestKgByBed[bed.id] ?? 0;
                      const readyFruit = bed.stage === "fruiting" || bed.stage === "ripening" || bed.stage === "harvest";
                      const infected   = bed.health === "infected";

                      // Right-edge X positions for end-cap
                      const bedRight   = PAD_L + bedW;

                      // Plant dot columns along the top face
                      const plantSpacing = 15;
                      const plantCols    = Math.max(1, Math.floor((bedW - 14) / plantSpacing));
                      const row1Y = bY + BED_H * 0.28;
                      const row2Y = bY + BED_H * 0.72;

                      return (
                        <g
                          key={bed.id}
                          className="cursor-pointer"
                          onClick={() => setSelected(isSelected ? null : bed.id)}
                        >
                          {/* ─ Front raised face (below = near viewer in perspective) ─ */}
                          {/* Appears as the vertical edge of the raised bed */}
                          <rect
                            x={PAD_L} y={bY - FRONT_H}
                            width={bedW} height={FRONT_H}
                            fill={MULCH_FRONT}
                            rx="1"
                          />
                          {/* Highlight line at top of front face (edge between top and front) */}
                          <line
                            x1={PAD_L} y1={bY - FRONT_H + 1}
                            x2={PAD_L + bedW} y2={bY - FRONT_H + 1}
                            stroke="#b0b4bc" strokeWidth="1" opacity="0.6"
                          />
                          {/* Bottom shadow of front face (meets the soil) */}
                          <line
                            x1={PAD_L} y1={bY - 1}
                            x2={PAD_L + bedW} y2={bY - 1}
                            stroke="#3d1505" strokeWidth="1.5" opacity="0.5"
                          />

                          {/* ─ Right end-cap face ─────────────────────── */}
                          {/* Shows the cross-section of the raised bed on the right end */}
                          {/* Top part (front face height) */}
                          <rect
                            x={bedRight} y={bY - FRONT_H}
                            width={END_W} height={FRONT_H}
                            fill={MULCH_END}
                            rx="1"
                          />
                          {/* Bottom part (mulch surface height) */}
                          <rect
                            x={bedRight} y={bY}
                            width={END_W} height={BED_H}
                            fill={MULCH_END}
                            opacity="0.7"
                          />
                          {/* Edge lines on end cap */}
                          <line x1={bedRight} y1={bY - FRONT_H} x2={bedRight} y2={bY + BED_H}
                            stroke="#555" strokeWidth="0.5" opacity="0.4" />
                          <line x1={bedRight + END_W} y1={bY - FRONT_H} x2={bedRight + END_W} y2={bY + BED_H}
                            stroke="#888" strokeWidth="0.5" opacity="0.3" />

                          {/* ─ Mulch top face (main visible surface) ──── */}
                          <rect
                            x={PAD_L} y={bY}
                            width={bedW} height={BED_H}
                            fill="url(#mulchLines)"
                          />

                          {/* Selection glow on top face */}
                          {isSelected && (
                            <rect x={PAD_L} y={bY} width={bedW} height={BED_H}
                              fill={zc} opacity="0.22"
                              stroke={zc} strokeWidth="1.5"
                            />
                          )}

                          {/* Health tint on top face */}
                          {viewMode === "health" && bed.health !== "healthy" && (
                            <rect x={PAD_L} y={bY} width={bedW} height={BED_H}
                              fill={HEALTH_COLOR[bed.health]} opacity="0.18" />
                          )}

                          {/* Zone color left stripe on top face */}
                          <rect x={PAD_L} y={bY} width="3.5" height={BED_H}
                            fill={zc} opacity="0.9" />

                          {/* Drip irrigation tape along center of top face */}
                          <rect
                            x={PAD_L + 6} y={bY + BED_H / 2 - 0.5}
                            width={bedW - 10} height="1"
                            fill="url(#dripTape)"
                          />

                          {/* ─ Plant dots (2 staggered rows) ────────── */}
                          {Array.from({ length: plantCols }).map((_, ci) => {
                            const cx1 = PAD_L + 10 + ci * plantSpacing;
                            const cx2 = cx1 + plantSpacing * 0.55;
                            return (
                              <g key={ci}>
                                {/* Row 1 */}
                                <circle cx={cx1} cy={row1Y} r="3.8" fill={pColor} opacity="0.88"
                                  className={infected ? "mpulse" : undefined} />
                                {readyFruit && ci % 2 === 0 && (
                                  <circle cx={cx1 + 4} cy={row1Y + 4} r="2" fill="#dc2626" opacity="0.9" />
                                )}
                                {/* Row 2 (staggered) */}
                                {cx2 < PAD_L + bedW - 4 && (
                                  <>
                                    <circle cx={cx2} cy={row2Y} r="3.5" fill={pColor} opacity="0.76"
                                      className={infected ? "mpulse" : undefined} />
                                    {readyFruit && ci % 2 === 1 && (
                                      <circle cx={cx2 + 3} cy={row2Y + 4} r="1.8" fill="#dc2626" opacity="0.85" />
                                    )}
                                  </>
                                )}
                              </g>
                            );
                          })}

                          {/* Infected pulse rings on top face */}
                          {infected && (
                            <>
                              <circle cx={PAD_L + bedW / 2} cy={bY + BED_H / 2} r="4"
                                fill="#dc2626" className="mring" />
                              <circle cx={PAD_L + bedW / 2} cy={bY + BED_H / 2} r="5"
                                fill="#dc2626" opacity="0.9" className="mpulse" />
                              <text x={PAD_L + bedW / 2} y={bY + BED_H / 2 + 4}
                                textAnchor="middle" fontSize="8" fill="white" fontWeight="900">!</text>
                            </>
                          )}

                          {/* Harvest badge (top-right of mulch surface) */}
                          {yieldKg > 0 && (
                            <>
                              <rect x={PAD_L + bedW - 46} y={bY + 2}
                                width="46" height="12" rx="6" fill="#0f172a" opacity="0.82" />
                              <text x={PAD_L + bedW - 23} y={bY + 11}
                                textAnchor="middle" fontSize="7.5" fill="white" fontWeight="700">
                                🌾 {yieldKg.toFixed(1)} kg
                              </text>
                            </>
                          )}

                          {/* Bed ID label on front face (reads when 3D-tilted) */}
                          <text
                            x={PAD_L + 6} y={bY - FRONT_H / 2 + 3.5}
                            fontSize="7" fill="#d0d4dc" fontWeight="700" opacity="0.9"
                          >
                            {bed.id.replace("-BED-", " ")}  {bed.lengthM}m
                          </text>
                        </g>
                      );
                    })}
                  </g>
                );
              })}

              {/* ── Length ruler (bottom) ────────────────────────────── */}
              <g opacity="0.55">
                <line x1={PAD_L} y1={totalH - 8} x2={PAD_L + MAX_BED_W} y2={totalH - 8}
                  stroke="#9a8070" strokeWidth="1" />
                {rulerMarks.map(m => {
                  const rx = PAD_L + Math.round((m / maxLen) * MAX_BED_W);
                  return (
                    <g key={m}>
                      <line x1={rx} y1={totalH - 11} x2={rx} y2={totalH - 5}
                        stroke="#9a8070" strokeWidth="1" />
                      <text x={rx} y={totalH - 1} textAnchor="middle" fontSize="7" fill="#9a8070">
                        {m}m
                      </text>
                    </g>
                  );
                })}
              </g>

              {/* ── Compass ──────────────────────────────────────────── */}
              <g transform={`translate(${W - 20}, 24)`}>
                <circle r="14" fill="#0f172a" opacity="0.55" />
                <text y="-2"  textAnchor="middle" fontSize="7"   fontWeight="800" fill="#f87171">N</text>
                <text y="9"   textAnchor="middle" fontSize="5"   fill="#94a3b8">S</text>
                <text x="8"   y="2" textAnchor="middle" fontSize="5" fill="#94a3b8">E</text>
                <text x="-8"  y="2" textAnchor="middle" fontSize="5" fill="#94a3b8">W</text>
              </g>
            </svg>
          </div>
        </div>

        {/* ── Legend ──────────────────────────────────────────────────── */}
        <div className="px-4 py-2 flex items-center gap-3 flex-wrap text-[10px] border-t border-white/10 bg-[#4a1e08]">
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
          {viewMode === "yield" && [["#14532d","High"],["#16a34a","Med"],["#4ade80","Low"],["#bbf7d0","None"]].map(([c,l]) => (
            <span key={l} className="flex items-center gap-1.5 text-white/70 font-medium">
              <span className="size-2.5 rounded-full inline-block" style={{ background: c }} />{l}
            </span>
          ))}
          <span className="flex items-center gap-2 ml-auto text-white/40 text-[9px] italic">
            Width = bed length · Tap to inspect
          </span>
        </div>
      </div>

      {/* ── Selected bed panel ──────────────────────────────────────── */}
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
                  className="text-slate-400 text-xl leading-none hover:text-slate-600 transition-colors">×</button>
              </div>
              <div className="grid grid-cols-4 gap-2 mb-3">
                {[
                  { label: "Length",  value: `${selectedBed.lengthM} m` },
                  { label: "Plants",  value: plantsInBed(selectedBed).toString() },
                  { label: "Stage",   value: STAGE_LABEL[selectedBed.stage] ?? selectedBed.stage },
                  { label: "Today",   value: yieldKg > 0 ? `${yieldKg.toFixed(1)} kg` : "—" },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-slate-50 rounded-xl p-2 text-center">
                    <div className="text-sm font-black text-slate-800 leading-tight">{value}</div>
                    <div className="text-[9px] text-slate-400 mt-0.5 uppercase tracking-wide">{label}</div>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full"
                  style={{ background:`${HEALTH_COLOR[selectedBed.health]}20`, color:HEALTH_COLOR[selectedBed.health], border:`1px solid ${HEALTH_COLOR[selectedBed.health]}50` }}>
                  ● {selectedBed.health.charAt(0).toUpperCase() + selectedBed.health.slice(1)}
                </span>
                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                  style={{ background:`${STAGE_COLOR[selectedBed.stage]}20`, color:STAGE_COLOR[selectedBed.stage], border:`1px solid ${STAGE_COLOR[selectedBed.stage]}50` }}>
                  {STAGE_LABEL[selectedBed.stage]}
                </span>
                <span className="text-[10px] text-slate-400 ml-auto">
                  Planted {new Date(selectedBed.plantedDate).toLocaleDateString("en",{month:"short",day:"numeric"})}
                </span>
              </div>
              <Link href={`/beds/${selectedBed.id}`}
                className="block w-full text-center text-sm font-bold py-2.5 rounded-xl text-white transition-opacity hover:opacity-90"
                style={{ background:`linear-gradient(90deg,${zc},${zc}cc)` }}>
                Open Bed Profile →
              </Link>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
