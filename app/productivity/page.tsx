"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { BarChart3, TrendingUp, Award, Wheat, Clock } from "lucide-react";
import { ACTIVITY_LABELS } from "@/lib/erp-types";
import type { Farmer, HarvestRecord, Valve } from "@/lib/types";
import type { WorkerAssignment, PayrollRecord } from "@/lib/erp-types";

export default function ProductivityPage() {
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [harvests, setHarvests] = useState<HarvestRecord[]>([]);
  const [valves, setValves] = useState<Valve[]>([]);
  const [workerAssignments, setWorkerAssignments] = useState<WorkerAssignment[]>([]);
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>([]);

  useEffect(() => {
    Promise.all([
      fetch("/api/farmers").then(r => r.json()),
      fetch("/api/harvest").then(r => r.json()),
      fetch("/api/valves").then(r => r.json()),
      fetch("/api/assignments").then(r => r.json()),
      fetch("/api/payroll").then(r => r.json()),
    ]).then(([f, h, v, a, p]) => {
      setFarmers(f);
      setHarvests(h.map((rec: HarvestRecord & { kg: string | number }) => ({ ...rec, kg: parseFloat(rec.kg.toString()) })));
      setValves(v);
      setWorkerAssignments(a);
      setPayrollRecords(p);
    });
  }, []);

  const currentMonth = new Date().toISOString().slice(0, 7);

  const allFarmers = farmers.filter(f => f.role !== "manager");

  // Build per-farmer stats
  const farmerStats = allFarmers.map(f => {
    const farmerHarvests = harvests.filter(h => h.farmerId === f.id);
    const totalKg = farmerHarvests.reduce((s, h) => s + parseFloat(h.kg.toString()), 0);
    const gradeA = farmerHarvests.filter(h => h.qualityGrade === "A").length;
    const gradeARate = farmerHarvests.length > 0 ? Math.round((gradeA / farmerHarvests.length) * 100) : 0;

    const assignments = workerAssignments.filter(a => a.farmerId === f.id);
    const completed = assignments.filter(a => a.status === "completed").length;
    const totalHours = assignments.filter(a => a.hoursActual).reduce((s, a) => s + (a.hoursActual ?? 0), 0);
    const kgPerHour = totalHours > 0 ? totalKg / totalHours : 0;

    const payroll = payrollRecords.filter(r => r.farmerId === f.id && r.month === currentMonth)[0];

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
  const avgAttendance = allFarmers.length > 0
    ? Math.round(allFarmers.reduce((s, f) => s + f.attendanceRate, 0) / allFarmers.length)
    : 0;
  const avgPerformance = allFarmers.length > 0
    ? Math.round(allFarmers.reduce((s, f) => s + f.performanceScore, 0) / allFarmers.length)
    : 0;

  return (
    <div className="p-6 md:p-8 max-w-[1400px] mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="size-5 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Productivity</h1>
          </div>
          <p className="text-muted-foreground text-sm">Worker performance metrics, output rates & harvest contributions</p>
        </div>
      </div>

      {/* Farm-wide KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4 bg-primary/10 border-primary/30">
          <div className="text-2xl font-bold text-primary tabular-nums">{totalKgFarm.toFixed(1)} kg</div>
          <div className="text-xs text-primary font-medium flex items-center gap-1 mt-0.5">
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
          const farmerValves = valves.filter(v => farmer.assignedValves.includes(v.id));
          return (
            <Card key={farmer.id} className="p-5 border-border">
              {/* Header */}
              <div className="flex items-start gap-3 mb-4">
                <div className="relative">
                  <Avatar className="size-11">
                    <AvatarFallback className={`font-bold text-sm ${
                      farmer.role === "supervisor" ? "bg-blue-100 text-blue-700" : "bg-primary/15 text-primary"
                    }`}>{farmer.avatar}</AvatarFallback>
                  </Avatar>
                  {i === 0 && (
                    <span className="absolute -top-1 -right-1 text-base">🥇</span>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground">{farmer.name}</span>
                    <Badge variant="outline" className="text-[10px] capitalize">{farmer.role}</Badge>
                  </div>
                  <div className="flex gap-1 mt-1">
                    {farmerValves.map(v => (
                      <span key={v.id} className="text-[10px] font-semibold" style={{ color: v.color }}>{v.name}</span>
                    ))}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black text-foreground tabular-nums">{farmer.performanceScore}</div>
                  <div className="text-[10px] text-muted-foreground">score</div>
                </div>
              </div>

              {/* Metrics grid */}
              <div className="grid grid-cols-4 gap-2 mb-4">
                <div className="text-center bg-muted rounded-lg py-2.5">
                  <div className="text-base font-bold text-foreground tabular-nums">{totalKg.toFixed(1)}</div>
                  <div className="text-[10px] text-muted-foreground">kg harvest</div>
                </div>
                <div className="text-center bg-muted rounded-lg py-2.5">
                  <div className="text-base font-bold text-primary tabular-nums">{gradeARate}%</div>
                  <div className="text-[10px] text-muted-foreground">Grade A</div>
                </div>
                <div className="text-center bg-muted rounded-lg py-2.5">
                  <div className="text-base font-bold text-blue-700 tabular-nums">{totalHours.toFixed(0)}h</div>
                  <div className="text-[10px] text-muted-foreground">hours</div>
                </div>
                <div className="text-center bg-muted rounded-lg py-2.5">
                  <div className="text-base font-bold text-indigo-700 tabular-nums">{completed}</div>
                  <div className="text-[10px] text-muted-foreground">jobs done</div>
                </div>
              </div>

              {/* Progress bars */}
              <div className="space-y-2 mb-3">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Attendance</span>
                    <span className="font-semibold">{farmer.attendanceRate}%</span>
                  </div>
                  <Progress value={farmer.attendanceRate} className="h-1.5" />
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Kg/hour efficiency</span>
                    <span className="font-semibold">{kgPerHour.toFixed(2)} kg/h</span>
                  </div>
                  <Progress value={Math.min(kgPerHour * 20, 100)} className="h-1.5" />
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-border text-xs text-muted-foreground">
                {topActivity && (
                  <span>Main activity: <strong className="text-foreground">{ACTIVITY_LABELS[topActivity as keyof typeof ACTIVITY_LABELS]}</strong></span>
                )}
                {payroll && (
                  <span className="font-semibold text-foreground tabular-nums">{payroll.netPay.toLocaleString()} ETB/mo</span>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
