"use client";

import Link from "next/link";
import {
  Users, Wheat, AlertTriangle, TrendingUp, Activity, Leaf,
  Bug, ShieldCheck, CalendarCheck, ListChecks, ChevronRight,
  Zap, Sparkles, Sprout, Package, Info,
} from "lucide-react";
import { IotStatusBar } from "@/components/iot-status-bar";
import { ValveIcon } from "@/components/valve-icon";
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
import { Tooltip } from "@/components/ui/tooltip";
import {
  FARM, VALVES, BEDS, FARMERS, HARVESTS, DISEASES, TASKS, ATTENDANCE,
  plantsInBed, todayKg, totalKgValve,
  VALVE_STATES, SOIL_READINGS, TANK_LEVELS, CAMERA_ALERTS,
} from "@/lib/data";
import { DISEASE_LABELS } from "@/lib/types";
import { useLang } from "@/lib/lang";
import { EN, AM } from "@/lib/translations";
import { cn } from "@/lib/utils";

/* ── small helpers ─────────────────────────────────────────────────────── */
function SectionHeader({
  title, sub, href, linkLabel,
}: { title: string; sub?: string; href?: string; linkLabel?: string }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div>
        <div className="font-bold text-slate-900 text-base">{title}</div>
        {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
      </div>
      {href && (
        <Link href={href}
          className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:underline transition-colors">
          {linkLabel ?? "View all →"}
        </Link>
      )}
    </div>
  );
}

function InfoTip({ tip }: { tip: string }) {
  return (
    <Tooltip content={tip} side="top" maxWidth="220px">
      <Info className="size-3 text-slate-300 hover:text-slate-500 cursor-help transition-colors" />
    </Tooltip>
  );
}

/* ── severity colour ───────────────────────────────────────────────────── */
function severityColor(s: number) {
  return s > 60 ? "bg-red-500" : s > 30 ? "bg-amber-500" : "bg-emerald-500";
}

