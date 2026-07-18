import { prisma } from "@/lib/prisma";

// Farm operational configuration — editable on the Settings page, stored as
// AppSetting rows, with sensible defaults so the app always works. These replace
// magic numbers that used to be hardcoded across the codebase.

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
const NUM_KEYS: Record<string, keyof FarmConfig> = {
  harvest_daily_target_kg: "harvestDailyTargetKg",
  default_daily_wage: "defaultDailyWage",
  workday_hours: "workdayHours",
  overtime_multiplier: "overtimeMultiplier",
  target_kg_per_m: "targetKgPerM",
};
const BOOL_KEYS: Record<string, keyof FarmConfig> = {
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

// server-side: read the live config (falls back to defaults on any error)
export async function getFarmConfig(): Promise<FarmConfig> {
  try {
    const rows = await prisma.appSetting.findMany({ where: { key: { in: CONFIG_KEYS } } });
    const map = new Map(rows.map((r) => [r.key, r.value]));
    const cfg: FarmConfig = { ...CONFIG_DEFAULTS };
    if (map.has("farm_name")) cfg.farmName = map.get("farm_name")!;
    for (const [k, field] of Object.entries(NUM_KEYS)) {
      const v = map.get(k);
      if (v != null && Number.isFinite(Number(v))) (cfg[field] as number) = Number(v);
    }
    for (const [k, field] of Object.entries(BOOL_KEYS)) {
      const v = map.get(k);
      if (v != null) (cfg[field] as boolean) = v === "true" || v === "1";
    }
    return cfg;
  } catch {
    return { ...CONFIG_DEFAULTS };
  }
}
