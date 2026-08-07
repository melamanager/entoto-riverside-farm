// Farm operational configuration — client-safe (no server-only imports).
// Editable on the Settings page, stored as AppSetting rows, with sensible
// defaults so the app always works. Server-side reading lives in
// lib/config-server.ts (which touches Prisma).

export type FarmConfig = {
  farmName: string;
  harvestDailyTargetKg: number;
  defaultDailyWage: number;   // ETB
  workdayHours: number;       // hours before overtime kicks in
  overtimeMultiplier: number; // OT pay multiplier
  targetKgPerM: number;       // yield efficiency baseline
  // The two working sessions of the farm day, split by the lunch break.
  // Editable by anyone who records attendance (see /api/attendance/session-times).
  morningStart: string;       // "06:00" — staff arrive
  morningEnd: string;         // "12:00" — leave for lunch  (6 o'clock local)
  afternoonStart: string;     // "13:00" — return from lunch (7 o'clock local)
  afternoonEnd: string;       // "17:00" — end of day
  notifyDisease: boolean;
  notifyLowStock: boolean;
  notifyTasks: boolean;
  notifyHarvest: boolean;
};

export const CONFIG_DEFAULTS: FarmConfig = {
  farmName: "Entoto Riverside Farm",
  harvestDailyTargetKg: 50,
  defaultDailyWage: 400,
  workdayHours: 8,
  overtimeMultiplier: 1.5,
  targetKgPerM: 0.38,
  morningStart: "06:00",
  morningEnd: "12:00",
  afternoonStart: "13:00",
  afternoonEnd: "17:00",
  notifyDisease: true,
  notifyLowStock: true,
  notifyTasks: true,
  notifyHarvest: true,
};

// AppSetting key ↔ config field
export const NUM_KEYS: Record<string, keyof FarmConfig> = {
  harvest_daily_target_kg: "harvestDailyTargetKg",
  default_daily_wage: "defaultDailyWage",
  workday_hours: "workdayHours",
  overtime_multiplier: "overtimeMultiplier",
  target_kg_per_m: "targetKgPerM",
};
// Free-text (validated) keys — the working-session boundaries, stored "HH:MM"
export const STR_KEYS: Record<string, keyof FarmConfig> = {
  morning_start: "morningStart",
  morning_end: "morningEnd",
  afternoon_start: "afternoonStart",
  afternoon_end: "afternoonEnd",
};
export const BOOL_KEYS: Record<string, keyof FarmConfig> = {
  notify_disease: "notifyDisease",
  notify_lowstock: "notifyLowStock",
  notify_tasks: "notifyTasks",
  notify_harvest: "notifyHarvest",
};

export const CONFIG_KEYS = [
  "farm_name",
  ...Object.keys(NUM_KEYS),
  ...Object.keys(STR_KEYS),
  ...Object.keys(BOOL_KEYS),
];

/** "HH:MM" (00:00–23:59). Times are stored and compared as plain strings. */
export const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