/* ─────────────────────────────────────────────────────────────────────── */
export default function DashboardPage() {
  const { isAm } = useLang();
  const t = isAm ? AM : EN;

  const beds       = BEDS();
  const harvests   = HARVESTS();
  const diseases   = DISEASES();
  const attendance = ATTENDANCE();
  const today      = "2026-05-17";

  const totalKgToday   = todayKg(today);
  const openDiseases   = diseases.filter(d => d.status !== "resolved").length;
  const estimatedYield = beds.reduce((s, b) => s + b.lengthM * 0.4 * 12, 0);
  const presentToday   = attendance.filter(a => a.date === today && a.status === "present").length;

  /* chart data */
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
  const totalHarvestPeriod = harvests.reduce((s, h) => s + h.kg, 0);

  /* today harvest per bed */
  const harvestKgByBed: Record<string, number> = {};
  harvests.filter(h => h.date === today).forEach(h => {
    harvestKgByBed[h.bedId] = (harvestKgByBed[h.bedId] ?? 0) + h.kg;
  });

  /* zone stats */
  const valveStats = VALVES.map(v => ({
    valve: v,
    kg: totalKgValve(v.id),
    bedCount: beds.filter(b => b.valveId === v.id).length,
    infected: beds.filter(b => b.valveId === v.id && b.health === "infected").length,
  })).sort((a, b) => b.kg - a.kg);
  const maxZoneKg = Math.max(...valveStats.map(x => x.kg), 1);

  /* people */
  const pendingTasks = TASKS.filter(task => task.status !== "done").length;
  const topFarmers = [...FARMERS]
    .filter(f => f.role === "farmer")
    .sort((a, b) => b.performanceScore - a.performanceScore)
    .slice(0, 5);

  /* IoT — static snapshot (live in IotStatusBar) */
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

      {/* ── Hero banner ────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-700 via-emerald-600 to-teal-500 p-5 md:p-7 shadow-xl shadow-emerald-900/20">
        {/* subtle dot pattern */}
        <div className="absolute inset-0 opacity-[0.06]"
          style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div>
            <div className="flex items-center gap-2 text-emerald-200 text-xs mb-2 font-medium">
              <Leaf className="size-3.5" />
              <span>{FARM.location} · {FARM.altitudeM} m alt · {FARM.totalAreaHa} ha</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white leading-tight tracking-tight">
              {FARM.name}
            </h1>
            <p className="text-emerald-200/80 text-sm mt-1.5">
              {new Date(today).toLocaleDateString("en", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
            </p>
          </div>

          {/* KPI mini-cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-2 lg:grid-cols-4 gap-2.5 shrink-0">
            {[
              {
                label: t.dashboard.todayHarvest,
                value: `${totalKgToday.toFixed(1)} kg`,
                sub: "all zones",
                icon: Wheat,
                color: "bg-white/15",
                tip: "Total strawberry weight harvested across all irrigation zones today. Daily target: ≥ 50 kg.",
              },
              {
                label: t.dashboard.activeDiseases,
                value: openDiseases,
                sub: openDiseases > 0 ? "needs action" : "all clear",
                icon: AlertTriangle,
                color: openDiseases > 0 ? "bg-red-500/80" : "bg-white/15",
                tip: `Beds with unresolved disease reports (open, notified, or treating). ${openDiseases > 3 ? "High risk — immediate spray schedule recommended." : "Within acceptable range."}`,
              },
              {
                label: t.dashboard.staffOnSite,
                value: presentToday,
                sub: "present today",
                icon: Users,
                color: "bg-white/15",
                tip: "Workers who checked in today out of all registered field staff. Absenteeism above 20% affects harvest capacity.",
              },
              {
                label: t.dashboard.seasonYield,
                value: `${(estimatedYield / 1000).toFixed(1)} t`,
                sub: "estimated total",
                icon: TrendingUp,
                color: "bg-white/15",
                tip: "Projected full-season harvest calculated from current bed lengths × expected yield rate (0.4 kg/m/week × 12 weeks).",
              },
            ].map(item => {
              const Icon = item.icon;
              return (
                <Tooltip key={item.label} content={item.tip} side="bottom" maxWidth="240px">
                  <div className={cn("rounded-xl backdrop-blur-sm px-4 py-3 min-w-[100px] cursor-default transition-all hover:scale-[1.02]", item.color)}>
                    <div className="flex items-center gap-1.5 text-[11px] text-white/70 mb-1 font-medium">
                      <Icon className="size-3" /> {item.label}
                    </div>
                    <div className="text-2xl font-extrabold text-white tabular-nums leading-tight">{item.value}</div>
                    <div className="text-[10px] text-white/55 mt-0.5">{item.sub}</div>
                  </div>
                </Tooltip>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── IoT Live Bar ───────────────────────────────────────────────── */}
      <IotStatusBar />

      {/* ── AI Alert Banner ────────────────────────────────────────────── */}
      {openDiseases > 0 && (
        <Link href="/ai"
          className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 transition-all shadow-lg shadow-amber-200 group">
          <span className="size-9 rounded-xl bg-white/20 grid place-items-center shrink-0 group-hover:bg-white/25 transition-colors">
            <Zap className="size-4.5 text-white" />
          </span>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm flex items-center gap-2">
              <Sparkles className="size-3.5" />
              AI detected {openDiseases} active issue{openDiseases > 1 ? "s" : ""} — harvest forecast ready
            </div>
            <div className="text-[11px] text-amber-100/90 truncate mt-0.5">
              View smart alerts, disease risk scores & 14-day yield projection
            </div>
          </div>
          <ChevronRight className="size-4.5 shrink-0 text-amber-200 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      )}

      {/* ── Quick Actions ───────────────────────────────────────────────── */}
      <QuickActions />

      {/* ── Stat strip ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">

        {/* Irrigation Zones */}
        <Tooltip
          content={`${openValves} valve zone${openValves !== 1 ? "s" : ""} actively flowing at ${totalFlowLph.toLocaleString()} L/h combined. Each zone feeds multiple raised beds via drip tape.`}
          side="bottom" maxWidth="240px">
          <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-4 shadow-sm hover:shadow-md transition-all cursor-default group">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] font-bold text-blue-500 uppercase tracking-wider flex items-center gap-1.5">
                <ValveIcon size={11} /> Irrigation
              </div>
              <span className={cn("size-2 rounded-full", openValves > 0 ? "bg-blue-400 animate-pulse" : "bg-slate-300")} />
            </div>
            <div className="text-2xl font-extrabold text-blue-700 tabular-nums">{openValves}<span className="text-sm font-normal text-blue-400">/{VALVES.length}</span></div>
            <div className="text-[10px] text-blue-500 mt-0.5 font-medium">{totalFlowLph.toLocaleString()} L/h active</div>
          </div>
        </Tooltip>

        {/* Soil Health */}
        <Tooltip
          content={`${soilOptimal} beds in optimal soil range (moisture 55–80%, EC 1.5–2.5 mS/cm, pH 5.8–6.5). ${soilWarning} need attention, ${soilCritical} are critical.`}
          side="bottom" maxWidth="250px">
          <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-4 shadow-sm hover:shadow-md transition-all cursor-default">
            <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Sprout className="size-3" /> Soil Health
            </div>
            <div className="flex items-end gap-1.5 mb-2.5">
              <span className="text-2xl font-extrabold text-emerald-700">{soilOptimal}</span>
              <span className="text-xs text-slate-400 mb-0.5">/ {soilReadings.length} optimal</span>
            </div>
            <div className="flex gap-0.5 rounded-full overflow-hidden h-1.5">
              <div className="bg-emerald-400 transition-all" style={{ width: `${(soilOptimal / soilReadings.length) * 100}%` }} />
              <div className="bg-amber-400 transition-all"   style={{ width: `${(soilWarning  / soilReadings.length) * 100}%` }} />
              <div className="bg-red-400 transition-all"     style={{ width: `${(soilCritical / soilReadings.length) * 100}%` }} />
            </div>
            <div className="text-[10px] text-slate-400 mt-1.5">
              <span className="text-amber-600 font-semibold">{soilWarning} warn</span>
              {soilCritical > 0 && <span className="text-red-600 font-semibold ml-1.5">{soilCritical} critical</span>}
            </div>
          </div>
        </Tooltip>

        {/* Water Today */}
        <Tooltip
          content={`Total water applied today across all open zones. Main tank at ${mainTankPct}% capacity (${Math.round(TANK_LEVELS[0].currentL / 1000)} m³ remaining of ${TANK_LEVELS[0].capacityL / 1000} m³ total).`}
          side="bottom" maxWidth="250px">
          <div className="rounded-xl border border-sky-200 bg-gradient-to-br from-sky-50 to-white p-4 shadow-sm hover:shadow-md transition-all cursor-default">
            <div className="text-[10px] font-bold text-sky-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Activity className="size-3" /> Water Today
            </div>
            <div className="flex items-end gap-1.5 mb-2.5">
              <span className="text-2xl font-extrabold text-sky-700">
                {totalWaterToday >= 1000 ? (totalWaterToday / 1000).toFixed(1) : Math.round(totalWaterToday)}
              </span>
              <span className="text-xs text-slate-400 mb-0.5">{totalWaterToday >= 1000 ? "m³" : "L"}</span>
            </div>
            <div className="h-1.5 bg-sky-100 rounded-full overflow-hidden">
              <div className="h-full bg-sky-400 rounded-full transition-all"
                style={{ width: `${Math.min(100, mainTankPct)}%` }} />
            </div>
            <div className="text-[10px] text-slate-400 mt-1.5">
              Tank <span className={cn("font-semibold",
                mainTankPct < 25 ? "text-red-500" : mainTankPct < 50 ? "text-amber-500" : "text-sky-600"
              )}>{mainTankPct}%</span> remaining
            </div>
          </div>
        </Tooltip>

        {/* Field Staff */}
        <Tooltip
          content={`${FARMERS.filter(f => f.role === "supervisor").length} supervisors and ${FARMERS.filter(f => f.role === "farmer").length} farmers registered. ${presentToday} are present today.`}
          side="bottom" maxWidth="230px">
          <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 shadow-sm hover:shadow-md transition-all cursor-default">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Users className="size-3" /> Field Staff
            </div>
            <div className="flex items-end gap-1.5 mb-2.5">
              <span className="text-2xl font-extrabold text-slate-700">
                {FARMERS.filter(f => f.role !== "manager").length}
              </span>
              <span className="text-xs text-slate-400 mb-0.5">total</span>
            </div>
            <div className="flex gap-1 items-center">
              <div className="size-1.5 rounded-full bg-emerald-400" />
              <span className="text-[10px] text-slate-400">{presentToday} present today</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              {FARMERS.filter(f => f.role === "supervisor").length} supervisors on-site
            </div>
          </div>
        </Tooltip>
      </div>

      {/* ── Weather + Weekly Report ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <WeatherWidget />
        <WeeklyReportCard harvests={harvests} diseases={diseases} attendance={attendance} beds={beds} today={today} />
      </div>

      {/* ── Harvest Trend + Alert Feed ──────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 border border-slate-200 shadow-sm p-4 md:p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="font-bold text-slate-900 text-base">Harvest Trend</div>
                <InfoTip tip="Daily strawberry harvest over the last 14 days across all zones. Hover any point to see exact kg. Dips may indicate weather, disease, or labour gaps." />
              </div>
              <div className="text-xs text-slate-400 mt-0.5">14-day rolling · all irrigation zones</div>
            </div>
            <Tooltip content="Total kg harvested across all 14 days in this window." side="left" maxWidth="200px">
              <div className="text-right cursor-default">
                <div className="text-2xl font-extrabold text-emerald-700 tabular-nums leading-tight">
                  {totalHarvestPeriod.toFixed(1)}
                </div>
                <div className="text-xs text-slate-400">kg this period</div>
              </div>
            </Tooltip>
          </div>
          <HarvestChart data={chartData} />
        </Card>

        {/* Alert Feed */}
        <div className="col-span-1 border border-slate-200 shadow-sm bg-white rounded-xl p-4 md:p-5 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="font-bold text-slate-900">Alert Feed</div>
              <InfoTip tip="AI camera detections and active disease reports. Camera alerts are from on-bed vision sensors. Disease reports are from supervisor inspections." />
            </div>
            <Badge variant="outline" className="text-[10px] tabular-nums">
              {openDiseases + newCamAlerts} active
            </Badge>
          </div>
          <div className="space-y-1.5 flex-1 overflow-y-auto max-h-64">
            {cameraAlerts.filter(a => a.status === "new").slice(0, 3).map(a => (
              <Link key={a.id} href="/iot"
                className="flex items-start gap-2.5 p-2.5 rounded-lg border border-red-100 bg-red-50 hover:bg-red-100 transition-colors group">
                <span className="size-1.5 rounded-full bg-red-500 mt-2 shrink-0 animate-pulse" />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-red-800 truncate">📷 {a.label} — {a.bedId}</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Tooltip
                      content={`Model confidence: ${Math.round(a.confidence * 100)}%. Above 80% = high confidence. Recommend visual verification and treatment log.`}
                      side="right" maxWidth="220px">
                      <span className="text-[10px] text-red-600 cursor-help underline decoration-dotted">
                        {Math.round(a.confidence * 100)}% conf
                      </span>
                    </Tooltip>
                    <span className="text-[10px] text-red-400">· {a.alertType}</span>
                  </div>
                </div>
                <ChevronRight className="size-3.5 text-red-300 group-hover:text-red-500 mt-0.5 shrink-0 transition-colors" />
              </Link>
            ))}
            {diseases.filter(d => d.status !== "resolved").slice(0, 4).map(d => (
              <Link key={d.id} href="/diseases"
                className="flex items-start gap-2.5 p-2.5 rounded-lg border border-amber-100 bg-amber-50 hover:bg-amber-100 transition-colors group">
                <span className="size-1.5 rounded-full bg-amber-500 mt-2 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-amber-800 truncate">
                    🌿 {DISEASE_LABELS[d.type]} — {d.bedId}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Tooltip
                      content={`${d.severity}% of bed area affected. ${d.severity > 60 ? "Critical — immediate spray required." : d.severity > 30 ? "Moderate — schedule treatment within 48h." : "Early stage — monitor daily."}`}
                      side="right" maxWidth="220px">
                      <span className="text-[10px] text-amber-600 cursor-help underline decoration-dotted">
                        {d.severity}% severity
                      </span>
                    </Tooltip>
                    <span className="text-[10px] text-amber-400 capitalize">· {d.status}</span>
                  </div>
                </div>
                <ChevronRight className="size-3.5 text-amber-300 group-hover:text-amber-500 mt-0.5 shrink-0 transition-colors" />
              </Link>
            ))}
            {openDiseases === 0 && newCamAlerts === 0 && (
              <div className="text-center text-slate-400 text-xs py-8 flex flex-col items-center gap-2">
                <span className="text-2xl">✅</span>
                All clear — no active alerts
              </div>
            )}
          </div>
          <Link href="/iot"
            className="mt-3 pt-3 border-t border-slate-100 text-[11px] text-emerald-600 hover:text-emerald-700 font-semibold text-center block transition-colors">
            View IoT Control Center →
          </Link>
        </div>
      </div>

      {/* ── Zone Productivity + Top Performers ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Zone productivity */}
        <Card className="border border-slate-200 shadow-sm p-4 md:p-5">
          <SectionHeader
            title="Zone Productivity"
            sub="Total harvest by irrigation zone · season to date"
            href="/valves"
            linkLabel="All zones →"
          />
          <div className="space-y-3">
            {valveStats.map((v, i) => (
              <Link href={`/valves/${v.valve.id}`} key={v.valve.id} className="block group">
                <div className="flex items-center gap-3">
                  <Tooltip
                    content={`Zone rank #${i + 1}. Covers ${v.bedCount} beds${v.infected > 0 ? `, ${v.infected} infected` : ""}. Total harvest since season start.`}
                    side="right" maxWidth="200px">
                    <div className="size-8 rounded-lg grid place-items-center text-white text-xs font-bold shrink-0 shadow-sm cursor-help transition-transform group-hover:scale-105"
                      style={{ background: v.valve.color }}>
                      #{i + 1}
                    </div>
                  </Tooltip>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <span className="font-bold text-slate-800 group-hover:text-emerald-700 transition-colors truncate">{v.valve.name}</span>
                      <Tooltip
                        content={`${v.kg.toFixed(1)} kg harvested from ${v.bedCount} beds (${(v.kg / v.bedCount).toFixed(1)} kg/bed average).`}
                        side="left" maxWidth="200px">
                        <span className="tabular-nums font-extrabold text-slate-900 ml-2 shrink-0 cursor-help">
                          {v.kg.toFixed(1)} <span className="text-xs font-normal text-slate-400">kg</span>
                        </span>
                      </Tooltip>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500 group-hover:opacity-80"
                        style={{ width: `${(v.kg / maxZoneKg) * 100}%`, background: v.valve.color }} />
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-slate-400 mt-1">
                      <span>{v.bedCount} beds</span>
                      {v.infected > 0 && (
                        <Tooltip content={`${v.infected} beds in this zone are currently infected. May reduce yield by 15–30%.`} side="right" maxWidth="200px">
                          <span className="text-red-600 font-bold cursor-help">⚠ {v.infected} infected</span>
                        </Tooltip>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </Card>

        {/* Top performers */}
        <Card className="border border-slate-200 shadow-sm p-4 md:p-5">
          <SectionHeader
            title="Top Performers"
            sub="Ranked by composite performance score"
            href="/employees"
            linkLabel="All staff →"
          />
          <div className="space-y-1">
            {topFarmers.map((f, i) => (
              <div key={f.id}
                className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors">
                <div className="text-[10px] font-bold text-slate-400 w-5 text-center shrink-0">#{i + 1}</div>
                <Avatar className="size-9 shrink-0">
                  <AvatarFallback className="bg-emerald-100 text-emerald-800 text-[10px] font-bold">{f.avatar}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-800 truncate">{f.name}</div>
                  <Tooltip
                    content={`Attendance rate: ${f.attendanceRate}% over the last 30 days. Target: ≥ 90%.`}
                    side="right" maxWidth="200px">
                    <div className="text-[11px] text-slate-400 cursor-help w-fit">
                      Attendance {f.attendanceRate}%
                    </div>
                  </Tooltip>
                </div>
                <Tooltip
                  content="Composite score (0–100) based on harvest output, task completion rate, and attendance. Updated weekly."
                  side="left" maxWidth="220px">
                  <div className="text-right shrink-0 cursor-help">
                    <div className={cn(
                      "text-sm font-extrabold tabular-nums",
                      f.performanceScore >= 85 ? "text-emerald-600" : f.performanceScore >= 70 ? "text-amber-600" : "text-slate-600"
                    )}>{f.performanceScore}</div>
                    <div className="text-[10px] text-slate-400">score</div>
                  </div>
                </Tooltip>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ── Harvest Forecast ────────────────────────────────────────────── */}
      <HarvestForecast beds={beds} today={today} />

      {/* ── Ripeness Heatmap ────────────────────────────────────────────── */}
      <RipenessHeatmap beds={beds} valves={VALVES} />

      {/* ── Performance by Origin ───────────────────────────────────────── */}
      <OriginPerformance beds={beds} harvests={harvests} diseases={diseases} />

      {/* ── Live Farm Map ───────────────────────────────────────────────── */}
      <Card className="border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 md:px-5 py-3.5 border-b border-slate-100">
          <div>
            <div className="font-bold text-slate-900 text-sm md:text-base">Live Farm Map</div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Tap any bed to open profile · colour = health status
            </div>
          </div>
          <Link href="/map" className="text-xs text-emerald-600 hover:text-emerald-700 hover:underline font-semibold transition-colors">
            Fullscreen →
          </Link>
        </div>
        <div className="p-3 md:p-4">
          <FarmMap valves={VALVES} beds={beds} harvestKgByBed={harvestKgByBed} />
        </div>
      </Card>

      {/* ── Quick nav shortcuts ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { href: "/supervisor",  icon: ShieldCheck,  label: "Supervisor View", sub: "Field operations",     col: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200 hover:border-emerald-400 hover:bg-emerald-100/50" },
          { href: "/attendance",  icon: CalendarCheck, label: "Attendance",      sub: "Today's register",     col: "text-blue-600",    bg: "bg-blue-50 border-blue-200 hover:border-blue-400 hover:bg-blue-100/50" },
          { href: "/tasks",       icon: ListChecks,   label: "Task Manager",    sub: `${pendingTasks} pending`, col: "text-purple-600", bg: "bg-purple-50 border-purple-200 hover:border-purple-400 hover:bg-purple-100/50" },
          { href: "/packaging",   icon: Package,      label: "Packaging",       sub: "Batch & dispatch",      col: "text-amber-600",   bg: "bg-amber-50 border-amber-200 hover:border-amber-400 hover:bg-amber-100/50" },
        ].map(item => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href}
              className={cn("flex items-center gap-3 p-4 rounded-xl border transition-all group", item.bg)}>
              <div className="size-9 rounded-xl bg-white border border-white/80 shadow-sm grid place-items-center shrink-0 group-hover:scale-105 transition-transform">
                <Icon className={cn("size-4", item.col)} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-slate-800">{item.label}</div>
                <div className="text-[11px] text-slate-500">{item.sub}</div>
              </div>
              <ChevronRight className={cn("size-4 text-slate-300 ml-auto transition-all group-hover:translate-x-0.5", `group-hover:${item.col}`)} />
            </Link>
          );
        })}
      </div>

      {/* ── Active disease table ────────────────────────────────────────── */}
      {diseases.filter(d => d.status !== "resolved").length > 0 && (
        <Card className="border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 md:px-5 py-3.5 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="size-7 rounded-lg bg-red-100 grid place-items-center">
                <Bug className="size-3.5 text-red-600" />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 text-sm md:text-base">Active Disease Reports</span>
                <InfoTip tip="Disease reports from supervisor inspections that have not yet been resolved. Severity = % of bed area affected. Status tracks treatment progress." />
                <span className="text-xs text-red-600 font-semibold">{openDiseases} open</span>
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
                  <th className="hidden sm:table-cell">
                    <Tooltip content="Percentage of the bed area visibly affected. >60% = critical, 30–60% = moderate, <30% = early stage." side="top" maxWidth="200px">
                      <span className="cursor-help underline decoration-dotted">Severity</span>
                    </Tooltip>
                  </th>
                  <th className="hidden md:table-cell">Reported</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {diseases.filter(d => d.status !== "resolved").slice(0, 5).map(d => (
                  <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                    <td>
                      <Link href={`/beds/${d.bedId}`}
                        className="font-mono font-bold text-slate-900 hover:text-emerald-700 transition-colors">
                        {d.bedId}
                      </Link>
                    </td>
                    <td className="font-medium text-slate-700 text-xs md:text-sm">{DISEASE_LABELS[d.type]}</td>
                    <td className="hidden sm:table-cell">
                      <div className="flex items-center gap-2">
                        <div className="w-16 md:w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className={cn("h-full rounded-full transition-all", severityColor(d.severity))}
                            style={{ width: `${d.severity}%` }} />
                        </div>
                        <Tooltip
                          content={`${d.severity}% of bed affected. ${d.severity > 60 ? "Requires immediate fungicide application." : d.severity > 30 ? "Schedule treatment within 48 hours." : "Monitor daily; consider preventive spray."}`}
                          side="right" maxWidth="220px">
                          <span className="text-xs font-semibold text-slate-700 tabular-nums cursor-help underline decoration-dotted">
                            {d.severity}%
                          </span>
                        </Tooltip>
                      </div>
                    </td>
                    <td className="hidden md:table-cell text-slate-500 text-xs">
                      {new Date(d.reportedAt).toLocaleDateString("en", { month: "short", day: "numeric" })}
                    </td>
                    <td>
                      <Badge className={cn("text-[10px] capitalize", {
                        "bg-red-100 text-red-700 border-red-200 hover:bg-red-100":       d.status === "open",
                        "bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-100": d.status === "notified",
                        "bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100":   d.status === "treating",
                        "bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100": d.status === "resolved",
                      })}>{d.status}</Badge>
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
