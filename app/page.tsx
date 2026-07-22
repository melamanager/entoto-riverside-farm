"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Users, Wheat, AlertTriangle, TrendingUp, Activity, Leaf,
  Bug, ShieldCheck, CalendarCheck, ListChecks, ChevronRight,
  Zap, Sparkles, Sprout, Package, Info,
} from "lucide-react";
import { ValveIcon } from "@/components/valve-icon";
import { FarmMap } from "@/components/farm-map";
import { HarvestChart } from "@/components/harvest-chart";
import { WeatherWidget } from "@/components/weather-widget";
import { QuickActions } from "@/components/quick-actions";
import { HarvestForecast } from "@/components/harvest-forecast";
import { RipenessHeatmap } from "@/components/ripeness-heatmap";
import { WeeklyReportCard } from "@/components/weekly-report-card";
import { OriginPerformance } from "@/components/origin-performance";
import { RoutineStatusCard } from "@/components/routine-status-card";
import { useDashboard } from "@/lib/use-dashboard";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip } from "@/components/ui/tooltip";
import { FARM } from "@/lib/data";
import { DISEASE_LABELS } from "@/lib/types";
import type { Bed, Farmer, Valve, DiseaseReport, HarvestRecord, AttendanceRecord, Task } from "@/lib/types";
import type { PackagingRecord } from "@/lib/erp-types";
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
        <div className="font-bold text-foreground text-base">{title}</div>
        {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
      </div>
      {href && (
        <Link href={href}
          className="text-xs font-semibold text-primary hover:text-primary/80 hover:underline transition-colors">
          {linkLabel ?? "View all →"}
        </Link>
      )}
    </div>
  );
}

function InfoTip({ tip }: { tip: string }) {
  return (
    <Tooltip content={tip} side="top" maxWidth="220px">
      <Info className="size-3 text-muted-foreground/50 hover:text-muted-foreground cursor-help transition-colors" />
    </Tooltip>
  );
}

/* ── severity colour ───────────────────────────────────────────────────── */
function severityColor(s: number) {
  return s > 60 ? "bg-red-500" : s > 30 ? "bg-amber-500" : "bg-primary";
}

