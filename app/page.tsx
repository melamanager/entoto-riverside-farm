import Link from "next/link";
import {
  Sprout, Users, Wheat, AlertTriangle, TrendingUp, Activity, Leaf,
  ArrowRight, Bug, ShieldCheck, CalendarCheck, ListChecks, ChevronRight,
  Map, Brain, Sparkles,
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
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  FARM, VALVES, BEDS, FARMERS, HARVESTS, DISEASES, NOTIFICATIONS, TASKS, ATTENDANCE,
  plantsInBed, todayKg, totalKgValve, getFarmer, getBed,
} from "@/lib/data";
import { DISEASE_LABELS } from "@/lib/types";

export default function DashboardPage() {
  const beds       = BEDS();
  const harvests   = HARVESTS();
  const diseases   = DISEASES();
  const attendance = ATTENDANCE();
  const today      = "2026-05-17";

  const totalPlants    = beds.reduce((s, b) => s + plantsInBed(b), 0);
  const totalKgToday   = todayKg(today);
  const openDiseases   = diseases.filter(d => d.status !== "resolved").length;
  const estimatedYield = beds.reduce((s, b) => s + b.lengthM * 0.4 * 12, 0);

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

  const pendingTasks = TASKS.filter(t => t.status !== "done").length;
  const topFarmers = [...FARMERS]
    .filter(f => f.role === "farmer")
    .sort((a, b) => b.performanceScore - a.performanceScore)
    .slice(0, 5);

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-5 max-w-[1600px] mx-auto">

      {/* ── Hero header ─────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1 flex-wrap">
            <Leaf className="size-3 text-emerald-600" />
            <span>{FARM.location}</span>
            <span className="text-slate-300">·</span>
            <span>{FARM.altitudeM}m</span>
            <span className="text-slate-300">·</span>
            <span>{FARM.totalAreaHa} ha</span>
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 leading-tight">{FARM.name}</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {new Date(today).toLocaleDateString("en", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
          </p>
        </div>
        <Link href="/map" className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors">
          <Map className="size-4" /> Farm Map
        </Link>
      </div>

      {/* ── AI Alert Banner ─────────────────────────────────────────────── */}
      {openDiseases > 0 && (
        <Link href="/ai" className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 transition-all shadow-lg shadow-amber-200">
          <span className="size-8 rounded-lg bg-white/20 grid place-items-center shrink-0">
            <Brain className="size-4 text-white" />
          </span>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm flex items-center gap-2">
              <Sparkles className="size-3.5" /> AI detected {openDiseases} active issue{openDiseases > 1 ? "s" : ""} + harvest forecast ready
            </div>
            <div className="text-[11px] text-amber-100 truncate">Click to view smart alerts, disease risk scores & 14-day yield projection</div>
          </div>
          <ChevronRight className="size-4 shrink-0 text-amber-200" />
        </Link>
      )}

      {/* ── Quick Actions ────────────────────────────────────────────────── */}
      <QuickActions />

      {/* ── Stat cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Irrigation Valves" value={VALVES.length}        hint="Active zones"              icon={ValveIcon}      tone="blue"    />
        <StatCard label="Raised Beds"       value={beds.length}          hint={`${beds.filter(b => b.health === "healthy").length} healthy`} icon={Sprout} tone="emerald" />
        <StatCard label="Today's Harvest"   value={`${totalKgToday.toFixed(1)} kg`} hint="All zones"     icon={Wheat}          tone="emerald" trend={{ value: "+12% vs yesterday", up: true }} />
        <StatCard label="Disease Alerts"    value={openDiseases}         hint={openDiseases > 0 ? "Needs attention" : "All clear"} icon={AlertTriangle} tone={openDiseases > 0 ? "red" : "emerald"} />
        <StatCard label="Total Plants"      value={totalPlants.toLocaleString()} hint="8 plants/m"       icon={Leaf}           tone="emerald" />
        <StatCard label="Field Staff"       value={FARMERS.filter(f => f.role !== "manager").length} hint={`${FARMERS.filter(f => f.role === "supervisor").length} supervisors`} icon={Users} tone="slate" />
        <StatCard label="Irrigation"        value="Active"               hint="Next cycle 17:00"          icon={Activity}       tone="blue"    />
        <StatCard label="Season Yield Est." value={`${(estimatedYield / 1000).toFixed(1)} t`} hint="Projected total" icon={TrendingUp} tone="amber" />
      </div>

      {/* ── Weather + Weekly Report (side by side on md+) ─────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <WeatherWidget />
        <WeeklyReportCard
          harvests={harvests}
          diseases={diseases}
          attendance={attendance}
          beds={beds}
          today={today}
        />
      </div>

      {/* ── Harvest Forecast ─────────────────────────────────────────────── */}
      <HarvestForecast beds={beds} today={today} />

      {/* ── Ripeness Heatmap ─────────────────────────────────────────────── */}
      <RipenessHeatmap beds={beds} valves={VALVES} />

      {/* ── Live Farm Map (scrollable on mobile) ────────────────────────── */}
      <Card className="border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 md:px-5 py-3.5 border-b border-slate-100">
          <div>
            <div className="font-semibold text-slate-900 text-sm md:text-base">Live Farm Map</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Tap any bed to open profile · colour = health</div>
          </div>
          <Link href="/map" className="text-xs text-emerald-600 hover:underline font-semibold">Fullscreen →</Link>
        </div>
        <div className="p-3 md:p-4">
          <FarmMap valves={VALVES} beds={beds} harvestKgByBed={harvestKgByBed} />
        </div>
      </Card>

      {/* ── Harvest chart + Notifications ────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 border border-slate-200 shadow-sm p-4 md:p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="font-semibold text-slate-900">Harvest Trend</div>
              <div className="text-xs text-slate-400">14-day · all zones</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-slate-900 tabular-nums">
                {harvests.reduce((s, h) => s + h.kg, 0).toFixed(1)}
              </div>
              <div className="text-xs text-slate-400">kg total</div>
            </div>
          </div>
          <HarvestChart data={chartData} />
        </Card>

        <Card className="border border-slate-200 shadow-sm p-4 md:p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold text-slate-900">Notifications</div>
            <Badge variant="outline" className="text-[10px]">{NOTIFICATIONS.filter(n => !n.read).length} new</Badge>
          </div>
          <div className="space-y-2">
            {NOTIFICATIONS.slice(0, 5).map(n => (
              <Link key={n.id} href={n.link ?? "#"} className="flex items-start gap-2.5 p-2.5 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors">
                <span className={`size-2 rounded-full mt-1.5 shrink-0 ${n.read ? "bg-slate-300" : "bg-emerald-500"}`} />
                <div className="min-w-0">
                  <div className="text-xs text-slate-700 leading-snug">{n.message}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1.5">
                    <Badge variant="outline" className="text-[9px] px-1 h-4 capitalize">{n.channel}</Badge>
                    {new Date(n.timestamp).toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      </div>

      {/* ── Valve leaderboard + Top farmers ─────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border border-slate-200 shadow-sm p-4 md:p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="font-semibold text-slate-900">Zone Productivity</div>
            <Link href="/valves" className="text-xs text-emerald-600 hover:underline font-medium">View all →</Link>
          </div>
          <div className="space-y-4">
            {valveStats.map((v, i) => {
              const max = Math.max(...valveStats.map(x => x.kg));
              return (
                <Link href={`/valves/${v.valve.id}`} key={v.valve.id} className="block group">
                  <div className="flex items-center gap-3">
                    <div className="size-7 rounded-md grid place-items-center text-white text-[11px] font-bold shrink-0" style={{ background: v.valve.color }}>
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="font-semibold text-slate-800 group-hover:text-emerald-700 truncate">{v.valve.name}</span>
                        <span className="tabular-nums font-bold text-slate-900 ml-2 shrink-0">{v.kg.toFixed(1)} <span className="text-xs font-normal text-slate-400">kg</span></span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${(v.kg / max) * 100}%`, background: v.valve.color }} />
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-slate-400 mt-1">
                        <span>{v.bedCount} beds</span>
                        {v.infected > 0 && <span className="text-red-600 font-semibold">{v.infected} infected</span>}
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
            <div className="font-semibold text-slate-900">Top Performers</div>
            <Link href="/employees" className="text-xs text-emerald-600 hover:underline font-medium">All staff →</Link>
          </div>
          <div className="space-y-2">
            {topFarmers.map((f, i) => (
              <div key={f.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors">
                <div className="text-[10px] font-bold text-slate-400 w-4 text-center shrink-0">#{i + 1}</div>
                <Avatar className="size-8 shrink-0">
                  <AvatarFallback className="bg-emerald-100 text-emerald-800 text-[10px] font-bold">{f.avatar}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-800 truncate">{f.name}</div>
                  <div className="text-[11px] text-slate-400">Attendance {f.attendanceRate}%</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-bold text-emerald-700">{f.performanceScore}</div>
                  <div className="text-[10px] text-slate-400">score</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ── Quick navigation shortcuts ──────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { href: "/supervisor", icon: ShieldCheck, label: "Supervisor View", sub: "Field operations", col: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200 hover:border-emerald-400" },
          { href: "/attendance", icon: CalendarCheck, label: "Attendance", sub: "Today's register", col: "text-blue-600", bg: "bg-blue-50 border-blue-200 hover:border-blue-400" },
          { href: "/tasks", icon: ListChecks, label: "Task Manager", sub: `${pendingTasks} pending`, col: "text-purple-600", bg: "bg-purple-50 border-purple-200 hover:border-purple-400" },
        ].map(item => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className={`flex items-center gap-3 p-4 rounded-xl border transition-all group ${item.bg}`}>
              <div className="size-9 rounded-lg bg-white border border-white/80 shadow-sm grid place-items-center shrink-0">
                <Icon className={`size-4.5 ${item.col}`} />
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
              <Bug className="size-4 text-red-600" />
              <span className="font-semibold text-slate-900 text-sm md:text-base">Active Disease Reports</span>
            </div>
            <Link href="/diseases" className="text-xs text-emerald-600 hover:underline font-medium">Manage →</Link>
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
