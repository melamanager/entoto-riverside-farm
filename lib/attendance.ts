/**
 * Attendance time helpers.
 *
 * A farm day runs in two sessions, split by the lunch break:
 *   checkInTime          → morning arrival        (≈06:00)
 *   morningCheckOutTime  → leaves for lunch       (6 o'clock local = 12:00)
 *   afternoonCheckInTime → returns from lunch     (7 o'clock local = 13:00)
 *   checkOutTime         → end of day             (≈17:00)
 */

export const DEFAULT_SHIFT = {
  checkInTime: "06:00",
  morningCheckOutTime: "12:00",
  afternoonCheckInTime: "13:00",
  checkOutTime: "17:00",
} as const;

export interface ShiftTimes {
  checkInTime?: string | null;
  morningCheckOutTime?: string | null;
  afternoonCheckInTime?: string | null;
  checkOutTime?: string | null;
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
 * Falls back to a single continuous span (arrival → end of day) for legacy
 * records written before the lunch break was tracked, so historical payroll
 * totals do not change. Returns null when nothing usable is present.
 */
export function calcHoursWorked(times: ShiftTimes): number | null {
  const morningIn = toMinutes(times.checkInTime);
  const morningOut = toMinutes(times.morningCheckOutTime);
  const afternoonIn = toMinutes(times.afternoonCheckInTime);
  const dayOut = toMinutes(times.checkOutTime);

  let minutes = 0;
  let counted = false;

  if (morningIn !== null && morningOut !== null && morningOut > morningIn) {
    minutes += morningOut - morningIn;
    counted = true;
  }
  if (afternoonIn !== null && dayOut !== null && dayOut > afternoonIn) {
    minutes += dayOut - afternoonIn;
    counted = true;
  }

  // Legacy single-session record: no lunch break recorded.
  if (!counted && morningIn !== null && dayOut !== null && dayOut > morningIn) {
    minutes = dayOut - morningIn;
    counted = true;
  }

  if (!counted) return null;
  return Math.round((minutes / 60) * 100) / 100;
}
