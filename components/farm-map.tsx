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
// Viewing from the front-left, looking toward the back-right.
// X-axis = bed length (runs RIGHT)
// Y-axis = row depth (runs UP-LEFT, into the field)
// Z-axis = height (runs UP)
const ORIG_X  = 80;    // SVG x of nearest-left-bottom corner
const ORIG_Y  = 500;   // SVG y of nearest-left-bottom corner (bottom of canvas)
const LX      = 5.0;   // px per metre of bed length → rightward
const LY      = 0.22;  // px per metre → slight downward slope (foreshortening)
const DX      = -5;    // px per row-unit of depth → leftward  (recedes left)
const DY      = 18;    // px per row-unit of depth → upward    (recedes up)
const HY      = 22;    // px per height-unit → upward          (raised edge)

// Bed world-space dimensions (in row-units unless noted)
const BED_DEPTH   = 0.68;  // fraction of row-unit the mulch surface occupies
const BED_HEIGHT  = 1.0;   // height unit for raised edge (exaggerated)
const ROW_SPACING = 1.0;   // row-unit per bed (bed + gap)
const ZONE_EXTRA  = 0.8;   // extra row-units between zones

// Face colours  (Ethiopian real-farm palette)
const SOIL      = "#5e2710";
const MULCH_TOP = "#bfc3cb";   // silver plastic mulch — top face
const MULCH_FNT = "#848890";   // front face — in partial shadow
const MULCH_END = "#606368";   // right end-cap — deepest shadow
const SHINE     = "#d8dce4";   // highlight stripe on mulch

const VALVE_COLORS = ["#10b981", "#3b82f6", "#a855f7"] as const;
const HEALTH_COLOR = { healthy:"#22c55e", warning:"#f59e0b", infected:"#ef4444" } as const;
const STAGE_COLOR: Record<string,string> = {
  planted:"#94a3b8", vegetative:"#4ade80", flowering:"#f9a8d4",
  fruiting:"#fb923c", ripening:"#f87171",  harvest:"#22c55e",
};
const STAGE_LABEL: Record<string,string> = {
  planted:"Planted", vegetative:"Vegetative", flowering:"Flowering",
  fruiting:"Fruiting", ripening:"Ripening", harvest:"Harvest",
};

// Project a world point → SVG point
function iso(len: number, row: number, h: number) {
  return {
    x: ORIG_X + len * LX + row * DX,
    y: ORIG_Y + len * LY - row * DY - h * HY,
  };
}
function pts(ps: {x:number;y:number}[]) {
  return ps.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
}

