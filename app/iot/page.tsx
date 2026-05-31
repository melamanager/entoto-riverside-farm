"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RichTooltip, type SensorInfo } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  Cpu, Droplets, Thermometer, Wind, Cloud, Sun, Camera,
  Gauge, Waves, AlertTriangle, CheckCircle2, Clock, Zap,
  RefreshCw, Activity, ChevronRight, ArrowUp, ArrowDown,
  CircleDot, ToggleLeft, ToggleRight, Eye, Sprout,
  Navigation, CloudRain, CloudSun,
} from "lucide-react";
import {
  VALVES, VALVE_STATES, SOIL_READINGS, TANK_LEVELS,
  CAMERA_ALERTS, IRRIGATION_EVENTS, WEATHER_CURRENT,
  WEATHER_HISTORY, FARMERS, BEDS,
} from "@/lib/data";
import type {
  ValveState, SoilReading, TankLevel, CameraAlert,
  WeatherCurrent, IrrigationEvent,
} from "@/lib/types";
import { toast } from "sonner";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function jitter(val: number, range: number) {
  return Math.round((val + (Math.random() - 0.5) * range * 2) * 10) / 10;
}

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function fmtL(l: number) {
  return l >= 1000 ? `${(l / 1000).toFixed(1)} m³` : `${Math.round(l)} L`;
}

function windDir(deg: number) {
  const dirs = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
  return dirs[Math.round(deg / 22.5) % 16];
}

// ─── Sparkline SVG ───────────────────────────────────────────────────────────

function Sparkline({ data, color = "#10b981", h = 40 }: { data: number[]; color?: string; h?: number }) {
  if (data.length < 2) return null;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const w = 200;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * (h - 4) - 2}`).join(" ");
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Wind Compass ─────────────────────────────────────────────────────────────

function WindCompass({ deg, kph }: { deg: number; kph: number }) {
  const rad = (deg * Math.PI) / 180;
  const cx = 50, cy = 50, r = 38, arrowLen = 26;
  const tip = { x: cx + Math.sin(rad) * arrowLen, y: cy - Math.cos(rad) * arrowLen };
  const base = { x: cx - Math.sin(rad) * 10, y: cy + Math.cos(rad) * 10 };
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="white" strokeOpacity="0.08" strokeWidth="1" />
      <circle cx={cx} cy={cy} r={r - 10} fill="none" stroke="white" strokeOpacity="0.05" strokeWidth="1" />
      {["N","E","S","W"].map((d, i) => {
        const a = i * 90 * Math.PI / 180;
        const tx = cx + Math.sin(a) * (r + 7);
        const ty = cy - Math.cos(a) * (r + 7);
        return <text key={d} x={tx} y={ty} textAnchor="middle" dominantBaseline="central" fontSize="7" fill="white" fillOpacity="0.4" fontWeight="600">{d}</text>;
      })}
      {[...Array(12)].map((_, i) => {
        const a = i * 30 * Math.PI / 180;
        const x1 = cx + Math.sin(a) * (r - 2), y1 = cy - Math.cos(a) * (r - 2);
        const x2 = cx + Math.sin(a) * (r - 7), y2 = cy - Math.cos(a) * (r - 7);
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="white" strokeOpacity="0.15" strokeWidth="0.8" />;
      })}
      <line x1={base.x} y1={base.y} x2={tip.x} y2={tip.y} stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx={tip.x} cy={tip.y} r="3" fill="#10b981" />
      <circle cx={cx} cy={cy} r="4" fill="#0d1117" stroke="#10b981" strokeWidth="1.5" />
      <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="central" fontSize="5.5" fill="white" fillOpacity="0.6">{kph}</text>
    </svg>
  );
}

// ─── Circular Gauge ───────────────────────────────────────────────────────────

function CircularGauge({ pct, color, label, sublabel }: { pct: number; color: string; label: string; sublabel: string }) {
  const r = 52, cx = 60, cy = 60, circ = 2 * Math.PI * r;
  const filled = (pct / 100) * circ;
  return (
    <svg viewBox="0 0 120 120" className="w-full h-full">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="white" strokeOpacity="0.06" strokeWidth="10" />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeOpacity="0.15" strokeWidth="10" />
      <circle
        cx={cx} cy={cy} r={r}
        fill="none" stroke={color} strokeWidth="10"
        strokeDasharray={`${filled} ${circ}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{ transition: "stroke-dasharray 0.6s ease" }}
      />
      <text x={cx} y={cy - 6} textAnchor="middle" fontSize="18" fontWeight="700" fill="white">{pct}%</text>
      <text x={cx} y={cy + 11} textAnchor="middle" fontSize="8" fill="white" fillOpacity="0.5">{label}</text>
      <text x={cx} y={cy + 22} textAnchor="middle" fontSize="7" fill="white" fillOpacity="0.35">{sublabel}</text>
    </svg>
  );
}

// ─── Sensor info definitions ─────────────────────────────────────────────────

function soilMoistureInfo(current: number): SensorInfo {
  return {
    name: "Soil Moisture", unit: "%",
    description: "Volumetric water content in the root zone. Strawberries need consistent moisture for berry development.",
    min: 0, max: 100, optimalLow: 60, optimalHigh: 80, current,
    lowLabel: "Dry", highLabel: "Saturated",
    tip: "Below 50% → water stress, smaller berries. Above 90% → root rot risk. Irrigate when dropping below 60%.",
  };
}

function soilTempInfo(current: number): SensorInfo {
  return {
    name: "Soil Temperature", unit: "°C",
    description: "Root zone temperature affects nutrient uptake and microbial activity.",
    min: 5, max: 35, optimalLow: 16, optimalHigh: 22, current,
    lowLabel: "Cold", highLabel: "Hot",
    tip: "Below 10°C slows root growth. Above 28°C causes heat stress. Entoto's altitude keeps soil cool — ideal for strawberries.",
  };
}

function ecInfo(current: number): SensorInfo {
  return {
    name: "Electrical Conductivity (EC)", unit: " mS/cm",
    description: "Measures dissolved nutrient/salt concentration in the soil solution. High EC means more nutrients but risks salt burn.",
    min: 0, max: 5, optimalLow: 1.5, optimalHigh: 2.5, current,
    lowLabel: "Low nutrients", highLabel: "Salt stress",
    tip: "Above 2.8 → leaf tip burn, reduced water uptake. Below 1.0 → nutrient deficiency. Flush with clean water if EC > 3.0.",
  };
}

