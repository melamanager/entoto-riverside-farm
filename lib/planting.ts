import type { GrowthStage } from "@/lib/types";

// Shared, client-safe planting logic (no prisma import). Two ideas:
//  1. AGE is DERIVED, never stored — a strawberry planted in Jan should read as
//     older every day. The `ageInDays` column was a frozen integer; use these.
//  2. STAGE is derived from progress toward the planting's OWN recorded expected
//     harvest date, so it adapts to variety-specific cycles automatically.

const MS_DAY = 86_400_000;

export function daysBetween(fromISO: string, toISO: string): number {
  const a = Date.parse(`${fromISO}T00:00:00Z`);
  const b = Date.parse(`${toISO}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / MS_DAY);
}

type PlantingLike = {
  status: string;
  plannedDate: string;
  actualDate?: string | null;
  expectedHarvestDate: string;
};

// The anchor is the real planting date once known, else the plan.
function anchorDate(p: PlantingLike): string {
  return p.actualDate || p.plannedDate;
}

// Days since the crop went in the ground. 0 for not-yet-planted / future dates.
export function liveAgeDays(p: PlantingLike, today: string): number {
  if (p.status === "planned") return 0;
  const age = daysBetween(anchorDate(p), today);
  return age < 0 ? 0 : age;
}

// Fraction of the way from planting to expected harvest (0..1+, clamped ≥0).
export function harvestProgress(p: PlantingLike, today: string): number {
  const total = daysBetween(anchorDate(p), p.expectedHarvestDate);
  if (total <= 0) return 1;
  const elapsed = daysBetween(anchorDate(p), today);
  return Math.max(0, elapsed / total);
}

// Growth stage derived from that progress. Thresholds match the six-stage
// GrowthStage enum used across the app (map, dashboard, origin performance).
export function liveStage(p: PlantingLike, today: string): GrowthStage {
  if (p.status === "planned") return "planted";
  if (p.status === "harvested") return "harvest";
  const f = harvestProgress(p, today);
  if (f < 0.15) return "planted";
  if (f < 0.45) return "vegetative";
  if (f < 0.65) return "flowering";
  if (f < 0.85) return "fruiting";
  if (f < 1) return "ripening";
  return "harvest";
}

// Days until the expected harvest date: positive = still to come, negative = past due.
export function daysToHarvest(p: PlantingLike, today: string): number {
  return daysBetween(today, p.expectedHarvestDate);
}

// A planting occupies its bed while it's in the ground and not yet cleared.
export function occupiesBed(status: string): boolean {
  return status === "planted" || status === "growing";
}
