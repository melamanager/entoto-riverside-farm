import type { AttendanceRecord, AttendanceStatus, Farmer } from "@/lib/types";
import { isWorking, isHalfDay, isHoliday, dayWeight } from "@/lib/attendance";

/**
 * Attendance reporting maths.
 *
 * Working days are DEFINED BY THE DATA: a date counts as a working day if
 * attendance was taken for anyone that day. There is no separate roster or
 * rest-day calendar to drift out of sync — if nobody recorded anything, it was
 * not a working day and nothing is counted as missing.
 *
 * A day is two sessions, so a half day counts 0.5 everywhere.
 */

export type Cadence = "day" | "week" | "month";

export interface PersonRow {
  farmer: Farmer;
  /** date (YYYY-MM-DD) → that day's record */
  byDate: Map<string, AttendanceRecord>;
  expectedDays: number;   // working days this person was on the roster for
  daysWorked: number;     // sums 0.5 for half days
  halfDays: number;
  lateCount: number;
  absentDays: number;
  leaveDays: number;
  missingDays: number;    // roster days with no record at all
  holidayDays: number;    // farm closed — excluded from expectedDays
  hours: number;
  overtime: number;
  attendancePct: number | null;
}

export interface ReportTotals {
  workingDays: string[];
  expectedDays: number;
  daysWorked: number;
  halfDays: number;
  lateCount: number;
  absentDays: number;
  leaveDays: number;
  missingDays: number;
  holidayDays: number;
  hours: number;
  overtime: number;
  attendancePct: number | null;
  punctualityPct: number | null;
}

/* ── date helpers (all YYYY-MM-DD, which sorts lexically) ─────────────────── */

export function iso(d: Date): string {
  return d.toLocaleDateString("en-CA");
}

export function addDays(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + n);
  return iso(d);
}

/** Monday-start week containing `dateStr`. */
export function startOfWeek(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  const dow = (d.getDay() + 6) % 7; // Mon=0 … Sun=6
  return addDays(dateStr, -dow);
}

export function startOfMonth(dateStr: string): string {
  return `${dateStr.slice(0, 7)}-01`;
}

export function endOfMonth(dateStr: string): string {
  const d = new Date(`${dateStr.slice(0, 7)}-01T00:00:00`);
  d.setMonth(d.getMonth() + 1);
  d.setDate(0);
  return iso(d);
}

/** Inclusive range covered by a cadence anchored on `anchor`. */
export function rangeFor(cadence: Cadence, anchor: string): { from: string; to: string } {
  if (cadence === "day") return { from: anchor, to: anchor };
  if (cadence === "week") {
    const from = startOfWeek(anchor);
    return { from, to: addDays(from, 6) };
  }
  return { from: startOfMonth(anchor), to: endOfMonth(anchor) };
}

/** Step one whole period forward (dir=1) or back (dir=-1). */
export function shift(cadence: Cadence, anchor: string, dir: 1 | -1): string {
  if (cadence === "day") return addDays(anchor, dir);
  if (cadence === "week") return addDays(startOfWeek(anchor), dir * 7);
  const d = new Date(`${startOfMonth(anchor)}T00:00:00`);
  d.setMonth(d.getMonth() + dir);
  return iso(d);
}

