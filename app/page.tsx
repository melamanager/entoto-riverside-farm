"use client";

import Link from "next/link";
import {
  Users, Wheat, AlertTriangle, TrendingUp, Activity, Leaf,
  ArrowRight, Bug, ShieldCheck, CalendarCheck, ListChecks, ChevronRight,
  Map, Zap, Sparkles, Sprout, Package, BarChart3, Clock,
} from "lucide-react";
import { IotStatusBar } from "@/components/iot-status-bar";
import { ValveIcon } from "@/components/valve-icon";
import { StatCard } from "@/components/stat-card";
import { FarmMap } from "@/components/farm-map";
import { HarvestChart } from "@/components/harvest-chart";
import { WeatherWidget } from "@/components/weather-widget";
import { QuickActions } from "@/components/quick-actions";
import { HarvestForecast } from "@/components/harvest-forecast";
import { RipenessHeatmap } from "@/components/ripeness-heatmap";
import { WeeklyReportCard } from "@/components/weekly-report-card";
import { OriginPerformance } from "@/components/origin-performance";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  FARM, VALVES, BEDS, FARMERS, HARVESTS, DISEASES, NOTIFICATIONS, TASKS, ATTENDANCE,
  plantsInBed, todayKg, totalKgValve, getFarmer,
  VALVE_STATES, SOIL_READINGS, TANK_LEVELS, CAMERA_ALERTS,
} from "@/lib/data";
import { DISEASE_LABELS } from "@/lib/types";
import { useLang } from "@/lib/lang";
import { EN, AM } from "@/lib/translations";
import { cn } from "@/lib/utils";

