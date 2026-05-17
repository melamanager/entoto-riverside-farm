import type { HarvestRecord, DiseaseReport, AttendanceRecord, Bed } from "@/lib/types";
import { TrendingUp, TrendingDown, Award, Bug, Users, Wheat } from "lucide-react";

interface Props {
  harvests: HarvestRecord[];
  diseases: DiseaseReport[];
  attendance: AttendanceRecord[];
  beds: Bed[];
  today: string;
}

// Market price ETB / kg (strawberry, Addis Ababa 2026)
const MARKET_PRICE_ETB = 120;

export function WeeklyReportCard({ harvests, diseases, attendance, beds, today }: Props) {
  const todayDate = new Date(today);

  // Last 7 days
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(todayDate);
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split("T")[0];
  });

  // Previous 7 days for delta
  const prevDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(todayDate);
    d.setDate(d.getDate() - (13 - i));
    return d.toISOString().split("T")[0];
  });

  const weekHarvests = harvests.filter(h => weekDates.includes(h.date));
  const prevHarvests = harvests.filter(h => prevDates.includes(h.date));

  const weekKg    = weekHarvests.reduce((s, h) => s + h.kg, 0);
  const prevKg    = prevHarvests.reduce((s, h) => s + h.kg, 0);
  const kgDelta   = prevKg > 0 ? ((weekKg - prevKg) / prevKg) * 100 : 0;

  const weekRevenue = weekKg * MARKET_PRICE_ETB;

  const weekDiseases = diseases.filter(d =>
    weekDates.some(date => d.reportedAt.startsWith(date))
  ).length;

  // Attendance rate this week
  const weekAtt = attendance.filter(a => weekDates.includes(a.date));
  const attRate = weekAtt.length > 0
    ? Math.round((weekAtt.filter(a => a.status === "present" || a.status === "late").length / weekAtt.length) * 100)
    : 94;

  // Best performing bed
  const bedKg = weekHarvests.reduce<Record<string, number>>((acc, h) => {
    acc[h.bedId] = (acc[h.bedId] ?? 0) + h.kg;
    return acc;
  }, {});
  const bestBedId = Object.entries(bedKg).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
  const bestBedKg = bedKg[bestBedId] ?? 0;

  const stats = [
    {
      label: "Total Harvest",
      value: `${weekKg.toFixed(1)} kg`,
      delta: kgDelta,
      icon: Wheat,
      color: "text-emerald-700",
      bg: "bg-emerald-50",
      iconColor: "text-emerald-600",
    },
    {
      label: "Est. Revenue",
      value: `${(weekRevenue / 1000).toFixed(1)}k ETB`,
      delta: kgDelta,
      icon: TrendingUp,
      color: "text-blue-700",
      bg: "bg-blue-50",
      iconColor: "text-blue-600",
    },
    {
      label: "Disease Incidents",
      value: String(weekDiseases),
      delta: null,
      icon: Bug,
      color: weekDiseases > 2 ? "text-red-700" : "text-emerald-700",
      bg: weekDiseases > 2 ? "bg-red-50" : "bg-emerald-50",
      iconColor: weekDiseases > 2 ? "text-red-600" : "text-emerald-600",
    },
    {
      label: "Attendance Rate",
      value: `${attRate}%`,
      delta: null,
      icon: Users,
      color: attRate > 85 ? "text-emerald-700" : "text-amber-700",
      bg: attRate > 85 ? "bg-emerald-50" : "bg-amber-50",
      iconColor: attRate > 85 ? "text-emerald-600" : "text-amber-600",
    },
  ];

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <div className="font-semibold text-slate-900">Weekly Report</div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {new Date(weekDates[0]).toLocaleDateString("en", { month: "short", day: "numeric" })} –{" "}
            {new Date(weekDates[6]).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })}
          </div>
        </div>
        <div className="size-8 rounded-lg bg-amber-50 border border-amber-200 grid place-items-center">
          <Award className="size-4 text-amber-600" />
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-px bg-slate-100">
        {stats.map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-white px-4 py-3.5">
              <div className="flex items-center gap-2 mb-1">
                <div className={`size-6 rounded-md ${s.bg} grid place-items-center`}>
                  <Icon className={`size-3.5 ${s.iconColor}`} />
                </div>
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{s.label}</span>
              </div>
              <div className={`text-xl font-bold tabular-nums ${s.color}`}>{s.value}</div>
              {s.delta !== null && (
                <div className={`flex items-center gap-1 text-[10px] font-semibold mt-0.5 ${s.delta >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {s.delta >= 0 ? <TrendingUp className="size-2.5" /> : <TrendingDown className="size-2.5" />}
                  {Math.abs(s.delta).toFixed(1)}% vs last week
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Best bed */}
      {bestBedId !== "—" && (
        <div className="px-5 py-3 border-t border-slate-100 flex items-center gap-3">
          <div className="size-7 rounded-full bg-amber-100 grid place-items-center shrink-0">
            <Award className="size-3.5 text-amber-600" />
          </div>
          <div className="text-xs text-slate-700">
            <span className="font-semibold">Top bed this week:</span>{" "}
            <span className="font-mono font-bold text-slate-900">{bestBedId}</span>
            <span className="text-slate-400"> · {bestBedKg.toFixed(1)} kg</span>
          </div>
        </div>
      )}
    </div>
  );
}
