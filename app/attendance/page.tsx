"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { CalendarCheck, Download, CheckCircle2, XCircle, Clock, Palmtree, Save } from "lucide-react";
import { toast } from "sonner";
import type { Farmer, AttendanceRecord, AttendanceStatus, Valve } from "@/lib/types";

const STATUSES: { value: AttendanceStatus; label: string; color: string }[] = [
  { value: "present", label: "Present", color: "bg-emerald-500" },
  { value: "late",    label: "Late",    color: "bg-amber-500"   },
  { value: "absent",  label: "Absent",  color: "bg-red-500"     },
  { value: "leave",   label: "Leave",   color: "bg-slate-400"   },
];

const STATUS_ICONS = {
  present: CheckCircle2,
  late: Clock,
  absent: XCircle,
  leave: Palmtree,
};

export default function AttendancePage() {
  const today = "2026-05-17";

  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [valves, setValves] = useState<Valve[]>([]);
  const [loading, setLoading] = useState(true);

  const [selected, setSelected] = useState<Record<string, AttendanceStatus>>({});
  const [checkIns, setCheckIns] = useState<Record<string, string>>({});
  const [viewDate, setViewDate] = useState(today);
  const [saved, setSaved] = useState(false);

  const [historicRecords, setHistoricRecords] = useState<AttendanceRecord[]>([]);

  // Load farmers, valves, and today's attendance on mount
  useEffect(() => {
    Promise.all([
      fetch("/api/farmers").then(r => r.json()),
      fetch("/api/valves").then(r => r.json()),
      fetch(`/api/attendance?date=${today}`).then(r => r.json()),
    ]).then(([farmData, valveData, attData]) => {
      setFarmers((farmData as Farmer[]).filter(f => f.role !== "manager"));
      setValves(valveData as Valve[]);
      const records = attData as AttendanceRecord[];
      setSelected(Object.fromEntries(records.map((a: AttendanceRecord) => [a.farmerId, a.status])));
      setCheckIns(Object.fromEntries(records.filter((a: AttendanceRecord) => a.checkInTime).map((a: AttendanceRecord) => [a.farmerId, a.checkInTime!])));
      setLoading(false);
    });
  }, []);

  // Refetch historic records when viewDate changes (and it's not today)
  useEffect(() => {
    if (viewDate === today) {
      setHistoricRecords([]);
      return;
    }
    fetch(`/api/attendance?date=${viewDate}`)
      .then(r => r.json())
      .then(data => setHistoricRecords(data as AttendanceRecord[]));
  }, [viewDate]);

  function setStatus(farmerId: string, status: AttendanceStatus) {
    setSelected(prev => ({ ...prev, [farmerId]: status }));
    setSaved(false);
  }

  async function saveAttendance() {
    const body = farmers.map(f => ({
      farmerId: f.id,
      date: today,
      status: selected[f.id] ?? "absent",
      checkInTime: checkIns[f.id] ?? null,
      recordedBy: "supervisor",
    }));
    await fetch("/api/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    toast.success("Attendance saved", {
      description: `Recorded for ${Object.keys(selected).length} staff members.`,
    });
    setSaved(true);
  }

  const presentCount = Object.values(selected).filter(s => s === "present").length;
  const lateCount = Object.values(selected).filter(s => s === "late").length;
  const absentCount = Object.values(selected).filter(s => s === "absent").length;

  if (loading) {
    return <div className="p-8 text-slate-400 text-sm">Loading…</div>;
  }

  return (
    <div className="p-6 md:p-8 max-w-[1200px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <CalendarCheck className="size-5 text-emerald-600" />
            <h1 className="text-2xl font-bold text-slate-900">Attendance</h1>
          </div>
          <p className="text-slate-500 text-sm">Daily attendance tracking for all farm staff</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="size-3.5" /> Export CSV
          </Button>
          <Button
            size="sm"
            className="gap-2 bg-emerald-600 hover:bg-emerald-700"
            onClick={saveAttendance}
          >
            <Save className="size-3.5" /> Save Attendance
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-3">
        <Card className="p-4 bg-emerald-50 border-emerald-200">
          <div className="text-2xl font-bold text-emerald-700 tabular-nums">{presentCount}</div>
          <div className="text-xs text-emerald-600 font-medium mt-0.5">Present</div>
        </Card>
        <Card className="p-4 bg-amber-50 border-amber-200">
          <div className="text-2xl font-bold text-amber-700 tabular-nums">{lateCount}</div>
          <div className="text-xs text-amber-600 font-medium mt-0.5">Late</div>
        </Card>
        <Card className="p-4 bg-red-50 border-red-200">
          <div className="text-2xl font-bold text-red-700 tabular-nums">{absentCount}</div>
          <div className="text-xs text-red-600 font-medium mt-0.5">Absent</div>
        </Card>
        <Card className="p-4 bg-slate-50 border-slate-200">
          <div className="text-2xl font-bold text-slate-700 tabular-nums">{farmers.length}</div>
          <div className="text-xs text-slate-500 font-medium mt-0.5">Total Staff</div>
        </Card>
      </div>

      {/* Today's register */}
      <Card className="border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
          <div className="font-semibold text-slate-900">
            Daily Register — {new Date(today).toLocaleDateString("en",{weekday:"long",month:"long",day:"numeric",year:"numeric"})}
          </div>
          {saved && <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200"><CheckCircle2 className="size-3 mr-1"/>Saved</Badge>}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full pro-table">
            <thead>
              <tr>
                <th>Staff Member</th>
                <th>Role</th>
                <th>Assigned Valve</th>
                <th>Check-in Time</th>
                <th className="text-center" colSpan={4}>Mark Attendance</th>
                <th>Current Status</th>
              </tr>
            </thead>
            <tbody>
              {farmers.map(f => {
                const valve = valves.filter(v => f.assignedValves.includes(v.id));
                const status = selected[f.id];
                const StatusIcon = status ? STATUS_ICONS[status] : null;
                return (
                  <tr key={f.id}>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <Avatar className="size-8">
                          <AvatarFallback className="bg-slate-100 text-slate-700 text-xs font-bold">{f.avatar}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-semibold text-slate-800 text-sm">{f.name}</div>
                          <div className="text-[11px] text-slate-400">{f.phone}</div>
                        </div>
                      </div>
                    </td>
                    <td><Badge variant="outline" className="text-[10px] capitalize">{f.role}</Badge></td>
                    <td>
                      <div className="flex gap-1">
                        {valve.map(v=>(
                          <span key={v.id} className="text-[11px] font-semibold" style={{color:v.color}}>{v.name}</span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <input
                        type="time"
                        value={checkIns[f.id] ?? "06:00"}
                        onChange={e => setCheckIns(prev=>({...prev,[f.id]:e.target.value}))}
                        className="text-xs border border-slate-200 rounded px-2 py-1 w-24 text-slate-700"
                      />
                    </td>
                    {STATUSES.map(s => (
                      <td key={s.value} className="text-center px-2">
                        <button
                          onClick={() => setStatus(f.id, s.value)}
                          title={s.label}
                          className={`size-8 rounded-full border-2 transition-all ${
                            status === s.value
                              ? `${s.color} border-transparent scale-110`
                              : "bg-slate-100 border-slate-200 hover:border-slate-400"
                          }`}
                        >
                          {status === s.value && (
                            <span className="text-white text-[10px] font-bold">{s.label[0]}</span>
                          )}
                        </button>
                        <div className="text-[9px] text-slate-400 mt-0.5">{s.label}</div>
                      </td>
                    ))}
                    <td>
                      {status ? (
                        <Badge className={`text-[10px] capitalize gap-1 ${
                          status==="present"?"bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100":
                          status==="late"?"bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100":
                          status==="absent"?"bg-red-100 text-red-700 border-red-200 hover:bg-red-100":
                          "bg-slate-100 text-slate-600 hover:bg-slate-100"
                        }`}>
                          {StatusIcon && <StatusIcon className="size-2.5"/>}{status}
                        </Badge>
                      ) : (
                        <span className="text-[11px] text-slate-400">— Not set</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-t border-slate-100">
          <div className="text-xs text-slate-500">Recorded by: Selam Girma (Supervisor)</div>
          <Button onClick={saveAttendance} className="bg-emerald-600 hover:bg-emerald-700 gap-2 text-sm" size="sm">
            <Save className="size-3.5" /> Save & Submit
          </Button>
        </div>
      </Card>

      {/* History */}
      <Card className="border border-slate-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-900">Attendance History</h3>
          <input
            type="date"
            value={viewDate}
            max={today}
            onChange={e => setViewDate(e.target.value)}
            className="text-xs border border-slate-200 rounded px-2 py-1 text-slate-700"
          />
        </div>
        {viewDate !== today && (
          <div className="overflow-x-auto">
            <table className="w-full pro-table">
              <thead>
                <tr>
                  <th>Farmer</th><th>Status</th><th>Check-in</th><th>Check-out</th><th>Hours</th>
                </tr>
              </thead>
              <tbody>
                {farmers.map(f => {
                  const rec = historicRecords.find(a=>a.farmerId===f.id);
                  return (
                    <tr key={f.id}>
                      <td>
                        <div className="flex items-center gap-2">
                          <Avatar className="size-6"><AvatarFallback className="bg-slate-100 text-slate-600 text-[10px] font-bold">{f.avatar}</AvatarFallback></Avatar>
                          <span className="font-medium text-sm">{f.name}</span>
                        </div>
                      </td>
                      <td>
                        {rec ? (
                          <Badge className={`text-[10px] capitalize ${
                            rec.status==="present"?"bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100":
                            rec.status==="late"?"bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100":
                            rec.status==="absent"?"bg-red-100 text-red-700 border-red-200 hover:bg-red-100":
                            "bg-slate-100 text-slate-600 hover:bg-slate-100"
                          }`}>{rec.status}</Badge>
                        ) : "—"}
                      </td>
                      <td className="tabular-nums text-slate-600">{rec?.checkInTime ?? "—"}</td>
                      <td className="tabular-nums text-slate-600">{rec?.checkOutTime ?? "—"}</td>
                      <td className="tabular-nums text-slate-600">{rec?.hoursWorked ? `${rec.hoursWorked}h` : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {viewDate === today && (
          <p className="text-sm text-slate-500 text-center py-4">Select a past date above to view historical records.</p>
        )}
      </Card>
    </div>
  );
}
