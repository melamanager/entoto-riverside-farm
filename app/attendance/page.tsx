"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { CalendarCheck, CalendarOff, Download, CheckCircle2, XCircle, Clock, Palmtree, Save, Users, Settings2, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import type { AttendanceRecord, AttendanceStatus } from "@/lib/types";
import { useOptions } from "@/lib/use-options";
import { useAuth } from "@/lib/auth";
import { useReference } from "@/lib/reference";
import { CONFIG_DEFAULTS } from "@/lib/config";
import { calcHoursWorked, deriveDayStatus, isWorking, isHalfDay } from "@/lib/attendance";
import { useIsMobile } from "@/lib/use-mobile";
import { ChevronDown } from "lucide-react";

const STATUS_ICONS = {
  present: CheckCircle2,
  late: Clock,
  absent: XCircle,
  leave: Palmtree,
  holiday: CalendarOff,
};

type Session = "morning" | "afternoon";

/** The four working-session boundaries, configurable per farm. */
type SessionTimes = {
  morningStart: string;
  morningEnd: string;
  afternoonStart: string;
  afternoonEnd: string;
};

const DEFAULT_TIMES: SessionTimes = {
  morningStart: CONFIG_DEFAULTS.morningStart,
  morningEnd: CONFIG_DEFAULTS.morningEnd,
  afternoonStart: CONFIG_DEFAULTS.afternoonStart,
  afternoonEnd: CONFIG_DEFAULTS.afternoonEnd,
};