export function FarmMap({ valves, beds, harvestKgByBed, highlightValves }: Props) {
  const [selected,  setSelected]  = useState<string | null>(null);
  const [viewMode,  setViewMode]  = useState<ViewMode>("health");

  const selectedBed = beds.find(b => b.id === selected);
  const maxLen      = Math.max(...beds.map(b => b.lengthM), 1);
  const maxYield    = Math.max(...beds.map(b => harvestKgByBed[b.id] ?? 0), 1);

  // ── Assign cumulative row positions ──────────────────────────────────────
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

  // Back-to-front painter's order
  const paintOrder = useMemo(() => [...bedLayout].reverse(), [bedLayout]);

  // ── Zone label positions ──────────────────────────────────────────────────
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

  // ── Total row extent → compute viewBox ────────────────────────────────────
  const totalRows = useMemo(() => {
    let r = 0;
    valves.forEach(valve => {
      beds.filter(b => b.valveId === valve.id).forEach(() => { r += ROW_SPACING; });
      r += ZONE_EXTRA;
    });
    return r;
  }, [valves, beds]);

  // Extreme SVG coordinates
  const topLeft    = iso(0,      totalRows + BED_DEPTH, BED_HEIGHT);
  const bottomLeft = iso(0,      0,                     0);
  const topRight   = iso(maxLen, totalRows,             BED_HEIGHT);
  const botRight   = iso(maxLen, 0,                     0);

  const minX = Math.min(topLeft.x, bottomLeft.x) - 6;
  const maxX = Math.max(topRight.x, botRight.x)  + 16;
  const minY = topLeft.y - 16;
  const maxY = Math.max(bottomLeft.y, botRight.y) + 28;

  const VW = maxX - minX;
  const VH = maxY - minY;
  const viewBox = `${minX.toFixed(0)} ${minY.toFixed(0)} ${VW.toFixed(0)} ${VH.toFixed(0)}`;

  // ── Plant dot colour ───────────────────────────────────────────────────────
  function plantColor(bed: Bed): string {
    if (viewMode === "stage") return STAGE_COLOR[bed.stage] ?? "#94a3b8";
    if (viewMode === "yield") {
      const r = (harvestKgByBed[bed.id] ?? 0) / maxYield;
      return r > 0.75 ? "#14532d" : r > 0.45 ? "#16a34a" : r > 0.1 ? "#4ade80" : "#bbf7d0";
    }
    return HEALTH_COLOR[bed.health] ?? "#22c55e";
  }

  return (
    <div className="space-y-3">

      {/* ── View mode controls ──────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        {(["health","yield","stage"] as ViewMode[]).map(m => (
          <button key={m} onClick={() => setViewMode(m)}
            className={`text-[11px] px-3 py-1.5 rounded-full font-semibold border transition-all ${
              viewMode === m
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
            }`}>
            {m === "health" ? "🌿 Health" : m === "yield" ? "🌾 Yield" : "🌸 Stage"}
          </button>
        ))}
      </div>

      {/* ── Map ─────────────────────────────────────────────────────────── */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-lg"
        style={{ background: SOIL }}>
        <div style={{ minWidth: Math.max(320, VW) }}>
        <svg viewBox={viewBox} width="100%" style={{ display:"block" }}>
          <defs>
            {/* Sheen lines on plastic mulch */}
            <pattern id="mulchPat" width="1" height="5" patternUnits="userSpaceOnUse">
              <rect width="1" height="5" fill={MULCH_TOP}/>
              <rect y="2" width="1" height="0.9" fill={SHINE} opacity="0.55"/>
            </pattern>
            {/* Ethiopian red soil texture */}
            <pattern id="soilPat" width="22" height="22" patternUnits="userSpaceOnUse">
              <rect width="22" height="22" fill={SOIL}/>
              <circle cx="5"  cy="7"  r="1.3" fill="#3d1505" opacity="0.45"/>
              <circle cx="16" cy="15" r="0.9" fill="#3d1505" opacity="0.3"/>
              <circle cx="11" cy="2"  r="0.7" fill="#7a2e12" opacity="0.2"/>
            </pattern>
            <style>{`
              @keyframes bedpulse { 0%,100%{opacity:.9} 50%{opacity:.2} }
              .bedpulse { animation: bedpulse 1.4s ease-in-out infinite; }
            `}</style>
          </defs>

          {/* Soil background */}
          <rect x={minX} y={minY} width={VW + 20} height={VH + 20} fill="url(#soilPat)"/>

          {/* Zone labels (behind all beds) */}
          {zoneStarts.map(({ valve, vi, rowStart }) => {
            const lp = iso(-1, rowStart + BED_DEPTH * 0.5, BED_HEIGHT + 0.3);
            return (
              <text key={valve.id} x={lp.x - 2} y={lp.y}
                fontSize="9" fontWeight="800" fill={VALVE_COLORS[vi % 3]} opacity="0.9"
                textAnchor="end">
                {valve.name}
              </text>
            );
          })}

          {/* ── Beds (back → front, painter's order) ─────────────────── */}
          {paintOrder.map(({ bed, rowStart, vi }) => {
            const L        = bed.lengthM;
            const rowEnd   = rowStart + BED_DEPTH;
            const zc       = VALVE_COLORS[vi % 3];
            const isDimmed = highlightValves && !highlightValves.includes(bed.valveId);
            const pc       = plantColor(bed);
            const isSel    = selected === bed.id;
            const yieldKg  = harvestKgByBed[bed.id] ?? 0;
            const infected = bed.health === "infected";
            const fruiting = bed.stage === "fruiting" || bed.stage === "ripening" || bed.stage === "harvest";

            // ── 8 corners of the raised-bed box ──────────────────────
            const A = iso(0, rowStart, 0);           // near-left-bottom (front-left base)
            const B = iso(L, rowStart, 0);           // near-right-bottom
            const C = iso(L, rowEnd,   0);           // far-right-bottom
            // const D = iso(0, rowEnd, 0);          // far-left-bottom (hidden)
            const E = iso(0, rowStart, BED_HEIGHT);  // near-left-top
            const F = iso(L, rowStart, BED_HEIGHT);  // near-right-top
            const G = iso(L, rowEnd,   BED_HEIGHT);  // far-right-top
            const H = iso(0, rowEnd,   BED_HEIGHT);  // far-left-top

            // ── Plant dot positions on top face ───────────────────────
            const nDots = Math.max(3, Math.floor(L / 3.2));
            const dotPositions = Array.from({ length: nDots }, (_, i) => {
              const t = (i + 0.5) / nDots;
              return {
                r1: iso(t * L, rowStart + BED_DEPTH * 0.26, BED_HEIGHT),
                r2: iso(t * L + L / nDots * 0.45, rowStart + BED_DEPTH * 0.74, BED_HEIGHT),
              };
            });

            return (
              <g key={bed.id} opacity={isDimmed ? 0.35 : 1}
                className="cursor-pointer"
                onClick={() => setSelected(isSel ? null : bed.id)}>

                {/* ── Front face (near vertical wall, most prominent) */}
                <polygon points={pts([A, B, F, E])}
                  fill={isSel ? zc : MULCH_FNT}
                  opacity={isSel ? 0.85 : 1}
                  stroke={isSel ? zc : "#5a5e65"}
                  strokeWidth={isSel ? "1.5" : "0.6"}
                />
                {/* Top highlight edge (junction of top + front face) */}
                <line x1={E.x} y1={E.y} x2={F.x} y2={F.y}
                  stroke={SHINE} strokeWidth="1.4" opacity="0.7"/>
                {/* Bottom shadow edge (base of front face meets soil) */}
                <line x1={A.x} y1={A.y} x2={B.x} y2={B.y}
                  stroke="#2a0e04" strokeWidth="1.2" opacity="0.7"/>

                {/* Bed label on front face */}
                <text x={(E.x + F.x) / 2} y={(E.y + A.y) / 2 + 3.5}
                  textAnchor="middle" fontSize="7" fontWeight="700"
                  fill="#cdd1d9" opacity="0.95">
                  {bed.id.replace("-BED-"," ")} · {L}m
                </text>

                {/* ── Right end-cap face ──────────────────────────── */}
                <polygon points={pts([B, C, G, F])}
                  fill={MULCH_END} stroke="#404348" strokeWidth="0.4"/>
                {/* Highlight edge at top of end-cap */}
                <line x1={F.x} y1={F.y} x2={G.x} y2={G.y}
                  stroke="#888c94" strokeWidth="0.8" opacity="0.6"/>

                {/* ── Top face (mulch surface — silver plastic) ───── */}
                <polygon points={pts([E, F, G, H])}
                  fill="url(#mulchPat)" stroke="#a0a4ab" strokeWidth="0.5"/>

                {/* Zone colour stripe along near edge of top face */}
                {(() => {
                  const stripe = 2.5;  // metres of stripe
                  const Es2 = iso(stripe, rowStart, BED_HEIGHT);
                  const Fs2 = iso(L - stripe < 0 ? 0 : L - stripe, rowStart, BED_HEIGHT);
                  // Left stripe
                  return (
                    <polygon points={pts([E, Es2, { x: Es2.x + DX * BED_DEPTH, y: Es2.y - DY * BED_DEPTH }, H])}
                      fill={zc} opacity="0.8"/>
                  );
                })()}

                {/* Health tint on top face */}
                {viewMode === "health" && bed.health !== "healthy" && (
                  <polygon points={pts([E, F, G, H])} fill={pc} opacity="0.2"/>
                )}

                {/* ── Plant dots on top face (two staggered rows) ─── */}
                {dotPositions.map(({ r1, r2 }, di) => (
                  <g key={di}>
                    <circle cx={r1.x} cy={r1.y} r="3.6"
                      fill={pc} opacity="0.88"
                      className={infected ? "bedpulse" : undefined}/>
                    {fruiting && di % 2 === 0 && (
                      <circle cx={r1.x + 2} cy={r1.y + 2} r="1.9"
                        fill="#dc2626" opacity="0.92"/>
                    )}
                    <circle cx={r2.x} cy={r2.y} r="3.2"
                      fill={pc} opacity="0.74"
                      className={infected ? "bedpulse" : undefined}/>
                    {fruiting && di % 2 === 1 && (
                      <circle cx={r2.x + 2} cy={r2.y + 2} r="1.7"
                        fill="#dc2626" opacity="0.88"/>
                    )}
                  </g>
                ))}

                {/* Infected warning pulse on top face */}
                {infected && (() => {
                  const mid = iso(L * 0.5, rowStart + BED_DEPTH * 0.5, BED_HEIGHT);
                  return (
                    <>
                      <circle cx={mid.x} cy={mid.y} r="9"
                        fill="#dc2626" opacity="0.22" className="bedpulse"/>
                      <circle cx={mid.x} cy={mid.y} r="5.5"
                        fill="#dc2626" opacity="0.9" className="bedpulse"/>
                      <text x={mid.x} y={mid.y + 3.5}
                        textAnchor="middle" fontSize="8" fontWeight="900" fill="white">!</text>
                    </>
                  );
                })()}

                {/* Harvest badge floating above top face */}
                {yieldKg > 0 && (() => {
                  const bp = iso(L * 0.65, rowStart + BED_DEPTH * 0.45, BED_HEIGHT + 0.4);
                  return (
                    <>
                      <rect x={bp.x - 22} y={bp.y - 7} width="44" height="13"
                        rx="6.5" fill="#0f172a" opacity="0.88"/>
                      <text x={bp.x} y={bp.y + 2.5}
                        textAnchor="middle" fontSize="7.5" fontWeight="700" fill="white">
                        🌾 {yieldKg.toFixed(1)} kg
                      </text>
                    </>
                  );
                })()}

              </g>
            );
          })}

          {/* ── Length ruler (front row) ───────────────────────────────── */}
          {[0, 10, 20, 30, maxLen].map(m => {
            const p0 = iso(m, 0, 0);
            return (
              <g key={m} opacity="0.5">
                <line x1={p0.x} y1={p0.y + 6} x2={p0.x} y2={p0.y + 12}
                  stroke="#9a8070" strokeWidth="1"/>
                <text x={p0.x} y={p0.y + 20}
                  textAnchor="middle" fontSize="7" fill="#9a8070">{m}m</text>
              </g>
            );
          })}
          <line
            x1={iso(0, 0, 0).x} y1={iso(0, 0, 0).y + 9}
            x2={iso(maxLen, 0, 0).x} y2={iso(maxLen, 0, 0).y + 9}
            stroke="#9a8070" strokeWidth="0.8" opacity="0.45"/>

        </svg>
        </div>

        {/* ── Legend ──────────────────────────────────────────────────── */}
        <div className="px-4 py-2 flex items-center gap-3 flex-wrap text-[10px] border-t border-white/10 bg-[#3d1a08]">
          {viewMode === "health" && Object.entries(HEALTH_COLOR).map(([k,v]) => (
            <span key={k} className="flex items-center gap-1.5 text-white/70 font-medium capitalize">
              <span className="size-2.5 rounded-full inline-block" style={{background:v}}/>{k}
            </span>
          ))}
          {viewMode === "stage" && Object.entries(STAGE_LABEL).map(([k,label]) => (
            <span key={k} className="flex items-center gap-1.5 text-white/70 font-medium">
              <span className="size-2.5 rounded-full inline-block" style={{background:STAGE_COLOR[k]}}/>{label}
            </span>
          ))}
          {viewMode === "yield" && [["#14532d","High"],["#16a34a","Med"],["#4ade80","Low"],["#bbf7d0","None"]].map(([c,l]) => (
            <span key={l} className="flex items-center gap-1.5 text-white/70 font-medium">
              <span className="size-2.5 rounded-full inline-block" style={{background:c}}/>{l}
            </span>
          ))}
          <span className="ml-auto text-white/40 text-[9px] italic">Length = bed size · Tap any bed</span>
        </div>
      </div>

      {/* ── Selected bed info card ───────────────────────────────────── */}
      {selectedBed && (() => {
        const vi      = valves.findIndex(v => v.id === selectedBed.valveId);
        const zc      = VALVE_COLORS[vi % 3] ?? "#10b981";
        const yieldKg = harvestKgByBed[selectedBed.id] ?? 0;
        return (
          <div className="rounded-2xl border bg-white shadow-md overflow-hidden"
            style={{ borderColor: `${zc}60` }}>
            <div className="h-1" style={{ background:`linear-gradient(90deg,${zc},${zc}88)` }}/>
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
                  { label:"Length", value:`${selectedBed.lengthM} m` },
                  { label:"Plants", value:plantsInBed(selectedBed).toString() },
                  { label:"Stage",  value:STAGE_LABEL[selectedBed.stage] ?? selectedBed.stage },
                  { label:"Today",  value:yieldKg > 0 ? `${yieldKg.toFixed(1)} kg` : "—" },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-slate-50 rounded-xl p-2 text-center">
                    <div className="text-sm font-black text-slate-800 leading-tight">{value}</div>
                    <div className="text-[9px] text-slate-400 mt-0.5 uppercase tracking-wide">{label}</div>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full"
                  style={{background:`${HEALTH_COLOR[selectedBed.health]}20`,color:HEALTH_COLOR[selectedBed.health],border:`1px solid ${HEALTH_COLOR[selectedBed.health]}50`}}>
                  ● {selectedBed.health.charAt(0).toUpperCase()+selectedBed.health.slice(1)}
                </span>
                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                  style={{background:`${STAGE_COLOR[selectedBed.stage]}20`,color:STAGE_COLOR[selectedBed.stage],border:`1px solid ${STAGE_COLOR[selectedBed.stage]}50`}}>
                  {STAGE_LABEL[selectedBed.stage]}
                </span>
              </div>
              <Link href={`/beds/${selectedBed.id}`}
                className="block w-full text-center text-sm font-bold py-2.5 rounded-xl text-white hover:opacity-90 transition-opacity"
                style={{background:`linear-gradient(90deg,${zc},${zc}cc)`}}>
                Open Bed Profile →
              </Link>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
