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
export const BOOL_KEYS: Record<string, keyof FarmConfig> = {
  notify_disease: "notifyDisease",
  notify_lowstock: "notifyLowStock",
  notify_tasks: "notifyTasks",
  notify_harvest: "notifyHarvest",
};

export const CONFIG_KEYS = [
  "farm_name",
  ...Object.keys(NUM_KEYS),
  ...Object.keys(BOOL_KEYS),
];
