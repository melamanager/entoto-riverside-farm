"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  ShieldCheck, Sprout, Bug, CalendarCheck, ListChecks,
  Wheat, AlertTriangle, CheckCircle2, Clock, ArrowRight,
  Phone, Activity, Bell,
} from "lucide-react";
import { DISEASE_LABELS } from "@/lib/types";
import { useLang } from "@/lib/lang";
import { EN, AM } from "@/lib/translations";
import type { Farmer, Valve, Bed, HarvestRecord, DiseaseReport, Task, AttendanceRecord } from "@/lib/types";
import type { FollowUp } from "@/lib/erp-types";

const TODAY = new Date().toISOString().split("T")[0];

export default function SupervisorPage() {
  const { isAm } = useLang();
  const t = isAm ? AM : EN;

  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [valves, setValves] = useState<Valve[]>([]);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [harvests, setHarvests] = useState<HarvestRecord[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);

  useEffect(() => {
    Promise.all([
      fetch("/api/farmers").then(r => r.json()),
      fetch("/api/valves").then(r => r.json()),
      fetch("/api/beds").then(r => r.json()),
      fetch("/api/harvest").then(r => r.json()),
      fetch("/api/tasks").then(r => r.json()),
      fetch("/api/attendance").then(r => r.json()),
      fetch("/api/follow-ups").then(r => r.json()),
    ]).then(([f, v, b, h, tk, a, fu]) => {
      setFarmers(f);
      setValves(v);
      setBeds(b);
      setHarvests(h.map((rec: HarvestRecord & { kg: string | number }) => ({ ...rec, kg: parseFloat(rec.kg.toString()) })));
      setTasks(tk);
      setAttendance(a);
      setFollowUps(fu);
    });
  }, []);

  const supervisors = farmers.filter(f => f.role === "supervisor");
  const todayAttendance = attendance.filter(a => a.date === TODAY);
  const allBeds = beds;
  const allDiseases: DiseaseReport[] = [];
  const allTasks = tasks;

  return (
    <div className="p-6 md:p-8 max-w-[1600px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="size-5 text-emerald-600" />
            <h1 className="text-2xl font-bold text-slate-900">{t.supervisor.title}</h1>
          </div>
          <p className="text-slate-500 text-sm">{t.supervisor.subtitle} · {new Date(TODAY).toLocaleDateString("en",{weekday:"long",month:"long",day:"numeric"})}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/attendance" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700">
            <CalendarCheck className="size-4" /> {t.supervisor.takeAttendance}
          </Link>
          <Link href="/tasks" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50">
            <ListChecks className="size-4" /> {t.supervisor.allTasks}
          </Link>
        </div>
      </div>

      {/* Per-Supervisor cards */}
      {supervisors.map(sup => {
        const myValves = valves.filter(v => sup.assignedValves.includes(v.id));
        const myBeds = allBeds.filter(b => sup.assignedValves.includes(b.valveId));
        const myBedIds = new Set(myBeds.map(b => b.id));
        const myDiseases = allDiseases.filter(d => myBedIds.has(d.bedId) && d.status !== "resolved");
        const myTasks = allTasks.filter(task => task.assignedTo === sup.id);
        const pendingTasks = myTasks.filter(task => task.status !== "done");
        const doneTasks = myTasks.filter(task => task.status === "done");
        const todayAttSup = todayAttendance.filter(a => {
          const farmer = farmers.find(f => f.id === a.farmerId);
          return farmer && sup.assignedValves.some(v => farmer.assignedValves.includes(v));
        });
        const presentCount = todayAttSup.filter(a => a.status === "present" || a.status === "late").length;
        const todayHarvestKg = harvests
          .filter(h => h.date === TODAY && myBedIds.has(h.bedId))
          .reduce((s, h) => s + parseFloat(h.kg.toString()), 0);

        const totalKgByBed = (bedId: string) =>
          harvests.filter(h => h.bedId === bedId).reduce((s, h) => s + parseFloat(h.kg.toString()), 0);

        return (
          <Card key={sup.id} className="border border-slate-200 shadow-sm overflow-hidden">
            {/* Supervisor header row */}
            <div className="flex items-center gap-4 px-6 py-4 bg-slate-50 border-b border-slate-200">
              <Avatar className="size-12 ring-2 ring-emerald-200">
                <AvatarFallback className="bg-emerald-700 text-white font-bold text-sm">{sup.avatar}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold text-slate-900">{sup.name}</span>
                  <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]">Supervisor</Badge>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                  <span className="flex items-center gap-1"><Phone className="size-3" />{sup.phone}</span>
                  <span>Valves: {myValves.map(v=>v.name).join(", ")}</span>
                  <span>Score: <strong className="text-slate-700">{sup.performanceScore}</strong></span>
                </div>
              </div>
              <div className="hidden md:flex items-center gap-6 text-center">
                <div>
                  <div className="text-xl font-bold text-slate-900">{myBeds.length}</div>
                  <div className="text-[10px] text-slate-500">{t.supervisor.beds}</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-emerald-600">{todayHarvestKg.toFixed(1)}</div>
                  <div className="text-[10px] text-slate-500">{t.supervisor.kgToday}</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-red-600">{myDiseases.length}</div>
                  <div className="text-[10px] text-slate-500">{t.supervisor.alerts}</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-amber-600">{presentCount}/{todayAttSup.length}</div>
                  <div className="text-[10px] text-slate-500">{t.supervisor.present}</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
              {/* Beds under supervision */}
              <div className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5"><Sprout className="size-3.5 text-emerald-600"/>Bed Status</h3>
                  <Link href="/beds" className="text-[11px] text-emerald-600 hover:underline">View all →</Link>
                </div>
                <div className="space-y-2">
                  {myBeds.slice(0, 6).map(bed => {
                    const kg = totalKgByBed(bed.id);
                    return (
                      <Link href={`/beds/${bed.id}`} key={bed.id} className="flex items-center gap-3 group">
                        <span className={`size-2 rounded-full shrink-0 ${bed.health==="healthy"?"bg-emerald-500":bed.health==="warning"?"bg-amber-500":"bg-red-500"}`} />
                        <span className="font-mono text-xs font-semibold text-slate-700 group-hover:text-emerald-700 w-20">{bed.id}</span>
                        <span className="text-[11px] text-slate-400 truncate flex-1">{bed.variety.split(" ")[0]}</span>
                        <span className="text-[11px] font-semibold text-slate-600 tabular-nums">{kg.toFixed(1)}kg</span>
                      </Link>
                    );
                  })}
                  {myBeds.length > 6 && <div className="text-[11px] text-slate-400">+{myBeds.length-6} more beds</div>}
                </div>
              </div>

              {/* Active disease alerts */}
              <div className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5"><Bug className="size-3.5 text-red-500"/>Disease Alerts</h3>
                  <Link href="/diseases" className="text-[11px] text-emerald-600 hover:underline">Manage →</Link>
                </div>
                {myDiseases.length === 0 ? (
                  <div className="flex items-center gap-2 text-sm text-emerald-700">
                    <CheckCircle2 className="size-4" /> No active alerts
                  </div>
                ) : (
                  <div className="space-y-2">
                    {myDiseases.slice(0, 4).map(d => (
                      <div key={d.id} className="p-2.5 rounded-lg border border-red-100 bg-red-50/50">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-mono text-[11px] font-bold text-slate-700">{d.bedId}</span>
                          <Badge variant="destructive" className="text-[9px] h-4">{d.severity}%</Badge>
                        </div>
                        <div className="text-[11px] font-semibold text-slate-700">{DISEASE_LABELS[d.type]}</div>
                        <div className="flex items-center gap-2 mt-1.5">
                          <Badge variant={d.treatmentApplied?"default":"outline"} className="text-[9px] h-4">
                            {d.treatmentApplied?"✓ Treated":"Pending"}
                          </Badge>
                          <Badge variant="outline" className="text-[9px] h-4 capitalize">{d.status}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Tasks */}
              <div className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5"><ListChecks className="size-3.5 text-blue-500"/>My Tasks</h3>
                  <Link href="/tasks" className="text-[11px] text-emerald-600 hover:underline">All tasks →</Link>
                </div>
                <div className="flex gap-3 mb-3 text-center">
                  <div className="flex-1 rounded-lg bg-amber-50 border border-amber-100 p-2">
                    <div className="text-lg font-bold text-amber-700">{pendingTasks.length}</div>
                    <div className="text-[10px] text-slate-500">Pending</div>
                  </div>
                  <div className="flex-1 rounded-lg bg-emerald-50 border border-emerald-100 p-2">
                    <div className="text-lg font-bold text-emerald-700">{doneTasks.length}</div>
                    <div className="text-[10px] text-slate-500">Done</div>
                  </div>
                </div>
                <div className="space-y-2">
                  {pendingTasks.slice(0,3).map(task => (
                    <div key={task.id} className="flex items-center gap-2.5">
                      <span className={`size-2 rounded-full shrink-0 ${task.priority==="high"?"bg-red-500":task.priority==="medium"?"bg-amber-500":"bg-slate-400"}`} />
                      <span className="text-xs text-slate-700 truncate">{task.title}</span>
                    </div>
                  ))}
                  {pendingTasks.length === 0 && <div className="text-xs text-emerald-700 flex items-center gap-1"><CheckCircle2 className="size-3"/>All tasks complete</div>}
                </div>
              </div>

              {/* Flow 6: My Follow-ups */}
              {(() => {
                const TODAY_STR = TODAY;
                const myFollowUps = followUps.filter(f => f.assignedTo === sup.id && f.status !== "done");
                const overdueFUs  = myFollowUps.filter(f => new Date(f.dueDate) < new Date(TODAY_STR));
                const todayFUs    = myFollowUps.filter(f => f.dueDate === TODAY_STR);
                const urgentFUs   = myFollowUps.filter(f => f.priority === "urgent" && !overdueFUs.includes(f) && !todayFUs.includes(f));
                const shownFUs    = [...overdueFUs, ...todayFUs, ...urgentFUs].slice(0, 4);
                return (
                  <div className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                        <Bell className="size-3.5 text-amber-500"/>My Follow-ups
                      </h3>
                      <Link href="/follow-ups" className="text-[11px] text-emerald-600 hover:underline">View all →</Link>
                    </div>
                    {myFollowUps.length === 0 ? (
                      <div className="flex items-center gap-1.5 text-xs text-emerald-700"><CheckCircle2 className="size-3"/>All clear</div>
                    ) : (
                      <div className="space-y-2">
                        {shownFUs.map(fu => {
                          const isOverdue = new Date(fu.dueDate) < new Date(TODAY_STR);
                          return (
                            <div key={fu.id} className={`p-2 rounded-md border text-xs ${isOverdue ? "bg-red-50 border-red-200" : fu.priority === "urgent" ? "bg-amber-50 border-amber-200" : "bg-slate-50 border-slate-200"}`}>
                              <div className={`font-semibold truncate ${isOverdue ? "text-red-700" : "text-slate-800"}`}>{fu.title}</div>
                              <div className={`text-[10px] mt-0.5 ${isOverdue ? "text-red-600 font-bold" : "text-slate-400"}`}>
                                {isOverdue ? `Overdue: ${fu.dueDate}` : `Due: ${fu.dueDate}`}
                              </div>
                            </div>
                          );
                        })}
                        {myFollowUps.length > 4 && (
                          <div className="text-[11px] text-slate-400">+{myFollowUps.length - 4} more follow-ups</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </Card>
        );
      })}

      {/* Today's attendance summary */}
      <Card className="border border-slate-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-900 flex items-center gap-2"><CalendarCheck className="size-4 text-emerald-600" />{t.supervisor.attendanceSummary}</h3>
          <Link href="/attendance" className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:underline font-medium">
            Take attendance <ArrowRight className="size-3" />
          </Link>
        </div>
        <div className="overflow-x-auto -mx-5">
          <table className="w-full pro-table text-sm">
            <thead>
              <tr>
                <th className="text-left">{t.common.farmer}</th>
                <th className="text-left">Role</th>
                <th className="text-left">{t.common.valve}</th>
                <th className="text-left">{t.attendance.checkIn}</th>
                <th className="text-left">{t.attendance.checkOut}</th>
                <th className="text-left">{t.attendance.hours}</th>
                <th className="text-left">{t.common.status}</th>
              </tr>
            </thead>
            <tbody>
              {farmers.filter(f=>f.role!=="manager").map(f => {
                const rec = todayAttendance.find(a => a.farmerId === f.id);
                const valve = valves.filter(v => f.assignedValves.includes(v.id)).map(v=>v.name).join(", ");
                return (
                  <tr key={f.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <Avatar className="size-6"><AvatarFallback className="bg-slate-100 text-slate-600 text-[10px] font-bold">{f.avatar}</AvatarFallback></Avatar>
                        <span className="font-medium text-slate-800">{f.name}</span>
                      </div>
                    </td>
                    <td><Badge variant="outline" className="text-[10px] capitalize">{f.role}</Badge></td>
                    <td className="text-slate-500">{valve}</td>
                    <td className="tabular-nums text-slate-600">{rec?.checkInTime ?? "—"}</td>
                    <td className="tabular-nums text-slate-600">{rec?.checkOutTime ?? "—"}</td>
                    <td className="tabular-nums text-slate-600">{rec?.hoursWorked ? `${rec.hoursWorked}h` : "—"}</td>
                    <td>
                      {rec ? (
                        <Badge className={`text-[10px] capitalize ${
                          rec.status==="present"?"bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100":
                          rec.status==="late"?"bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100":
                          rec.status==="absent"?"bg-red-100 text-red-700 border-red-200 hover:bg-red-100":
                          "bg-slate-100 text-slate-600 hover:bg-slate-100"
                        }`}>{rec.status}</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-slate-400">Not recorded</Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