function phInfo(current: number): SensorInfo {
  return {
    name: "Soil pH", unit: "",
    description: "Acidity/alkalinity of the soil. Controls which nutrients are available to plant roots.",
    min: 4, max: 9, optimalLow: 5.8, optimalHigh: 6.5, current,
    lowLabel: "Acidic", highLabel: "Alkaline",
    tip: "Below 5.5 → phosphorus lockout. Above 7.0 → iron & manganese deficiency (yellowing leaves). Adjust with sulfur (down) or lime (up).",
  };
}

function flowRateInfo(current: number): SensorInfo {
  return {
    name: "Flow Rate", unit: " L/h",
    description: "Volume of water delivered through the drip lines per hour when the valve is open.",
    min: 0, max: 2400, optimalLow: 800, optimalHigh: 2200, current,
    lowLabel: "Low", highLabel: "Max",
    tip: "Typical drip irrigation: 800–2,000 L/h per zone. Drop in flow may indicate a clogged emitter or low pressure.",
  };
}

function pressureInfo(current: number): SensorInfo {
  return {
    name: "Inlet Pressure", unit: " bar",
    description: "Water pressure at the valve inlet. Required for drip emitters to deliver uniform coverage across the zone.",
    min: 0, max: 6, optimalLow: 1.5, optimalHigh: 3.5, current,
    lowLabel: "Too low", highLabel: "Too high",
    tip: "Below 1.0 bar → poor emitter coverage. Above 4.0 bar → emitter damage and misting. Ideal drip range: 1.5–3.0 bar.",
  };
}

function humidityInfo(current: number): SensorInfo {
  return {
    name: "Relative Humidity", unit: "%",
    description: "Amount of moisture in the air relative to its maximum capacity at the current temperature.",
    min: 0, max: 100, optimalLow: 60, optimalHigh: 75, current,
    lowLabel: "Dry", highLabel: "Saturated",
    tip: "Above 85% → gray mold (Botrytis) risk on flowers & fruit. Below 50% → increased plant transpiration stress. Entoto's cool climate raises nighttime humidity.",
  };
}

function dewPointInfo(current: number): SensorInfo {
  return {
    name: "Dew Point", unit: "°C",
    description: "Temperature at which air becomes saturated and moisture condenses on surfaces (leaves, fruit).",
    min: -5, max: 25, optimalLow: 5, optimalHigh: 14, current,
    lowLabel: "Very dry", highLabel: "High risk",
    tip: "When dew point approaches air temperature, leaf wetness occurs — prime condition for Botrytis and powdery mildew. Monitor closely at dew point > 14°C.",
  };
}

function pressureHpaInfo(current: number): SensorInfo {
  return {
    name: "Atmospheric Pressure", unit: " hPa",
    description: "Barometric pressure. At Entoto's 2,800m altitude, normal pressure is ~730–780 hPa (vs sea-level 1013 hPa).",
    min: 700, max: 800, optimalLow: 730, optimalHigh: 780, current,
    lowLabel: "Storm risk", highLabel: "Fair weather",
    tip: "Falling pressure often precedes rain or storms. Stable/rising pressure indicates clear conditions. Altitude significantly lowers baseline pressure.",
  };
}

function uvInfo(current: number): SensorInfo {
  return {
    name: "UV Index", unit: "",
    description: "Ultraviolet radiation intensity from the sun. Higher at altitude — Entoto at 2,800m receives ~40% more UV than sea level.",
    min: 0, max: 12, optimalLow: 0, optimalHigh: 5, current,
    lowLabel: "Safe", highLabel: "Extreme",
    tip: "0–2 Low, 3–5 Moderate, 6–7 High, 8–10 Very High, 11+ Extreme. Workers should use SPF30+ sunscreen above UV 6. Plant sunburn can occur above UV 9.",
  };
}

function rainfallInfo(current: number): SensorInfo {
  return {
    name: "Rainfall (24h)", unit: " mm",
    description: "Total precipitation recorded over the past 24 hours by the tipping-bucket rain gauge.",
    min: 0, max: 30, optimalLow: 0, optimalHigh: 8, current,
    lowLabel: "Dry", highLabel: "Heavy rain",
    tip: "0–2 mm → light, supplement with irrigation. 3–8 mm → adequate, reduce irrigation. >10 mm → suspend irrigation, check drainage. >20 mm → disease alert.",
  };
}

function solarInfo(current: number): SensorInfo {
  return {
    name: "Solar Radiation", unit: " W/m²",
    description: "Shortwave radiation reaching the crop canopy. Drives photosynthesis and evapotranspiration.",
    min: 0, max: 900, optimalLow: 300, optimalHigh: 750, current,
    lowLabel: "Overcast", highLabel: "Intense",
    tip: "Below 200 W/m² → low photosynthesis, slow ripening. 400–700 W/m² → peak growth. Above 800 W/m² → possible sunscald on exposed berries. Entoto's thin air increases intensity.",
  };
}

function windInfo(current: number): SensorInfo {
  return {
    name: "Wind Speed", unit: " kph",
    description: "Average wind speed at the weather station mast (2m height). Affects evapotranspiration and disease spread.",
    min: 0, max: 60, optimalLow: 0, optimalHigh: 20, current,
    lowLabel: "Calm", highLabel: "Strong",
    tip: "Above 25 kph → increases plant water stress and dries soil faster. Above 40 kph → physical crop damage, broken runners. Entoto's ridgeline can experience strong gusts.",
  };
}

function tankLevelInfo(pct: number): SensorInfo {
  return {
    name: "Tank Level", unit: "%",
    description: "Current water volume as a percentage of total tank capacity. Measured by ultrasonic distance sensor.",
    min: 0, max: 100, optimalLow: 30, optimalHigh: 100, current: pct,
    lowLabel: "Empty", highLabel: "Full",
    tip: "Below 25% → low alert, schedule refill. Below 10% → critical, irrigation may be interrupted. Refill from borehole pump or municipal supply.",
  };
}

