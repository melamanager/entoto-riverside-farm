"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ClipboardCheck, CalendarCheck, Droplets, Beaker, Wheat, Shovel,
  ShoppingCart, Warehouse, Clock, ChevronLeft, ChevronRight,
  ExternalLink, Plus, Download, CheckCircle2, CircleDashed, CircleDot,
  MessageSquare, Pin, Trash2, Send, CheckCheck,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useLang } from "@/lib/lang";
import { EN, AM } from "@/lib/translations";
import type { Farmer } from "@/lib/types";

/* ── API response types ─────────────────────────────────────────────── */

type DailyData = {
  date: string;
  attendance: { marked: number; totalWorkers: number; present: number; absent: number; unmarked: string[] };
  watering: {
    valvesWatered: number; totalValves: number; sessions: number; skipped: number;
    valves: { id: string; name: string; color: string; schedule: string; watered: boolean }[];
  };
  fertigation: { applied: number; scheduled: number; skipped: number; treatmentsApplied: number };
  harvest: { records: number; totalKg: number; beds: number };
  maintenance: { total: number; done: number; tasks: { id: string; title: string; status: string; assignee: string }[] };
  sales: { orders: number; totalETB: number; totalKg: number };
  stock: {
    inCount: number; outCount: number; inValueETB: number; outValueETB: number;
    transactions: { id: string; type: string; item: string; quantity: number; unit: string }[];
  };
  overtime: { workers: number; totalHours: number; records: { farmerId: string; name: string; hours: number }[] };
  nilReports?: { area: string; by: string; note: string | null }[];
};

type WeeklyData = {
  start: string;
  end: string;
  store: {
    inCount: number; outCount: number; wasteCount: number; adjustmentCount: number;
    inValueETB: number; outValueETB: number;
    movements: { id: string; date: string; type: string; item: string; category: string; quantity: number; unit: string; valueETB: number }[];
  };
  expenses: { totalETB: number; byCategory: Record<string, number>; count: number };
  sales: { orders: number; totalETB: number; totalKg: number; paidETB: number };
  harvest: { totalKg: number };
  watering: { sessions: number; skipped: number };
  net: { incomeETB: number; spendETB: number; balanceETB: number };
  overtime: {
    totalHours: number; totalPayETB: number;
    workers: { farmerId: string; name: string; avatar: string; daysWorked: number; hoursWorked: number; overtimeHours: number; dailyWage: number; overtimePay: number; missedDays: number }[];
  };
};

type DailyNoteT = {
  id: string;
  date: string;
  type: "instruction" | "report" | "issue" | "note";
  body: string;
  pinned: boolean;
  readBy: string[];
  createdAt: string;
  author: { id: string; name: string; avatar: string; role: string };
  valve?: { name: string } | null;
};

type ComplianceRow = {
  date: string;
  supervisorId: string;
  name: string;
  avatar: string;
  attendance: boolean;
  watering: boolean;
  dayLog: boolean;
  recorded: boolean;
  acknowledged: boolean;
  ackByName: string | null;
  ackNote: string | null;
};

type AttendanceRec = {
  farmerId: string; date: string; status: string;
  checkInTime?: string | null; checkOutTime?: string | null;
  hoursWorked?: number | null; overtimeHours?: number | null; recordedBy: string;
  farmer?: { name: string };
};

/* ── helpers ────────────────────────────────────────────────────────── */

function today() {
  return new Date().toLocaleDateString("en-CA");
}

