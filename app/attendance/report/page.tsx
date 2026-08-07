"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  BarChart3, ChevronLeft, ChevronRight, Download, Printer, AlertTriangle,
  CheckCircle2, Clock, XCircle, Palmtree, CalendarCheck, ArrowLeft, CircleSlash,
} from "lucide-react";
import type { AttendanceRecord, AttendanceStatus } from "@/lib/types";
import { useReference } from "@/lib/reference";
import { isWorking, isHalfDay } from "@/lib/attendance";
import {
  buildReport, rangeFor, shift, eachDate, sessionsOf, iso,
  type Cadence, type PersonRow,
} from "@/lib/attendance-report";

/* ── cell colours, one language across every view ─────────────────────────── */
const CELL: Record<string, string> = {
  present: "bg-primary",
  late:    "bg-amber-400",
  absent:  "bg-red-400",
  leave:   "bg-slate-300",
};
const LEGEND: { key: string; label: string; icon: React.ElementType }[] = [
  { key: "present", label: "Present", icon: CheckCircle2 },
  { key: "late",    label: "Late",    icon: Clock },
  { key: "absent",  label: "Absent",  icon: XCircle },
  { key: "leave",   label: "Leave",   icon: Palmtree },
];

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function fmtDay(d: string) {
  return new Date(`${d}T00:00:00`).toLocaleDateString("en", { weekday: "short", day: "numeric" });
}

