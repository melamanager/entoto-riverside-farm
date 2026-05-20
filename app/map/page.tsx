"use client";

import { FarmMap } from "@/components/farm-map";
import { VALVES, BEDS, HARVESTS, FARM, plantsInBed } from "@/lib/data";
import { Mountain } from "lucide-react";
import { ValveIcon } from "@/components/valve-icon";
import { useLang } from "@/lib/lang";
import { EN, AM } from "@/lib/translations";

export default function MapPage() {
  const { isAm } = useLang();
  const t = isAm ? AM : EN;
  const beds = BEDS();
  const today = "2026-05-20";
  const harvestKgByBed: Record<string, number> = {};
  HARVESTS().filter(h => h.date === today).forEach(h => {
    harvestKgByBed[h.bedId] = (harvestKgByBed[h.bedId] ?? 0) + h.kg;
  });

  const healthyCount  = beds.filter(b => b.health === "healthy").length;
  const warningCount  = beds.filter(b => b.health === "warning").length;
  const infectedCount = beds.filter(b => b.health === "infected").length;
  const readyCount    = beds.filter(b => b.stage === "ripening" || b.stage === "harvest").length;
  const totalPlants   = beds.reduce((s, b) => s + plantsInBed(b), 0);
  const totalYieldToday = Object.values(harvestKgByBed).reduce((s, v) => s + v, 0);

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">🗺 {t.map.title}</h1>
          <p className="text-stone-500 text-sm flex items-center gap-1.5 mt-0.5">
            <Mountain className="size-3.5" />
            {FARM.location} · {FARM.altitudeM} m asl · {FARM.totalAreaHa} ha
          </p>
        </div>
        <div className="flex gap-2 flex-wrap text-[11px] font-semibold">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-stone-100 text-stone-600 border border-stone-200">
            <span className="size-2 rounded-full bg-stone-400 inline-block" />
            {beds.length} beds
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            <ValveIcon size={11} />
            {totalPlants.toLocaleString()} plants
          </span>
          {totalYieldToday > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
              🌾 {totalYieldToday.toFixed(1)} kg today
            </span>
          )}
        </div>
      </div>

      <FarmMap valves={VALVES} beds={beds} harvestKgByBed={harvestKgByBed} />

      {/* Status cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            icon: "🌿", label: "Healthy",   count: healthyCount,
            color: "#22c55e", bg: "bg-emerald-50", border: "border-emerald-200",
            desc: "Routine inspection only",
          },
          {
            icon: "⚠️", label: "Warning",   count: warningCount,
            color: "#f59e0b", bg: "bg-amber-50",   border: "border-amber-200",
            desc: "Monitor closely this week",
          },
          {
            icon: "🚨", label: "Infected",  count: infectedCount,
            color: "#ef4444", bg: "bg-red-50",     border: "border-red-200",
            desc: "Immediate treatment needed",
          },
          {
            icon: "🍓", label: "Ready",     count: readyCount,
            color: "#a855f7", bg: "bg-violet-50",  border: "border-violet-200",
            desc: "Peak ripeness — harvest now",
          },
        ].map(({ icon, label, count, color, bg, border, desc }) => (
          <div key={label} className={`rounded-xl border-2 ${border} ${bg} p-3.5 flex items-center gap-3`}>
            <div className="text-2xl leading-none shrink-0">{icon}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black leading-none" style={{ color }}>{count}</span>
                <span className="text-xs font-semibold text-stone-500">beds</span>
              </div>
              <div className="text-xs font-bold text-stone-700 mt-0.5">{label}</div>
              <div className="text-[10px] text-stone-400 mt-0.5 leading-tight">{desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