export default function DashboardPage() {
  const { isAm } = useLang();
  const t = isAm ? AM : EN;
  const beds       = BEDS();
  const harvests   = HARVESTS();
  const diseases   = DISEASES();
  const attendance = ATTENDANCE();
  const today      = "2026-05-17";

  const totalPlants    = beds.reduce((s, b) => s + plantsInBed(b), 0);
  const totalKgToday   = todayKg(today);
  const openDiseases   = diseases.filter(d => d.status !== "resolved").length;
  const estimatedYield = beds.reduce((s, b) => s + b.lengthM * 0.4 * 12, 0);
  const healthyBeds    = beds.filter(b => b.health === "healthy").length;
  const presentToday   = attendance.filter(a => a.date === today && a.status === "present").length;

  // 14-day harvest chart data
  const series: Record<string, number> = {};
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    series[d.toISOString().split("T")[0]] = 0;
  }
  harvests.forEach(h => { if (series[h.date] !== undefined) series[h.date] += h.kg; });
  const chartData = Object.entries(series).map(([date, kg]) => ({
    date: new Date(date).toLocaleDateString("en", { month: "short", day: "numeric" }),
    kg: Math.round(kg * 10) / 10,
  }));

  const harvestKgByBed: Record<string, number> = {};
  harvests.filter(h => h.date === today).forEach(h => {
    harvestKgByBed[h.bedId] = (harvestKgByBed[h.bedId] ?? 0) + h.kg;
  });

  const valveStats = VALVES.map(v => ({
    valve: v,
    kg: totalKgValve(v.id),
    bedCount: beds.filter(b => b.valveId === v.id).length,
    infected: beds.filter(b => b.valveId === v.id && b.health === "infected").length,
  })).sort((a, b) => b.kg - a.kg);

  const pendingTasks = TASKS.filter(task => task.status !== "done").length;
  const topFarmers = [...FARMERS]
    .filter(f => f.role === "farmer")
    .sort((a, b) => b.performanceScore - a.performanceScore)
    .slice(0, 5);

  const totalHarvestAllTime = harvests.reduce((s, h) => s + h.kg, 0);

  const soilReadings    = SOIL_READINGS();
  const cameraAlerts    = CAMERA_ALERTS;
  const openValves      = VALVE_STATES.filter(v => v.isOpen).length;
  const totalFlowLph    = VALVE_STATES.reduce((s, v) => s + v.flowRateLph, 0);
  const totalWaterToday = VALVE_STATES.reduce((s, v) => s + v.totalLitersToday, 0);
  const mainTankPct     = Math.round((TANK_LEVELS[0].currentL / TANK_LEVELS[0].capacityL) * 100);
  const newCamAlerts    = cameraAlerts.filter(a => a.status === "new").length;
  const soilOptimal     = soilReadings.filter(r => r.status === "optimal").length;
  const soilWarning     = soilReadings.filter(r => r.status === "warning").length;
  const soilCritical    = soilReadings.filter(r => r.status === "critical").length;

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-5 max-w-[1600px] mx-auto">

      {/* ── Hero banner ─────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-700 via-emerald-600 to-teal-500 p-5 md:p-6 shadow-xl shadow-emerald-900/20">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMSIgZmlsbD0id2hpdGUiIGZpbGwtb3BhY2l0eT0iMC4wOCIvPjwvc3ZnPg==')] opacity-60" />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div>
            <div className="flex items-center gap-2 text-emerald-200 text-xs mb-2">
              <Leaf className="size-3" />
              <span>{FARM.location} · {FARM.altitudeM}m alt · {FARM.totalAreaHa} ha</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white leading-tight tracking-tight">{FARM.name}</h1>
            <p className="text-emerald-200 text-sm mt-1">
              {new Date(today).toLocaleDateString("en", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 shrink-0">
            {[
              { label: t.dashboard.todayHarvest,  value: `${totalKgToday.toFixed(1)} kg`, sub: "all zones", icon: Wheat, color: "bg-white/20 text-white" },
              { label: t.dashboard.activeDiseases, value: openDiseases,              sub: openDiseases > 0 ? "needs action" : "all clear", icon: AlertTriangle, color: openDiseases > 0 ? "bg-red-500/80 text-white" : "bg-white/20 text-white" },
              { label: t.dashboard.staffOnSite,   value: presentToday,               sub: "present today", icon: Users, color: "bg-white/20 text-white" },
              { label: t.dashboard.seasonYield,   value: `${(estimatedYield / 1000).toFixed(1)} t`, sub: "estimated total", icon: TrendingUp, color: "bg-white/20 text-white" },
            ].map(item => {
              const Icon = item.icon;
              return (
                <div key={item.label} className={`rounded-xl ${item.color} backdrop-blur-sm px-4 py-3 min-w-[100px]`}>
                  <div className="flex items-center gap-1.5 text-xs text-white/70 mb-1">
                    <Icon className="size-3" /> {item.label}
                  </div>
                  <div className="text-2xl font-extrabold text-white tabular-nums leading-tight">{item.value}</div>
                  <div className="text-[10px] text-white/60 mt-0.5">{item.sub}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── IoT Status Bar (isolated client component — has its own live state) */}
      <IotStatusBar />

      {/* ── AI Alert Banner ─────────────────────────────────────────────── */}
      {openDiseases > 0 && (
        <Link href="/ai" className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 transition-all shadow-lg shadow-amber-200">
          <span className="size-8 rounded-lg bg-white/20 grid place-items-center shrink-0">
            <Zap className="size-4 text-white" />
          </span>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm flex items-center gap-2">
              <Sparkles className="size-3.5" /> AI detected {openDiseases} active issue{openDiseases > 1 ? "s" : ""} — harvest forecast ready
            </div>
            <div className="text-[11px] text-amber-100 truncate">Click to view smart alerts, disease risk scores & 14-day yield projection</div>
          </div>
          <ChevronRight className="size-4 shrink-0 text-amber-200" />
        </Link>
      )}

      {/* ── Quick Actions ────────────────────────────────────────────────── */}
      <QuickActions />

      {/* ── Secondary stat strip ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Irrigation Zones" value={`${openValves}/${VALVES.length} open`} hint={`${totalFlowLph.toLocaleString()} L/h`} icon={ValveIcon} tone="blue" />
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Sprout className="size-3 text-emerald-500" /> Soil Health
          </div>
          <div className="flex items-end gap-2 mb-2">
            <span className="text-2xl font-extrabold text-emerald-700">{soilOptimal}</span>
            <span className="text-xs text-slate-400 mb-0.5">optimal</span>
          </div>
          <div className="flex gap-1">
            <div className="h-1.5 rounded-full bg-emerald-400" style={{width:`${(soilOptimal/soilReadings.length)*100}%`, flex:1, minWidth:0}} />
            <div className="h-1.5 rounded-full bg-amber-400" style={{width:`${(soilWarning/soilReadings.length)*100}%`, flex: soilWarning > 0 ? 1 : 0, minWidth:0}} />
            <div className="h-1.5 rounded-full bg-red-400"   style={{width:`${(soilCritical/soilReadings.length)*100}%`, flex: soilCritical > 0 ? 1 : 0, minWidth:0}} />
          </div>
          <div className="text-[10px] text-slate-400 mt-1">{soilWarning} warn · {soilCritical} critical</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Activity className="size-3 text-blue-500" /> Water Today
          </div>
          <div className="flex items-end gap-2 mb-2">
            <span className="text-2xl font-extrabold text-blue-700">
              {totalWaterToday >= 1000 ? `${(totalWaterToday/1000).toFixed(1)}` : Math.round(totalWaterToday)}
            </span>
            <span className="text-xs text-slate-400 mb-0.5">{totalWaterToday >= 1000 ? "m³" : "L"}</span>
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-400 rounded-full" style={{width:`${Math.min(100,(mainTankPct))}%`}} />
          </div>
          <div className="text-[10px] text-slate-400 mt-1">Tank: {mainTankPct}% remaining</div>
        </div>
        <StatCard label="Field Staff" value={FARMERS.filter(f => f.role !== "manager").length} hint={`${FARMERS.filter(f=>f.role==="supervisor").length} supervisors`} icon={Users} tone="slate" />
      </div>

      {/* ── Weather + Weekly Report (side by side on md+) ─────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <WeatherWidget />
        <WeeklyReportCard harvests={harvests} diseases={diseases} attendance={attendance} beds={beds} today={today} />
      </div>

      {/* ── Harvest chart + Notifications ────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 border border-slate-200 shadow-sm p-4 md:p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="font-bold text-slate-900 text-base">Harvest Trend</div>
              <div className="text-xs text-slate-400">14-day rolling · all zones</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-extrabold text-emerald-700 tabular-nums">
                {totalHarvestAllTime.toFixed(1)}
              </div>
              <div className="text-xs text-slate-400">kg this period</div>
            </div>
          </div>
          <HarvestChart data={chartData} />
        </Card>

        <div className="col-span-1 border border-slate-200 shadow-sm bg-white rounded-xl p-4 md:p-5 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div className="font-bold text-slate-900">Alert Feed</div>
            <Badge variant="outline" className="text-[10px]">
              {openDiseases + newCamAlerts} active
            </Badge>
          </div>
          <div className="space-y-2 flex-1 overflow-y-auto max-h-72">
            {/* Camera alerts */}
            {cameraAlerts.filter(a => a.status === "new").slice(0,3).map(a => (
              <Link key={a.id} href="/iot" className="flex items-start gap-2.5 p-2.5 rounded-lg border border-red-100 bg-red-50 hover:bg-red-100 transition-colors">
                <span className="size-2 rounded-full bg-red-500 mt-1.5 shrink-0 animate-pulse" />
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-red-800 truncate">📷 {a.label} — {a.bedId}</div>
                  <div className="text-[10px] text-red-600 mt-0.5">{Math.round(a.confidence*100)}% confidence · {a.alertType}</div>
                </div>
              </Link>
            ))}
            {/* Disease alerts */}
            {diseases.filter(d => d.status !== "resolved").slice(0,4).map(d => (
              <Link key={d.id} href="/diseases" className="flex items-start gap-2.5 p-2.5 rounded-lg border border-amber-100 bg-amber-50 hover:bg-amber-100 transition-colors">
                <span className="size-2 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-amber-800 truncate">🌿 {DISEASE_LABELS[d.type]} — {d.bedId}</div>
                  <div className="text-[10px] text-amber-600 mt-0.5">Severity {d.severity}% · {d.status}</div>
                </div>
              </Link>
            ))}
            {openDiseases === 0 && newCamAlerts === 0 && (
              <div className="text-center text-slate-400 text-xs py-6">All clear — no active alerts</div>
            )}
          </div>
          <Link href="/iot" className="mt-3 text-[11px] text-emerald-600 hover:underline font-semibold text-center block">
            View IoT Control Center →
          </Link>
        </div>
      </div>

      {/* ── Valve leaderboard + Top farmers ─────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border border-slate-200 shadow-sm p-4 md:p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="font-bold text-slate-900">Zone Productivity</div>
              <div className="text-xs text-slate-400">Total harvest by irrigation zone</div>
            </div>
            <Link href="/valves" className="text-xs text-emerald-600 hover:underline font-semibold">View all →</Link>
          </div>
          <div className="space-y-4">
            {valveStats.map((v, i) => {
              const max = Math.max(...valveStats.map(x => x.kg));
              return (
                <Link href={`/valves/${v.valve.id}`} key={v.valve.id} className="block group">
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-lg grid place-items-center text-white text-xs font-bold shrink-0 shadow-sm" style={{ background: v.valve.color }}>
                      #{i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between text-sm mb-1.5">
                        <span className="font-bold text-slate-800 group-hover:text-emerald-700 truncate">{v.valve.name}</span>
                        <span className="tabular-nums font-extrabold text-slate-900 ml-2 shrink-0">{v.kg.toFixed(1)} <span className="text-xs font-normal text-slate-400">kg</span></span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${(v.kg / max) * 100}%`, background: v.valve.color }} />
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-slate-400 mt-1">
                        <span>{v.bedCount} beds</span>
                        {v.infected > 0 && <span className="text-red-600 font-bold">{v.infected} infected</span>}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </Card>

        <Card className="border border-slate-200 shadow-sm p-4 md:p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="font-bold text-slate-900">Top Performers</div>
              <div className="text-xs text-slate-400">Ranked by performance score</div>
            </div>
            <Link href="/employees" className="text-xs text-emerald-600 hover:underline font-semibold">All staff →</Link>
          </div>
          <div className="space-y-1">
            {topFarmers.map((f, i) => (
              <div key={f.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors">
                <div className="text-[10px] font-bold text-slate-400 w-5 text-center shrink-0">#{i + 1}</div>
                <Avatar className="size-9 shrink-0">
                  <AvatarFallback className="bg-emerald-100 text-emerald-800 text-[10px] font-bold">{f.avatar}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-800 truncate">{f.name}</div>
                  <div className="text-[11px] text-slate-400">Attendance {f.attendanceRate}%</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-extrabold text-emerald-700">{f.performanceScore}</div>
                  <div className="text-[10px] text-slate-400">score</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ── Harvest Forecast ─────────────────────────────────────────────── */}
      <HarvestForecast beds={beds} today={today} />

      {/* ── Ripeness Heatmap ─────────────────────────────────────────────── */}
      <RipenessHeatmap beds={beds} valves={VALVES} />

      {/* ── Performance by Origin ────────────────────────────────────────── */}
      <OriginPerformance beds={beds} harvests={harvests} diseases={diseases} />

      {/* ── Live Farm Map ────────────────────────────────────────────────── */}
      <Card className="border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 md:px-5 py-3.5 border-b border-slate-100">
          <div>
            <div className="font-bold text-slate-900 text-sm md:text-base">Live Farm Map</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Tap any bed to open profile · colour = health status</div>
          </div>
          <Link href="/map" className="text-xs text-emerald-600 hover:underline font-semibold">Fullscreen →</Link>
        </div>
        <div className="p-3 md:p-4">
          <FarmMap valves={VALVES} beds={beds} harvestKgByBed={harvestKgByBed} />
        </div>
      </Card>

      {/* ── Quick navigation shortcuts ──────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        {[
          { href: "/supervisor",  icon: ShieldCheck,  label: "Supervisor View",  sub: "Field operations", col: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200 hover:border-emerald-400" },
          { href: "/attendance",  icon: CalendarCheck, label: "Attendance",       sub: "Today's register", col: "text-blue-600",    bg: "bg-blue-50 border-blue-200 hover:border-blue-400" },
          { href: "/tasks",       icon: ListChecks,   label: "Task Manager",     sub: `${pendingTasks} pending`, col: "text-purple-600", bg: "bg-purple-50 border-purple-200 hover:border-purple-400" },
          { href: "/packaging",   icon: Package,      label: "Packaging",        sub: "Batch & dispatch",  col: "text-amber-600",   bg: "bg-amber-50 border-amber-200 hover:border-amber-400" },
        ].map(item => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className={`flex items-center gap-3 p-4 rounded-xl border transition-all group ${item.bg}`}>
              <div className="size-9 rounded-lg bg-white border border-white/80 shadow-sm grid place-items-center shrink-0">
                <Icon className={`size-4 ${item.col}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-slate-800">{item.label}</div>
                <div className="text-[11px] text-slate-500">{item.sub}</div>
              </div>
              <ChevronRight className={`size-4 text-slate-300 ml-auto group-hover:${item.col} transition-colors`} />
            </Link>
          );
        })}
      </div>

      {/* ── Active disease table ─────────────────────────────────────────── */}
      {diseases.filter(d => d.status !== "resolved").length > 0 && (
        <Card className="border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 md:px-5 py-3.5 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="size-7 rounded-lg bg-red-100 grid place-items-center">
                <Bug className="size-3.5 text-red-600" />
              </div>
              <div>
                <span className="font-bold text-slate-900 text-sm md:text-base">Active Disease Reports</span>
                <span className="ml-2 text-xs text-red-600 font-semibold">{openDiseases} open</span>
              </div>
            </div>
            <Link href="/diseases" className="text-xs text-emerald-600 hover:underline font-semibold">Manage →</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full pro-table">
              <thead>
                <tr>
                  <th>Bed</th>
                  <th>Disease</th>
                  <th className="hidden sm:table-cell">Severity</th>
                  <th className="hidden md:table-cell">Reported</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {diseases.filter(d => d.status !== "resolved").slice(0, 5).map(d => (
                  <tr key={d.id}>
                    <td>
                      <Link href={`/beds/${d.bedId}`} className="font-mono font-bold text-slate-900 hover:text-emerald-700">{d.bedId}</Link>
                    </td>
                    <td className="font-medium text-slate-700 text-xs md:text-sm">{DISEASE_LABELS[d.type]}</td>
                    <td className="hidden sm:table-cell">
                      <div className="flex items-center gap-2">
                        <div className="w-16 md:w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${d.severity > 60 ? "bg-red-500" : d.severity > 30 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${d.severity}%` }} />
                        </div>
                        <span className="text-xs font-semibold text-slate-700 tabular-nums">{d.severity}%</span>
                      </div>
                    </td>
                    <td className="hidden md:table-cell text-slate-500 text-xs">
                      {new Date(d.reportedAt).toLocaleDateString("en", { month: "short", day: "numeric" })}
                    </td>
                    <td>
                      <Badge className={`text-[10px] capitalize ${
                        d.status === "open"     ? "bg-red-100 text-red-700 border-red-200 hover:bg-red-100" :
                        d.status === "notified" ? "bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-100" :
                        d.status === "treating" ? "bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100" :
                                                  "bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                      }`}>{d.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