export default function AttendancePage() {
  const options = useOptions();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  // On a phone the register is a list of people, and only the exception gets
  // opened up — the normal day is one tap per person.
  const [openCard, setOpenCard] = useState<string | null>(null);
  const statuses = options.attendanceStatuses.map(s => ({
    value: s.value as AttendanceStatus,
    label: s.label,
    color: s.color ?? "bg-slate-400",
  }));
  const today = new Date().toLocaleDateString("en-CA");
  // Supervisors record today. Correcting an earlier day changes what people are
  // paid for work already done, so only a manager can move this off today.
  const isManager = user?.role === "manager";
  const [registerDate, setRegisterDate] = useState(today);
  const editingPast = registerDate < today;

  // farmers + valves come from the shared, cached reference store (no refetch)
  const { farmers: allFarmers, valves, loaded: refLoaded } = useReference();
  // Today's register only lists people still on the roster — daily workers who
  // have left are archived, not deleted, so their past records survive.
  const farmers = allFarmers.filter(f => f.role !== "manager" && !f.archivedAt);
  const [attLoaded, setAttLoaded] = useState(false);
  const loading = !refLoaded || !attLoaded;
  const [saving, setSaving] = useState(false);
  const [workdayHours, setWorkdayHours] = useState(8); // OT threshold — from Settings, not hard-coded

  // Only managers and supervisors may retune the session boundaries.
  const canEditTimes = user?.role === "manager" || user?.role === "supervisor";
  const [times, setTimes] = useState<SessionTimes>(DEFAULT_TIMES);
  const [timesDraft, setTimesDraft] = useState<SessionTimes>(DEFAULT_TIMES);
  const [editingTimes, setEditingTimes] = useState(false);
  const [savingTimes, setSavingTimes] = useState(false);

  // Each session is marked independently.
  const [morningSel, setMorningSel] = useState<Record<string, AttendanceStatus>>({});
  const [afternoonSel, setAfternoonSel] = useState<Record<string, AttendanceStatus>>({});
  const [checkIns, setCheckIns] = useState<Record<string, string>>({});
  const [morningOuts, setMorningOuts] = useState<Record<string, string>>({});
  const [afternoonIns, setAfternoonIns] = useState<Record<string, string>>({});
  const [checkOuts, setCheckOuts] = useState<Record<string, string>>({});
  const [recorders, setRecorders] = useState<Record<string, string>>({});
  const [viewDate, setViewDate] = useState(today);
  const [saved, setSaved] = useState(false);

  const [historicRecords, setHistoricRecords] = useState<AttendanceRecord[]>([]);

  // History must still name people who have since left, so it lists everyone on
  // the roster plus any archived worker who actually has a record that day.
  const historyFarmers = allFarmers.filter(
    f => f.role !== "manager"
      && (!f.archivedAt || historicRecords.some(r => r.farmerId === f.id)),
  );

  // Only today's attendance is page-specific; farmers/valves are shared.
  useEffect(() => {
    setAttLoaded(false);
    fetch(`/api/attendance?date=${registerDate}`).then(r => r.json()).then((attData) => {
      const records = attData as AttendanceRecord[];
      // Legacy rows have no per-session status — fall back to the whole day.
      setMorningSel(Object.fromEntries(records.map(a => [a.farmerId, a.morningStatus ?? a.status])));
      setAfternoonSel(Object.fromEntries(records.map(a => [a.farmerId, a.afternoonStatus ?? a.status])));
      setCheckIns(Object.fromEntries(records.filter(a => a.checkInTime).map(a => [a.farmerId, a.checkInTime!])));
      setMorningOuts(Object.fromEntries(records.filter(a => a.morningCheckOutTime).map(a => [a.farmerId, a.morningCheckOutTime!])));
      setAfternoonIns(Object.fromEntries(records.filter(a => a.afternoonCheckInTime).map(a => [a.farmerId, a.afternoonCheckInTime!])));
      setCheckOuts(Object.fromEntries(records.filter(a => a.checkOutTime).map(a => [a.farmerId, a.checkOutTime!])));
      // a day with no records yet starts blank rather than keeping the last day's
      if (records.length === 0) { setMorningSel({}); setAfternoonSel({}); }
      setSaved(false);
      setAttLoaded(true);
    });
  }, [registerDate]);

  // Workday length (OT threshold) and the session boundaries both live in config
  useEffect(() => {
    fetch("/api/config").then(r => (r.ok ? r.json() : null)).then(c => {
      if (!c) return;
      if (c.workdayHours) setWorkdayHours(c.workdayHours);
      const t: SessionTimes = {
        morningStart: c.morningStart ?? DEFAULT_TIMES.morningStart,
        morningEnd: c.morningEnd ?? DEFAULT_TIMES.morningEnd,
        afternoonStart: c.afternoonStart ?? DEFAULT_TIMES.afternoonStart,
        afternoonEnd: c.afternoonEnd ?? DEFAULT_TIMES.afternoonEnd,
      };
      setTimes(t);
      setTimesDraft(t);
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
      .then(data => {
        const recs = data as (AttendanceRecord & { recorder?: { name: string } })[];
        setHistoricRecords(recs);
        setRecorders(Object.fromEntries(recs.map(r => [r.farmerId, (r as { recorder?: { name: string } }).recorder?.name ?? r.recordedBy])));
      });
  }, [viewDate, today]);

  /**
   * Mark one session. A normal day is the same both halves, so setting one
   * mirrors into the other while it is still blank — the supervisor only has
   * to touch the afternoon when it actually differs.
   */
  function setSessionStatus(farmerId: string, session: Session, status: AttendanceStatus) {
    if (session === "morning") {
      setMorningSel(prev => ({ ...prev, [farmerId]: status }));
      setAfternoonSel(prev => (prev[farmerId] ? prev : { ...prev, [farmerId]: status }));
    } else {
      setAfternoonSel(prev => ({ ...prev, [farmerId]: status }));
      setMorningSel(prev => (prev[farmerId] ? prev : { ...prev, [farmerId]: status }));
    }
    setSaved(false);
  }

  /** One tap sets the whole day; the card expands only when it differs. */
  function setWholeDay(farmerId: string, status: AttendanceStatus) {
    setMorningSel(prev => ({ ...prev, [farmerId]: status }));
    setAfternoonSel(prev => ({ ...prev, [farmerId]: status }));
    setSaved(false);
  }

  function markAllPresent() {
    const all = Object.fromEntries(farmers.map(f => [f.id, "present" as AttendanceStatus]));
    setMorningSel(all);
    setAfternoonSel(all);
    setSaved(false);
    toast.info("All staff marked present for both sessions — adjust exceptions, then save.");
  }

  /**
   * The farm is shut — Sunday or a public holiday. Recording it is better than
   * leaving the day blank: nobody is marked absent, the day is not counted
   * against anyone's attendance rate, and it is clear the day was accounted
   * for rather than forgotten.
   */
  function markHoliday() {
    const all = Object.fromEntries(farmers.map(f => [f.id, "holiday" as AttendanceStatus]));
    setMorningSel(all);
    setAfternoonSel(all);
    setSaved(false);
    toast.info("Whole day marked as holiday — save to record it.", {
      description: "Nobody is counted absent and it will not affect attendance rates.",
    });
  }

  // Sundays are not worked here, so nudge rather than silently leaving it blank
  const isSunday = new Date(`${today}T00:00:00`).getDay() === 0;
  const dayMarkedHoliday =
    farmers.length > 0 && farmers.every(f => morningSel[f.id] === "holiday");

  /** Marked when at least one session has been set. */
  const isMarked = (id: string) => Boolean(morningSel[id] || afternoonSel[id]);
  const dayStatusOf = (id: string): AttendanceStatus | undefined => {
    const m = morningSel[id], a = afternoonSel[id];
    if (!m && !a) return undefined;
    return deriveDayStatus(m ?? a!, a ?? m!);
  };

  /** Hours for one person, counting only the sessions actually worked. */
  const hoursFor = (id: string): number | null => {
    const m = morningSel[id], a = afternoonSel[id];
    if (!m && !a) return null;
    return calcHoursWorked(
      {
        checkInTime: checkIns[id] ?? times.morningStart,
        morningCheckOutTime: morningOuts[id] ?? times.morningEnd,
        afternoonCheckInTime: afternoonIns[id] ?? times.afternoonStart,
        checkOutTime: checkOuts[id] ?? times.afternoonEnd,
      },
      { morningWorked: isWorking(m), afternoonWorked: isWorking(a) },
    );
  };

  async function saveSessionTimes() {
    setSavingTimes(true);
    const res = await fetch("/api/attendance/session-times", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(timesDraft),
    });
    setSavingTimes(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error("Could not save session times", { description: err.error ?? "Check the values and try again." });
      return;
    }
    setTimes(timesDraft);
    setEditingTimes(false);
    toast.success("Session times updated", { description: "New defaults apply to the register from now on." });
  }

  async function saveAttendance() {
    if (!user) { toast.error("Session expired — please sign in again."); return; }
    const marked = farmers.filter(f => isMarked(f.id));
    if (marked.length === 0) { toast.error("Mark at least one staff member first."); return; }
    setSaving(true);
    const body = marked.map(f => {
      const morning = morningSel[f.id] ?? afternoonSel[f.id];
      const afternoon = afternoonSel[f.id] ?? morningSel[f.id];
      const mWorked = isWorking(morning);
      const aWorked = isWorking(afternoon);
      return {
        farmerId: f.id,
        date: registerDate,
        morningStatus: morning,
        afternoonStatus: afternoon,
        // times for a session that wasn't worked are cleared server-side too
        checkInTime: mWorked ? (checkIns[f.id] ?? times.morningStart) : null,
        morningCheckOutTime: mWorked ? (morningOuts[f.id] ?? times.morningEnd) : null,
        afternoonCheckInTime: aWorked ? (afternoonIns[f.id] ?? times.afternoonStart) : null,
        checkOutTime: aWorked ? (checkOuts[f.id] ?? times.afternoonEnd) : null,
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
      const err = await res.json().catch(() => ({}));
      if (res.status === 403) {
        toast.error(err.error ?? "Only a manager can change a past date", { description: err.detail });
      } else {
        toast.error(err.error ?? "Failed to save attendance", {
          description: err.detail ?? "Check your connection and try again.",
        });
      }
      return;
    }
    const halfDays = marked.filter(f => isHalfDay(morningSel[f.id], afternoonSel[f.id])).length;
    toast.success("Attendance saved", {
      description: `${body.length} staff recorded by ${user.name}.`
        + (halfDays > 0 ? ` ${halfDays} half-day(s).` : "")
        + " Hours & overtime calculated per session.",
    });
    setSaved(true);
  }

  function exportCsv() {
    const header = "Date,Staff,Morning,Afternoon,Day,Morning in,Lunch out,Afternoon in,Day out,Hours,Overtime";
    const rows = farmers.map(f => {
      const m = morningSel[f.id] ?? "";
      const a = afternoonSel[f.id] ?? "";
      const mWorked = isWorking(m as AttendanceStatus);
      const aWorked = isWorking(a as AttendanceStatus);
      const ci = mWorked ? (checkIns[f.id] ?? times.morningStart) : "";
      const mo = mWorked ? (morningOuts[f.id] ?? times.morningEnd) : "";
      const ai = aWorked ? (afternoonIns[f.id] ?? times.afternoonStart) : "";
      const co = aWorked ? (checkOuts[f.id] ?? times.afternoonEnd) : "";
      const hours = hoursFor(f.id);
      const ot = hours !== null ? Math.max(0, Math.round((hours - workdayHours) * 10) / 10) : "";
      return [today, f.name, m, a, dayStatusOf(f.id) ?? "", ci, mo, ai, co, hours ?? "", ot].join(",");
    });
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `attendance-${today}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const dayStatuses = farmers.map(f => dayStatusOf(f.id)).filter(Boolean) as AttendanceStatus[];
  const presentCount = dayStatuses.filter(s => s === "present").length;
  const lateCount = dayStatuses.filter(s => s === "late").length;
  const absentCount = dayStatuses.filter(s => s === "absent").length;
  const halfDayCount = farmers.filter(f => isHalfDay(morningSel[f.id], afternoonSel[f.id])).length;
  const holidayCount = dayStatuses.filter(s => s === "holiday").length;
  const markedCount = farmers.filter(f => isMarked(f.id)).length;

  if (loading) {
    return <div className="p-8 text-muted-foreground text-sm">Loading…</div>;
  }

  /** Compact status picker for one session. */
  const StatusPicker = ({ farmerId, session, value }: { farmerId: string; session: Session; value?: AttendanceStatus }) => (
    <div className="flex gap-1">
      {statuses.map(s => (
        <button
          key={s.value}
          onClick={() => setSessionStatus(farmerId, session, s.value)}
          title={`${session === "morning" ? "Morning" : "Afternoon"}: ${s.label}`}
          className={`size-7 rounded-full border-2 text-[10px] font-bold transition-all ${
            value === s.value
              ? `${s.color} border-transparent text-white scale-110`
              : "bg-muted border-border text-muted-foreground hover:border-muted-foreground"
          }`}
        >
          {s.label[0]}
        </button>
      ))}
    </div>
  );

  return (
    <div className="p-6 md:p-8 max-w-[1200px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <CalendarCheck className="size-5 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Attendance</h1>
          </div>
          <p className="text-muted-foreground text-sm">{isMobile ? "Tap each person" : "Morning and afternoon sessions, marked separately"}</p>
        </div>
        <div className="flex gap-2">
          {isMobile ? (
            <div className="flex gap-2 w-full">
              <Button size="sm" className="flex-1 gap-1.5" onClick={markAllPresent}>
                <Users className="size-3.5" /> All present
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={markHoliday}>
                <CalendarOff className="size-3.5" /> Holiday
              </Button>
              <Link href="/attendance/report">
                <Button variant="outline" size="sm" className="px-2.5" aria-label="Report">
                  <BarChart3 className="size-3.5" />
                </Button>
              </Link>
            </div>
          ) : (
            <>
              <Link href="/attendance/report">
                <Button variant="outline" size="sm" className="gap-2">
                  <BarChart3 className="size-3.5" /> Report
                </Button>
              </Link>
              <Button variant="outline" size="sm" className="gap-2" onClick={markAllPresent}>
                <Users className="size-3.5" /> Mark All Present
              </Button>
              <Button variant="outline" size="sm" className="gap-2" onClick={markHoliday}>
                <CalendarOff className="size-3.5" /> Holiday
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
            </>
          )}
        </div>
      </div>

      {/* Correcting an earlier day — managers only */}
      {isManager && (
        <Card className={`p-3 flex items-center gap-3 flex-wrap ${editingPast ? "border-amber-300 bg-amber-50" : ""}`}>
          <label className="text-xs font-semibold text-foreground shrink-0">
            {editingPast ? "Correcting" : "Register for"}
          </label>
          <input
            type="date"
            value={registerDate}
            max={today}
            onChange={e => setRegisterDate(e.target.value || today)}
            className="text-xs border border-border rounded px-2 py-1.5 text-foreground bg-card"
          />
          {editingPast ? (
            <>
              <span className="text-[11px] text-amber-800 flex-1 min-w-[180px]">
                You are changing a day that has already passed. This affects what people are
                paid — the correction is recorded against your name.
              </span>
              <Button size="sm" variant="outline" className="shrink-0" onClick={() => setRegisterDate(today)}>
                Back to today
              </Button>
            </>
          ) : (
            <span className="text-[11px] text-muted-foreground">
              Pick an earlier date to fix a day that was missed or entered wrong.
            </span>
          )}
        </Card>
      )}

      {/* The farm does not work Sundays — offer the holiday instead of a blank day */}
      {isSunday && !editingPast && !dayMarkedHoliday && (
        <Card className="border border-sky-300 bg-sky-50 p-4 flex items-start gap-3 flex-wrap">
          <CalendarOff className="size-4 text-sky-600 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-[200px]">
            <div className="font-semibold text-sky-900 text-sm">It&rsquo;s Sunday</div>
            <p className="text-xs text-sky-800 mt-0.5">
              The farm does not normally work today. Marking it a holiday records the day
              properly — nobody is counted absent and attendance rates are unaffected.
            </p>
          </div>
          <Button size="sm" className="gap-1.5 bg-sky-600 hover:bg-sky-700 shrink-0" onClick={markHoliday}>
            <CalendarOff className="size-3.5" /> Mark as holiday
          </Button>
        </Card>
      )}

      {/* Summary — a compact strip on a phone, cards on a wide screen.
          Five big cards used to fill the whole first screen before you could
          see a single name. */}
      {isMobile ? (
        <div className="flex items-center gap-1.5 overflow-x-auto -mx-1 px-1 pb-0.5">
          {[
            { n: presentCount, l: "present", c: "bg-primary/15 text-primary border-primary/30" },
            { n: lateCount,    l: "late",    c: "bg-amber-100 text-amber-700 border-amber-200" },
            { n: absentCount,  l: "absent",  c: "bg-red-100 text-red-700 border-red-200" },
            ...(holidayCount > 0 ? [{ n: holidayCount, l: "holiday", c: "bg-sky-100 text-sky-700 border-sky-200" }] : []),
            ...(halfDayCount > 0 ? [{ n: halfDayCount, l: "half day", c: "bg-indigo-100 text-indigo-700 border-indigo-200" }] : []),
          ].map(x => (
            <span key={x.l} className={`shrink-0 text-[11px] font-semibold rounded-full border px-2.5 py-1 tabular-nums ${x.c}`}>
              {x.n} {x.l}
            </span>
          ))}
          <span className="shrink-0 text-[11px] font-medium rounded-full border border-border bg-muted text-muted-foreground px-2.5 py-1 tabular-nums">
            {markedCount}/{farmers.length} marked
          </span>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
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
          {holidayCount > 0 ? (
            <Card className="p-4 bg-sky-50 border-sky-200">
              <div className="text-2xl font-bold text-sky-700 tabular-nums">{holidayCount}</div>
              <div className="text-xs text-sky-600 font-medium mt-0.5">Holiday</div>
            </Card>
          ) : (
            <Card className="p-4 bg-indigo-50 border-indigo-200">
              <div className="text-2xl font-bold text-indigo-700 tabular-nums">{halfDayCount}</div>
              <div className="text-xs text-indigo-600 font-medium mt-0.5">Half day</div>
            </Card>
          )}
          <Card className="p-4 bg-muted border-border">
            <div className="text-2xl font-bold text-foreground/80 tabular-nums">{farmers.length}</div>
            <div className="text-xs text-muted-foreground font-medium mt-0.5">Total Staff</div>
          </Card>
        </div>
      )}

      {/* ── Mobile register: a list of people, one tap each ──────────────
          The table below is 1156px wide — on a phone that meant scrolling
          sideways three screens to mark one person. Here the common case is a
          single tap, and the card only opens when the day is not uniform. */}
      {isMobile ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-0.5">
            <div className="text-sm font-semibold text-foreground">
              {new Date(`${registerDate}T00:00:00`).toLocaleDateString("en", { weekday: "long", day: "numeric", month: "long" })}
              {editingPast && <span className="ml-1 text-[10px] font-semibold text-amber-600 uppercase">correcting</span>}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {times.morningStart}–{times.morningEnd} · {times.afternoonStart}–{times.afternoonEnd}
              </span>
              {canEditTimes && (
                <button onClick={() => { setTimesDraft(times); setEditingTimes(v => !v); }}
                  className="text-muted-foreground hover:text-foreground" aria-label="Edit session times">
                  <Settings2 className="size-3.5" />
                </button>
              )}
            </div>
          </div>

          {editingTimes && canEditTimes && (
            <Card className="p-3 bg-muted/50">
              <div className="text-xs font-semibold mb-2">Working session times</div>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { key: "morningStart", label: "Morning starts" },
                  { key: "morningEnd", label: "Lunch break at" },
                  { key: "afternoonStart", label: "Afternoon starts" },
                  { key: "afternoonEnd", label: "Day ends" },
                ] as { key: keyof SessionTimes; label: string }[]).map(({ key, label }) => (
                  <label key={key} className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
                    <input type="time" value={timesDraft[key]}
                      onChange={e => setTimesDraft(prev => ({ ...prev, [key]: e.target.value }))}
                      className="text-xs border border-border rounded px-2 py-1.5 text-foreground" />
                  </label>
                ))}
              </div>
              <Button size="sm" className="w-full mt-2 gap-1.5" onClick={saveSessionTimes} disabled={savingTimes}>
                <Save className="size-3.5" /> {savingTimes ? "Saving…" : "Save times"}
              </Button>
            </Card>
          )}

          {farmers.map(f => {
            const morning = morningSel[f.id];
            const afternoon = afternoonSel[f.id];
            const day = dayStatusOf(f.id);
            const split = Boolean(morning && afternoon && morning !== afternoon);
            const hours = hoursFor(f.id);
            const open = openCard === f.id;
            const StatusIcon = day ? STATUS_ICONS[day] : null;

            return (
              <Card key={f.id} className={`p-3 ${day ? "" : "border-dashed"}`}>
                <div className="flex items-center gap-2.5 mb-2.5">
                  <Avatar className="size-9 shrink-0">
                    <AvatarFallback className="bg-muted text-muted-foreground text-xs font-bold">{f.avatar}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm text-foreground truncate">{f.name}</div>
                    <div className="text-[11px] text-muted-foreground truncate capitalize">
                      {f.jobTitle || f.role}
                      {hours !== null && <span className="tabular-nums"> · {hours}h</span>}
                    </div>
                  </div>
                  {day && StatusIcon && (
                    <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold text-muted-foreground">
                      {split && <span className="text-indigo-600">½</span>}
                      <StatusIcon className="size-3.5" />
                    </span>
                  )}
                </div>

                {/* One tap marks the whole day */}
                <div className="grid grid-cols-5 gap-1">
                  {statuses.map(st => {
                    const on = !split && day === st.value;
                    return (
                      <button
                        key={st.value}
                        onClick={() => setWholeDay(f.id, st.value)}
                        aria-pressed={on}
                        className={`flex flex-col items-center justify-center gap-0.5 rounded-lg border py-2 min-h-[46px] transition-colors ${
                          on ? `${st.color} border-transparent text-white`
                             : "bg-card border-border text-muted-foreground active:bg-accent"}`}
                      >
                        {(() => { const I = STATUS_ICONS[st.value]; return I ? <I className="size-4" /> : null; })()}
                        <span className="text-[9.5px] font-semibold leading-none">{st.label}</span>
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => setOpenCard(open ? null : f.id)}
                  className="mt-2 w-full flex items-center justify-center gap-1 text-[11px] text-muted-foreground py-1"
                >
                  {split
                    ? <span className="text-indigo-600 font-semibold">Morning {morning} · Afternoon {afternoon}</span>
                    : "Different morning / afternoon, or edit times"}
                  <ChevronDown className={`size-3 transition-transform ${open ? "rotate-180" : ""}`} />
                </button>

                {open && (
                  <div className="mt-2 pt-2 border-t border-border space-y-3">
                    {(["morning", "afternoon"] as Session[]).map(session => {
                      const val = session === "morning" ? morning : afternoon;
                      const worked = isWorking(val);
                      return (
                        <div key={session}>
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">{session}</div>
                          <div className="grid grid-cols-5 gap-1">
                            {statuses.map(st => (
                              <button
                                key={st.value}
                                onClick={() => setSessionStatus(f.id, session, st.value)}
                                aria-label={st.label}
                                title={st.label}
                                className={`flex items-center justify-center rounded-md border py-1.5 min-h-[36px] transition-colors ${
                                  val === st.value ? `${st.color} border-transparent text-white`
                                                   : "bg-card border-border text-muted-foreground active:bg-accent"}`}
                              >
                                {(() => { const I = STATUS_ICONS[st.value]; return I ? <I className="size-3.5" /> : <span className="text-[10px]">{st.label[0]}</span>; })()}
                              </button>
                            ))}
                          </div>
                          {worked && (
                            <div className="flex gap-1.5 mt-1.5">
                              <input type="time" aria-label={`${session} in`}
                                value={session === "morning" ? (checkIns[f.id] ?? times.morningStart) : (afternoonIns[f.id] ?? times.afternoonStart)}
                                onChange={e => {
                                  const v = e.target.value;
                                  session === "morning" ? setCheckIns(p2 => ({ ...p2, [f.id]: v })) : setAfternoonIns(p2 => ({ ...p2, [f.id]: v }));
                                  setSaved(false);
                                }}
                                className="flex-1 text-xs border border-border rounded px-2 py-1.5 text-foreground" />
                              <input type="time" aria-label={`${session} out`}
                                value={session === "morning" ? (morningOuts[f.id] ?? times.morningEnd) : (checkOuts[f.id] ?? times.afternoonEnd)}
                                onChange={e => {
                                  const v = e.target.value;
                                  session === "morning" ? setMorningOuts(p2 => ({ ...p2, [f.id]: v })) : setCheckOuts(p2 => ({ ...p2, [f.id]: v }));
                                  setSaved(false);
                                }}
                                className="flex-1 text-xs border border-border rounded px-2 py-1.5 text-foreground" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            );
          })}

          {/* Sticky save — sits above the app's bottom nav, where the thumb is */}
          <div className="sticky z-30" style={{ bottom: "calc(68px + env(safe-area-inset-bottom))" }}>
            <Button
              onClick={saveAttendance}
              disabled={saving || markedCount === 0}
              className="w-full gap-2 shadow-lg h-12 text-sm"
            >
              <Save className="size-4" />
              {saving ? "Saving…" : saved ? "Saved ✓" : `Save attendance (${markedCount}/${farmers.length})`}
            </Button>
          </div>
          <div className="h-2" />
        </div>
      ) : (
        /* Desktop register — the wide table works well with a mouse */
        <Card className="border border-border shadow-sm overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-border flex-wrap">
          <div className="font-semibold text-foreground">
            Daily Register — {new Date(`${registerDate}T00:00:00`).toLocaleDateString("en",{weekday:"long",month:"long",day:"numeric",year:"numeric"})}
            {editingPast && <span className="ml-2 text-[10px] font-semibold text-amber-600 uppercase">correcting a past day</span>}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground tabular-nums">
              Morning {times.morningStart}–{times.morningEnd} · Afternoon {times.afternoonStart}–{times.afternoonEnd}
            </span>
            {canEditTimes && (
              <Button variant="outline" size="sm" className="gap-1.5 h-7 text-[11px]"
                onClick={() => { setTimesDraft(times); setEditingTimes(v => !v); }}>
                <Settings2 className="size-3" /> {editingTimes ? "Cancel" : "Edit times"}
              </Button>
            )}
            {saved && <Badge className="bg-primary/15 text-primary border-primary/30"><CheckCircle2 className="size-3 mr-1"/>Saved</Badge>}
          </div>
        </div>

        {/* Session-time configuration — supervisors and managers */}
        {editingTimes && canEditTimes && (
          <div className="px-5 py-4 border-b border-border bg-muted/50">
            <div className="text-xs font-semibold text-foreground mb-3">Working session times</div>
            <div className="flex flex-wrap items-end gap-4">
              {([
                { key: "morningStart",   label: "Morning starts" },
                { key: "morningEnd",     label: "Lunch break at" },
                { key: "afternoonStart", label: "Afternoon starts" },
                { key: "afternoonEnd",   label: "Day ends" },
              ] as { key: keyof SessionTimes; label: string }[]).map(({ key, label }) => (
                <label key={key} className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
                  <input
                    type="time"
                    value={timesDraft[key]}
                    onChange={e => setTimesDraft(prev => ({ ...prev, [key]: e.target.value }))}
                    className="text-xs border border-border rounded px-2 py-1 w-28 text-foreground"
                  />
                </label>
              ))}
              <Button size="sm" className="gap-1.5" onClick={saveSessionTimes} disabled={savingTimes}>
                <Save className="size-3.5" /> {savingTimes ? "Saving…" : "Save times"}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-3">
              These become the default check-in/out times on the register. Existing records are not changed.
            </p>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full pro-table">
            <thead>
              <tr>
                <th rowSpan={2}>Staff Member</th>
                <th rowSpan={2}>Valve</th>
                <th colSpan={2} className="text-center border-l border-border">Morning</th>
                <th colSpan={2} className="text-center border-l border-border">Afternoon</th>
                <th rowSpan={2} className="border-l border-border">Hours / OT</th>
                <th rowSpan={2}>Day</th>
              </tr>
              <tr>
                <th className="border-l border-border font-normal text-[10px]">Status</th>
                <th className="font-normal text-[10px]">In / Out</th>
                <th className="border-l border-border font-normal text-[10px]">Status</th>
                <th className="font-normal text-[10px]">In / Out</th>
              </tr>
            </thead>
            <tbody>
              {farmers.map(f => {
                const valve = valves.filter(v => f.assignedValves.includes(v.id));
                const morning = morningSel[f.id];
                const afternoon = afternoonSel[f.id];
                const mWorked = isWorking(morning);
                const aWorked = isWorking(afternoon);
                const day = dayStatusOf(f.id);
                const hours = hoursFor(f.id);
                const ot = hours !== null ? Math.max(0, Math.round((hours - workdayHours) * 10) / 10) : null;
                const half = isHalfDay(morning, afternoon);
                const StatusIcon = day ? STATUS_ICONS[day] : null;
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

                    {/* ── Morning ── */}
                    <td className="border-l border-border">
                      <StatusPicker farmerId={f.id} session="morning" value={morning} />
                    </td>
                    <td>
                      <div className="flex gap-1">
                        <input
                          type="time"
                          aria-label="Morning in"
                          value={checkIns[f.id] ?? times.morningStart}
                          disabled={!mWorked}
                          onChange={e => { setCheckIns(prev=>({...prev,[f.id]:e.target.value})); setSaved(false); }}
                          className="text-xs border border-border rounded px-1.5 py-1 w-[86px] text-foreground disabled:opacity-40"
                        />
                        <input
                          type="time"
                          aria-label="Lunch out"
                          value={morningOuts[f.id] ?? times.morningEnd}
                          disabled={!mWorked}
                          onChange={e => { setMorningOuts(prev=>({...prev,[f.id]:e.target.value})); setSaved(false); }}
                          className="text-xs border border-border rounded px-1.5 py-1 w-[86px] text-foreground disabled:opacity-40"
                        />
                      </div>
                    </td>

                    {/* ── Afternoon ── */}
                    <td className="border-l border-border">
                      <StatusPicker farmerId={f.id} session="afternoon" value={afternoon} />
                    </td>
                    <td>
                      <div className="flex gap-1">
                        <input
                          type="time"
                          aria-label="Afternoon in"
                          value={afternoonIns[f.id] ?? times.afternoonStart}
                          disabled={!aWorked}
                          onChange={e => { setAfternoonIns(prev=>({...prev,[f.id]:e.target.value})); setSaved(false); }}
                          className="text-xs border border-border rounded px-1.5 py-1 w-[86px] text-foreground disabled:opacity-40"
                        />
                        <input
                          type="time"
                          aria-label="Day out"
                          value={checkOuts[f.id] ?? times.afternoonEnd}
                          disabled={!aWorked}
                          onChange={e => { setCheckOuts(prev=>({...prev,[f.id]:e.target.value})); setSaved(false); }}
                          className="text-xs border border-border rounded px-1.5 py-1 w-[86px] text-foreground disabled:opacity-40"
                        />
                      </div>
                    </td>

                    <td className="tabular-nums text-xs border-l border-border">
                      {hours !== null ? (
                        <span>
                          {hours}h
                          {ot !== null && ot > 0 && <span className="text-indigo-600 font-semibold ml-1">+{ot} OT</span>}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td>
                      {day ? (
                        <div className="flex flex-col gap-0.5 items-start">
                          <Badge className={`text-[10px] capitalize gap-1 ${
                            day==="present"?"bg-primary/15 text-primary border-primary/30 hover:bg-primary/15":
                            day==="late"?"bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100":
                            day==="absent"?"bg-red-100 text-red-700 border-red-200 hover:bg-red-100":
                            "bg-muted text-muted-foreground hover:bg-muted"
                          }`}>
                            {StatusIcon && <StatusIcon className="size-2.5"/>}{day}
                          </Badge>
                          {half && <span className="text-[9px] font-semibold text-indigo-600">half day</span>}
                        </div>
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
      )}

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
                  <th>Farmer</th><th>Morning</th><th>Afternoon</th><th>Day</th><th>Morning in</th><th>Lunch out</th><th>Afternoon in</th><th>Day out</th><th>Hours</th><th>Overtime</th><th>Recorded By</th>
                </tr>
              </thead>
              <tbody>
                {historyFarmers.map(f => {
                  const rec = historicRecords.find(a=>a.farmerId===f.id);
                  const pill = (s?: AttendanceStatus | null) => s ? (
                    <Badge className={`text-[10px] capitalize ${
                      s==="present"?"bg-primary/15 text-primary border-primary/30 hover:bg-primary/15":
                      s==="late"?"bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100":
                      s==="absent"?"bg-red-100 text-red-700 border-red-200 hover:bg-red-100":
                      "bg-muted text-muted-foreground hover:bg-muted"
                    }`}>{s}</Badge>
                  ) : <span className="text-muted-foreground">—</span>;
                  return (
                    <tr key={f.id}>
                      <td>
                        <div className="flex items-center gap-2">
                          <Avatar className="size-6"><AvatarFallback className="bg-muted text-muted-foreground text-[10px] font-bold">{f.avatar}</AvatarFallback></Avatar>
                          <span className="font-medium text-sm">{f.name}</span>
                          {f.archivedAt && (
                            <span className="text-[9px] uppercase tracking-wide text-muted-foreground border border-border rounded px-1 py-px">left</span>
                          )}
                        </div>
                      </td>
                      <td>{pill(rec?.morningStatus ?? rec?.status)}</td>
                      <td>{pill(rec?.afternoonStatus ?? rec?.status)}</td>
                      <td>
                        {rec ? (
                          <div className="flex flex-col gap-0.5 items-start">
                            {pill(rec.status)}
                            {isHalfDay(rec.morningStatus, rec.afternoonStatus) && (
                              <span className="text-[9px] font-semibold text-indigo-600">half day</span>
                            )}
                          </div>
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