/* ─────────────────────────────────────────────────────────────────────── */
export default function DashboardPage() {
  const { isAm } = useLang();
  const t = isAm ? AM : EN;

  const [beds, setBeds]             = useState<Bed[]>([]);
  const [valves, setValves]         = useState<Valve[]>([]);
  const [farmers, setFarmers]       = useState<Farmer[]>([]);
  const [harvests, setHarvests]     = useState<HarvestRecord[]>([]);
  const [diseases, setDiseases]     = useState<DiseaseReport[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [tasks, setTasks]           = useState<Task[]>([]);
  const [packagingRecords, setPackagingRecords] = useState<PackagingRecord[]>([]);
  const [watering, setWatering] = useState<{ valvesWatered: number; totalValves: number; sessions: number; waterVolumeL: number } | null>(null);
  const today = new Date().toLocaleDateString("en-CA");

  // one batched request (+ sessionStorage warm start) instead of 9 round trips
  const [harvestFrom] = useState(() => {
    const from = new Date();
    from.setDate(from.getDate() - 13);
    return from.toISOString().split("T")[0];
  });
  const dash = useDashboard(harvestFrom);
  useEffect(() => {
    if (!dash) return;
    setBeds(dash.beds as Bed[]);
    setValves(dash.valves as Valve[]);
    setFarmers(dash.farmers as Farmer[]);
    setHarvests(dash.harvests.map(h => ({ ...h, kg: parseFloat(String(h.kg)) })) as unknown as HarvestRecord[]);
    setDiseases(dash.diseases as DiseaseReport[]);
    setAttendance(dash.attendance as AttendanceRecord[]);
    setTasks(dash.tasks as Task[]);
    setPackagingRecords(dash.packagingRecords as PackagingRecord[]);
  }, [dash]);
  useEffect(() => {
    fetch(`/api/routines/daily?date=${new Date().toLocaleDateString("en-CA")}`)
      .then(r => r.json())
      .then(d => setWatering(d.watering ?? null));
  }, []);

  const totalKgToday   = harvests.filter(h => h.date === today).reduce((s, h) => s + h.kg, 0);
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

  /* zone stats (last 14 days) */
  const bedValve: Record<string, string> = {};
  beds.forEach(b => { bedValve[b.id] = b.valveId; });
  const valveStats = valves.map(v => ({
    valve: v,
    kg: harvests.filter(h => bedValve[h.bedId] === v.id).reduce((s, h) => s + h.kg, 0),
    bedCount: beds.filter(b => b.valveId === v.id).length,
    infected: beds.filter(b => b.valveId === v.id && b.health === "infected").length,
  })).sort((a, b) => b.kg - a.kg);
  const maxZoneKg = Math.max(...valveStats.map(x => x.kg), 1);

  /* people */
  const pendingTasks = tasks.filter(task => task.status !== "done").length;
  const topFarmers = [...farmers]
    .filter(f => f.role === "farmer")
    .sort((a, b) => b.performanceScore - a.performanceScore)
    .slice(0, 5);

  /* bed health + watering — live */
  const bedsHealthy  = beds.filter(b => b.health === "healthy").length;
  const bedsWarning  = beds.filter(b => b.health === "warning").length;
  const bedsInfected = beds.filter(b => b.health === "infected").length;

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-5 max-w-[1600px] mx-auto">

      {/* ── Hero banner ────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl p-5 md:p-7 shadow-xl"
        style={{ background: "linear-gradient(135deg, #1a2a0a 0%, #243516 35%, #2e4519 65%, #1f3010 100%)" }}>
        {/* chartreuse dot texture */}
        <div className="absolute inset-0 opacity-40"
          style={{ backgroundImage: "radial-gradient(circle, #c8dc38 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
        {/* glow */}
        <div className="absolute -top-16 -right-16 size-64 rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #c8dc38, transparent 70%)" }} />

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div>
            <div className="flex items-center gap-2 text-[#c8dc38]/70 text-xs mb-2 font-medium">
              <Leaf className="size-3.5" />
              <span>{FARM.location} · {FARM.altitudeM} m alt · {FARM.totalAreaHa} ha</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white leading-tight tracking-tight">
              {FARM.name}
            </h1>
            <p className="text-white/50 text-sm mt-1.5">
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
                tip: "Total strawberry weight harvested across all irrigation zones today. Daily target: ≥ 50 kg.",
              },
              {
                label: t.dashboard.activeDiseases,
                value: openDiseases,
                sub: openDiseases > 0 ? "needs action" : "all clear",
                icon: AlertTriangle,
                tip: `Beds with unresolved disease reports (open, notified, or treating). ${openDiseases > 3 ? "High risk — immediate spray schedule recommended." : "Within acceptable range."}`,
              },
              {
                label: t.dashboard.staffOnSite,
                value: presentToday,
                sub: "present today",
                icon: Users,
                tip: "Workers who checked in today out of all registered field staff. Absenteeism above 20% affects harvest capacity.",
              },
              {
                label: t.dashboard.seasonYield,
                value: `${(estimatedYield / 1000).toFixed(1)} t`,
                sub: "estimated total",
                icon: TrendingUp,
                tip: "Projected full-season harvest calculated from current bed lengths × expected yield rate (0.4 kg/m/week × 12 weeks).",
              },
            ].map(item => {
              const Icon = item.icon;
              return (
                <Tooltip key={item.label} content={item.tip} side="bottom" maxWidth="240px">
                  <div className="rounded-xl backdrop-blur-sm px-4 py-3 min-w-[100px] cursor-default transition-all hover:scale-[1.02]"
                    style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.08)" }}>
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

      {/* ── AI Alert Banner ────────────────────────────────────────────── */}
      {openDiseases > 0 && (
        <Link href="/ai"
          className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-amber-600/80 to-orange-600/80 border border-amber-500/30 text-white hover:from-amber-600 hover:to-orange-600 transition-all shadow-lg group">
          <span className="size-9 rounded-xl bg-white/15 grid place-items-center shrink-0 group-hover:bg-white/20 transition-colors">
            <Zap className="size-4.5 text-amber-200" />
          </span>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm flex items-center gap-2">
              <Sparkles className="size-3.5" />
              AI detected {openDiseases} active issue{openDiseases > 1 ? "s" : ""} — harvest forecast ready
            </div>
            <div className="text-[11px] text-amber-100/80 truncate mt-0.5">
              View smart alerts, disease risk scores & 14-day yield projection
            </div>
          </div>
          <ChevronRight className="size-4.5 shrink-0 text-amber-200/60 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      )}

      {/* ── Quick Actions ───────────────────────────────────────────────── */}
      <QuickActions />

      {/* ── Routine compliance (mandatory daily routines, all supervisors) ── */}
      <RoutineStatusCard mode="manager" />

      {/* ── Stat strip ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">

        {/* Watering today (live) */}
        <Tooltip
          content={`Valves watered today from the irrigation log. Log watering sessions on the Daily Routines page.`}
          side="bottom" maxWidth="240px" wrapperClassName="h-full w-full">
          <Link href="/routines" className="rounded-xl border border-blue-500/20 bg-blue-500/8 p-4 hover:border-blue-500/40 transition-all group h-full flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                <ValveIcon size={11} /> Watering
              </div>
              <span className={cn("size-2 rounded-full", (watering?.valvesWatered ?? 0) > 0 ? "bg-blue-400" : "bg-muted-foreground/30")} />
            </div>
            <div className="text-2xl font-extrabold text-blue-300 tabular-nums">{watering?.valvesWatered ?? 0}<span className="text-sm font-normal text-blue-400/60">/{watering?.totalValves ?? valves.length}</span></div>
            <div className="text-[10px] text-blue-400/80 mt-0.5 font-medium">{watering?.sessions ?? 0} session{(watering?.sessions ?? 0) === 1 ? "" : "s"} today</div>
          </Link>
        </Tooltip>

        {/* Bed health (live) */}
        <Tooltip
          content={`${bedsHealthy} of ${beds.length} beds healthy. ${bedsWarning} showing warnings, ${bedsInfected} infected — infected beds carry active disease reports.`}
          side="bottom" maxWidth="250px" wrapperClassName="h-full w-full">
          <Link href="/beds" className="rounded-xl border border-primary/20 bg-primary/8 p-4 hover:border-primary/40 transition-all h-full flex flex-col justify-between">
            <div className="text-[10px] font-bold text-primary/80 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Sprout className="size-3" /> Bed Health
            </div>
            <div className="flex items-end gap-1.5 mb-2.5">
              <span className="text-2xl font-extrabold text-primary">{bedsHealthy}</span>
              <span className="text-xs text-muted-foreground mb-0.5">/ {beds.length || "–"} healthy</span>
            </div>
            <div className="flex gap-0.5 rounded-full overflow-hidden h-1.5">
              <div className="bg-primary transition-all" style={{ width: `${beds.length ? (bedsHealthy / beds.length) * 100 : 0}%` }} />
              <div className="bg-amber-400 transition-all"   style={{ width: `${beds.length ? (bedsWarning / beds.length) * 100 : 0}%` }} />
              <div className="bg-red-400 transition-all"     style={{ width: `${beds.length ? (bedsInfected / beds.length) * 100 : 0}%` }} />
            </div>
            <div className="text-[10px] text-muted-foreground mt-1.5">
              <span className="text-amber-400 font-semibold">{bedsWarning} warn</span>
              {bedsInfected > 0 && <span className="text-red-400 font-semibold ml-1.5">{bedsInfected} infected</span>}
            </div>
          </Link>
        </Tooltip>

        {/* Water used today (live) */}
        <Tooltip
          content={`Total water recorded in today's watering sessions (from the irrigation log).`}
          side="bottom" maxWidth="250px" wrapperClassName="h-full w-full">
          <Link href="/routines" className="rounded-xl border border-sky-500/20 bg-sky-500/8 p-4 hover:border-sky-500/40 transition-all h-full flex flex-col justify-between">
            <div className="text-[10px] font-bold text-sky-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Activity className="size-3" /> Water Today
            </div>
            <div className="flex items-end gap-1.5 mb-2.5">
              <span className="text-2xl font-extrabold text-sky-300">
                {(watering?.waterVolumeL ?? 0) >= 1000 ? ((watering?.waterVolumeL ?? 0) / 1000).toFixed(1) : Math.round(watering?.waterVolumeL ?? 0)}
              </span>
              <span className="text-xs text-muted-foreground mb-0.5">{(watering?.waterVolumeL ?? 0) >= 1000 ? "m³" : "L"}</span>
            </div>
            <div className="text-[10px] text-muted-foreground mt-1.5">
              {(watering?.waterVolumeL ?? 0) > 0 ? "recorded in watering log" : "no watering logged yet"}
            </div>
          </Link>
        </Tooltip>

        {/* Field Staff */}
        <Tooltip
          content={`${farmers.filter(f => f.role === "supervisor").length} supervisors and ${farmers.filter(f => f.role === "farmer").length} farmers registered. ${presentToday} are present today.`}
          side="bottom" maxWidth="230px" wrapperClassName="h-full w-full">
          <div className="rounded-xl border border-border bg-muted/40 p-4 hover:border-primary/30 transition-all cursor-default h-full flex flex-col justify-between">
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Users className="size-3" /> Field Staff
            </div>
            <div className="flex items-end gap-1.5 mb-2.5">
              <span className="text-2xl font-extrabold text-foreground">
                {farmers.filter(f => f.role !== "manager").length}
              </span>
              <span className="text-xs text-muted-foreground mb-0.5">total</span>
            </div>
            <div className="flex gap-1 items-center">
              <div className="size-1.5 rounded-full bg-primary" />
              <span className="text-[10px] text-muted-foreground">{presentToday} present today</span>
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              {farmers.filter(f => f.role === "supervisor").length} supervisors on-site
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
        <Card className="lg:col-span-2 border border-border bg-card p-4 md:p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="font-bold text-foreground text-base">Harvest Trend</div>
                <InfoTip tip="Daily strawberry harvest over the last 14 days across all zones. Hover any point to see exact kg. Dips may indicate weather, disease, or labour gaps." />
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">14-day rolling · all irrigation zones</div>
            </div>
            <Tooltip content="Total kg harvested across all 14 days in this window." side="left" maxWidth="200px">
              <div className="text-right cursor-default">
                <div className="text-2xl font-extrabold text-primary tabular-nums leading-tight">
                  {totalHarvestPeriod.toFixed(1)}
                </div>
                <div className="text-xs text-muted-foreground">kg this period</div>
              </div>
            </Tooltip>
          </div>
          <HarvestChart data={chartData} />
        </Card>

        {/* Alert Feed */}
        <div className="col-span-1 border border-border bg-card rounded-xl p-4 md:p-5 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="font-bold text-foreground">Alert Feed</div>
              <InfoTip tip="Active disease reports from supervisor inspections and AI photo analysis." />
            </div>
            <Badge variant="outline" className="text-[10px] tabular-nums">
              {openDiseases} active
            </Badge>
          </div>
          <div className="space-y-1.5 flex-1 overflow-y-auto max-h-64">
            {diseases.filter(d => d.status !== "resolved").slice(0, 4).map(d => (
              <Link key={d.id} href="/diseases"
                className="flex items-start gap-2.5 p-2.5 rounded-lg border border-amber-500/20 bg-amber-500/8 hover:bg-amber-500/12 transition-colors group">
                <span className="size-1.5 rounded-full bg-amber-500 mt-2 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-amber-300 truncate">
                    🌿 {DISEASE_LABELS[d.type]} — {d.bedId}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Tooltip
                      content={`${d.severity}% of bed area affected. ${d.severity > 60 ? "Critical — immediate spray required." : d.severity > 30 ? "Moderate — schedule treatment within 48h." : "Early stage — monitor daily."}`}
                      side="right" maxWidth="220px">
                      <span className="text-[10px] text-amber-400 cursor-help underline decoration-dotted">
                        {d.severity}% severity
                      </span>
                    </Tooltip>
                    <span className="text-[10px] text-amber-500/60 capitalize">· {d.status}</span>
                  </div>
                </div>
                <ChevronRight className="size-3.5 text-amber-500/30 group-hover:text-amber-400 mt-0.5 shrink-0 transition-colors" />
              </Link>
            ))}
            {openDiseases === 0 && (
              <div className="text-center text-muted-foreground text-xs py-8 flex flex-col items-center gap-2">
                <span className="text-2xl">✅</span>
                All clear — no active alerts
              </div>
            )}
          </div>
          <Link href="/diseases"
            className="mt-3 pt-3 border-t border-border text-[11px] text-primary hover:text-primary/80 font-semibold text-center block transition-colors">
            Manage diseases →
          </Link>
        </div>
      </div>

      {/* ── Zone Productivity + Top Performers ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Zone productivity */}
        <Card className="border border-border bg-card p-4 md:p-5">
          <SectionHeader
            title="Zone Productivity"
            sub="Total harvest by irrigation zone · last 14 days"
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
                      <span className="font-bold text-foreground group-hover:text-primary transition-colors truncate">{v.valve.name}</span>
                      <Tooltip
                        content={`${v.kg.toFixed(1)} kg harvested from ${v.bedCount} beds (${(v.kg / v.bedCount).toFixed(1)} kg/bed average).`}
                        side="left" maxWidth="200px">
                        <span className="tabular-nums font-extrabold text-foreground ml-2 shrink-0 cursor-help">
                          {v.kg.toFixed(1)} <span className="text-xs font-normal text-muted-foreground">kg</span>
                        </span>
                      </Tooltip>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500 group-hover:opacity-80"
                        style={{ width: `${(v.kg / maxZoneKg) * 100}%`, background: v.valve.color }} />
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-1">
                      <span>{v.bedCount} beds</span>
                      {v.infected > 0 && (
                        <Tooltip content={`${v.infected} beds in this zone are currently infected. May reduce yield by 15–30%.`} side="right" maxWidth="200px">
                          <span className="text-red-400 font-bold cursor-help">⚠ {v.infected} infected</span>
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
        <Card className="border border-border bg-card p-4 md:p-5">
          <SectionHeader
            title="Top Performers"
            sub="Ranked by composite performance score"
            href="/employees"
            linkLabel="All staff →"
          />
          <div className="space-y-1">
            {topFarmers.map((f, i) => (
              <div key={f.id}
                className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-accent transition-colors">
                <div className="text-[10px] font-bold text-muted-foreground w-5 text-center shrink-0">#{i + 1}</div>
                <Avatar className="size-9 shrink-0">
                  <AvatarFallback className="bg-primary/15 text-primary text-[10px] font-bold">{f.avatar}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-foreground truncate">{f.name}</div>
                  <Tooltip
                    content={`Attendance rate: ${f.attendanceRate}% over the last 30 days. Target: ≥ 90%.`}
                    side="right" maxWidth="200px">
                    <div className="text-[11px] text-muted-foreground cursor-help w-fit">
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
                      f.performanceScore >= 85 ? "text-primary" : f.performanceScore >= 70 ? "text-amber-400" : "text-muted-foreground"
                    )}>{f.performanceScore}</div>
                    <div className="text-[10px] text-muted-foreground">score</div>
                  </div>
                </Tooltip>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ── Harvest Forecast ────────────────────────────────────────────── */}
      <HarvestForecast beds={beds} today={today} valves={valves} />

      {/* ── Ripeness Heatmap ────────────────────────────────────────────── */}
      <RipenessHeatmap beds={beds} valves={valves} />

      {/* ── Performance by Origin ───────────────────────────────────────── */}
      <OriginPerformance beds={beds} harvests={harvests} diseases={diseases} packagingRecords={packagingRecords} />

      {/* ── Live Farm Map ───────────────────────────────────────────────── */}
      <Card className="border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-4 md:px-5 py-3.5 border-b border-border">
          <div>
            <div className="font-bold text-foreground text-sm md:text-base">Live Farm Map</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              Tap any bed to open profile · colour = health status
            </div>
          </div>
          <Link href="/map" className="text-xs text-primary hover:text-primary/80 hover:underline font-semibold transition-colors">
            Fullscreen →
          </Link>
        </div>
        <div className="p-3 md:p-4">
          <FarmMap valves={valves} beds={beds} harvestKgByBed={harvestKgByBed} />
        </div>
      </Card>

      {/* ── Quick nav shortcuts ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { href: "/supervisor",  icon: ShieldCheck,   label: "Supervisor View", sub: "Field operations",       accent: "text-primary",    bg: "bg-primary/8 border-primary/20 hover:border-primary/40" },
          { href: "/attendance",  icon: CalendarCheck, label: "Attendance",      sub: "Today's register",       accent: "text-blue-400",   bg: "bg-blue-500/8 border-blue-500/20 hover:border-blue-500/40" },
          { href: "/tasks",       icon: ListChecks,    label: "Task Manager",    sub: `${pendingTasks} pending`, accent: "text-violet-400", bg: "bg-violet-500/8 border-violet-500/20 hover:border-violet-500/40" },
          { href: "/packaging",   icon: Package,       label: "Packaging",       sub: "Batch & dispatch",       accent: "text-amber-400",  bg: "bg-amber-500/8 border-amber-500/20 hover:border-amber-500/40" },
        ].map(item => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href}
              className={cn("flex items-center gap-3 p-4 rounded-xl border transition-all group", item.bg)}>
              <div className="size-9 rounded-xl bg-card border border-border shadow-sm grid place-items-center shrink-0 group-hover:scale-105 transition-transform">
                <Icon className={cn("size-4", item.accent)} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-foreground">{item.label}</div>
                <div className="text-[11px] text-muted-foreground">{item.sub}</div>
              </div>
              <ChevronRight className={cn("size-4 text-border ml-auto transition-all group-hover:translate-x-0.5", `group-hover:${item.accent}`)} />
            </Link>
          );
        })}
      </div>

      {/* ── Active disease table ────────────────────────────────────────── */}
      {diseases.filter(d => d.status !== "resolved").length > 0 && (
        <Card className="border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-4 md:px-5 py-3.5 border-b border-border">
            <div className="flex items-center gap-2">
              <div className="size-7 rounded-lg bg-red-500/15 grid place-items-center">
                <Bug className="size-3.5 text-red-400" />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-foreground text-sm md:text-base">Active Disease Reports</span>
                <InfoTip tip="Disease reports from supervisor inspections that have not yet been resolved. Severity = % of bed area affected. Status tracks treatment progress." />
                <span className="text-xs text-red-400 font-semibold">{openDiseases} open</span>
              </div>
            </div>
            <Link href="/diseases" className="text-xs text-primary hover:text-primary/80 hover:underline font-semibold">Manage →</Link>
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
                  <tr key={d.id}>
                    <td>
                      <Link href={`/beds/${d.bedId}`}
                        className="font-mono font-bold text-foreground hover:text-primary transition-colors">
                        {d.bedId}
                      </Link>
                    </td>
                    <td className="font-medium text-foreground text-xs md:text-sm">{DISEASE_LABELS[d.type]}</td>
                    <td className="hidden sm:table-cell">
                      <div className="flex items-center gap-2">
                        <div className="w-16 md:w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className={cn("h-full rounded-full transition-all", severityColor(d.severity))}
                            style={{ width: `${d.severity}%` }} />
                        </div>
                        <Tooltip
                          content={`${d.severity}% of bed affected. ${d.severity > 60 ? "Requires immediate fungicide application." : d.severity > 30 ? "Schedule treatment within 48 hours." : "Monitor daily; consider preventive spray."}`}
                          side="right" maxWidth="220px">
                          <span className="text-xs font-semibold text-foreground tabular-nums cursor-help underline decoration-dotted">
                            {d.severity}%
                          </span>
                        </Tooltip>
                      </div>
                    </td>
                    <td className="hidden md:table-cell text-muted-foreground text-xs">
                      {new Date(d.reportedAt).toLocaleDateString("en", { month: "short", day: "numeric" })}
                    </td>
                    <td>
                      <Badge className={cn("text-[10px] capitalize border", {
                        "bg-red-500/15 text-red-300 border-red-500/25":       d.status === "open",
                        "bg-amber-500/15 text-amber-300 border-amber-500/25": d.status === "notified",
                        "bg-blue-500/15 text-blue-300 border-blue-500/25":    d.status === "treating",
                        "bg-primary/15 text-primary border-primary/25":       d.status === "resolved",
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
