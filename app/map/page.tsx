"use client";

import { useState, useEffect } from "react";
import { FarmMap } from "@/components/farm-map";
import { VALVES, BEDS, HARVESTS, FARM, plantsInBed, VALVE_STATES, SOIL_READINGS, CAMERA_ALERTS, TANK_LEVELS, WEATHER_CURRENT } from "@/lib/data";
import { Mountain, Droplets, Thermometer, Wind, Waves, Camera } from "lucide-react";
import { ValveIcon } from "@/components/valve-icon";
import { cn } from "@/lib/utils";
import { useLang } from "@/lib/lang";
import { EN, AM } from "@/lib/translations";
import type { ValveState } from "@/lib/types";

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

  const soilReadings = SOIL_READINGS();
  const cameraAlerts = CAMERA_ALERTS;
  const newCamAlerts = cameraAlerts.filter(a => a.status === "new").length;
  const mainTank     = TANK_LEVELS[0];
  const mainTankPct  = Math.round((mainTank.currentL / mainTank.capacityL) * 100);

  const [liveValves, setLiveValves] = useState<ValveState[]>(VALVE_STATES.map(v => ({...v})));
  const [liveWeather, setLiveWeather] = useState(WEATHER_CURRENT);

  useEffect(() => {
    const id = setInterval(() => {
      setLiveValves(prev => prev.map(v => ({
        ...v,
        flowRateLph: v.isOpen ? Math.round(Math.max(0, v.flowRateLph + (Math.random()-0.5)*40)) : 0,
        totalLitersToday: v.isOpen ? v.totalLitersToday + Math.round(v.flowRateLph/1200) : v.totalLitersToday,
      })));
      setLiveWeather(prev => ({
        ...prev,
        tempC: Math.round((prev.tempC + (Math.random()-0.5)*0.2)*10)/10,
        windKph: Math.round(Math.max(0, prev.windKph + (Math.random()-0.5)*1.5)),
      }));
    }, 3000);
    return () => clearInterval(id);
  }, []);

  const openValves   = liveValves.filter(v => v.isOpen).length;
  const totalFlowLph = liveValves.reduce((s,v) => s + v.flowRateLph, 0);

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

      {/* IoT Live Strip */}
      <div className="rounded-xl bg-[#0d1117] border border-white/8 px-4 py-3 flex flex-wrap items-center gap-x-5 gap-y-2">
        <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-semibold">
          <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Live Sensors
        </div>
        <div className="h-4 w-px bg-white/10 hidden sm:block" />
        {liveValves.map(vs => {
          const valve = VALVES.find(v => v.id === vs.valveId);
          return (
            <div key={vs.valveId} className="flex items-center gap-1.5 text-[11px]">
              <span className={cn("size-2 rounded-full", vs.isOpen ? "bg-primary animate-pulse" : "bg-muted-foreground/30")} />
              <span className="text-muted-foreground">{valve?.name}</span>
              <span className={cn("font-mono font-semibold", vs.isOpen ? "text-primary" : "text-muted-foreground/40")}>
                {vs.isOpen ? `${vs.flowRateLph.toLocaleString()} L/h` : "IDLE"}
              </span>
            </div>
          );
        })}
        <div className="h-4 w-px bg-white/10 hidden sm:block" />
        <div className="text-[11px]">
          <span className="text-muted-foreground">Tank: </span>
          <span className={cn("font-semibold", mainTankPct < 25 ? "text-red-400" : mainTankPct < 50 ? "text-amber-400" : "text-primary")}>{mainTankPct}%</span>
        </div>
        {newCamAlerts > 0 && (
          <div className="flex items-center gap-1 text-[11px] text-red-400 font-semibold">
            <span className="size-1.5 rounded-full bg-red-400 animate-ping" />
            {newCamAlerts} camera alert{newCamAlerts !== 1 ? "s" : ""}
          </div>
        )}
        <div className="ml-auto flex items-center gap-3 text-[11px] text-muted-foreground">
          <span>{liveWeather.tempC}°C</span>
          <span>{liveWeather.humidityPct}% RH</span>
          <span>{liveWeather.windKph} kph</span>
        </div>
      </div>

      <FarmMap
        valves={VALVES}
        beds={beds}
        harvestKgByBed={harvestKgByBed}
        valveStates={liveValves}
        soilReadings={soilReadings}
        cameraAlerts={cameraAlerts}
      />

      {/* Status + IoT cards */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {[
          { icon: "🌿", label: "Healthy",   count: healthyCount,  color: "#c8dc38", bg: "bg-primary/8",      border: "border-primary/25",       desc: "Routine inspection only" },
          { icon: "⚠️", label: "Warning",   count: warningCount,  color: "#f59e0b", bg: "bg-amber-500/8",   border: "border-amber-500/25",     desc: "Monitor closely this week" },
          { icon: "🚨", label: "Infected",  count: infectedCount, color: "#ef4444", bg: "bg-red-500/8",     border: "border-red-500/25",       desc: "Immediate treatment needed" },
          { icon: "🍓", label: "Ready",     count: readyCount,    color: "#a855f7", bg: "bg-violet-500/8",  border: "border-violet-500/25",    desc: "Peak ripeness — harvest now" },
        ].map(({ icon, label, count, color, bg, border, desc }) => (
          <div key={label} className={`col-span-1 rounded-xl border-2 ${border} ${bg} p-3.5 flex items-center gap-3`}>
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

        {/* Water tank card */}
        <div className="col-span-1 rounded-xl border-2 border-blue-500/25 bg-blue-500/8 p-3.5">
          <div className="flex items-center gap-1.5 mb-2">
            <Waves className="size-3.5 text-blue-400" />
            <span className="text-xs font-bold text-blue-300">Main Tank</span>
          </div>
          <div className="text-2xl font-black text-blue-300 leading-none mb-1">{mainTankPct}%</div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-1">
            <div className="h-full bg-blue-400 rounded-full transition-all" style={{width:`${mainTankPct}%`}} />
          </div>
          <div className="text-[10px] text-blue-400/80">{Math.round(mainTank.currentL / 1000).toFixed(1)} m³ · {totalFlowLph.toLocaleString()} L/h out</div>
        </div>

        {/* Weather card */}
        <div className="col-span-1 rounded-xl border-2 border-sky-500/25 bg-sky-500/8 p-3.5">
          <div className="flex items-center gap-1.5 mb-2">
            <Thermometer className="size-3.5 text-sky-400" />
            <span className="text-xs font-bold text-sky-300">Weather</span>
          </div>
          <div className="text-2xl font-black text-sky-300 leading-none mb-1">{liveWeather.tempC}°C</div>
          <div className="text-[10px] text-sky-400/80">{liveWeather.humidityPct}% RH · Wind {liveWeather.windKph} kph</div>
          <div className="text-[10px] text-sky-400/60 mt-0.5">{liveWeather.condition}</div>
        </div>
      </div>
    </div>
  );
}
