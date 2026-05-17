import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { BarChart3, TrendingUp, Award, Wheat, Clock } from "lucide-react";
import { FARMERS, HARVESTS, VALVES } from "@/lib/data";
import { WORKER_ASSIGNMENTS, PAYROLL_RECORDS } from "@/lib/erp-data";
import { ACTIVITY_LABELS } from "@/lib/erp-types";

export default function ProductivityPage() {
  const farmers = FARMERS.filter(f => f.role !== "manager");
  const harvests = HARVESTS();

  // Build per-farmer stats
  const farmerStats = farmers.map(f => {
    const farmerHarvests = harvests.filter(h => h.farmerId === f.id);
    const totalKg = farmerHarvests.reduce((s, h) => s + h.kg, 0);
    const gradeA = farmerHarvests.filter(h => h.qualityGrade === "A").length;
    const gradeARate = farmerHarvests.length > 0 ? Math.round((gradeA / farmerHarvests.length) * 100) : 0;

    const assignments = WORKER_ASSIGNMENTS.filter(a => a.farmerId === f.id);
    const completed = assignments.filter(a => a.status === "completed").length;
    const totalHours = assignments.filter(a => a.hoursActual).reduce((s, a) => s + (a.hoursActual ?? 0), 0);
    const kgPerHour = totalHours > 0 ? totalKg / totalHours : 0;

    const payroll = PAYROLL_RECORDS.filter(r => r.farmerId === f.id && r.month === "2026-05")[0];

    // Activity breakdown
    const activityCounts = assignments.reduce<Record<string, number>>((acc, a) => {
      acc[a.activity] = (acc[a.activity] ?? 0) + 1;
      return acc;
    }, {});
    const topActivity = Object.entries(activityCounts).sort((a, b) => b[1] - a[1])[0];

    return {
      farmer: f,
      totalKg,
      gradeARate,
      completed,
      totalHours,
      kgPerHour,
      payroll,
      topActivity: topActivity ? topActivity[0] : null,
    };
  }).sort((a, b) => b.farmer.performanceScore - a.farmer.performanceScore);

  const totalKgFarm = farmerStats.reduce((s, f) => s + f.totalKg, 0);
  const topPerformer = farmerStats[0];
  const avgAttendance = Math.round(
    farmers.reduce((s, f) => s + f.attendanceRate, 0) / farmers.length
  );
  const avgPerformance = Math.round(
    farmers.reduce((s, f) => s + f.performanceScore, 0) / farmers.length
  );

  return (
    <div className="p-6 md:p-8 max-w-[1400px] mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="size-5 text-indigo-600" />
            <h1 className="text-2xl font-bold text-slate-900">Productivity</h1>
          </div>
          <p className="text-slate-500 text-sm">Worker performance metrics, output rates & harvest contributions</p>
        </div>
      </div>

      {/* Farm-wide KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4 bg-emerald-50 border-emerald-200">
          <div className="text-2xl font-bold text-emerald-700 tabular-nums">{totalKgFarm.toFixed(1)} kg</div>
          <div className="text-xs text-emerald-600 font-medium flex items-center gap-1 mt-0.5">
            <Wheat className="size-3" /> Total Harvested
          </div>
        </Card>
        <Card className="p-4 bg-blue-50 border-blue-200">
          <div className="text-2xl font-bold text-blue-700 tabular-nums">{avgAttendance}%</div>
          <div className="text-xs text-blue-600 font-medium flex items-center gap-1 mt-0.5">
            <Clock className="size-3" /> Avg Attendance
          </div>
        </Card>
        <Card className="p-4 bg-indigo-50 border-indigo-200">
          <div className="text-2xl font-bold text-indigo-700 tabular-nums">{avgPerformance}</div>
          <div className="text-xs text-indigo-600 font-medium flex items-center gap-1 mt-0.5">
            <TrendingUp className="size-3" /> Avg Performance Score
          </div>
        </Card>
        <Card className="p-4 bg-amber-50 border-amber-200">
          <div className="flex items-center gap-2">
            <Avatar className="size-9">
              <AvatarFallback className="bg-amber-100 text-amber-700 text-xs font-bold">{topPerformer?.farmer.avatar}</AvatarFallback>
            </Avatar>
            <div>
              <div className="text-sm font-bold text-amber-800">{topPerformer?.farmer.name.split(" ")[0]}</div>
              <div className="text-[10px] text-amber-600 flex items-center gap-0.5"><Award className="size-3" /> Top Performer</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Per-farmer breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {farmerStats.map(({ farmer, totalKg, gradeARate, completed, totalHours, kgPerHour, payroll, topActivity }, i) => {
          const valves = VALVES.filter(v => farmer.assignedValves.includes(v.id));
          return (
            <Card key={farmer.id} className="p-5 border-slate-200">
              {/* Header */}
              <div className="flex items-start gap-3 mb-4">
                <div className="relative">
                  <Avatar className="size-11">
                    <AvatarFallback className={`font-bold text-sm ${
                      farmer.role === "supervisor" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"
                    }`}>{farmer.avatar}</AvatarFallback>
                  </Avatar>
                  {i === 0 && (
                    <span className="absolute -top-1 -right-1 text-base">🥇</span>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{farmer.name}</span>
                    <Badge variant="outline" className="text-[10px] capitalize">{farmer.role}</Badge>
                  </div>
                  <div className="flex gap-1 mt-1">
                    {valves.map(v => (
                      <span key={v.id} className="text-[10px] font-semibold" style={{ color: v.color }}>{v.name}</span>
                    ))}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black text-slate-800 tabular-nums">{farmer.performanceScore}</div>
                  <div className="text-[10px] text-slate-400">score</div>
                </div>
              </div>

              {/* Metrics grid */}
              <div className="grid grid-cols-4 gap-2 mb-4">
                <div className="text-center bg-slate-50 rounded-lg py-2.5">
                  <div className="text-base font-bold text-slate-800 tabular-nums">{totalKg.toFixed(1)}</div>
                  <div className="text-[10px] text-slate-400">kg harvest</div>
                </div>
                <div className="text-center bg-slate-50 rounded-lg py-2.5">
                  <div className="text-base font-bold text-emerald-700 tabular-nums">{gradeARate}%</div>
                  <div className="text-[10px] text-slate-400">Grade A</div>
                </div>
                <div className="text-center bg-slate-50 rounded-lg py-2.5">
                  <div className="text-base font-bold text-blue-700 tabular-nums">{totalHours.toFixed(0)}h</div>
                  <div className="text-[10px] text-slate-400">hours</div>
                </div>
                <div className="text-center bg-slate-50 rounded-lg py-2.5">
                  <div className="text-base font-bold text-indigo-700 tabular-nums">{completed}</div>
                  <div className="text-[10px] text-slate-400">jobs done</div>
                </div>
              </div>

              {/* Progress bars */}
              <div className="space-y-2 mb-3">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-500">Attendance</span>
                    <span className="font-semibold">{farmer.attendanceRate}%</span>
                  </div>
                  <Progress value={farmer.attendanceRate} className="h-1.5" />
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-500">Kg/hour efficiency</span>
                    <span className="font-semibold">{kgPerHour.toFixed(2)} kg/h</span>
                  </div>
                  <Progress value={Math.min(kgPerHour * 20, 100)} className="h-1.5" />
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs text-slate-500">
                {topActivity && (
                  <span>Main activity: <strong className="text-slate-700">{ACTIVITY_LABELS[topActivity as keyof typeof ACTIVITY_LABELS]}</strong></span>
                )}
                {payroll && (
                  <span className="font-semibold text-slate-700 tabular-nums">{payroll.netPay.toLocaleString()} ETB/mo</span>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
