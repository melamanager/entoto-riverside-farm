"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { CalendarCheck, Download, CheckCircle2, XCircle, Clock, Palmtree, Save, Users } from "lucide-react";
import { toast } from "sonner";
import type { AttendanceRecord, AttendanceStatus } from "@/lib/types";
import { useOptions } from "@/lib/use-options";
import { useAuth } from "@/lib/auth";
import { useReference } from "@/lib/reference";
import { calcHoursWorked } from "@/lib/attendance";

const STATUS_ICONS = {
  present: CheckCircle2,
  late: Clock,
  absent: XCircle,
  leave: Palmtree,
};

// The farm day runs in two sessions: staff arrive in the morning, break for
// lunch at 6 o'clock local (12:00), return at 7 o'clock (13:00), finish at 17:00.
const DEFAULT_CHECK_IN = "06:00";
const DEFAULT_MORNING_OUT = "12:00";
const DEFAULT_AFTERNOON_IN = "13:00";
const DEFAULT_CHECK_OUT = "17:00";

export default function AttendancePage() {
  const options = useOptions();
  const { user } = useAuth();
  const statuses = options.attendanceStatuses.map(s => ({
    value: s.value as AttendanceStatus,
    label: s.label,
    color: s.color ?? "bg-slate-400",
  }));
  const today = new Date().toLocaleDateString("en-CA");

  // farmers + valves come from the shared, cached reference store (no refetch)
  const { farmers: allFarmers, valves, loaded: refLoaded } = useReference();
  const farmers = allFarmers.filter(f => f.role !== "manager");
  const [attLoaded, setAttLoaded] = useState(false);
  const loading = !refLoaded || !attLoaded;
  const [saving, setSaving] = useState(false);
  const [workdayHours, setWorkdayHours] = useState(8); // OT threshold — from Settings, not hard-coded

  const [selected, setSelected] = useState<Record<string, AttendanceStatus>>({});
  const [checkIns, setCheckIns] = useState<Record<string, string>>({});
  const [morningOuts, setMorningOuts] = useState<Record<string, string>>({});
  const [afternoonIns, setAfternoonIns] = useState<Record<string, string>>({});
  const [checkOuts, setCheckOuts] = useState<Record<string, string>>({});
  const [recorders, setRecorders] = useState<Record<string, string>>({});
  const [viewDate, setViewDate] = useState(today);
  const [saved, setSaved] = useState(false);

  const [historicRecords, setHistoricRecords] = useState<AttendanceRecord[]>([]);

  // Only today's attendance is page-specific; farmers/valves are shared.
  useEffect(() => {
    fetch(`/api/attendance?date=${today}`).then(r => r.json()).then((attData) => {
      const records = attData as AttendanceRecord[];
      setSelected(Object.fromEntries(records.map(a => [a.farmerId, a.status])));
      setCheckIns(Object.fromEntries(records.filter(a => a.checkInTime).map(a => [a.farmerId, a.checkInTime!])));
      setMorningOuts(Object.fromEntries(records.filter(a => a.morningCheckOutTime).map(a => [a.farmerId, a.morningCheckOutTime!])));
      setAfternoonIns(Object.fromEntries(records.filter(a => a.afternoonCheckInTime).map(a => [a.farmerId, a.afternoonCheckInTime!])));
      setCheckOuts(Object.fromEntries(records.filter(a => a.checkOutTime).map(a => [a.farmerId, a.checkOutTime!])));
      setAttLoaded(true);
    });
  }, [today]);

  // the standard workday (hours before overtime) is configurable in Settings
  useEffect(() => {
    fetch("/api/config").then(r => (r.ok ? r.json() : null)).then(c => { if (c?.workdayHours) setWorkdayHours(c.workdayHours); });
  }, []);

  // Refetch historic records when viewDate changes (and it's not today)
  useEffect(() => {
    if (viewDate === today) {
      setHistoricRecords([]);
      return;
    }
    fetch(`/api/attendance?date=${viewDate}`)
      .then(r => r.json())
      .then(data => {
        const recs = data as (AttendanceRecord & { recorder?: { name: string } })[];
        setHistoricRecords(recs);
        setRecorders(Object.fromEntries(recs.map(r => [r.farmerId, (r as { recorder?: { name: string } }).recorder?.name ?? r.recordedBy])));
      });
  }, [viewDate, today]);

  function setStatus(farmerId: string, status: AttendanceStatus) {
    setSelected(prev => ({ ...prev, [farmerId]: status }));
    setSaved(false);
  }

  function markAllPresent() {
    setSelected(Object.fromEntries(farmers.map(f => [f.id, "present" as AttendanceStatus])));
    setSaved(false);
    toast.info("All staff marked present — adjust exceptions, then save.");
  }

  async function saveAttendance() {
    if (!user) { toast.error("Session expired — please sign in again."); return; }
    if (Object.keys(selected).length === 0) { toast.error("Mark at least one staff member first."); return; }
    setSaving(true);
    const body = farmers
      .filter(f => selected[f.id])
      .map(f => {
        const status = selected[f.id];
        const working = status === "present" || status === "late";
        const checkIn = working ? (checkIns[f.id] ?? DEFAULT_CHECK_IN) : undefined;
        const morningOut = working ? (morningOuts[f.id] ?? DEFAULT_MORNING_OUT) : undefined;
        const afternoonIn = working ? (afternoonIns[f.id] ?? DEFAULT_AFTERNOON_IN) : undefined;
        const checkOut = working ? (checkOuts[f.id] ?? undefined) : undefined;
        // Both sessions, so the lunch break is not counted as worked time.
        const hours = working
          ? calcHoursWorked({
              checkInTime: checkIn,
              morningCheckOutTime: morningOut,
              afternoonCheckInTime: afternoonIn,
              checkOutTime: checkOut,
            })
          : 0;
        return {
          farmerId: f.id,
          date: today,
          status,
          // undefined leaves an existing value untouched on re-save; absent/leave explicitly clears
          checkInTime: working ? checkIn : null,
          morningCheckOutTime: working ? morningOut : null,
          afternoonCheckInTime: working ? afternoonIn : null,
          checkOutTime: working ? (checkOut ?? undefined) : null,
          hoursWorked: working ? (hours ?? undefined) : 0,
          overtimeHours: working
            ? (hours !== null && hours !== undefined ? Math.max(0, Math.round((hours - workdayHours) * 10) / 10) : undefined)
            : 0,
          recordedBy: user.id,
        };
      });
    const res = await fetch("/api/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (!res.ok) {
      toast.error("Failed to save attendance", { description: "Check your connection and try again." });
      return;
    }
    toast.success("Attendance saved", {
      description: `${body.length} staff recorded by ${user.name}. Hours & overtime calculated from check-in/out.`,
    });
    setSaved(true);
  }

  function exportCsv() {
    const header = "Date,Staff,Status,Morning in,Lunch out,Afternoon in,Day out,Hours,Overtime";
    const rows = farmers.map(f => {
      const status = selected[f.id] ?? "";
      const working = status === "present" || status === "late";
      const ci = working ? (checkIns[f.id] ?? DEFAULT_CHECK_IN) : "";
      const mo = working ? (morningOuts[f.id] ?? DEFAULT_MORNING_OUT) : "";
      const ai = working ? (afternoonIns[f.id] ?? DEFAULT_AFTERNOON_IN) : "";
      const co = working ? (checkOuts[f.id] ?? "") : "";
      const hours = working
        ? calcHoursWorked({ checkInTime: ci, morningCheckOutTime: mo, afternoonCheckInTime: ai, checkOutTime: co })
        : 0;
      const ot = hours !== null && hours !== undefined ? Math.max(0, Math.round((hours - workdayHours) * 10) / 10) : "";
      return [today, f.name, status, ci, mo, ai, co, hours ?? "", ot].join(",");
    });
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `attendance-${today}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const presentCount = Object.values(selected).filter(s => s === "present").length;
  const lateCount = Object.values(selected).filter(s => s === "late").length;
  const absentCount = Object.values(selected).filter(s => s === "absent").length;

  if (loading) {
    return <div className="p-8 text-muted-foreground text-sm">Loading…</div>;
  }

  return (
    <div className="p-6 md:p-8 max-w-[1200px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <CalendarCheck className="size-5 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Attendance</h1>
          </div>
          <p className="text-muted-foreground text-sm">Daily attendance tracking for all farm staff</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={markAllPresent}>
            <Users className="size-3.5" /> Mark All Present
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={exportCsv}>
            <Download className="size-3.5" /> Export CSV
          </Button>
          <Button
            size="sm"
            className="gap-2 bg-primary hover:bg-primary/90"
            onClick={saveAttendance}
            disabled={saving}
          >
            <Save className="size-3.5" /> {saving ? "Saving…" : "Save Attendance"}
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-3">
        <Card className="p-4 bg-primary/10 border-primary/30">
          <div className="text-2xl font-bold text-primary tabular-nums">{presentCount}</div>
          <div className="text-xs text-primary font-medium mt-0.5">Present</div>
        </Card>
        <Card className="p-4 bg-amber-50 border-amber-200">
          <div className="text-2xl font-bold text-amber-700 tabular-nums">{lateCount}</div>
          <div className="text-xs text-amber-600 font-medium mt-0.5">Late</div>
        </Card>
        <Card className="p-4 bg-red-50 border-red-200">
          <div className="text-2xl font-bold text-red-700 tabular-nums">{absentCount}</div>
          <div className="text-xs text-red-600 font-medium mt-0.5">Absent</div>
        </Card>
        <Card className="p-4 bg-muted border-border">
          <div className="text-2xl font-bold text-foreground/80 tabular-nums">{farmers.length}</div>
          <div className="text-xs text-muted-foreground font-medium mt-0.5">Total Staff</div>
        </Card>
      </div>

      {/* Today's register */}
      <Card className="border border-border shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
          <div className="font-semibold text-foreground">
            Daily Register — {new Date(today).toLocaleDateString("en",{weekday:"long",month:"long",day:"numeric",year:"numeric"})}
          </div>
          {saved && <Badge className="bg-primary/15 text-primary border-primary/30"><CheckCircle2 className="size-3 mr-1"/>Saved</Badge>}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full pro-table">
            <thead>
              <tr>
                <th>Staff Member</th>
                <th>Assigned Valve</th>
                <th>Morning in</th>
                <th>Lunch out</th>
                <th>Afternoon in</th>
                <th>Day out</th>
                <th>Hours / OT</th>
                <th className="text-center" colSpan={4}>Mark Attendance</th>
                <th>Current Status</th>
              </tr>
            </thead>
            <tbody>
              {farmers.map(f => {
                const valve = valves.filter(v => f.assignedValves.includes(v.id));
                const status = selected[f.id];
                const working = status === "present" || status === "late";
                const hours = working
                  ? calcHoursWorked({
                      checkInTime: checkIns[f.id] ?? DEFAULT_CHECK_IN,
                      morningCheckOutTime: morningOuts[f.id] ?? DEFAULT_MORNING_OUT,
                      afternoonCheckInTime: afternoonIns[f.id] ?? DEFAULT_AFTERNOON_IN,
                      checkOutTime: checkOuts[f.id],
                    })
                  : null;
                const ot = hours !== null ? Math.max(0, Math.round((hours - workdayHours) * 10) / 10) : null;
                const StatusIcon = status ? STATUS_ICONS[status] : null;
                return (
                  <tr key={f.id}>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <Avatar className="size-8">
                          <AvatarFallback className="bg-muted text-muted-foreground text-xs font-bold">{f.avatar}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-semibold text-foreground text-sm">{f.name}</div>
                          <div className="text-[11px] text-muted-foreground capitalize">{f.role} · {f.phone}</div>
                        </div>
                      </div>
                    </td>
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
                        value={checkIns[f.id] ?? DEFAULT_CHECK_IN}
                        disabled={!working}
                        onChange={e => { setCheckIns(prev=>({...prev,[f.id]:e.target.value})); setSaved(false); }}
                        className="text-xs border border-border rounded px-2 py-1 w-24 text-foreground disabled:opacity-40"
                      />
                    </td>
                    <td>
                      <input
                        type="time"
                        value={morningOuts[f.id] ?? DEFAULT_MORNING_OUT}
                        disabled={!working}
                        onChange={e => { setMorningOuts(prev=>({...prev,[f.id]:e.target.value})); setSaved(false); }}
                        className="text-xs border border-border rounded px-2 py-1 w-24 text-foreground disabled:opacity-40"
                      />
                    </td>
                    <td>
                      <input
                        type="time"
                        value={afternoonIns[f.id] ?? DEFAULT_AFTERNOON_IN}
                        disabled={!working}
                        onChange={e => { setAfternoonIns(prev=>({...prev,[f.id]:e.target.value})); setSaved(false); }}
                        className="text-xs border border-border rounded px-2 py-1 w-24 text-foreground disabled:opacity-40"
                      />
                    </td>
                    <td>
                      <input
                        type="time"
                        value={checkOuts[f.id] ?? ""}
                        disabled={!working}
                        placeholder={DEFAULT_CHECK_OUT}
                        onChange={e => { setCheckOuts(prev=>({...prev,[f.id]:e.target.value})); setSaved(false); }}
                        className="text-xs border border-border rounded px-2 py-1 w-24 text-foreground disabled:opacity-40"
                      />
                    </td>
                    <td className="tabular-nums text-xs">
                      {hours !== null ? (
                        <span>
                          {hours}h
                          {ot !== null && ot > 0 && <span className="text-indigo-600 font-semibold ml-1">+{ot} OT</span>}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    {statuses.map(s => (
                      <td key={s.value} className="text-center px-2">
                        <button
                          onClick={() => setStatus(f.id, s.value)}
                          title={s.label}
                          className={`size-8 rounded-full border-2 transition-all ${
                            status === s.value
                              ? `${s.color} border-transparent scale-110`
                              : "bg-muted border-border hover:border-muted-foreground"
                          }`}
                        >
                          {status === s.value && (
                            <span className="text-white text-[10px] font-bold">{s.label[0]}</span>
                          )}
                        </button>
                        <div className="text-[9px] text-muted-foreground mt-0.5">{s.label}</div>
                      </td>
                    ))}
                    <td>
                      {status ? (
                        <Badge className={`text-[10px] capitalize gap-1 ${
                          status==="present"?"bg-primary/15 text-primary border-primary/30 hover:bg-primary/15":
                          status==="late"?"bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100":
                          status==="absent"?"bg-red-100 text-red-700 border-red-200 hover:bg-red-100":
                          "bg-muted text-muted-foreground hover:bg-muted"
                        }`}>
                          {StatusIcon && <StatusIcon className="size-2.5"/>}{status}
                        </Badge>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">— Not set</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-5 py-3 bg-muted border-t border-border">
          <div className="text-xs text-muted-foreground">
            Recorded by: <span className="font-semibold text-foreground/80">{user?.name ?? "—"}</span>
            <span className="capitalize"> ({user?.role ?? ""})</span>
          </div>
          <Button onClick={saveAttendance} disabled={saving} className="bg-primary hover:bg-primary/90 gap-2 text-sm" size="sm">
            <Save className="size-3.5" /> {saving ? "Saving…" : "Save & Submit"}
          </Button>
        </div>
      </Card>

      {/* History */}
      <Card className="border border-border shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-foreground">Attendance History</h3>
          <input
            type="date"
            value={viewDate}
            max={today}
            onChange={e => setViewDate(e.target.value)}
            className="text-xs border border-border rounded px-2 py-1 text-foreground"
          />
        </div>
        {viewDate !== today && (
          <div className="overflow-x-auto">
            <table className="w-full pro-table">
              <thead>
                <tr>
                  <th>Farmer</th><th>Status</th><th>Morning in</th><th>Lunch out</th><th>Afternoon in</th><th>Day out</th><th>Hours</th><th>Overtime</th><th>Recorded By</th>
                </tr>
              </thead>
              <tbody>
                {farmers.map(f => {
                  const rec = historicRecords.find(a=>a.farmerId===f.id);
                  return (
                    <tr key={f.id}>
                      <td>
                        <div className="flex items-center gap-2">
                          <Avatar className="size-6"><AvatarFallback className="bg-muted text-muted-foreground text-[10px] font-bold">{f.avatar}</AvatarFallback></Avatar>
                          <span className="font-medium text-sm">{f.name}</span>
                        </div>
                      </td>
                      <td>
                        {rec ? (
                          <Badge className={`text-[10px] capitalize ${
                            rec.status==="present"?"bg-primary/15 text-primary border-primary/30 hover:bg-primary/15":
                            rec.status==="late"?"bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100":
                            rec.status==="absent"?"bg-red-100 text-red-700 border-red-200 hover:bg-red-100":
                            "bg-muted text-muted-foreground hover:bg-muted"
                          }`}>{rec.status}</Badge>
                        ) : "—"}
                      </td>
                      <td className="tabular-nums text-foreground/70">{rec?.checkInTime ?? "—"}</td>
                      <td className="tabular-nums text-foreground/70">{rec?.morningCheckOutTime ?? "—"}</td>
                      <td className="tabular-nums text-foreground/70">{rec?.afternoonCheckInTime ?? "—"}</td>
                      <td className="tabular-nums text-foreground/70">{rec?.checkOutTime ?? "—"}</td>
                      <td className="tabular-nums text-foreground/70">{rec?.hoursWorked ? `${rec.hoursWorked}h` : "—"}</td>
                      <td className="tabular-nums text-foreground/70">
                        {rec?.overtimeHours && rec.overtimeHours > 0
                          ? <span className="text-indigo-600 font-semibold">{rec.overtimeHours}h</span>
                          : "—"}
                      </td>
                      <td className="text-foreground/70 text-xs">{rec ? (recorders[f.id] ?? rec.recordedBy) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {viewDate === today && (
          <p className="text-sm text-muted-foreground text-center py-4">Select a past date above to view historical records.</p>
        )}
      </Card>
    </div>
  );
}
