"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users, Wheat, AlertTriangle, TrendingUp, Leaf,
  Bug, ShieldCheck, CalendarCheck, ListChecks, ChevronRight,
  Zap, Sparkles, Sprout, Package, Info,
} from "lucide-react";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DISEASE_LABELS } from "@/lib/types";
import { useLang } from "@/lib/lang";
import { EN, AM } from "@/lib/translations";
import type { Valve, Bed, Farmer, HarvestRecord, DiseaseReport, Notification, Task, AttendanceRecord } from "@/lib/types";
import type { PackagingRecord } from "@/lib/erp-types";

const FARM = { name: "ENTOTO Riverside Farm", location: "Entoto Mountain, Addis Ababa, Ethiopia", altitudeM: 2800, totalAreaHa: 4.2 };

function InfoTip({ tip }: { tip: string }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Info className="size-3 text-muted-foreground/50 cursor-help inline-block align-middle ml-1 hover:text-muted-foreground transition-colors" />
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[200px] text-xs">{tip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default function DashboardPage() {
  const { isAm } = useLang();
  const t = isAm ? AM : EN;

  const [valves, setValves] = useState<Valve[]>([]);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [harvests, setHarvests] = useState<HarvestRecord[]>([]);
  const [diseases, setDiseases] = useState<DiseaseReport[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [packagingRecords, setPackagingRecords] = useState<PackagingRecord[]>([]);

  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    Promise.all([
      fetch("/api/valves").then(r => r.json()),
      fetch("/api/beds").then(r => r.json()),
      fetch("/api/farmers").then(r => r.json()),
      fetch("/api/harvest").then(r => r.json()),
      fetch("/api/diseases").then(r => r.json()),
      fetch("/api/notifications").then(r => r.json()),
      fetch("/api/tasks").then(r => r.json()),
      fetch(`/api/attendance?date=${today}`).then(r => r.json()),
      fetch("/api/packaging").then(r => r.json()),
    ]).then(([v, b, f, h, d, n, tk, a, pk]) => {
      setValves(v);
      setBeds(b);
      setFarmers(f);
      setHarvests(h.map((rec: HarvestRecord & { kg: string | number }) => ({ ...rec, kg: parseFloat(rec.kg.toString()) })));
      setDiseases(d);
      setNotifications(n);
      setTasks(tk);
      setAttendance(a);
      setPackagingRecords(pk);
    });
  }, []);

  const totalPlants    = beds.reduce((s, b) => s + b.lengthM * b.plantsPerMeter, 0);
  const totalKgToday   = harvests.filter(h => h.date === today).reduce((sum, h) => sum + parseFloat(h.kg.toString()), 0);
  const openDiseases   = diseases.filter(d => d.status !== "resolved").length;
  const estimatedYield = beds.reduce((s, b) => s + b.lengthM * 0.4 * 12, 0);
  const healthyBeds    = beds.filter(b => b.health === "healthy").length;
  const presentToday   = attendance.filter(a => a.status === "present").length;

  const series: Record<string, number> = {};
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    series[d.toISOString().split("T")[0]] = 0;
  }
  harvests.forEach(h => { if (series[h.date] !== undefined) series[h.date] += parseFloat(h.kg.toString()); });
  const chartData = Object.entries(series).map(([date, kg]) => ({
    date: new Date(date).toLocaleDateString("en", { month: "short", day: "numeric" }),
    kg: Math.round(kg * 10) / 10,
  }));

  const harvestKgByBed: Record<string, number> = {};
  harvests.filter(h => h.date === today).forEach(h => {
    harvestKgByBed[h.bedId] = (harvestKgByBed[h.bedId] ?? 0) + parseFloat(h.kg.toString());
  });

  const valveStats = valves.map(v => {
    const valveBedIds = beds.filter(b => b.valveId === v.id).map(b => b.id);
    const kg = harvests.filter(h => valveBedIds.includes(h.bedId)).reduce((s, h) => s + parseFloat(h.kg.toString()), 0);
    return {
      valve: v,
      kg,
      bedCount: beds.filter(b => b.valveId === v.id).length,
      infected: beds.filter(b => b.valveId === v.id && b.health === "infected").length,
    };
  }).sort((a, b) => b.kg - a.kg);

  const pendingTasks = tasks.filter(task => task.status !== "done").length;
  const topFarmers = [...farmers]
    .filter(f => f.role === "farmer")
    .sort((a, b) => b.performanceScore - a.performanceScore)
    .slice(0, 5);

  const totalHarvestAllTime = harvests.reduce((s, h) => s + parseFloat(h.kg.toString()), 0);

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-5 max-w-[1600px] mx-auto">

      {/* ── Hero banner ─────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl p-5 md:p-6 shadow-xl"
        style={{ background: "linear-gradient(135deg, #1a2a0a 0%, #243516 35%, #2e4519 65%, #1f3010 100%)" }}>
        <div className="absolute inset-0 opacity-40"
          style={{ backgroundImage: "radial-gradient(circle, #c8dc38 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
        <div className="absolute -top-16 -right-16 size-64 rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #c8dc38, transparent 70%)" }} />

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div>
            <div className="flex items-center gap-2 text-[#c8dc38]/70 text-xs mb-2">
              <Leaf className="size-3" />
              <span>{FARM.location} · {FARM.altitudeM}m alt · {FARM.totalAreaHa} ha</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white leading-tight tracking-tight">{FARM.name}</h1>
            <p className="text-white/50 text-sm mt-1">
              {new Date(today).toLocaleDateString("en", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 shrink-0">
            {[
              { label: t.dashboard.todayHarvest,   value: `${totalKgToday.toFixed(1)} kg`, sub: "all zones",                         tip: "Total kg harvested across all beds today" },
              { label: t.dashboard.activeDiseases,  value: openDiseases,                    sub: openDiseases > 0 ? "needs action" : "all clear", tip: "Disease reports still open or being treated" },
              { label: t.dashboard.staffOnSite,    value: presentToday,                    sub: "present today",                     tip: "Farmers who checked in today" },
              { label: t.dashboard.seasonYield,    value: `${(estimatedYield / 1000).toFixed(1)} t`, sub: "estimated total",         tip: "Projected season yield at 0.4 kg/m/month" },
            ].map(item => (
              <TooltipProvider key={item.label} delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="rounded-xl backdrop-blur-sm px-4 py-3 min-w-[100px] cursor-default"
                      style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.08)" }}>
                      <div className="text-xs text-white/60 mb-1">{item.label}</div>
                      <div className="text-2xl font-extrabold text-white tabular-nums leading-tight">{item.value}</div>
                      <div className="text-[10px] text-white/50 mt-0.5">{item.sub}</div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">{item.tip}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}
          </div>
        </div>
      </div>

      {/* ── AI Alert Banner ─────────────────────────────────────────────── */}
      {openDiseases > 0 && (
        <Link href="/ai" className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-amber-600/80 to-orange-600/80 border border-amber-500/30 text-white hover:from-amber-600 hover:to-orange-600 transition-all shadow-lg">
          <span className="size-8 rounded-lg bg-white/15 grid place-items-center shrink-0">
            <Zap className="size-4 text-amber-200" />
          </span>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm flex items-center gap-2">
              <Sparkles className="size-3.5" /> AI detected {openDiseases} active issue{openDiseases > 1 ? "s" : ""} — harvest forecast ready
            </div>
            <div className="text-[11px] text-amber-100/80 truncate">Click to view smart alerts, disease risk scores & 14-day yield projection</div>
          </div>
          <ChevronRight className="size-4 shrink-0 text-amber-200/60" />
        </Link>
      )}

      {/* ── Quick Actions ────────────────────────────────────────────────── */}
      <QuickActions />

      {/* ── Secondary stat strip ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Irrigation Zones" value={valves.length}                                                           hint="Active"                                                           icon={ValveIcon} tone="blue"    />
        <StatCard label="Healthy Beds"      value={`${healthyBeds}/${beds.length}`}                                        hint={`${beds.filter(b=>b.health==="infected").length} infected`}       icon={Sprout}    tone="emerald" />
        <StatCard label="Total Plants"      value={totalPlants.toLocaleString()}                                           hint="8 plants/m"                                                       icon={Leaf}      tone="emerald" />
        <StatCard label="Field Staff"       value={farmers.filter(f => f.role !== "manager").length}                       hint={`${farmers.filter(f=>f.role==="supervisor").length} supervisors`} icon={Users}     tone="slate"   />
      </div>

      {/* ── Weather + Weekly Report ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <WeatherWidget />
        <WeeklyReportCard harvests={harvests} diseases={diseases} attendance={attendance} beds={beds} today={today} />
      </div>

      {/* ── Harvest chart + Notifications ───────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 border border-border bg-card p-4 md:p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="font-bold text-foreground text-base">
                Harvest Trend
                <InfoTip tip="Rolling 14-day daily harvest across all zones" />
              </div>
              <div className="text-xs text-muted-foreground">14-day rolling · all zones</div>
            </div>
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="text-right cursor-default">
                    <div className="text-2xl font-extrabold text-primary tabular-nums">
                      {totalHarvestAllTime.toFixed(1)}
                    </div>
                    <div className="text-xs text-muted-foreground">kg this period</div>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="left" className="text-xs">Cumulative harvest for the 14-day window</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <HarvestChart data={chartData} />
        </Card>

        <Card className="border border-border bg-card p-4 md:p-5 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div className="font-bold text-foreground">
              Notifications
              <InfoTip tip="Latest system and field alerts" />
            </div>
            <Badge variant="outline" className="text-[10px]">{notifications.filter(n => !n.read).length} new</Badge>
          </div>
          <div className="space-y-2 flex-1">
            {notifications.slice(0, 6).map(n => (
              <Link key={n.id} href={n.link ?? "#"} className="flex items-start gap-2.5 p-2.5 rounded-lg border border-border/60 hover:bg-accent transition-colors">
                <span className={`size-2 rounded-full mt-1.5 shrink-0 ${n.read ? "bg-muted-foreground/30" : "bg-primary"}`} />
                <div className="min-w-0">
                  <div className="text-xs text-foreground leading-snug">{n.message}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1.5">
                    <Badge variant="outline" className="text-[9px] px-1 h-4 capitalize">{n.channel}</Badge>
                    {new Date(n.timestamp).toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      </div>

      {/* ── Zone leaderboard + Top farmers ──────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border border-border bg-card p-4 md:p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="font-bold text-foreground">
                Zone Productivity
                <InfoTip tip="All-time harvest kg per irrigation zone" />
              </div>
              <div className="text-xs text-muted-foreground">Total harvest by irrigation zone</div>
            </div>
            <Link href="/valves" className="text-xs text-primary hover:text-primary/80 font-semibold">View all →</Link>
          </div>
          <div className="space-y-4">
            {valveStats.map((v, i) => {
              const max = Math.max(...valveStats.map(x => x.kg));
              return (
                <Link href={`/valves/${v.valve.id}`} key={v.valve.id} className="block group">
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-lg grid place-items-center text-white text-xs font-bold shrink-0 shadow-sm"
                      style={{ background: v.valve.color }}>
                      #{i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between text-sm mb-1.5">
                        <span className="font-bold text-foreground group-hover:text-primary truncate transition-colors">{v.valve.name}</span>
                        <TooltipProvider delayDuration={150}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="tabular-nums font-extrabold text-foreground ml-2 shrink-0 cursor-default">
                                {v.kg.toFixed(1)} <span className="text-xs font-normal text-muted-foreground">kg</span>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent className="text-xs">{v.bedCount} beds · {v.infected > 0 ? `${v.infected} infected` : "all healthy"}</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all"
                          style={{ width: `${max > 0 ? (v.kg / max) * 100 : 0}%`, background: v.valve.color }} />
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-1">
                        <span>{v.bedCount} beds</span>
                        {v.infected > 0 && <span className="text-red-400 font-bold">{v.infected} infected</span>}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </Card>

        <Card className="border border-border bg-card p-4 md:p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="font-bold text-foreground">
                Top Performers
                <InfoTip tip="Ranked by overall performance score" />
              </div>
              <div className="text-xs text-muted-foreground">Ranked by performance score</div>
            </div>
            <Link href="/employees" className="text-xs text-primary hover:text-primary/80 font-semibold">All staff →</Link>
          </div>
          <div className="space-y-1">
            {topFarmers.map((f, i) => (
              <div key={f.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-accent transition-colors">
                <div className="text-[10px] font-bold text-muted-foreground w-5 text-center shrink-0">#{i + 1}</div>
                <Avatar className="size-9 shrink-0">
                  <AvatarFallback className="bg-primary/15 text-primary text-[10px] font-bold">{f.avatar}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-foreground truncate">{f.name}</div>
                  <TooltipProvider delayDuration={150}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="text-[11px] text-muted-foreground cursor-default">Attendance {f.attendanceRate}%</div>
                      </TooltipTrigger>
                      <TooltipContent className="text-xs">Days present / total working days this season</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-extrabold text-primary">{f.performanceScore}</div>
                  <div className="text-[10px] text-muted-foreground">score</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ── Harvest Forecast ─────────────────────────────────────────────── */}
      <HarvestForecast beds={beds} today={today} valves={valves} />

      {/* ── Ripeness Heatmap ─────────────────────────────────────────────── */}
      <RipenessHeatmap beds={beds} valves={valves} />

      {/* ── Performance by Origin ────────────────────────────────────────── */}
      <OriginPerformance beds={beds} harvests={harvests} diseases={diseases} packagingRecords={packagingRecords} />

      {/* ── Live Farm Map ────────────────────────────────────────────────── */}
      <Card className="border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-4 md:px-5 py-3.5 border-b border-border">
          <div>
            <div className="font-bold text-foreground text-sm md:text-base">Live Farm Map</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">Tap any bed to open profile · colour = health status</div>
          </div>
          <Link href="/map" className="text-xs text-primary hover:text-primary/80 font-semibold">Fullscreen →</Link>
        </div>
        <div className="p-3 md:p-4">
          <FarmMap valves={valves} beds={beds} harvestKgByBed={harvestKgByBed} />
        </div>
      </Card>

      {/* ── Quick nav shortcuts ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        {[
          { href: "/supervisor",  icon: ShieldCheck,   label: "Supervisor View", sub: "Field operations",       accent: "text-primary",    bg: "bg-primary/8 border-primary/20 hover:border-primary/40" },
          { href: "/attendance",  icon: CalendarCheck, label: "Attendance",      sub: "Today's register",       accent: "text-blue-400",   bg: "bg-blue-500/8 border-blue-500/20 hover:border-blue-500/40" },
          { href: "/tasks",       icon: ListChecks,    label: "Task Manager",    sub: `${pendingTasks} pending`, accent: "text-violet-400", bg: "bg-violet-500/8 border-violet-500/20 hover:border-violet-500/40" },
          { href: "/packaging",   icon: Package,       label: "Packaging",       sub: "Batch & dispatch",       accent: "text-amber-400",  bg: "bg-amber-500/8 border-amber-500/20 hover:border-amber-500/40" },
        ].map(item => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className={`flex items-center gap-3 p-4 rounded-xl border transition-all group ${item.bg}`}>
              <div className="size-9 rounded-lg bg-card border border-border shadow-sm grid place-items-center shrink-0">
                <Icon className={`size-4 ${item.accent}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-foreground">{item.label}</div>
                <div className="text-[11px] text-muted-foreground">{item.sub}</div>
              </div>
              <ChevronRight className={`size-4 text-border ml-auto group-hover:${item.accent} transition-colors`} />
            </Link>
          );
        })}
      </div>

      {/* ── Active disease table ─────────────────────────────────────────── */}
      {diseases.filter(d => d.status !== "resolved").length > 0 && (
        <Card className="border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-4 md:px-5 py-3.5 border-b border-border">
            <div className="flex items-center gap-2">
              <div className="size-7 rounded-lg bg-red-500/15 grid place-items-center">
                <Bug className="size-3.5 text-red-400" />
              </div>
              <div>
                <span className="font-bold text-foreground text-sm md:text-base">Active Disease Reports</span>
                <span className="ml-2 text-xs text-red-400 font-semibold">{openDiseases} open</span>
              </div>
            </div>
            <Link href="/diseases" className="text-xs text-primary hover:text-primary/80 font-semibold">Manage →</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full pro-table">
              <thead>
                <tr>
                  <th>Bed</th>
                  <th>Disease</th>
                  <th className="hidden sm:table-cell">
                    Severity
                    <InfoTip tip="Disease severity score 0–100%" />
                  </th>
                  <th className="hidden md:table-cell">Reported</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {diseases.filter(d => d.status !== "resolved").slice(0, 5).map(d => (
                  <tr key={d.id}>
                    <td>
                      <Link href={`/beds/${d.bedId}`} className="font-mono font-bold text-foreground hover:text-primary transition-colors">{d.bedId}</Link>
                    </td>
                    <td className="font-medium text-foreground text-xs md:text-sm">{DISEASE_LABELS[d.type]}</td>
                    <td className="hidden sm:table-cell">
                      <div className="flex items-center gap-2">
                        <div className="w-16 md:w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${d.severity > 60 ? "bg-red-500" : d.severity > 30 ? "bg-amber-500" : "bg-primary"}`}
                            style={{ width: `${d.severity}%` }} />
                        </div>
                        <span className="text-xs font-semibold text-foreground tabular-nums">{d.severity}%</span>
                      </div>
                    </td>
                    <td className="hidden md:table-cell text-muted-foreground text-xs">
                      {new Date(d.reportedAt).toLocaleDateString("en", { month: "short", day: "numeric" })}
                    </td>
                    <td>
                      <Badge className={`text-[10px] capitalize border ${
                        d.status === "open"     ? "bg-red-500/15 text-red-300 border-red-500/25" :
                        d.status === "notified" ? "bg-amber-500/15 text-amber-300 border-amber-500/25" :
                        d.status === "treating" ? "bg-blue-500/15 text-blue-300 border-blue-500/25" :
                                                  "bg-primary/15 text-primary border-primary/25"
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