export function eachDate(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/* ── roster membership ────────────────────────────────────────────────────── */

/**
 * Was this person on the roster on that date? Someone who joined later or has
 * since left is not counted as missing for days outside their time here.
 */
export function onRosterOn(f: Farmer, date: string): boolean {
  const joined = (f.joinedDate ?? "").slice(0, 10);
  if (joined && joined > date) return false;
  if (f.archivedAt) {
    const left = String(f.archivedAt).slice(0, 10);
    if (left <= date) return false;
  }
  return true;
}

/* ── the report ───────────────────────────────────────────────────────────── */

export function buildReport(
  records: AttendanceRecord[],
  staff: Farmer[],
  from: string,
  to: string,
): { rows: PersonRow[]; totals: ReportTotals } {
  const inRange = records.filter(r => r.date >= from && r.date <= to);

  // A day where every record says "holiday" is a closed day, not a working one.
  const closedDays = new Set(
    Array.from(new Set(inRange.map(r => r.date))).filter(d => {
      const onDay = inRange.filter(r => r.date === d);
      return onDay.length > 0 && onDay.every(r => isHoliday(r.status));
    }),
  );

  // A working day is any date attendance was taken and the farm was open.
  const workingDays = Array.from(new Set(inRange.map(r => r.date)))
    .filter(d => !closedDays.has(d))
    .sort();
  const workingSet = new Set(workingDays);

  // Only report on people who were here during the period, plus anyone who has
  // a record in it (so someone who has since left still appears for their days).
  const withRecords = new Set(inRange.map(r => r.farmerId));
  const people = staff.filter(
    f => f.role !== "manager" && (withRecords.has(f.id) || workingDays.some(d => onRosterOn(f, d))),
  );

  const rows: PersonRow[] = people.map(farmer => {
    const mine = inRange.filter(r => r.farmerId === farmer.id);
    const byDate = new Map(mine.map(r => [r.date, r]));

    const rosterDays = workingDays.filter(d => onRosterOn(farmer, d));
    // Count a day they have a record for even if the roster window says
    // otherwise — the record is the stronger evidence they worked.
    const expectedDates = Array.from(new Set([...rosterDays, ...mine.map(r => r.date)])).sort();

    let daysWorked = 0, halfDays = 0, lateCount = 0, absentDays = 0, leaveDays = 0;
    let missingDays = 0, holidayDays = 0, hours = 0, overtime = 0;

    for (const d of expectedDates) {
      const rec = byDate.get(d);
      if (!rec) { missingDays += 1; continue; }

      // Farm closed for this person — costs them nothing either way.
      if (isHoliday(rec.status)) { holidayDays += 1; continue; }

      daysWorked += dayWeight(rec);
      hours += rec.hoursWorked ?? 0;
      overtime += rec.overtimeHours ?? 0;

      const m = rec.morningStatus ?? rec.status;
      const a = rec.afternoonStatus ?? rec.status;
      if (isHalfDay(rec.morningStatus, rec.afternoonStatus)) halfDays += 1;
      if (m === "late" || a === "late") lateCount += 1;
      // Whole-day absence / leave only — a half day is counted by daysWorked.
      if (!isWorking(m) && !isWorking(a)) {
        if (m === "leave" && a === "leave") leaveDays += 1;
        else absentDays += 1;
      }
    }

    // Closed days are not "expected" of anyone, so they leave the rate alone.
    const expectedDays = expectedDates.length - holidayDays;
    return {
      farmer,
      byDate,
      expectedDays,
      daysWorked: round2(daysWorked),
      halfDays,
      lateCount,
      absentDays,
      leaveDays,
      missingDays,
      holidayDays,
      hours: round2(hours),
      overtime: round2(overtime),
      attendancePct: expectedDays > 0 ? Math.round((daysWorked / expectedDays) * 100) : null,
    };
  });

  const sum = (pick: (r: PersonRow) => number) => rows.reduce((s, r) => s + pick(r), 0);
  const expectedDays = sum(r => r.expectedDays);
  const daysWorked = sum(r => r.daysWorked);
  // Punctuality: of the days someone turned up, how many with no lateness.
  const turnedUp = rows.reduce(
    (s, r) => s + r.expectedDays - r.absentDays - r.leaveDays - r.missingDays, 0,
  );
  const lateCount = sum(r => r.lateCount);

  return {
    rows: rows.sort((a, b) => a.farmer.name.localeCompare(b.farmer.name)),
    totals: {
      workingDays,
      expectedDays,
      daysWorked: round2(daysWorked),
      halfDays: sum(r => r.halfDays),
      lateCount,
      absentDays: sum(r => r.absentDays),
      leaveDays: sum(r => r.leaveDays),
      missingDays: sum(r => r.missingDays),
      holidayDays: sum(r => r.holidayDays),
      hours: round2(sum(r => r.hours)),
      overtime: round2(sum(r => r.overtime)),
      attendancePct: expectedDays > 0 ? Math.round((daysWorked / expectedDays) * 100) : null,
      punctualityPct: turnedUp > 0 ? Math.round(((turnedUp - lateCount) / turnedUp) * 100) : null,
    },
  };
}

/** Per-session status of one day, for the grid cells. */
export function sessionsOf(rec?: AttendanceRecord): { morning?: AttendanceStatus; afternoon?: AttendanceStatus } {
  if (!rec) return {};
  return {
    morning: rec.morningStatus ?? rec.status,
    afternoon: rec.afternoonStatus ?? rec.status,
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
