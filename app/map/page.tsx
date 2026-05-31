"use client";

import { useEffect, useState } from "react";
import { FarmMap } from "@/components/farm-map";
import { Mountain } from "lucide-react";
import { ValveIcon } from "@/components/valve-icon";
import { useLang } from "@/lib/lang";
import { EN, AM } from "@/lib/translations";
import type { Valve, Bed } from "@/lib/types";

const FARM = { name: "ENTOTO Riverside Farm", location: "Entoto Mountain, Addis Ababa, Ethiopia", altitudeM: 2800, totalAreaHa: 4.2 };

export default function MapPage() {
  const { isAm } = useLang();
  const t = isAm ? AM : EN;
  const [valves, setValves] = useState<Valve[]>([]);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [harvestKgByBed, setHarvestKgByBed] = useState<Record<string, number>>({});

  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    Promise.all([
      fetch("/api/valves").then(r => r.json()),
      fetch("/api/beds").then(r => r.json()),
      fetch(`/api/harvest?date=${today}`).then(r => r.json()),
    ]).then(([v, b, h]) => {
      setValves(v);
      setBeds(b);
      const byBed: Record<string, number> = {};
      (h as Array<{ bedId: string; kg: string | number }>).forEach(rec => {
        byBed[rec.bedId] = (byBed[rec.bedId] ?? 0) + parseFloat(rec.kg.toString());
      });
      setHarvestKgByBed(byBed);
    });
  }, []);

  const healthyCount  = beds.filter(b => b.health === "healthy").length;
  const warningCount  = beds.filter(b => b.health === "warning").length;
  const infectedCount = beds.filter(b => b.health === "infected").length;
  const readyCount    = beds.filter(b => b.stage === "ripening" || b.stage === "harvest").length;
  const totalPlants   = beds.reduce((s, b) => s + b.lengthM * b.plantsPerMeter, 0);
  const totalYieldToday = Object.values(harvestKgByBed).reduce((s, v) => s + v, 0);

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">🗺 {t.map.title}</h1>
          <p className="text-muted-foreground text-sm flex items-center gap-1.5 mt-0.5">
            <Mountain className="size-3.5" />
            {FARM.location} · {FARM.altitudeM} m asl · {FARM.totalAreaHa} ha
          </p>
        </div>
        <div className="flex gap-2 flex-wrap text-[11px] font-semibold">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted text-muted-foreground border border-border">
            <span className="size-2 rounded-full bg-muted-foreground/50 inline-block" />
            {beds.length} beds
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/30">
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

      <FarmMap valves={valves} beds={beds} harvestKgByBed={harvestKgByBed} />

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
                <span className="text-xs font-semibold text-muted-foreground">beds</span>
              </div>
              <div className="text-xs font-bold text-foreground mt-0.5">{label}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
