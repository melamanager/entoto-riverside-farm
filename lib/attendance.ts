import type { AttendanceStatus } from "@/lib/types";

/**
 * Attendance time helpers.
 *
 * A farm day runs in two independent sessions, split by the lunch break:
 *   morning:   checkInTime          → morningCheckOutTime   (≈06:00 → 12:00)
 *   afternoon: afternoonCheckInTime → checkOutTime          (≈13:00 → 17:00)
 *
 * Each session is marked separately, so someone can work the morning and be
 * absent after lunch. The session boundaries are configurable per farm
 * (lib/config.ts → morningStart/morningEnd/afternoonStart/afternoonEnd).
 */

export interface ShiftTimes {
  checkInTime?: string | null;
  morningCheckOutTime?: string | null;
  afternoonCheckInTime?: string | null;
  checkOutTime?: string | null;
}

/** Which sessions were actually worked. Both default to true (legacy records). */
export interface SessionsWorked {
  morningWorked?: boolean;
  afternoonWorked?: boolean;
}

/** A session counts as worked when the person turned up — late still counts. */
export function isWorking(status?: AttendanceStatus | null): boolean {
  return status === "present" || status === "late";
}

/**
 * The farm was closed — Sunday or a public holiday.
 *
 * This is neither worked nor absent. It is excluded from the attendance
 * denominator entirely, so a holiday never drags anyone's rate down, and it is
 * still a positive record: the day was accounted for, not forgotten.
 */
export function isHoliday(status?: AttendanceStatus | null): boolean {
  return status === "holiday";
}

/** "HH:MM" → minutes since midnight, or null when unparseable. */
export function toMinutes(t?: string | null): number | null {
  if (!t) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/**
 * Total hours worked across both sessions, rounded to 2dp.
 *
 * A session only counts when it was actually worked, so an afternoon absence
 * does not get paid. Falls back to a single continuous span (arrival → end of
 * day) for legacy records written before the lunch break was tracked, so
 * historical payroll totals do not change. Returns null when nothing usable.
 */
export function calcHoursWorked(times: ShiftTimes, sessions: SessionsWorked = {}): number | null {
  const { morningWorked = true, afternoonWorked = true } = sessions;

  const morningIn = toMinutes(times.checkInTime);
  const morningOut = toMinutes(times.morningCheckOutTime);
  const afternoonIn = toMinutes(times.afternoonCheckInTime);
  const dayOut = toMinutes(times.checkOutTime);

  let minutes = 0;
  let counted = false;

  if (morningWorked && morningIn !== null && morningOut !== null && morningOut > morningIn) {
    minutes += morningOut - morningIn;
    counted = true;
  }
  if (afternoonWorked && afternoonIn !== null && dayOut !== null && dayOut > afternoonIn) {
    minutes += dayOut - afternoonIn;
    counted = true;
  }

  // Legacy single-session record: no lunch break recorded, both sessions worked.
  if (!counted && morningWorked && afternoonWorked && morningIn !== null && dayOut !== null && dayOut > morningIn) {
    minutes = dayOut - morningIn;
    counted = true;
  }

  if (!counted) return null;
  return Math.round((minutes / 60) * 100) / 100;
}

/**
 * The day's overall status, derived from the two sessions. Kept in sync with
 * `status` on the record so dashboards, reports and the farm context that read
 * a single status per day keep working.
 */
export function deriveDayStatus(
  morning: AttendanceStatus,
  afternoon: AttendanceStatus,
): AttendanceStatus {
  const worked = [morning, afternoon].filter(isWorking);
  if (worked.length > 0) return worked.includes("late") ? "late" : "present";
  // Neither session worked.
  if (morning === "holiday" && afternoon === "holiday") return "holiday";
  if (morning === "leave" && afternoon === "leave") return "leave";
  return "absent";
}

/** True when exactly one of the two sessions was worked. */
export function isHalfDay(morning?: AttendanceStatus | null, afternoon?: AttendanceStatus | null): boolean {
  if (!morning || !afternoon) return false;
  return isWorking(morning) !== isWorking(afternoon);
}

/**
 * How much of a paid day this record represents: 1 for both sessions, 0.5 for
 * a half day, 0 when absent. Legacy records (no per-session status) fall back
 * to the whole-day status so past payroll is unchanged.
 */
export function dayWeight(rec: {
  status: AttendanceStatus;
  morningStatus?: AttendanceStatus | null;
  afternoonStatus?: AttendanceStatus | null;
}): number {
  // The farm was shut — nothing was worked, and nothing is owed for it.
  if (rec.status === "holiday") return 0;
  if (rec.morningStatus && rec.afternoonStatus) {
    return (isWorking(rec.morningStatus) ? 0.5 : 0) + (isWorking(rec.afternoonStatus) ? 0.5 : 0);
  }
  return isWorking(rec.status) ? 1 : 0;
}