function drainRateInfo(lph: number): SensorInfo {
  return {
    name: "Net Flow Rate", unit: " L/h",
    description: "Rate at which the tank is filling (positive) or draining (negative) due to irrigation consumption.",
    min: -3000, max: 3000, optimalLow: -2500, optimalHigh: 0, current: lph,
    lowLabel: "Fast drain", highLabel: "Filling",
    tip: "Negative value = water being consumed by irrigation. Positive = tank refilling. Zero = no irrigation active. Compare with flow meters on valve tabs.",
  };
}

// ─── Flow Meter Bar ───────────────────────────────────────────────────────────

function FlowBar({ lph, maxLph = 2400, color }: { lph: number; maxLph?: number; color: string }) {
  const pct = Math.min((lph / maxLph) * 100, 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>Flow rate</span>
        <span className="font-mono text-foreground">{lph > 0 ? `${lph.toLocaleString()} L/h` : "—"}</span>
      </div>
      <div className="h-1.5 bg-muted/40 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: lph > 0 ? color : "transparent" }}
        />
      </div>
    </div>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: "irrigation", label: "Irrigation", icon: Droplets },
  { id: "soil",       label: "Soil Sensors", icon: Sprout },
  { id: "tanks",      label: "Water Tanks", icon: Waves },
  { id: "cameras",    label: "AI Cameras", icon: Camera },
  { id: "weather",    label: "Weather Station", icon: Cloud },
] as const;
type TabId = typeof TABS[number]["id"];

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function IoTPage() {
  const [tab, setTab] = useState<TabId>("irrigation");
  const [valveStates, setValveStates] = useState<ValveState[]>(VALVE_STATES.map(v => ({ ...v })));
  const [soilReadings, setSoilReadings] = useState<SoilReading[]>(SOIL_READINGS());
  const [tanks, setTanks] = useState<TankLevel[]>(TANK_LEVELS.map(t => ({ ...t })));
  const [cameraAlerts, setCameraAlerts] = useState<CameraAlert[]>(CAMERA_ALERTS);
  const [weather, setWeather] = useState<WeatherCurrent>(WEATHER_CURRENT);
  const [events, setEvents] = useState<IrrigationEvent[]>(IRRIGATION_EVENTS);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [alertFilter, setAlertFilter] = useState<"all" | "new" | "reviewed" | "actioned">("all");

  const valves = VALVES;
  const farmers = FARMERS;
  const beds = BEDS();

  const getValve = (id: string) => valves.find(v => v.id === id);
  const getFarmer = (id: string) => farmers.find(f => f.id === id);
  const getBed = (id: string) => beds.find(b => b.id === id);

  // Simulate live sensor ticks
  useEffect(() => {
    const interval = setInterval(() => {
      setValveStates(prev => prev.map(v => ({
        ...v,
        flowRateLph: v.isOpen ? jitter(v.flowRateLph, 30) : 0,
        pressureBar: jitter(v.pressureBar, 0.05),
        totalLitersToday: v.isOpen ? v.totalLitersToday + Math.round(v.flowRateLph / 1200) : v.totalLitersToday,
      })));
      setSoilReadings(prev => prev.map(r => ({
        ...r,
        moisturePct: Math.min(100, Math.max(20, jitter(r.moisturePct, 0.4))),
        tempC: jitter(r.tempC, 0.05),
        ecMsCm: Math.max(0.5, jitter(r.ecMsCm, 0.02)),
      })));
      setTanks(prev => prev.map(t => ({
        ...t,
        currentL: Math.max(0, Math.min(t.capacityL, t.currentL + t.fillRateLph / 120)),
      })));
      setWeather(prev => ({
        ...prev,
        tempC: jitter(prev.tempC, 0.1),
        humidityPct: Math.round(Math.min(100, Math.max(30, jitter(prev.humidityPct, 0.5)))),
        windKph: Math.round(Math.max(0, jitter(prev.windKph, 1))),
        solarWm2: Math.round(Math.max(0, jitter(prev.solarWm2, 5))),
      }));
      setLastUpdated(new Date());
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => { setRefreshing(false); setLastUpdated(new Date()); }, 800);
  }, []);

  function toggleValve(valveId: string) {
    setValveStates(prev => prev.map(v => {
      if (v.valveId !== valveId) return v;
      const nowOpen = !v.isOpen;
      const now = new Date().toISOString();
      const newEvent: IrrigationEvent = {
        id: `ie-${Date.now()}`,
        valveId,
        action: nowOpen ? "open" : "close",
        mode: "manual",
        triggeredBy: "f-008",
        timestamp: now,
      };
      setEvents(ev => [newEvent, ...ev]);
      const valve = getValve(valveId);
      toast.success(`${valve?.name ?? valveId} ${nowOpen ? "opened" : "closed"} (manual override)`);
      return {
        ...v,
        isOpen: nowOpen,
        mode: "manual" as const,
        flowRateLph: nowOpen ? Math.round(1200 + Math.random() * 800) : 0,
        ...(nowOpen ? { openedAt: now } : { closedAt: now }),
        nextScheduledEvent: nowOpen ? "Manual override — close manually" : "Manual override — open manually",
      };
    }));
  }

  function markCameraAlert(id: string, status: CameraAlert["status"]) {
    setCameraAlerts(prev => prev.map(a => a.id === id ? { ...a, status } : a));
    toast.success(status === "actioned" ? "Marked as actioned" : "Marked as reviewed");
  }

  const newAlertsCount = cameraAlerts.filter(a => a.status === "new").length;
  const openValves = valveStates.filter(v => v.isOpen).length;
  const totalFlowLph = valveStates.reduce((s, v) => s + v.flowRateLph, 0);
  const soilWarnings = soilReadings.filter(r => r.status !== "optimal").length;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Header ── */}
      <div className="border-b border-border bg-background/95 backdrop-blur sticky top-0 z-10">
        <div className="px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/25 grid place-items-center">
              <Cpu className="size-4 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground tracking-tight">IoT Control Center</h1>
              <p className="text-[11px] text-muted-foreground">ENTOTO Riverside · Live sensor network</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Live status pills */}
            <div className="hidden sm:flex items-center gap-2">
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-400">
                <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {openValves} valve{openValves !== 1 ? "s" : ""} open
              </span>
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-[11px] text-blue-400">
                <Activity className="size-2.5" />
                {totalFlowLph.toLocaleString()} L/h
              </span>
              {newAlertsCount > 0 && (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-[11px] text-red-400">
                  <AlertTriangle className="size-2.5" />
                  {newAlertsCount} new alert{newAlertsCount !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            <div className="text-[10px] text-muted-foreground/60 text-right hidden sm:block">
              <div>Last updated</div>
              <div className="text-muted-foreground font-mono">{lastUpdated.toLocaleTimeString()}</div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleRefresh}
              className="border-border text-muted-foreground hover:bg-accent h-8 px-2.5"
            >
              <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} />
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6 flex gap-1 overflow-x-auto pb-px">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2.5 text-[12px] font-medium border-b-2 transition-all whitespace-nowrap",
                tab === t.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground/70"
              )}
            >
              <t.icon className="size-3.5" />
              {t.label}
              {t.id === "cameras" && newAlertsCount > 0 && (
                <span className="ml-0.5 size-4 rounded-full bg-red-500 text-foreground text-[9px] font-bold grid place-items-center">{newAlertsCount}</span>
              )}
              {t.id === "soil" && soilWarnings > 0 && (
                <span className="ml-0.5 px-1.5 rounded-full bg-amber-500/20 text-amber-400 text-[9px] font-bold">{soilWarnings}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6 space-y-6 max-w-7xl mx-auto">

        {/* ── IRRIGATION TAB ── */}
        {tab === "irrigation" && (
          <div className="space-y-6">
            {/* Summary row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Active Valves", value: `${openValves} / ${valves.length}`, icon: Droplets, color: "text-cyan-400", bg: "bg-cyan-500/10 border-cyan-500/20" },
                { label: "Total Flow", value: `${totalFlowLph.toLocaleString()} L/h`, icon: Activity, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
                { label: "Water Today", value: fmtL(valveStates.reduce((s, v) => s + v.totalLitersToday, 0)), icon: Waves, color: "text-indigo-400", bg: "bg-indigo-500/10 border-indigo-500/20" },
                { label: "Pressure (avg)", value: `${(valveStates.reduce((s, v) => s + v.pressureBar, 0) / valveStates.length).toFixed(1)} bar`, icon: Gauge, color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20" },
              ].map(s => (
                <div key={s.label} className={cn("p-4 rounded-xl border", s.bg)}>
                  <div className="flex items-center gap-2 mb-1">
                    <s.icon className={cn("size-3.5", s.color)} />
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</span>
                  </div>
                  <div className={cn("text-xl font-bold", s.color)}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* Valve cards */}
            <div className="grid md:grid-cols-3 gap-4">
              {valves.map(valve => {
                const vs = valveStates.find(v => v.valveId === valve.id);
                if (!vs) return null;
                const isOpen = vs.isOpen;
                return (
                  <div key={valve.id} className={cn(
                    "rounded-2xl border p-5 space-y-4 transition-all",
                    isOpen
                      ? "bg-gradient-to-br from-emerald-950/30 to-background border-emerald-500/30"
                      : "bg-card border-border"
                  )}>
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="relative size-10 rounded-xl grid place-items-center" style={{ background: `${valve.color}20`, border: `1px solid ${valve.color}40` }}>
                          <Droplets className="size-5" style={{ color: valve.color }} />
                          {isOpen && (
                            <span className="absolute -top-1 -right-1 size-3 rounded-full bg-emerald-400 border-2 border-[#0d1117] animate-pulse" />
                          )}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-foreground">{valve.name}</div>
                          <div className="text-[10px] text-muted-foreground">{valve.irrigationSchedule}</div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge className={cn("text-[10px] font-bold border-0", isOpen ? "bg-emerald-500/20 text-emerald-300" : "bg-muted/40 text-muted-foreground")}>
                          {isOpen ? "OPEN" : "CLOSED"}
                        </Badge>
                        <Badge className={cn("text-[9px] border-0", vs.mode === "manual" ? "bg-amber-500/15 text-amber-400" : "bg-blue-500/15 text-blue-400")}>
                          {vs.mode === "manual" ? "MANUAL" : "AUTO"}
                        </Badge>
                      </div>
                    </div>

                    {/* Flow animation strip */}
                    {isOpen && (
                      <div className="h-1 rounded-full overflow-hidden bg-muted/25">
                        <div
                          className="h-full rounded-full animate-pulse"
                          style={{ background: `linear-gradient(90deg, transparent, ${valve.color}, transparent)`, backgroundSize: "200%", animation: "flow-move 2s linear infinite" }}
                        />
                      </div>
                    )}

                    {/* Readings */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-muted/20 rounded-lg p-3">
                        <RichTooltip info={flowRateInfo(vs.flowRateLph)} side="top">
                          <div className="w-full">
                            <div className="text-[9px] text-muted-foreground/60 uppercase tracking-wider mb-1 underline decoration-dotted decoration-slate-600 cursor-help">Flow Rate</div>
                            <div className={cn("text-base font-bold font-mono", isOpen ? "text-emerald-300" : "text-muted-foreground/60")}>
                              {isOpen ? `${vs.flowRateLph.toLocaleString()}` : "—"}
                              {isOpen && <span className="text-[10px] text-muted-foreground font-normal ml-0.5">L/h</span>}
                            </div>
                          </div>
                        </RichTooltip>
                      </div>
                      <div className="bg-muted/20 rounded-lg p-3">
                        <RichTooltip info={pressureInfo(vs.pressureBar)} side="top">
                          <div className="w-full">
                            <div className="text-[9px] text-muted-foreground/60 uppercase tracking-wider mb-1 underline decoration-dotted decoration-slate-600 cursor-help">Pressure</div>
                            <div className="text-base font-bold font-mono text-foreground/70">
                              {vs.pressureBar.toFixed(1)}
                              <span className="text-[10px] text-muted-foreground font-normal ml-0.5">bar</span>
                            </div>
                          </div>
                        </RichTooltip>
                      </div>
                    </div>

                    <FlowBar lph={vs.flowRateLph} color={valve.color} />

                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>Total today: <span className="text-foreground/70 font-mono">{fmtL(vs.totalLitersToday)}</span></span>
                    </div>

                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground bg-muted/20 rounded-lg px-3 py-2">
                      <Clock className="size-3" />
                      <span className="truncate">{vs.nextScheduledEvent}</span>
                    </div>

                    {/* Toggle button */}
                    <button
                      onClick={() => toggleValve(valve.id)}
                      className={cn(
                        "w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm transition-all border",
                        isOpen
                          ? "bg-red-500/15 border-red-500/30 text-red-300 hover:bg-red-500/25"
                          : "bg-emerald-500/15 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25"
                      )}
                    >
                      {isOpen
                        ? <><ToggleRight className="size-4" /> Close Valve</>
                        : <><ToggleLeft className="size-4" /> Open Valve</>
                      }
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Event log */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Activity className="size-4 text-muted-foreground" /> Irrigation Event Log
                </h3>
                <span className="text-[10px] text-muted-foreground/60">{events.length} events</span>
              </div>
              <div className="divide-y divide-border">
                {events.slice(0, 8).map(ev => {
                  const valve = getValve(ev.valveId);
                  const actor = ev.triggeredBy === "schedule" ? "Scheduled" : getFarmer(ev.triggeredBy)?.name ?? ev.triggeredBy;
                  return (
                    <div key={ev.id} className="px-5 py-3 flex items-center gap-3">
                      <div className={cn("size-7 rounded-full grid place-items-center shrink-0", ev.action === "open" ? "bg-emerald-500/15" : "bg-red-500/15")}>
                        {ev.action === "open"
                          ? <ArrowUp className="size-3 text-emerald-400" />
                          : <ArrowDown className="size-3 text-red-400" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-foreground">
                          {valve?.name ?? ev.valveId} — {ev.action === "open" ? "Opened" : "Closed"}
                        </div>
                        <div className="text-[10px] text-muted-foreground">{actor} · {ev.mode === "manual" ? "manual" : "auto schedule"}</div>
                      </div>
                      {ev.durationMinutes && (
                        <div className="text-right shrink-0">
                          <div className="text-[10px] text-muted-foreground">{ev.durationMinutes} min</div>
                          {ev.totalLiters && <div className="text-[10px] text-blue-400">{fmtL(ev.totalLiters)}</div>}
                        </div>
                      )}
                      <div className="text-[10px] text-muted-foreground/60 shrink-0 w-20 text-right font-mono">
                        {new Date(ev.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── SOIL SENSORS TAB ── */}
        {tab === "soil" && (
          <div className="space-y-5">
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {[
                { label: "Sensors Online", value: `${soilReadings.length}`, icon: CircleDot, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
                { label: "Optimal Zones", value: soilReadings.filter(r => r.status === "optimal").length.toString(), icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
                { label: "Warnings", value: soilReadings.filter(r => r.status === "warning").length.toString(), icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
                { label: "Critical", value: soilReadings.filter(r => r.status === "critical").length.toString(), icon: AlertTriangle, color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
              ].map(s => (
                <div key={s.label} className={cn("p-4 rounded-xl border", s.bg)}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <s.icon className={cn("size-3", s.color)} />
                    <span className="text-[9px] text-muted-foreground uppercase tracking-wider">{s.label}</span>
                  </div>
                  <div className={cn("text-2xl font-bold", s.color)}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
              {[
                { color: "bg-emerald-500", label: "Optimal" },
                { color: "bg-amber-500", label: "Warning" },
                { color: "bg-red-500", label: "Critical" },
              ].map(l => (
                <div key={l.label} className="flex items-center gap-1.5">
                  <div className={cn("size-2 rounded-full", l.color)} />
                  {l.label}
                </div>
              ))}
              <span className="ml-auto">Updated: {new Date(soilReadings[0]?.recordedAt ?? "").toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
            </div>

            {/* Bed grid grouped by valve */}
            {["valve-a", "valve-b", "valve-c"].map(valveId => {
              const valve = getValve(valveId);
              const zoneReadings = soilReadings.filter(r => {
                const bed = getBed(r.bedId);
                return bed?.valveId === valveId;
              });
              return (
                <div key={valveId}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="size-2 rounded-full" style={{ background: valve?.color }} />
                    <span className="text-xs font-semibold text-foreground">{valve?.name} Zone</span>
                    <span className="text-[10px] text-muted-foreground/60">({zoneReadings.length} beds)</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {zoneReadings.map(r => {
                      const bed = getBed(r.bedId);
                      const statusColor = r.status === "optimal" ? "border-emerald-500/30 bg-emerald-500/5"
                        : r.status === "warning" ? "border-amber-500/30 bg-amber-500/5"
                        : "border-red-500/30 bg-red-500/5";
                      const dotColor = r.status === "optimal" ? "bg-emerald-400" : r.status === "warning" ? "bg-amber-400" : "bg-red-400";
                      return (
                        <div key={r.bedId} className={cn("rounded-xl border p-3.5 space-y-2.5 transition-all hover:border-border/50", statusColor)}>
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-foreground">{r.bedId}</span>
                            <span className={cn("size-2 rounded-full animate-pulse", dotColor)} />
                          </div>
                          {bed && (
                            <div className="text-[9px] text-muted-foreground/60 truncate">{bed.variety}</div>
                          )}
                          <div className="grid grid-cols-2 gap-2">
                            {/* Moisture */}
                            <RichTooltip info={soilMoistureInfo(r.moisturePct)} side="bottom">
                              <div className="w-full">
                                <div className="flex items-center gap-1 mb-1">
                                  <Droplets className="size-2.5 text-blue-400" />
                                  <span className="text-[8px] text-muted-foreground/60 underline decoration-dotted cursor-help">Moisture</span>
                                </div>
                                <div className="text-sm font-bold text-blue-300 font-mono">{r.moisturePct.toFixed(0)}%</div>
                                <div className="h-1 bg-muted/40 rounded-full mt-1 overflow-hidden">
                                  <div className="h-full bg-blue-400 rounded-full" style={{ width: `${r.moisturePct}%`, transition: "width 0.5s" }} />
                                </div>
                              </div>
                            </RichTooltip>
                            {/* Temperature */}
                            <RichTooltip info={soilTempInfo(r.tempC)} side="bottom">
                              <div className="w-full">
                                <div className="flex items-center gap-1 mb-1">
                                  <Thermometer className="size-2.5 text-orange-400" />
                                  <span className="text-[8px] text-muted-foreground/60 underline decoration-dotted cursor-help">Soil Temp</span>
                                </div>
                                <div className="text-sm font-bold text-orange-300 font-mono">{r.tempC.toFixed(1)}°</div>
                              </div>
                            </RichTooltip>
                            {/* EC */}
                            <RichTooltip info={ecInfo(r.ecMsCm)} side="top">
                              <div className="w-full">
                                <div className="flex items-center gap-1 mb-1">
                                  <Zap className="size-2.5 text-purple-400" />
                                  <span className="text-[8px] text-muted-foreground/60 underline decoration-dotted cursor-help">EC</span>
                                </div>
                                <div className={cn("text-sm font-bold font-mono", r.ecMsCm > 2.5 ? "text-amber-300" : "text-purple-300")}>{r.ecMsCm.toFixed(1)}</div>
                                <div className="text-[8px] text-muted-foreground/50">mS/cm</div>
                              </div>
                            </RichTooltip>
                            {/* pH */}
                            <RichTooltip info={phInfo(r.ph)} side="top">
                              <div className="w-full">
                                <div className="flex items-center gap-1 mb-1">
                                  <Activity className="size-2.5 text-green-400" />
                                  <span className="text-[8px] text-muted-foreground/60 underline decoration-dotted cursor-help">pH</span>
                                </div>
                                <div className={cn("text-sm font-bold font-mono", r.ph < 5.8 ? "text-amber-300" : "text-green-300")}>{r.ph.toFixed(1)}</div>
                              </div>
                            </RichTooltip>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── WATER TANKS TAB ── */}
        {tab === "tanks" && (
          <div className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              {tanks.map(tank => {
                const pct = Math.round((tank.currentL / tank.capacityL) * 100);
                const isDraining = tank.fillRateLph < 0;
                const isFilling = tank.fillRateLph > 0;
                const color = pct > 50 ? "#10b981" : pct > 25 ? "#f59e0b" : "#ef4444";
                const statusText = tank.status === "ok" ? "Normal" : tank.status === "low" ? "Low Level" : "Critical";
                const statusColor = tank.status === "ok" ? "text-emerald-400 bg-emerald-500/15 border-emerald-500/30"
                  : tank.status === "low" ? "text-amber-400 bg-amber-500/15 border-amber-500/30"
                  : "text-red-400 bg-red-500/15 border-red-500/30";

                return (
                  <div key={tank.id} className="rounded-2xl border border-border bg-card p-6 space-y-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-base font-bold text-foreground">{tank.name}</h3>
                        <div className="text-[11px] text-muted-foreground mt-0.5">Capacity: {fmtL(tank.capacityL)}</div>
                      </div>
                      <Badge className={cn("text-[10px] font-semibold border", statusColor)}>{statusText}</Badge>
                    </div>

                    <div className="flex items-center gap-8">
                      {/* Circular gauge */}
                      <RichTooltip info={tankLevelInfo(pct)} side="right">
                        <div className="w-36 h-36 shrink-0 cursor-help">
                          <CircularGauge
                            pct={pct}
                            color={color}
                            label="Full"
                            sublabel={fmtL(tank.currentL)}
                          />
                        </div>
                      </RichTooltip>

                      {/* Stats */}
                      <div className="flex-1 space-y-4">
                        <div>
                          <div className="text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-1">Current Volume</div>
                          <div className="text-2xl font-bold text-foreground font-mono">{fmtL(tank.currentL)}</div>
                        </div>
                        <div>
                          <RichTooltip info={drainRateInfo(tank.fillRateLph)} side="top">
                            <div className="cursor-help">
                              <div className="text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-1 underline decoration-dotted decoration-slate-600">Flow Rate</div>
                              <div className={cn("flex items-center gap-1.5 text-base font-bold font-mono",
                                isDraining ? "text-red-300" : isFilling ? "text-emerald-300" : "text-muted-foreground")}>
                                {isDraining && <ArrowDown className="size-4" />}
                                {isFilling && <ArrowUp className="size-4" />}
                                {tank.fillRateLph !== 0 ? `${Math.abs(tank.fillRateLph).toLocaleString()} L/h` : "Static"}
                              </div>
                              <div className="text-[10px] text-muted-foreground/60">
                                {isDraining ? "Draining (irrigation active)" : isFilling ? "Refilling" : "No flow"}
                              </div>
                            </div>
                          </RichTooltip>
                        </div>
                        <div>
                          <div className="text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-1">Empty in</div>
                          <div className="text-sm font-semibold text-foreground/70">
                            {isDraining
                              ? `~${Math.round(tank.currentL / Math.abs(tank.fillRateLph) * 60)} min at current rate`
                              : "—"}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Fill level bar */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-[10px] text-muted-foreground/60">
                        <span>0 L</span>
                        <span className="text-muted-foreground">{pct}% full</span>
                        <span>{fmtL(tank.capacityL)}</span>
                      </div>
                      <div className="h-3 bg-muted/30 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-1000 relative overflow-hidden"
                          style={{ width: `${pct}%`, background: color }}
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent to-white/20" />
                        </div>
                      </div>
                      {/* Level markers */}
                      <div className="flex justify-between text-[9px] text-muted-foreground/50">
                        <span>Critical: 10%</span>
                        <span>Low: 25%</span>
                        <span>Safe: 50%</span>
                        <span>Full: 100%</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-border text-[10px] text-muted-foreground/60">
                      <span>Last refill: {new Date(tank.lastRefillAt).toLocaleDateString([], { month: "short", day: "numeric" })} at {new Date(tank.lastRefillAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                      <span>ID: {tank.id}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Water balance summary */}
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">Daily Water Balance</h3>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-1">Withdrawn Today</div>
                  <div className="text-xl font-bold text-red-400">
                    {fmtL(valveStates.reduce((s, v) => s + v.totalLitersToday, 0))}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-1">Rainfall Captured</div>
                  <div className="text-xl font-bold text-blue-400">{fmtL(Math.round(WEATHER_CURRENT.rainfallMm24h * 420))}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-1">Net Balance</div>
                  <div className={cn("text-xl font-bold", true ? "text-emerald-400" : "text-red-400")}>
                    {fmtL(Math.round(WEATHER_CURRENT.rainfallMm24h * 420) - valveStates.reduce((s, v) => s + v.totalLitersToday, 0))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── CAMERAS TAB ── */}
        {tab === "cameras" && (
          <div className="space-y-5">
            {/* Filter */}
            <div className="flex items-center gap-2">
              {(["all", "new", "reviewed", "actioned"] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setAlertFilter(f)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors capitalize",
                    alertFilter === f
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                      : "bg-muted/25 text-muted-foreground border border-border hover:text-foreground/70"
                  )}
                >
                  {f === "all" ? `All (${cameraAlerts.length})` : `${f.charAt(0).toUpperCase() + f.slice(1)} (${cameraAlerts.filter(a => a.status === f).length})`}
                </button>
              ))}
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {cameraAlerts.filter(a => alertFilter === "all" || a.status === alertFilter).map(alert => {
                const bed = getBed(alert.bedId);
                const typeColor = alert.alertType === "disease" ? "bg-red-500/20 text-red-300 border-red-500/30"
                  : alert.alertType === "pest" ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                  : alert.alertType === "ripeness" ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                  : "bg-purple-500/20 text-purple-300 border-purple-500/30";
                const statusColor = alert.status === "new" ? "bg-red-500 text-foreground"
                  : alert.status === "reviewed" ? "bg-blue-500/20 text-blue-300"
                  : "bg-white/10 text-muted-foreground";

                return (
                  <div key={alert.id} className="rounded-2xl border border-border bg-card overflow-hidden group hover:border-border transition-all">
                    {/* Camera thumbnail */}
                    <div className={cn("h-36 relative bg-gradient-to-br", alert.bgGradient, "overflow-hidden")}>
                      {/* Scan line animation */}
                      <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.03)_50%)] bg-[length:100%_4px]" />
                      {/* Corner markers */}
                      {[[0,0,"top-2 left-2"],[1,0,"top-2 right-2"],[0,1,"bottom-2 left-2"],[1,1,"bottom-2 right-2"]].map(([x,y,pos]) => (
                        <div key={`${x}-${y}`} className={`absolute ${pos} w-4 h-4 border-white/30`}
                          style={{ borderTop: y === 0 ? "1px solid" : "none", borderBottom: y === 1 ? "1px solid" : "none", borderLeft: x === 0 ? "1px solid" : "none", borderRight: x === 1 ? "1px solid" : "none" }}
                        />
                      ))}
                      {/* Detection box */}
                      <div className="absolute inset-6 border border-dashed border-border rounded flex items-center justify-center">
                        <Camera className="size-8 text-foreground/20" />
                      </div>
                      {/* Alert type icon */}
                      <div className="absolute top-3 left-3">
                        <Badge className={cn("text-[9px] font-bold border", typeColor)}>
                          {alert.alertType.toUpperCase()}
                        </Badge>
                      </div>
                      {/* Confidence */}
                      <div className="absolute bottom-3 right-3 bg-black/60 rounded px-2 py-1 text-[10px] font-mono text-foreground">
                        {Math.round(alert.confidence * 100)}% conf.
                      </div>
                      {/* Status dot */}
                      {alert.status === "new" && (
                        <div className="absolute top-3 right-3 size-2 rounded-full bg-red-400 animate-ping" />
                      )}
                      {/* Camera ID */}
                      <div className="absolute bottom-3 left-3 text-[9px] text-foreground/40 font-mono">{alert.cameraId}</div>
                    </div>

                    {/* Info */}
                    <div className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-bold text-foreground">{alert.label}</div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            {alert.bedId} · {bed?.variety ?? "Unknown variety"}
                          </div>
                        </div>
                        <Badge className={cn("text-[9px] shrink-0", statusColor)}>
                          {alert.status}
                        </Badge>
                      </div>

                      <p className="text-[11px] text-muted-foreground leading-relaxed">{alert.description}</p>

                      <div className="text-[10px] text-muted-foreground/60 flex items-center gap-1">
                        <Clock className="size-3" />
                        {timeAgo(alert.detectedAt)} — {new Date(alert.detectedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </div>

                      {/* Confidence bar */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[9px] text-muted-foreground/60">
                          <span>Model confidence</span>
                          <span className="text-foreground font-mono">{Math.round(alert.confidence * 100)}%</span>
                        </div>
                        <div className="h-1 bg-muted/40 rounded-full overflow-hidden">
                          <div
                            className={cn("h-full rounded-full", alert.confidence > 0.85 ? "bg-emerald-400" : alert.confidence > 0.7 ? "bg-amber-400" : "bg-red-400")}
                            style={{ width: `${alert.confidence * 100}%` }}
                          />
                        </div>
                      </div>

                      {/* Actions */}
                      {alert.status === "new" && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => markCameraAlert(alert.id, "reviewed")}
                            className="flex-1 h-7 text-[10px] bg-muted/25 border-border text-foreground/70 hover:bg-accent"
                          >
                            <Eye className="size-3 mr-1" /> Review
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => markCameraAlert(alert.id, "actioned")}
                            className="flex-1 h-7 text-[10px] bg-cyan-600 hover:bg-cyan-700 text-foreground border-0"
                          >
                            <CheckCircle2 className="size-3 mr-1" /> Action
                          </Button>
                        </div>
                      )}
                      {alert.status === "reviewed" && (
                        <Button
                          size="sm"
                          onClick={() => markCameraAlert(alert.id, "actioned")}
                          className="w-full h-7 text-[10px] bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30"
                        >
                          <CheckCircle2 className="size-3 mr-1" /> Mark Actioned
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── WEATHER STATION TAB ── */}
        {tab === "weather" && (
          <div className="space-y-5">
            {/* Hero row */}
            <div className="grid md:grid-cols-3 gap-5">
              {/* Temperature card */}
              <div className="md:col-span-1 rounded-2xl border border-border bg-gradient-to-br from-sky-950/50 to-background p-6 space-y-4">
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase tracking-wider">
                  <CloudSun className="size-3" />
                  Temperature · Entoto 2800m
                </div>
                <div className="flex items-end gap-3">
                  <div className="text-6xl font-bold text-foreground tracking-tight">{weather.tempC.toFixed(1)}</div>
                  <div className="pb-2 text-muted-foreground text-xl">°C</div>
                </div>
                <div className="text-sm text-muted-foreground">{weather.condition}</div>
                <div className="text-[11px] text-muted-foreground/60">Feels like <span className="text-muted-foreground">{weather.feelsLikeC.toFixed(1)}°C</span></div>
                <div className="h-10">
                  <Sparkline
                    data={WEATHER_HISTORY.map(p => p.tempC)}
                    color="#60a5fa"
                    h={40}
                  />
                </div>
                <div className="flex justify-between text-[9px] text-muted-foreground/50">
                  <span>00:00</span>
                  <span>12:00</span>
                  <span>23:00</span>
                </div>
              </div>

              {/* Wind compass */}
              <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Wind className="size-3" /> Wind
                  </div>
                  <div className="text-right">
                    <RichTooltip info={windInfo(weather.windKph)} side="top">
                    <div className="text-right cursor-help">
                      <div className="text-xl font-bold text-foreground">{weather.windKph} <span className="text-sm text-muted-foreground">kph</span></div>
                      <div className="text-[10px] text-muted-foreground underline decoration-dotted">{windDir(weather.windDeg)} · {weather.windDeg}°</div>
                    </div>
                  </RichTooltip>
                  </div>
                </div>
                <div className="h-32">
                  <WindCompass deg={weather.windDeg} kph={weather.windKph} />
                </div>
                <div className="h-10">
                  <Sparkline data={WEATHER_HISTORY.map(p => p.windKph)} color="#a78bfa" h={40} />
                </div>
              </div>

              {/* Solar & Humidity */}
              <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase tracking-wider">
                  <Sun className="size-3" /> Solar & Humidity
                </div>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-1">
                      <RichTooltip info={solarInfo(weather.solarWm2)} side="left">
                        <span className="text-[10px] text-muted-foreground/60 flex items-center gap-1 cursor-help underline decoration-dotted decoration-slate-600"><Sun className="size-2.5" /> Solar Radiation</span>
                      </RichTooltip>
                      <span className="text-sm font-bold text-amber-300">{weather.solarWm2} W/m²</span>
                    </div>
                    <div className="h-1.5 bg-muted/40 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-400 rounded-full" style={{ width: `${(weather.solarWm2 / 900) * 100}%`, transition: "width 0.5s" }} />
                    </div>
                    <div className="h-8 mt-2">
                      <Sparkline data={WEATHER_HISTORY.map(p => p.solarWm2)} color="#fbbf24" h={32} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <RichTooltip info={humidityInfo(weather.humidityPct)} side="left">
                        <span className="text-[10px] text-muted-foreground/60 flex items-center gap-1 cursor-help underline decoration-dotted decoration-slate-600"><Droplets className="size-2.5" /> Humidity</span>
                      </RichTooltip>
                      <span className="text-sm font-bold text-blue-300">{weather.humidityPct}%</span>
                    </div>
                    <div className="h-1.5 bg-muted/40 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-400 rounded-full" style={{ width: `${weather.humidityPct}%`, transition: "width 0.5s" }} />
                    </div>
                    <div className="h-8 mt-2">
                      <Sparkline data={WEATHER_HISTORY.map(p => p.humidityPct)} color="#60a5fa" h={32} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { label: "Humidity",     value: `${weather.humidityPct}%`,           icon: Droplets,    color: "text-blue-400",   info: humidityInfo(weather.humidityPct) },
                { label: "Dew Point",    value: `${weather.dewPointC.toFixed(1)}°C`,  icon: Thermometer, color: "text-cyan-400",   info: dewPointInfo(weather.dewPointC) },
                { label: "Pressure",     value: `${weather.pressureHpa} hPa`,         icon: Gauge,       color: "text-indigo-400", info: pressureHpaInfo(weather.pressureHpa) },
                { label: "UV Index",     value: `${weather.uvIndex}`,                 icon: Sun,         color: "text-amber-400",  info: uvInfo(weather.uvIndex) },
                { label: "Rainfall 24h", value: `${weather.rainfallMm24h} mm`,        icon: CloudRain,   color: "text-blue-400",   info: rainfallInfo(weather.rainfallMm24h) },
                { label: "Solar",        value: `${weather.solarWm2} W/m²`,           icon: Zap,         color: "text-yellow-400", info: solarInfo(weather.solarWm2) },
              ].map(s => (
                <RichTooltip key={s.label} info={s.info} side="top">
                  <div className="bg-card border border-border rounded-xl p-4 w-full cursor-help hover:border-border/50 transition-colors">
                    <div className="flex items-center gap-1.5 mb-2">
                      <s.icon className={cn("size-3", s.color)} />
                      <span className="text-[9px] text-muted-foreground/60 uppercase tracking-wider underline decoration-dotted">{s.label}</span>
                    </div>
                    <div className={cn("text-base font-bold font-mono", s.color)}>{s.value}</div>
                  </div>
                </RichTooltip>
              ))}
            </div>

            {/* 24h weather table */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-5 py-3.5 border-b border-border">
                <h3 className="text-sm font-semibold text-foreground">24-Hour History</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="border-b border-border">
                      {["Time", "Temp °C", "Humidity %", "Wind km/h", "Rainfall mm", "Solar W/m²"].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-[9px] text-muted-foreground/60 uppercase tracking-wider font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {WEATHER_HISTORY.filter((_, i) => i % 3 === 0).map((row) => (
                      <tr key={row.time} className="hover:bg-muted/15 transition-colors">
                        <td className="px-4 py-2.5 font-mono text-muted-foreground">{row.time}</td>
                        <td className="px-4 py-2.5 font-mono text-blue-300">{row.tempC.toFixed(1)}</td>
                        <td className="px-4 py-2.5 font-mono text-sky-300">{row.humidityPct}</td>
                        <td className="px-4 py-2.5 font-mono text-purple-300">{row.windKph}</td>
                        <td className="px-4 py-2.5 font-mono text-indigo-300">{row.rainfallMm > 0 ? row.rainfallMm.toFixed(1) : "—"}</td>
                        <td className="px-4 py-2.5 font-mono text-amber-300">{row.solarWm2 > 0 ? row.solarWm2 : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Station info */}
            <div className="rounded-xl border border-border bg-card px-5 py-4 flex flex-wrap gap-4 text-[10px] text-muted-foreground/60">
              <span>Station: <span className="text-muted-foreground">ENTOTO-WS-01</span></span>
              <span>Altitude: <span className="text-muted-foreground">2,800 m ASL</span></span>
              <span>Sensor: <span className="text-muted-foreground">Davis Vantage Vue</span></span>
              <span>Protocol: <span className="text-muted-foreground">WeatherLink API · 2 min interval</span></span>
              <span className="ml-auto flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-emerald-400">Online</span>
              </span>
            </div>
          </div>
        )}

      </div>

      <style>{`
        @keyframes flow-move {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
      `}</style>
    </div>
  );
}