function shiftDate(ds: string, days: number) {
  const d = new Date(`${ds}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split("T")[0];
}

function mondayOf(ds: string) {
  const d = new Date(`${ds}T00:00:00Z`);
  const day = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
  return shiftDate(ds, -(day - 1));
}

function fmtDate(ds: string) {
  return new Date(`${ds}T00:00:00`).toLocaleDateString("en", { weekday: "short", month: "short", day: "numeric" });
}

function fmtShort(ds: string) {
  return new Date(`${ds}T00:00:00`).toLocaleDateString("en", { month: "short", day: "numeric" });
}

type RoutineStatus = "done" | "partial" | "pending" | "none";

function StatusBadge({ status, t }: { status: RoutineStatus; t: typeof EN | typeof AM }) {
  if (status === "done")
    return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300 gap-1"><CheckCircle2 className="size-3" />{t.routines.done}</Badge>;
  if (status === "none")
    return <Badge className="bg-primary/15 text-primary border-primary/30 gap-1"><CheckCircle2 className="size-3" />{t.routines.noneToday}</Badge>;
  if (status === "partial")
    return <Badge className="bg-amber-100 text-amber-700 border-amber-300 gap-1"><CircleDot className="size-3" />{t.routines.partial}</Badge>;
  return <Badge className="bg-muted text-muted-foreground border-border gap-1"><CircleDashed className="size-3" />{t.routines.pendingStatus}</Badge>;
}

const inputCls = "w-full border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground";

const NOTE_TYPE_STYLE: Record<DailyNoteT["type"], string> = {
  instruction: "bg-blue-100 text-blue-700",
  report: "bg-emerald-100 text-emerald-700",
  issue: "bg-rose-100 text-rose-700",
  note: "bg-muted text-muted-foreground",
};

/* ── page ───────────────────────────────────────────────────────────── */

export default function RoutinesPage() {
  const { user, isManager } = useAuth();
  const { isAm } = useLang();
  const t = isAm ? AM : EN;

  const [view, setView] = useState<"daily" | "weekly">("daily");
  const [date, setDate] = useState(today());
  const [weekStart, setWeekStart] = useState(mondayOf(today()));
  const [daily, setDaily] = useState<DailyData | null>(null);
  const [weekly, setWeekly] = useState<WeeklyData | null>(null);
  const [farmers, setFarmers] = useState<Farmer[]>([]);

  const [wateringOpen, setWateringOpen] = useState(false);
  const [maintOpen, setMaintOpen] = useState(false);
  const [otOpen, setOtOpen] = useState(false);

  const [wateringForm, setWateringForm] = useState({ valveIds: [] as string[], status: "done", startTime: "06:00", durationMin: 25, waterVolumeL: 0, notes: "" });
  const [maintForm, setMaintForm] = useState({ title: "", description: "", assignedTo: "", priority: "medium" });
  const [otRecords, setOtRecords] = useState<AttendanceRec[]>([]);

  const [notes, setNotes] = useState<DailyNoteT[]>([]);
  const [noteBody, setNoteBody] = useState("");
  const [noteType, setNoteType] = useState<DailyNoteT["type"]>("note");
  const [posting, setPosting] = useState(false);

  const [compliance, setCompliance] = useState<ComplianceRow[]>([]);
  const [myTodayCompliance, setMyTodayCompliance] = useState<ComplianceRow | null>(null);
  const [ackTarget, setAckTarget] = useState<{ date: string; supervisorId: string; name: string } | null>(null);
  const [ackNote, setAckNote] = useState("");

  const loadDaily = useCallback(() => {
    fetch(`/api/routines/daily?date=${date}`).then(r => r.json()).then(setDaily);
  }, [date]);

  const loadWeekly = useCallback(() => {
    fetch(`/api/routines/weekly?start=${weekStart}`).then(r => r.json()).then(setWeekly);
  }, [weekStart]);

  const loadNotes = useCallback(async () => {
    const data: DailyNoteT[] = await fetch(`/api/daily-notes?date=${date}`).then(r => r.ok ? r.json() : []);
    setNotes(data);
    // mark unseen notes as read (fire-and-forget)
    const uid = user?.id;
    if (uid) {
      const unseen = data.filter(n => !n.readBy.includes(uid));
      if (unseen.length > 0) {
        await Promise.all(unseen.map(n =>
          fetch(`/api/daily-notes/${n.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ read: true }),
          })));
        setNotes(prev => prev.map(n => n.readBy.includes(uid) ? n : { ...n, readBy: [...n.readBy, uid] }));
      }
    }
  }, [date, user?.id]);

  const loadCompliance = useCallback(() => {
    fetch(`/api/routines/compliance?from=${weekStart}&to=${shiftDate(weekStart, 6)}`)
      .then(r => r.ok ? r.json() : { rows: [] })
      .then(d => setCompliance(d.rows ?? []));
  }, [weekStart]);

  useEffect(() => { loadDaily(); }, [loadDaily]);
  useEffect(() => { loadNotes(); }, [loadNotes]);
  useEffect(() => { if (view === "weekly") { loadWeekly(); loadCompliance(); } }, [view, loadWeekly, loadCompliance]);

  // supervisor's own compliance banner for today
  useEffect(() => {
    if (isManager || !user?.id || date !== today()) { setMyTodayCompliance(null); return; }
    fetch(`/api/routines/compliance?from=${date}&to=${date}`)
      .then(r => r.ok ? r.json() : { rows: [] })
      .then(d => setMyTodayCompliance((d.rows ?? []).find((r: ComplianceRow) => r.supervisorId === user.id) ?? null));
  }, [isManager, user?.id, date, daily]);
  useEffect(() => {
    fetch("/api/farmers").then(r => r.json()).then((all: Farmer[]) => setFarmers(all.filter(f => f.role !== "manager")));
  }, []);

  /* ── "nothing to report today" declarations ── */
  const nilAreas = new Set((daily?.nilReports ?? []).map(n => n.area));
  const nilBy = (area: string) => daily?.nilReports?.find(n => n.area === area);
  // an empty area that's been explicitly declared reads "none" (attended to), not "pending"
  const nilOr = (area: string, base: RoutineStatus): RoutineStatus =>
    base === "pending" && nilAreas.has(area) ? "none" : base;
  // which of the declarable areas actually have activity today (hides the button)
  const activity = {
    fertigation: !!daily && (daily.fertigation.applied > 0 || daily.fertigation.scheduled > 0 || daily.fertigation.treatmentsApplied > 0),
    harvest:     !!daily && daily.harvest.records > 0,
    maintenance: !!daily && daily.maintenance.total > 0,
    sales:       !!daily && daily.sales.orders > 0,
    store:       !!daily && (daily.stock.inCount + daily.stock.outCount) > 0,
  };

  /* ── statuses ── */
  const statuses: Record<string, RoutineStatus> = daily ? {
    attendance: daily.attendance.marked === 0 ? "pending" : daily.attendance.marked < daily.attendance.totalWorkers ? "partial" : "done",
    watering: daily.watering.valvesWatered === 0 ? "pending" : daily.watering.valvesWatered < daily.watering.totalValves ? "partial" : "done",
    fertigation: nilOr("fertigation", daily.fertigation.scheduled > 0 ? "partial" : (daily.fertigation.applied > 0 || daily.fertigation.treatmentsApplied > 0) ? "done" : "pending"),
    harvest: nilOr("harvest", daily.harvest.records > 0 ? "done" : "pending"),
    maintenance: nilOr("maintenance", daily.maintenance.total === 0 ? "pending" : daily.maintenance.done === daily.maintenance.total ? "done" : "partial"),
    sales: nilOr("sales", daily.sales.orders > 0 ? "done" : "pending"),
    stock: nilOr("store", (daily.stock.inCount + daily.stock.outCount) > 0 ? "done" : "pending"),
    overtime: daily.overtime.workers > 0 ? "done" : "pending",
  } : {};
  const doneCount = Object.values(statuses).filter(s => s === "done" || s === "none").length;

  async function declareNil(area: string) {
    const res = await fetch("/api/routines/nil", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, area }),
    });
    if (!res.ok) { toast.error("Couldn't save that"); return; }
    toast.success(t.routines.noneMarked);
    loadDaily();
  }
  async function undoNil(area: string) {
    const res = await fetch("/api/routines/nil", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, area }),
    });
    if (!res.ok) { toast.error("Couldn't undo that"); return; }
    loadDaily();
  }

  // the "no activity → declare / declared" row shown at the bottom of activity cards
  function NilRow({ area, active }: { area: string; active: boolean }) {
    if (active) return null;
    const nr = nilBy(area);
    if (nr) return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1.5 mt-1">
        <span className="text-[11px] text-primary font-medium flex items-center gap-1 min-w-0">
          <CheckCircle2 className="size-3 shrink-0" /> <span className="truncate">{t.routines.noneToday} · {nr.by}</span>
        </span>
        <button onClick={() => undoNil(area)} className="text-[10px] text-muted-foreground hover:text-foreground shrink-0">{isAm ? "ተመለስ" : "Undo"}</button>
      </div>
    );
    return (
      <Button variant="outline" size="sm" className="w-full gap-1 mt-1 border-dashed text-muted-foreground" onClick={() => declareNil(area)}>
        <CheckCircle2 className="size-3" /> {t.routines.markNoneToday}
      </Button>
    );
  }

  /* ── actions ── */
  async function saveWatering() {
    if (wateringForm.valveIds.length === 0) { toast.error("Select at least one valve"); return; }
    // one irrigation log per selected valve — whole-farm watering in one entry
    const { valveIds, ...rest } = wateringForm;
    let saved = 0;
    const failed: string[] = [];
    for (const valveId of valveIds) {
      try {
        const res = await fetch("/api/irrigation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...rest,
            valveId,
            durationMin: Number(rest.durationMin),
            waterVolumeL: Number(rest.waterVolumeL) || undefined,
            notes: rest.notes || undefined,
            date,
            recordedBy: user?.id,
          }),
        });
        if (!res.ok) { failed.push(valveId); continue; }
        saved++;
      } catch {
        failed.push(valveId);
      }
    }
    if (failed.length) {
      // dialog stays open with only the failed valves selected — retry-safe
      setWateringForm(f => ({ ...f, valveIds: failed }));
      toast.error(`${saved} of ${valveIds.length} valves saved — ${failed.join(", ")} failed and stay selected. Press Save to retry.`);
      loadDaily();
      return;
    }
    toast.success(saved === 1 ? "Watering logged" : `Watering logged for ${saved} valves`);
    setWateringOpen(false);
    loadDaily();
  }

  async function saveMaintTask() {
    if (!maintForm.title.trim()) { toast.error("Title is required"); return; }
    if (!maintForm.assignedTo) { toast.error("Select an assignee"); return; }
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: maintForm.title,
        description: maintForm.description || maintForm.title,
        assignedTo: maintForm.assignedTo,
        createdBy: user?.id,
        priority: maintForm.priority,
        category: "maintenance",
        dueDate: date,
      }),
    });
    if (!res.ok) { toast.error("Failed to create task"); return; }
    toast.success("Maintenance task created");
    setMaintOpen(false);
    setMaintForm({ title: "", description: "", assignedTo: "", priority: "medium" });
    loadDaily();
  }

  async function openOvertime() {
    const recs: AttendanceRec[] = await fetch(`/api/attendance?date=${date}`).then(r => r.json());
    const workedToday = recs.filter(r => r.status === "present" || r.status === "late");
    if (workedToday.length === 0) {
      toast.error("No attendance marked yet", { description: "Mark attendance first, then record overtime." });
      return;
    }
    setOtRecords(workedToday);
    setOtOpen(true);
  }

  async function saveOvertime() {
    const payload = otRecords.map(r => ({
      farmerId: r.farmerId,
      date: r.date,
      status: r.status,
      checkInTime: r.checkInTime ?? undefined,
      checkOutTime: r.checkOutTime ?? undefined,
      hoursWorked: r.hoursWorked ?? undefined,
      overtimeHours: Number(r.overtimeHours) || 0,
      recordedBy: r.recordedBy ?? user?.id,
    }));
    const res = await fetch("/api/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) { toast.error("Failed to save overtime"); return; }
    toast.success("Overtime hours saved");
    setOtOpen(false);
    loadDaily();
  }

  async function postNote() {
    if (posting || !noteBody.trim()) return;
    setPosting(true);
    const res = await fetch("/api/daily-notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, type: noteType, body: noteBody }),
    });
    setPosting(false);
    if (!res.ok) { toast.error("Failed to post note"); return; }
    const created: DailyNoteT = await res.json();
    setNotes(prev => [...prev, created]);
    setNoteBody("");
  }

  async function togglePin(n: DailyNoteT) {
    const res = await fetch(`/api/daily-notes/${n.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned: !n.pinned }),
    });
    if (!res.ok) { toast.error("Failed to update pin"); return; }
    loadNotes();
  }

  async function deleteNote(n: DailyNoteT) {
    const res = await fetch(`/api/daily-notes/${n.id}`, { method: "DELETE" });
    if (!res.ok) { toast.error("Failed to delete note"); return; }
    setNotes(prev => prev.filter(p => p.id !== n.id));
  }

  async function acknowledgeDay() {
    if (!ackTarget) return;
    const res = await fetch("/api/routines/compliance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: ackTarget.date, supervisorId: ackTarget.supervisorId, note: ackNote || undefined }),
    });
    if (!res.ok) { toast.error("Failed to acknowledge day"); return; }
    toast.success(`${ackTarget.name}'s ${ackTarget.date} acknowledged as worked`);
    setAckTarget(null);
    setAckNote("");
    loadCompliance();
    loadWeekly();
  }

  const noteTypeLabel = (ty: DailyNoteT["type"]) =>
    ty === "instruction" ? t.routines.typeInstruction
    : ty === "report" ? t.routines.typeReport
    : ty === "issue" ? t.routines.typeIssue
    : t.routines.typeNote;

  function exportOvertimeCsv() {
    if (!weekly) return;
    const header = "Worker,Days Worked,Hours Worked,Overtime Hours,Daily Wage (ETB),Overtime Pay (ETB)";
    const rows = weekly.overtime.workers.map(w =>
      [w.name, w.daysWorked, w.hoursWorked, w.overtimeHours, w.dailyWage, w.overtimePay].join(","));
    const csv = [header, ...rows, `TOTAL,,,${weekly.overtime.totalHours},,${weekly.overtime.totalPayETB}`].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `overtime-week-${weekly.start}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  /* ── render ── */
  return (
    <div className="p-6 md:p-8 max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ClipboardCheck className="size-5 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">{t.routines.title}</h1>
          </div>
          <p className="text-muted-foreground text-sm">{t.routines.subtitle}</p>
        </div>
        {/* weekly view carries financials + wages → managers only */}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-muted">
          {(isManager ? (["daily", "weekly"] as const) : (["daily"] as const)).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${view === v ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              {v === "daily" ? t.routines.dailyTab : t.routines.weeklyTab}
            </button>
          ))}
        </div>
      </div>

      {view === "daily" ? (
        <>
          {/* Date bar + progress */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" className="size-8" onClick={() => setDate(shiftDate(date, -1))}><ChevronLeft className="size-4" /></Button>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className={`${inputCls} w-auto`} />
              <Button variant="outline" size="icon" className="size-8" onClick={() => setDate(shiftDate(date, 1))} disabled={date >= today()}><ChevronRight className="size-4" /></Button>
              {date !== today() && <Button variant="ghost" size="sm" onClick={() => setDate(today())}>Today</Button>}
            </div>
            {daily && (
              <div className="flex items-center gap-3">
                <div className="text-sm text-muted-foreground">{fmtDate(date)}</div>
                <Badge className="bg-primary/10 text-primary border-primary/25 text-sm px-3 py-1">
                  {doneCount}/8 {t.routines.completedOf}
                </Badge>
              </div>
            )}
          </div>

          {/* Supervisor: no-routines-today warning */}
          {myTodayCompliance && !myTodayCompliance.recorded && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-800">
              <CircleDot className="size-5 shrink-0 mt-0.5 text-amber-500" />
              <div className="text-sm">
                <div className="font-bold">{t.routines.pendingToday}</div>
                <div className="text-xs mt-0.5">{t.routines.noRoutinesToday}</div>
              </div>
            </div>
          )}

          {/* Checklist + Day Log */}
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-4 items-start">
          {daily && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {/* 1. Attendance */}
              <Card className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2"><CalendarCheck className="size-4 text-blue-500" /><span className="font-semibold text-sm">{t.routines.attendance}</span></div>
                  <StatusBadge status={statuses.attendance} t={t} />
                </div>
                <div className="text-2xl font-bold">{daily.attendance.marked}<span className="text-sm text-muted-foreground font-normal"> / {daily.attendance.totalWorkers} marked</span></div>
                <div className="text-xs text-muted-foreground">
                  {daily.attendance.present} present · {daily.attendance.absent} absent
                  {daily.attendance.unmarked.length > 0 && (
                    <div className="mt-1 text-amber-600">Unmarked: {daily.attendance.unmarked.slice(0, 3).join(", ")}{daily.attendance.unmarked.length > 3 ? ` +${daily.attendance.unmarked.length - 3}` : ""}</div>
                  )}
                </div>
                <Link href="/attendance"><Button variant="outline" size="sm" className="w-full gap-1 mt-1"><ExternalLink className="size-3" /> Open Attendance</Button></Link>
              </Card>

              {/* 2. Watering */}
              <Card className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2"><Droplets className="size-4 text-sky-500" /><span className="font-semibold text-sm">{t.routines.watering}</span></div>
                  <StatusBadge status={statuses.watering} t={t} />
                </div>
                <div className="text-2xl font-bold">{daily.watering.valvesWatered}<span className="text-sm text-muted-foreground font-normal"> / {daily.watering.totalValves} valves</span></div>
                <div className="flex flex-wrap gap-1">
                  {daily.watering.valves.map(v => (
                    <span key={v.id} title={v.schedule}
                      className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${v.watered ? "bg-emerald-50 text-emerald-700 border-emerald-300" : "bg-muted text-muted-foreground border-border"}`}>
                      {v.name} {v.watered ? "✓" : "—"}
                    </span>
                  ))}
                </div>
                <Button size="sm" className="w-full gap-1" onClick={() => { const un = daily.watering.valves.filter(v => !v.watered).map(v => v.id); setWateringForm({ valveIds: un.length ? un : daily.watering.valves.slice(0, 1).map(v => v.id), status: "done", startTime: "06:00", durationMin: 25, waterVolumeL: 0, notes: "" }); setWateringOpen(true); }}>
                  <Plus className="size-3" /> {t.routines.logWatering}
                </Button>
              </Card>

              {/* 3. Fertilization & Treatment */}
              <Card className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2"><Beaker className="size-4 text-violet-500" /><span className="font-semibold text-sm">{t.routines.fertigation}</span></div>
                  <StatusBadge status={statuses.fertigation} t={t} />
                </div>
                <div className="text-2xl font-bold">{daily.fertigation.applied}<span className="text-sm text-muted-foreground font-normal"> applied</span></div>
                <div className="text-xs text-muted-foreground">
                  {daily.fertigation.scheduled} scheduled · {daily.fertigation.treatmentsApplied} treatment{daily.fertigation.treatmentsApplied === 1 ? "" : "s"} applied
                </div>
                <div className="flex gap-2">
                  <Link href="/fertigation" className="flex-1"><Button variant="outline" size="sm" className="w-full gap-1"><ExternalLink className="size-3" /> Fertigation</Button></Link>
                  <Link href="/diseases" className="flex-1"><Button variant="outline" size="sm" className="w-full gap-1"><ExternalLink className="size-3" /> Diseases</Button></Link>
                </div>
                <NilRow area="fertigation" active={activity.fertigation} />
              </Card>

              {/* 4. Harvesting */}
              <Card className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2"><Wheat className="size-4 text-amber-500" /><span className="font-semibold text-sm">{t.routines.harvesting}</span></div>
                  <StatusBadge status={statuses.harvest} t={t} />
                </div>
                <div className="text-2xl font-bold">{daily.harvest.totalKg.toFixed(1)}<span className="text-sm text-muted-foreground font-normal"> kg</span></div>
                <div className="text-xs text-muted-foreground">{daily.harvest.records} record{daily.harvest.records === 1 ? "" : "s"} · {daily.harvest.beds} bed{daily.harvest.beds === 1 ? "" : "s"}</div>
                <Link href="/harvest"><Button variant="outline" size="sm" className="w-full gap-1 mt-1"><ExternalLink className="size-3" /> Open Harvest Log</Button></Link>
                <NilRow area="harvest" active={activity.harvest} />
              </Card>

              {/* 5. Maintenance */}
              <Card className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2"><Shovel className="size-4 text-orange-500" /><span className="font-semibold text-sm">{t.routines.maintenance}</span></div>
                  <StatusBadge status={statuses.maintenance} t={t} />
                </div>
                <div className="text-2xl font-bold">{daily.maintenance.done}<span className="text-sm text-muted-foreground font-normal"> / {daily.maintenance.total} tasks done</span></div>
                <div className="text-xs text-muted-foreground space-y-0.5 max-h-16 overflow-y-auto">
                  {daily.maintenance.tasks.slice(0, 3).map(task => (
                    <div key={task.id} className="truncate">{task.status === "done" ? "✓" : "○"} {task.title}</div>
                  ))}
                  {daily.maintenance.total === 0 && <span>No maintenance tasks for this day</span>}
                </div>
                <Button size="sm" variant="outline" className="w-full gap-1" onClick={() => setMaintOpen(true)}>
                  <Plus className="size-3" /> {t.routines.addMaintTask}
                </Button>
                <NilRow area="maintenance" active={activity.maintenance} />
              </Card>

              {/* 6. Sales */}
              <Card className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2"><ShoppingCart className="size-4 text-emerald-600" /><span className="font-semibold text-sm">{t.routines.sales}</span></div>
                  <StatusBadge status={statuses.sales} t={t} />
                </div>
                {/* money & orders link are manager-only */}
                <div className="text-2xl font-bold">
                  {isManager ? <>{daily.sales.totalETB.toLocaleString()}<span className="text-sm text-muted-foreground font-normal"> ETB</span></>
                    : <>{daily.sales.orders}<span className="text-sm text-muted-foreground font-normal"> order{daily.sales.orders === 1 ? "" : "s"}</span></>}
                </div>
                <div className="text-xs text-muted-foreground">{daily.sales.orders} order{daily.sales.orders === 1 ? "" : "s"} · {daily.sales.totalKg.toFixed(1)} kg</div>
                {isManager && <Link href="/orders"><Button variant="outline" size="sm" className="w-full gap-1 mt-1"><ExternalLink className="size-3" /> Open Orders</Button></Link>}
                <NilRow area="sales" active={activity.sales} />
              </Card>

              {/* 7. Store */}
              <Card className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2"><Warehouse className="size-4 text-teal-600" /><span className="font-semibold text-sm">{t.routines.store}</span></div>
                  <StatusBadge status={statuses.stock} t={t} />
                </div>
                <div className="text-2xl font-bold">{daily.stock.inCount + daily.stock.outCount}<span className="text-sm text-muted-foreground font-normal"> movements</span></div>
                <div className="text-xs text-muted-foreground space-y-0.5 max-h-16 overflow-y-auto">
                  {daily.stock.transactions.slice(0, 3).map(txn => (
                    <div key={txn.id} className="truncate">
                      <span className={txn.type === "stock_in" ? "text-emerald-600" : "text-rose-600"}>{txn.type === "stock_in" ? "IN" : "OUT"}</span> {txn.item} · {txn.quantity} {txn.unit}
                    </div>
                  ))}
                  {daily.stock.transactions.length === 0 && <span>No movements recorded</span>}
                </div>
                <Link href="/stock"><Button variant="outline" size="sm" className="w-full gap-1"><ExternalLink className="size-3" /> Open Store</Button></Link>
                <NilRow area="store" active={activity.store} />
              </Card>

              {/* 8. Overtime */}
              <Card className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2"><Clock className="size-4 text-indigo-500" /><span className="font-semibold text-sm">{t.routines.overtime}</span></div>
                  <StatusBadge status={statuses.overtime} t={t} />
                </div>
                <div className="text-2xl font-bold">{daily.overtime.totalHours.toFixed(1)}<span className="text-sm text-muted-foreground font-normal"> h · {daily.overtime.workers} worker{daily.overtime.workers === 1 ? "" : "s"}</span></div>
                <div className="text-xs text-muted-foreground space-y-0.5 max-h-16 overflow-y-auto">
                  {daily.overtime.records.slice(0, 3).map(r => (
                    <div key={r.farmerId} className="truncate">{r.name}: {r.hours}h</div>
                  ))}
                  {daily.overtime.records.length === 0 && <span>No overtime recorded</span>}
                </div>
                <Button size="sm" className="w-full gap-1" onClick={openOvertime}>
                  <Plus className="size-3" /> {t.routines.recordOvertime}
                </Button>
              </Card>
            </div>
          )}

          {/* ── Day Log: manager ↔ supervisor communication ── */}
          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="size-4 text-primary" />
                <div>
                  <div className="font-semibold text-sm">{t.routines.dayLog}</div>
                  <div className="text-[11px] text-muted-foreground">{t.routines.dayLogSub}</div>
                </div>
              </div>
              <Badge variant="outline">{notes.length}</Badge>
            </div>

            <div className="space-y-2 max-h-[430px] overflow-y-auto pr-1">
              {notes.length === 0 && (
                <p className="text-xs text-muted-foreground py-6 text-center">{t.routines.noNotes}</p>
              )}
              {notes.map(n => (
                <div key={n.id} className={`rounded-lg border p-2.5 space-y-1.5 ${n.pinned ? "border-amber-500/40 bg-amber-500/10" : "border-border bg-muted/30"}`}>
                  <div className="flex items-center gap-2">
                    <div className={`size-6 shrink-0 rounded-full grid place-items-center text-[9px] font-bold text-white ${n.author.role === "manager" ? "bg-amber-500" : "bg-blue-500"}`}>
                      {n.author.avatar}
                    </div>
                    <div className="flex-1 min-w-0 truncate">
                      <span className="text-xs font-semibold">{n.author.name}</span>
                      <span className="text-[10px] text-muted-foreground ml-1 capitalize">{n.author.role}</span>
                    </div>
                    {n.pinned && <Pin className="size-3 text-amber-500 shrink-0" />}
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase shrink-0 ${NOTE_TYPE_STYLE[n.type]}`}>
                      {noteTypeLabel(n.type)}
                    </span>
                  </div>
                  <p className="text-xs whitespace-pre-wrap break-words">{n.body}</p>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>
                      {new Date(n.createdAt).toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" })}
                      {n.valve ? ` · ${n.valve.name}` : ""}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="flex items-center gap-0.5" title={`${t.routines.seenBy} ${n.readBy.length}`}>
                        <CheckCheck className={`size-3 ${n.readBy.length > 1 ? "text-blue-500" : ""}`} /> {n.readBy.length}
                      </span>
                      {isManager && (
                        <button onClick={() => togglePin(n)} className="hover:text-amber-600" title="Pin / unpin">
                          <Pin className={`size-3 ${n.pinned ? "text-amber-500" : ""}`} />
                        </button>
                      )}
                      {(n.author.id === user?.id || isManager) && (
                        <button onClick={() => deleteNote(n)} className="hover:text-rose-600" title="Delete">
                          <Trash2 className="size-3" />
                        </button>
                      )}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* composer */}
            <div className="space-y-2 pt-2 border-t border-border">
              <div className="flex gap-1 flex-wrap">
                {(["instruction", "report", "issue", "note"] as const).map(ty => (
                  <button key={ty} onClick={() => setNoteType(ty)}
                    className={`text-[10px] font-semibold px-2 py-1 rounded-full border transition-all ${noteType === ty ? NOTE_TYPE_STYLE[ty] + " border-transparent ring-1 ring-primary/40" : "border-border text-muted-foreground hover:text-foreground"}`}>
                    {noteTypeLabel(ty)}
                  </button>
                ))}
              </div>
              <textarea rows={2} className={inputCls} placeholder={t.routines.notePlaceholder}
                value={noteBody} onChange={e => setNoteBody(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) postNote(); }} />
              <Button size="sm" className="w-full gap-1" disabled={posting || !noteBody.trim()} onClick={postNote}>
                <Send className="size-3" /> {t.routines.postNote}
              </Button>
            </div>
          </Card>
          </div>
        </>
      ) : (
        /* ── Weekly view ── */
        <>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="size-8" onClick={() => setWeekStart(shiftDate(weekStart, -7))}><ChevronLeft className="size-4" /></Button>
            <div className="text-sm font-semibold px-2">{fmtShort(weekStart)} — {fmtShort(shiftDate(weekStart, 6))}</div>
            <Button variant="outline" size="icon" className="size-8" onClick={() => setWeekStart(shiftDate(weekStart, 7))} disabled={weekStart >= mondayOf(today())}><ChevronRight className="size-4" /></Button>
            {weekStart !== mondayOf(today()) && <Button variant="ghost" size="sm" onClick={() => setWeekStart(mondayOf(today()))}>This week</Button>}
          </div>

          {weekly && (
            <>
              {/* Net summary tiles */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card className="p-4">
                  <div className="text-xl font-bold text-emerald-600">{weekly.net.incomeETB.toLocaleString()} ETB</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{t.routines.income} ({weekly.sales.orders} orders)</div>
                </Card>
                <Card className="p-4">
                  <div className="text-xl font-bold text-rose-600">{weekly.net.spendETB.toLocaleString()} ETB</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{t.routines.spend}</div>
                </Card>
                <Card className={`p-4 ${weekly.net.balanceETB >= 0 ? "bg-emerald-50 border-emerald-200" : "bg-rose-50 border-rose-200"}`}>
                  <div className={`text-xl font-bold ${weekly.net.balanceETB >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{weekly.net.balanceETB.toLocaleString()} ETB</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{t.routines.balance}</div>
                </Card>
                <Card className="p-4">
                  <div className="text-xl font-bold">{weekly.harvest.totalKg.toFixed(1)} kg</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Harvest · {weekly.watering.sessions} watering sessions</div>
                </Card>
              </div>

              {/* Store weekly report */}
              <Card className="p-5 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Warehouse className="size-4 text-teal-600" />
                    <h2 className="font-bold text-base">{t.routines.storeReport}</h2>
                  </div>
                  <div className="flex gap-2 text-xs">
                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300">IN {weekly.store.inCount} · {weekly.store.inValueETB.toLocaleString()} ETB</Badge>
                    <Badge className="bg-rose-100 text-rose-700 border-rose-300">OUT {weekly.store.outCount} · {weekly.store.outValueETB.toLocaleString()} ETB</Badge>
                    {weekly.store.wasteCount > 0 && <Badge className="bg-amber-100 text-amber-700 border-amber-300">WASTE {weekly.store.wasteCount}</Badge>}
                  </div>
                </div>
                {weekly.store.movements.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-muted-foreground border-b border-border">
                          <th className="py-2 pr-4">Date</th><th className="py-2 pr-4">Item</th><th className="py-2 pr-4">Type</th>
                          <th className="py-2 pr-4 text-right">Qty</th><th className="py-2 text-right">Value (ETB)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {weekly.store.movements.map(m => (
                          <tr key={m.id} className="border-b border-border/50">
                            <td className="py-1.5 pr-4 whitespace-nowrap">{fmtShort(m.date)}</td>
                            <td className="py-1.5 pr-4">{m.item}</td>
                            <td className="py-1.5 pr-4">
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${m.type === "stock_in" ? "bg-emerald-100 text-emerald-700" : m.type === "waste" ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"}`}>
                                {m.type.replace("stock_", "").toUpperCase()}
                              </span>
                            </td>
                            <td className="py-1.5 pr-4 text-right">{m.quantity} {m.unit}</td>
                            <td className="py-1.5 text-right">{m.valueETB.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No store movements this week.</p>
                )}
                {/* Expenses by category */}
                <div className="flex flex-wrap gap-1.5 pt-1 border-t border-border">
                  <span className="text-xs text-muted-foreground mr-1 mt-1">Expenses ({weekly.expenses.totalETB.toLocaleString()} ETB):</span>
                  {Object.entries(weekly.expenses.byCategory).map(([cat, amt]) => (
                    <Badge key={cat} variant="outline" className="capitalize">{cat}: {amt.toLocaleString()}</Badge>
                  ))}
                  {weekly.expenses.count === 0 && <span className="text-xs text-muted-foreground mt-1">none</span>}
                </div>
              </Card>

              {/* Overtime & payroll */}
              <Card className="p-5 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Clock className="size-4 text-indigo-500" />
                    <h2 className="font-bold text-base">{t.routines.overtimePayroll}</h2>
                  </div>
                  <Button variant="outline" size="sm" className="gap-1" onClick={exportOvertimeCsv}>
                    <Download className="size-3" /> {t.routines.exportCsv}
                  </Button>
                </div>
                {weekly.overtime.workers.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-muted-foreground border-b border-border">
                          <th className="py-2 pr-4">Worker</th>
                          <th className="py-2 pr-4 text-right">Days</th>
                          <th className="py-2 pr-4 text-right">{t.routines.missedLabel}</th>
                          <th className="py-2 pr-4 text-right">Hours</th>
                          <th className="py-2 pr-4 text-right">OT Hours</th>
                          <th className="py-2 pr-4 text-right">Daily Wage</th>
                          <th className="py-2 text-right">OT Pay (ETB)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {weekly.overtime.workers.map(w => (
                          <tr key={w.farmerId} className="border-b border-border/50">
                            <td className="py-1.5 pr-4 font-medium">{w.name}</td>
                            <td className="py-1.5 pr-4 text-right">{w.daysWorked}</td>
                            <td className="py-1.5 pr-4 text-right">
                              {w.missedDays > 0
                                ? <span className="text-rose-600 font-bold">{w.missedDays}</span>
                                : <span className="text-muted-foreground">0</span>}
                            </td>
                            <td className="py-1.5 pr-4 text-right">{w.hoursWorked.toFixed(1)}</td>
                            <td className="py-1.5 pr-4 text-right font-semibold text-indigo-300">{w.overtimeHours.toFixed(1)}</td>
                            <td className="py-1.5 pr-4 text-right">{w.dailyWage.toLocaleString()}</td>
                            <td className="py-1.5 text-right font-semibold">{w.overtimePay.toLocaleString()}</td>
                          </tr>
                        ))}
                        <tr className="font-bold">
                          <td className="py-2 pr-4">Total</td>
                          <td /><td /><td />
                          <td className="py-2 pr-4 text-right text-indigo-300">{weekly.overtime.totalHours.toFixed(1)}</td>
                          <td />
                          <td className="py-2 text-right">{weekly.overtime.totalPayETB.toLocaleString()}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No attendance recorded this week.</p>
                )}
                <p className="text-[11px] text-muted-foreground">
                  OT pay = OT hours × (daily wage ÷ 8) × 1.5 — same formula as the monthly payroll page. Monthly payroll picks these hours up automatically.
                </p>
              </Card>

              {/* ── Supervisor routine compliance ── */}
              <Card className="p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="size-4 text-primary" />
                  <h2 className="font-bold text-base">{t.routines.compliance}</h2>
                </div>
                <p className="text-[11px] text-muted-foreground">{t.routines.complianceRule}</p>
                {(() => {
                  const days = Array.from({ length: 7 }, (_, i) => shiftDate(weekStart, i));
                  const supervisors = [...new Map(compliance.map(r => [r.supervisorId, { id: r.supervisorId, name: r.name }])).values()];
                  const cell = (sid: string, d: string) => compliance.find(r => r.supervisorId === sid && r.date === d);
                  const todayStr = today();
                  return (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs text-muted-foreground border-b border-border">
                            <th className="py-2 pr-4">Supervisor</th>
                            {days.map(d => (
                              <th key={d} className="py-2 px-2 text-center whitespace-nowrap">{fmtShort(d)}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {supervisors.map(s => (
                            <tr key={s.id} className="border-b border-border/50">
                              <td className="py-2 pr-4 font-medium whitespace-nowrap">{s.name}</td>
                              {days.map(d => {
                                const r = cell(s.id, d);
                                if (!r || d > todayStr) {
                                  return <td key={d} className="py-2 px-2 text-center text-muted-foreground/40">·</td>;
                                }
                                if (r.recorded) {
                                  const what = [r.attendance && "attendance", r.watering && "watering", r.dayLog && "day log"].filter(Boolean).join(", ");
                                  return <td key={d} className="py-2 px-2 text-center" title={`${t.routines.recordedLabel}: ${what}`}>
                                    <span className="inline-grid place-items-center size-6 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">✓</span>
                                  </td>;
                                }
                                if (r.acknowledged) {
                                  return <td key={d} className="py-2 px-2 text-center" title={`${t.routines.ackdLabel} by ${r.ackByName}${r.ackNote ? `: ${r.ackNote}` : ""}`}>
                                    <span className="inline-grid place-items-center size-6 rounded-full bg-amber-100 text-amber-700 text-xs font-bold">A</span>
                                  </td>;
                                }
                                if (d === todayStr) {
                                  return <td key={d} className="py-2 px-2 text-center" title={t.routines.pendingToday}>
                                    <span className="inline-grid place-items-center size-6 rounded-full border-2 border-dashed border-amber-400 text-amber-500 text-xs">…</span>
                                  </td>;
                                }
                                return <td key={d} className="py-2 px-2 text-center">
                                  {isManager ? (
                                    <button
                                      onClick={() => { setAckTarget({ date: d, supervisorId: s.id, name: s.name }); setAckNote(""); }}
                                      title={`${t.routines.missedLabel} — ${t.routines.ackDay}`}
                                      className="inline-grid place-items-center size-6 rounded-full bg-rose-100 text-rose-700 text-xs font-bold hover:ring-2 hover:ring-rose-400 transition-all">
                                      ✗
                                    </button>
                                  ) : (
                                    <span className="inline-grid place-items-center size-6 rounded-full bg-rose-100 text-rose-700 text-xs font-bold" title={t.routines.missedLabel}>✗</span>
                                  )}
                                </td>;
                              })}
                            </tr>
                          ))}
                          {supervisors.length === 0 && (
                            <tr><td colSpan={8} className="py-4 text-center text-xs text-muted-foreground">No supervisors found.</td></tr>
                          )}
                        </tbody>
                      </table>
                      <div className="flex flex-wrap gap-3 mt-3 text-[10px] text-muted-foreground">
                        <span><span className="inline-block size-3 rounded-full bg-emerald-100 border border-emerald-300 mr-1 align-middle" />{t.routines.recordedLabel}</span>
                        <span><span className="inline-block size-3 rounded-full bg-amber-100 border border-amber-300 mr-1 align-middle" />{t.routines.ackdLabel}</span>
                        <span><span className="inline-block size-3 rounded-full bg-rose-100 border border-rose-300 mr-1 align-middle" />{t.routines.missedLabel}{isManager ? " (click to acknowledge)" : ""}</span>
                      </div>
                    </div>
                  );
                })()}
              </Card>
            </>
          )}
        </>
      )}

      {/* ── Acknowledge day dialog (manager) ── */}
      <Dialog open={!!ackTarget} onOpenChange={o => !o && setAckTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{t.routines.ackDay}</DialogTitle></DialogHeader>
          {ackTarget && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{ackTarget.name}</span> recorded no routines on <span className="font-semibold text-foreground">{fmtDate(ackTarget.date)}</span>.
                Acknowledging counts it as a worked day anyway.
              </p>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Reason (optional)</label>
                <textarea rows={2} className={inputCls} placeholder="e.g. sick day, market trip for the farm…"
                  value={ackNote} onChange={e => setAckNote(e.target.value)} />
              </div>
              <Button className="w-full" onClick={acknowledgeDay}>Acknowledge as worked</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Watering dialog ── */}
      <Dialog open={wateringOpen} onOpenChange={setWateringOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{t.routines.logWatering} — {fmtDate(date)}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Valves — pick one or many</label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {(daily?.watering.valves ?? []).map(v => {
                  const on = wateringForm.valveIds.includes(v.id);
                  return (
                    <button key={v.id} type="button" title={v.schedule}
                      onClick={() => setWateringForm(f => ({ ...f, valveIds: on ? f.valveIds.filter(x => x !== v.id) : [...f.valveIds, v.id] }))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition-all ${on ? "text-white" : "border-border text-muted-foreground bg-card"}`}
                      style={on ? { background: v.color, borderColor: v.color } : {}}>
                      {v.name}{v.watered ? " ✓" : ""}
                    </button>
                  );
                })}
              </div>
              <div className="text-[10px] text-muted-foreground mt-1">✓ = already logged today. Same time/duration is recorded for each selected valve.</div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Status</label>
                <select className={inputCls} value={wateringForm.status} onChange={e => setWateringForm(f => ({ ...f, status: e.target.value }))}>
                  <option value="done">Done</option>
                  <option value="partial">Partial</option>
                  <option value="skipped">Skipped</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Start time</label>
                <input type="time" className={inputCls} value={wateringForm.startTime} onChange={e => setWateringForm(f => ({ ...f, startTime: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Duration (min)</label>
                <input type="number" min={0} className={inputCls} value={wateringForm.durationMin} onChange={e => setWateringForm(f => ({ ...f, durationMin: Number(e.target.value) }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Water (L, optional)</label>
                <input type="number" min={0} className={inputCls} value={wateringForm.waterVolumeL} onChange={e => setWateringForm(f => ({ ...f, waterVolumeL: Number(e.target.value) }))} />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Notes</label>
              <textarea rows={2} className={inputCls} value={wateringForm.notes} onChange={e => setWateringForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <Button className="w-full" onClick={saveWatering}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Maintenance task dialog ── */}
      <Dialog open={maintOpen} onOpenChange={setMaintOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{t.routines.maintenance} — {fmtDate(date)}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Title</label>
              <input className={inputCls} placeholder="e.g. Clear dry leaves — Valve A" value={maintForm.title} onChange={e => setMaintForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Description</label>
              <textarea rows={2} className={inputCls} value={maintForm.description} onChange={e => setMaintForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Assign to</label>
                <select className={inputCls} value={maintForm.assignedTo} onChange={e => setMaintForm(f => ({ ...f, assignedTo: e.target.value }))}>
                  <option value="">Select…</option>
                  {farmers.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Priority</label>
                <select className={inputCls} value={maintForm.priority} onChange={e => setMaintForm(f => ({ ...f, priority: e.target.value }))}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>
            <Button className="w-full" onClick={saveMaintTask}>Create Task</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Overtime dialog ── */}
      <Dialog open={otOpen} onOpenChange={setOtOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{t.routines.recordOvertime} — {fmtDate(date)}</DialogTitle></DialogHeader>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {otRecords.map((r, i) => (
              <div key={r.farmerId} className="flex items-center justify-between gap-3">
                <div className="text-sm">
                  <div className="font-medium">{r.farmer?.name ?? r.farmerId}</div>
                  <div className="text-[11px] text-muted-foreground capitalize">{r.status} · {r.hoursWorked ?? 0}h worked</div>
                </div>
                <div className="flex items-center gap-1">
                  <input type="number" min={0} max={12} step={0.5} className={`${inputCls} w-20 text-right`}
                    value={r.overtimeHours ?? 0}
                    onChange={e => setOtRecords(prev => prev.map((p, pi) => pi === i ? { ...p, overtimeHours: Number(e.target.value) } : p))} />
                  <span className="text-xs text-muted-foreground">h</span>
                </div>
              </div>
            ))}
          </div>
          <Button className="w-full" onClick={saveOvertime}>Save Overtime</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
