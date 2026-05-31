"use client";

import { useState, useEffect } from "react";
import { VALVE_STATES, TANK_LEVELS, CAMERA_ALERTS, VALVES } from "@/lib/data";
import { WEATHER_CURRENT } from "@/lib/data";
import { cn } from "@/lib/utils";

export function IotStatusBar() {
  const [liveValves, setLiveValves] = useState(VALVE_STATES.map(v => ({ ...v })));
  const [liveWeather, setLiveWeather] = useState(WEATHER_CURRENT);

  useEffect(() => {
    const id = setInterval(() => {
      setLiveValves(prev => prev.map(v => ({
        ...v,
        flowRateLph: v.isOpen ? Math.round((v.flowRateLph + (Math.random() - 0.5) * 40)) : 0,
        totalLitersToday: v.isOpen ? v.totalLitersToday + Math.round(v.flowRateLph / 1200) : v.totalLitersToday,
      })));
      setLiveWeather(prev => ({
        ...prev,
        tempC: Math.round((prev.tempC + (Math.random() - 0.5) * 0.2) * 10) / 10,
        windKph: Math.round(Math.max(0, prev.windKph + (Math.random() - 0.5) * 2)),
      }));
    }, 3000);
    return () => clearInterval(id);
  }, []);

  const mainTankPct = Math.round((TANK_LEVELS[0].currentL / TANK_LEVELS[0].capacityL) * 100);
  const newCamAlerts = CAMERA_ALERTS.filter(a => a.status === "new").length;
  const totalFlowLph = liveValves.reduce((s, v) => s + v.flowRateLph, 0);

  return (
    <div className="rounded-xl bg-[#0d1117] border border-white/8 px-4 py-3 flex flex-wrap items-center gap-x-5 gap-y-2">
      <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-semibold">
        <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
        IoT Live
      </div>
      <div className="h-4 w-px bg-white/10 hidden sm:block" />
      {liveValves.map(vs => {
        const valve = VALVES.find(v => v.id === vs.valveId);
        return (
          <div key={vs.valveId} className="flex items-center gap-1.5 text-[11px]">
            <span className={cn("size-2 rounded-full", vs.isOpen ? "bg-emerald-400 animate-pulse" : "bg-slate-600")} />
            <span className="text-slate-400">{valve?.name}</span>
            <span className={cn("font-mono font-semibold", vs.isOpen ? "text-emerald-300" : "text-slate-600")}>
              {vs.isOpen ? `${vs.flowRateLph.toLocaleString()} L/h` : "IDLE"}
            </span>
          </div>
        );
      })}
      <div className="h-4 w-px bg-white/10 hidden sm:block" />
      <div className="text-[11px] text-slate-400">
        Total: <span className="text-blue-300 font-mono font-semibold">{totalFlowLph.toLocaleString()} L/h</span>
      </div>
      <div className="text-[11px] text-slate-400">
        Tank: <span className={cn("font-semibold", mainTankPct < 25 ? "text-red-400" : mainTankPct < 50 ? "text-amber-400" : "text-emerald-300")}>{mainTankPct}%</span>
      </div>
      {newCamAlerts > 0 && (
        <div className="flex items-center gap-1 text-[11px] text-red-400 font-semibold">
          <span className="size-1.5 rounded-full bg-red-400 animate-ping" />
          {newCamAlerts} camera alert{newCamAlerts !== 1 ? "s" : ""}
        </div>
      )}
      <div className="ml-auto text-[11px] text-slate-500 hidden md:block">
        {liveWeather.tempC}°C · {liveWeather.condition} · Wind {liveWeather.windKph} kph
      </div>
    </div>
  );
}