export default function AttendanceReportPage() {
  const { farmers, loaded: refLoaded } = useReference();
  const today = iso(new Date());

  const [cadence, setCadence] = useState<Cadence>("week");
  const [anchor, setAnchor] = useState(today);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const { from, to } = useMemo(() => rangeFor(cadence, anchor), [cadence, anchor]);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/attendance?from=${from}&to=${to}`)
      .then(r => (r.ok ? r.json() : []))
      .then(d => { setRecords(d as AttendanceRecord[]); setLoading(false); });
  }, [from, to]);

  const { rows, totals } = useMemo(
    () => buildReport(records, farmers, from, to),
    [records, farmers, from, to],
  );

  const periodLabel = useMemo(() => {
    if (cadence === "day") return new Date(`${from}T00:00:00`).toLocaleDateString("en", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    if (cadence === "week") return `${new Date(`${from}T00:00:00`).toLocaleDateString("en", { day: "numeric", month: "short" })} — ${new Date(`${to}T00:00:00`).toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric" })}`;
    return new Date(`${from}T00:00:00`).toLocaleDateString("en", { month: "long", year: "numeric" });
  }, [cadence, from, to]);

  function exportCsv() {
    const header = "Staff,Role,Expected days,Days worked,Half days,Late,Absent,Leave,Not recorded,Hours,Overtime,Attendance %";
    const lines = rows.map(r => [
      r.farmer.name, r.farmer.jobTitle || r.farmer.role, r.expectedDays, r.daysWorked,
      r.halfDays, r.lateCount, r.absentDays, r.leaveDays, r.missingDays,
      r.hours, r.overtime, r.attendancePct ?? "",
    ].join(","));
    const blob = new Blob([[`Attendance ${from} to ${to}`, header, ...lines].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `attendance-${cadence}-${from}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  if (!refLoaded) return <div className="p-8 text-muted-foreground text-sm">Loading…</div>;

  const noData = totals.workingDays.length === 0;

  return (
    <div className="p-6 md:p-8 max-w-[1200px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap no-print">
        <div>
          <Link href="/attendance" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-1">
            <ArrowLeft className="size-3" /> Back to register
          </Link>
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="size-5 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Attendance Report</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            Working days are counted from what was actually recorded — a day nobody took attendance is not counted against anyone.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={exportCsv}>
            <Download className="size-3.5" /> Export CSV
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => window.print()}>
            <Printer className="size-3.5" /> Print
          </Button>
        </div>
      </div>

      {/* Period controls */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="inline-flex rounded-lg border border-border overflow-hidden no-print">
          {(["day", "week", "month"] as Cadence[]).map(c => (
            <button
              key={c}
              onClick={() => { setCadence(c); setAnchor(today); }}
              className={`px-4 py-1.5 text-xs font-semibold capitalize transition-colors ${
                cadence === c ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-accent"
              }`}
            >
              {c === "day" ? "Daily" : c === "week" ? "Weekly" : "Monthly"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="size-8 p-0 no-print" onClick={() => setAnchor(a => shift(cadence, a, -1))}>
            <ChevronLeft className="size-4" />
          </Button>
          <div className="text-sm font-semibold text-foreground min-w-[220px] text-center tabular-nums">{periodLabel}</div>
          <Button variant="outline" size="sm" className="size-8 p-0 no-print" onClick={() => setAnchor(a => shift(cadence, a, 1))}>
            <ChevronRight className="size-4" />
          </Button>
          <Button variant="outline" size="sm" className="text-xs no-print" onClick={() => setAnchor(today)}>Today</Button>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-muted-foreground text-sm">Loading…</div>
      ) : noData ? (
        <Card className="p-10 text-center border border-border">
          <CircleSlash className="size-8 text-muted-foreground mx-auto mb-3" />
          <div className="font-semibold text-foreground mb-1">No attendance taken in this period</div>
          <p className="text-sm text-muted-foreground">
            Nothing was recorded between {from} and {to}, so there is nothing to report —
            and nobody is counted as missing.
          </p>
        </Card>
      ) : (
        <>
          {/* KPI strip */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <Kpi label="Attendance" value={totals.attendancePct !== null ? `${totals.attendancePct}%` : "—"} tone="primary"
                 sub={`${totals.daysWorked} of ${totals.expectedDays} days`} />
            <Kpi label="Punctuality" value={totals.punctualityPct !== null ? `${totals.punctualityPct}%` : "—"} tone="blue"
                 sub={`${totals.lateCount} late`} />
            <Kpi label="Hours" value={`${totals.hours}`} tone="slate" sub={`${totals.overtime}h overtime`} />
            <Kpi label="Half days" value={`${totals.halfDays}`} tone="indigo" sub="one session only" />
            <Kpi label="Absent" value={`${totals.absentDays}`} tone="red" sub={`${totals.leaveDays} on leave`} />
            <Kpi label="Not recorded" value={`${totals.missingDays}`} tone={totals.missingDays > 0 ? "amber" : "slate"}
                 sub={`${totals.workingDays.length} working days`} />
          </div>

          {/* Gap warning — the thing managers actually miss */}
          {totals.missingDays > 0 && (
            <Card className="border border-amber-300 bg-amber-50 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="size-4 text-amber-600 mt-0.5 shrink-0" />
                <div className="text-sm">
                  <div className="font-semibold text-amber-900 mb-1">
                    {totals.missingDays} person-day{totals.missingDays === 1 ? "" : "s"} not recorded
                  </div>
                  <p className="text-amber-800 text-xs">
                    Attendance was taken on those days, but these people have no entry — so their
                    day is neither paid nor explained. Fix them on the register before payroll.
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {rows.filter(r => r.missingDays > 0).map(r => (
                      <span key={r.farmer.id} className="text-[11px] bg-white border border-amber-300 rounded px-1.5 py-0.5 text-amber-900">
                        {r.farmer.name} · {r.missingDays}d
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          )}

          {cadence === "day"   && <DailyView rows={rows} date={from} />}
          {cadence === "week"  && <GridView rows={rows} dates={eachDate(from, to)} workingDays={totals.workingDays} showDow />}
          {cadence === "month" && <GridView rows={rows} dates={eachDate(from, to)} workingDays={totals.workingDays} compact />}

          {/* Per-person summary — payroll-grade, same in every cadence */}
          <Card className="border border-border shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border font-semibold text-foreground">
              Per-person summary
            </div>
            <div className="overflow-x-auto">
              <table className="w-full pro-table">
                <thead>
                  <tr>
                    <th>Staff</th><th>Expected</th><th>Worked</th><th>Half</th>
                    <th>Late</th><th>Absent</th><th>Leave</th><th>Not rec.</th>
                    <th>Hours</th><th>OT</th><th>Attendance</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.farmer.id}>
                      <td>
                        <div className="flex items-center gap-2">
                          <Avatar className="size-6"><AvatarFallback className="bg-muted text-muted-foreground text-[10px] font-bold">{r.farmer.avatar}</AvatarFallback></Avatar>
                          <div>
                            <div className="font-medium text-sm flex items-center gap-1.5">
                              {r.farmer.name}
                              {r.farmer.archivedAt && (
                                <span className="text-[9px] uppercase tracking-wide text-muted-foreground border border-border rounded px-1 py-px">left</span>
                              )}
                            </div>
                            <div className="text-[10px] text-muted-foreground capitalize">{r.farmer.jobTitle || r.farmer.role}</div>
                          </div>
                        </div>
                      </td>
                      <td className="tabular-nums text-foreground/70">{r.expectedDays}</td>
                      <td className="tabular-nums font-semibold">{r.daysWorked}</td>
                      <td className="tabular-nums text-foreground/70">{r.halfDays || "—"}</td>
                      <td className="tabular-nums text-foreground/70">{r.lateCount || "—"}</td>
                      <td className="tabular-nums text-foreground/70">{r.absentDays || "—"}</td>
                      <td className="tabular-nums text-foreground/70">{r.leaveDays || "—"}</td>
                      <td className={`tabular-nums ${r.missingDays > 0 ? "text-amber-600 font-semibold" : "text-foreground/70"}`}>{r.missingDays || "—"}</td>
                      <td className="tabular-nums text-foreground/70">{r.hours}</td>
                      <td className="tabular-nums text-foreground/70">
                        {r.overtime > 0 ? <span className="text-indigo-600 font-semibold">{r.overtime}</span> : "—"}
                      </td>
                      <td>
                        {r.attendancePct !== null ? (
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-14 rounded-full bg-muted overflow-hidden">
                              <div className={`h-full ${r.attendancePct >= 90 ? "bg-primary" : r.attendancePct >= 70 ? "bg-amber-400" : "bg-red-400"}`}
                                   style={{ width: `${r.attendancePct}%` }} />
                            </div>
                            <span className="tabular-nums text-xs font-semibold">{r.attendancePct}%</span>
                          </div>
                        ) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

/* ── KPI tile ─────────────────────────────────────────────────────────────── */
function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone: string }) {
  const tones: Record<string, string> = {
    primary: "bg-primary/10 border-primary/30 text-primary",
    blue:    "bg-blue-50 border-blue-200 text-blue-700",
    red:     "bg-red-50 border-red-200 text-red-700",
    amber:   "bg-amber-50 border-amber-200 text-amber-700",
    indigo:  "bg-indigo-50 border-indigo-200 text-indigo-700",
    slate:   "bg-muted border-border text-foreground/80",
  };
  return (
    <Card className={`p-4 ${tones[tone] ?? tones.slate}`}>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-xs font-medium mt-0.5">{label}</div>
      {sub && <div className="text-[10px] opacity-70 mt-0.5 tabular-nums">{sub}</div>}
    </Card>
  );
}

/* ── Daily: roll call, split by session ───────────────────────────────────── */
function DailyView({ rows, date }: { rows: PersonRow[]; date: string }) {
  const bucket = (session: "morning" | "afternoon") => {
    const out: Record<string, PersonRow[]> = { present: [], late: [], absent: [], leave: [], missing: [] };
    for (const r of rows) {
      const rec = r.byDate.get(date);
      if (!rec) { out.missing.push(r); continue; }
      const s = sessionsOf(rec)[session] as AttendanceStatus | undefined;
      if (s && out[s]) out[s].push(r);
    }
    return out;
  };

  const Column = ({ title, session }: { title: string; session: "morning" | "afternoon" }) => {
    const b = bucket(session);
    return (
      <div className="flex-1 min-w-[260px]">
        <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-3">{title}</div>
        <div className="space-y-3">
          {LEGEND.map(({ key, label, icon: Icon }) => (
            <div key={key}>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground/70 mb-1.5">
                <Icon className="size-3" /> {label}
                <span className="tabular-nums text-muted-foreground">({b[key].length})</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {b[key].length === 0 && <span className="text-[11px] text-muted-foreground">—</span>}
                {b[key].map(r => (
                  <span key={r.farmer.id} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card pl-1 pr-2 py-0.5">
                    <span className={`size-4 rounded-full ${CELL[key]}`} />
                    <span className="text-[11px] font-medium">{r.farmer.name}</span>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const missing = rows.filter(r => !r.byDate.get(date));

  return (
    <Card className="border border-border shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <CalendarCheck className="size-4 text-primary" />
        <h3 className="font-semibold text-foreground">Roll call</h3>
      </div>
      <div className="flex gap-8 flex-wrap">
        <Column title="Morning" session="morning" />
        <div className="w-px bg-border self-stretch hidden md:block" />
        <Column title="Afternoon" session="afternoon" />
      </div>
      {missing.length > 0 && (
        <div className="mt-5 pt-4 border-t border-border">
          <div className="text-[11px] font-semibold text-amber-700 mb-1.5">Not recorded ({missing.length})</div>
          <div className="flex flex-wrap gap-1.5">
            {missing.map(r => (
              <span key={r.farmer.id} className="text-[11px] border border-amber-300 bg-amber-50 text-amber-900 rounded px-1.5 py-0.5">
                {r.farmer.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

/* ── Weekly / Monthly: person × day grid, each cell split by session ──────── */
function GridView({
  rows, dates, workingDays, showDow, compact,
}: { rows: PersonRow[]; dates: string[]; workingDays: string[]; showDow?: boolean; compact?: boolean }) {
  const working = new Set(workingDays);
  const w = compact ? "w-3" : "w-7";

  return (
    <Card className="border border-border shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border flex-wrap gap-2">
        <h3 className="font-semibold text-foreground">Who worked, day by day</h3>
        <div className="flex items-center gap-3 flex-wrap">
          {LEGEND.map(({ key, label }) => (
            <span key={key} className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              <span className={`size-2.5 rounded-sm ${CELL[key]}`} /> {label}
            </span>
          ))}
          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            <span className="size-2.5 rounded-sm border border-dashed border-amber-400 bg-amber-50" /> Not recorded
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            <span className="size-2.5 rounded-sm bg-muted" /> No attendance taken
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left text-[10px] uppercase tracking-wide text-muted-foreground font-semibold px-4 py-2 sticky left-0 bg-card">Staff</th>
              {dates.map(d => (
                <th key={d} className={`${w} text-[9px] text-muted-foreground font-medium px-0 py-2 text-center tabular-nums`}>
                  {compact
                    ? Number(d.slice(-2))
                    : showDow
                      ? <div><div>{DOW[(new Date(`${d}T00:00:00`).getDay() + 6) % 7]}</div><div className="opacity-60">{Number(d.slice(-2))}</div></div>
                      : fmtDay(d)}
                </th>
              ))}
              <th className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold px-3 py-2 text-right">Days</th>
              <th className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold px-3 py-2 text-right">Hrs</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.farmer.id} className="border-b border-border last:border-0 hover:bg-accent/40">
                <td className="px-4 py-1.5 sticky left-0 bg-card">
                  <div className="flex items-center gap-2 min-w-[150px]">
                    <Avatar className="size-5"><AvatarFallback className="bg-muted text-muted-foreground text-[9px] font-bold">{r.farmer.avatar}</AvatarFallback></Avatar>
                    <span className="text-xs font-medium truncate">{r.farmer.name}</span>
                    {r.farmer.archivedAt && <span className="text-[8px] uppercase text-muted-foreground border border-border rounded px-1">left</span>}
                  </div>
                </td>
                {dates.map(d => {
                  const rec = r.byDate.get(d);
                  const tookAttendance = working.has(d);
                  const { morning, afternoon } = sessionsOf(rec);
                  const half = rec && isHalfDay(rec.morningStatus, rec.afternoonStatus);
                  const title = !tookAttendance
                    ? `${d} — no attendance taken`
                    : !rec
                      ? `${d} — not recorded for ${r.farmer.name}`
                      : `${d} — morning: ${morning}, afternoon: ${afternoon}${half ? " (half day)" : ""}`;
                  return (
                    <td key={d} className="px-0 py-1.5 text-center" title={title}>
                      <div className="mx-auto flex h-5 w-5 overflow-hidden rounded-sm">
                        {!tookAttendance ? (
                          <div className="flex-1 bg-muted" />
                        ) : !rec ? (
                          <div className="flex-1 border border-dashed border-amber-400 bg-amber-50 rounded-sm" />
                        ) : (
                          <>
                            <div className={`flex-1 ${CELL[morning ?? "absent"] ?? "bg-muted"}`} />
                            <div className={`flex-1 ${CELL[afternoon ?? "absent"] ?? "bg-muted"}`} />
                          </>
                        )}
                      </div>
                    </td>
                  );
                })}
                <td className="px-3 py-1.5 text-right tabular-nums text-xs font-semibold">{r.daysWorked}</td>
                <td className="px-3 py-1.5 text-right tabular-nums text-xs text-foreground/70">{r.hours}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-5 py-2.5 bg-muted border-t border-border text-[11px] text-muted-foreground">
        Each square is one day, split left/right into morning and afternoon.
      </div>
    </Card>
  );
}
