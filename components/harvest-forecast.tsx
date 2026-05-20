import type { Bed, GrowthStage } from "@/lib/types";
import { VALVES } from "@/lib/data";
import { Wheat, CalendarDays } from "lucide-react";

interface Props { beds: Bed[]; today: string; }

const KG_PER_M_PER_DAY = 0.38;
const HARVEST_WINDOW_DAYS = 3;

// Days remaining to harvest from planted date for each stage
const STAGE_DAYS_REMAINING: Record<GrowthStage, number> = {
  harvest:    0,
  ripening:   4,
  fruiting:   18,
  flowering:  28,
  vegetative: 42,
  planted:    56,
};

// Cumulative days from planting to reach each stage
const STAGE_DAYS_FROM_PLANTED: Record<GrowthStage, number> = {
  planted:    0,
  vegetative: 14,
  flowering:  28,
  fruiting:   38,
  ripening:   52,
  harvest:    56,
};

function bedDaysToHarvest(bed: Bed, todayDate: Date): number {
  // Stage-based estimate from observed current state
  const stageBased = STAGE_DAYS_REMAINING[bed.stage];

  // Planted-date based estimate: days grown so far vs expected for current stage
  const plantedMs = new Date(bed.plantedDate).getTime();
  const daysGrown = Math.round((todayDate.getTime() - plantedMs) / 86_400_000);
  const expectedDaysGrown = STAGE_DAYS_FROM_PLANTED[bed.stage];
  // If plant is ahead (+) or behind (-) schedule, adjust
  const scheduleOffset = daysGrown - expectedDaysGrown;
  const adjustedRemaining = Math.max(0, stageBased - scheduleOffset);

  // Blend: weight stage-based for near-term (ripening/harvest), planted-date for earlier stages
  if (bed.stage === "harvest" || bed.stage === "ripening") return stageBased;
  return Math.max(0, adjustedRemaining);
}

export function HarvestForecast({ beds, today }: Props) {
  const todayDate = new Date(today);

  const bedForecast = beds.map(bed => {
    const daysAway = bedDaysToHarvest(bed, todayDate);
    const harvestDate = new Date(todayDate.getTime() + daysAway * 86_400_000);
    const valve = VALVES.find(v => v.id === bed.valveId);
    return { bed, daysAway, harvestDate, valve };
  });

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(todayDate);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split("T")[0];
    const label = i === 0 ? "Today" : i === 1 ? "Tomorrow"
      : d.toLocaleDateString("en", { weekday: "short", month: "short", day: "numeric" });
    const contributing = bedForecast.filter(b =>
      b.daysAway <= i && b.daysAway > i - HARVEST_WINDOW_DAYS
    );
    const kg = contributing.reduce((s, b) => s + b.bed.lengthM * KG_PER_M_PER_DAY, 0);
    return { label, kg: Math.round(kg * 10) / 10, beds: contributing.length, dateStr };
  });

  const maxKg = Math.max(...days.map(d => d.kg), 1);
  const totalWeek = days.reduce((s, d) => s + d.kg, 0);
  const readyNow = beds.filter(b => b.stage === "harvest" || b.stage === "ripening").length;

  const upcoming = bedForecast
    .filter(b => b.daysAway <= 30)
    .sort((a, b) => a.daysAway - b.daysAway);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <CalendarDays className="size-4 text-emerald-600" />
            <span className="font-semibold text-slate-900">7-Day Harvest Forecast</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">{readyNow} beds ready or ripening now</div>
        </div>
        <div className="text-right">
          <div className="text-xl font-bold text-emerald-700 tabular-nums">{totalWeek.toFixed(0)} kg</div>
          <div className="text-[11px] text-slate-400">est. this week</div>
        </div>
      </div>

      <div className="p-5">
        {/* Bar chart */}
        <div className="flex items-end gap-2 h-28 mb-3">
          {days.map((day, i) => {
            const pct = (day.kg / maxKg) * 100;
            return (
              <div key={day.dateStr} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                <div className="text-[10px] font-semibold text-slate-700 tabular-nums">
                  {day.kg > 0 ? `${day.kg}` : "—"}
                </div>
                <div className="w-full flex-1 flex items-end">
                  <div
                    className={`w-full rounded-t-md transition-all ${
                      i === 0 ? "bg-emerald-500"
                      : day.kg > 0 ? "bg-emerald-200"
                      : "bg-slate-100"
                    }`}
                    style={{ height: `${Math.max(pct, day.kg > 0 ? 8 : 2)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Day labels */}
        <div className="flex gap-2">
          {days.map((day, i) => (
            <div key={day.dateStr} className="flex-1 text-center min-w-0">
              <div className={`text-[9px] truncate ${i === 0 ? "font-bold text-emerald-700" : "text-slate-400"}`}>
                {day.label}
              </div>
            </div>
          ))}
        </div>

        {readyNow > 0 && (
          <div className="mt-4 flex items-center gap-2 px-3 py-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
            <Wheat className="size-4 text-emerald-600 shrink-0" />
            <div className="text-xs text-emerald-800">
              <span className="font-bold">{readyNow} beds</span> ready to harvest or in final ripening today
            </div>
          </div>
        )}

        {/* Per-bed upcoming schedule */}
        {upcoming.length > 0 && (
          <div className="mt-4">
            <div className="text-xs font-semibold text-slate-600 mb-2">Upcoming by Bed (planted-date adjusted)</div>
            <div className="divide-y divide-slate-50">
              {upcoming.slice(0, 6).map(({ bed, daysAway, harvestDate, valve }) => {
                const expectedKg = Math.round(bed.lengthM * KG_PER_M_PER_DAY * HARVEST_WINDOW_DAYS * 10) / 10;
                return (
                  <div key={bed.id} className="flex items-center gap-2 py-1.5 text-xs">
                    <span className="font-mono font-bold text-slate-700 w-14 shrink-0">{bed.id}</span>
                    <span className="text-slate-500 flex-1 truncate">{bed.variety}</span>
                    {valve && (
                      <span className="text-[10px] font-semibold shrink-0" style={{ color: valve.color }}>
                        {valve.name.split(" ")[0]}
                      </span>
                    )}
                    <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                      daysAway === 0 ? "bg-emerald-100 text-emerald-700"
                      : daysAway <= 4 ? "bg-amber-100 text-amber-700"
                      : "bg-slate-100 text-slate-600"
                    }`}>
                      {daysAway === 0 ? "Now"
                        : daysAway === 1 ? "Tomorrow"
                        : `${harvestDate.toLocaleDateString("en", { month: "short", day: "numeric" })}`}
                    </span>
                    <span className="text-slate-400 shrink-0 w-14 text-right tabular-nums">~{expectedKg} kg</span>
                  </div>
                );
              })}
            </div>
            {upcoming.length > 6 && (
              <div className="text-center text-[10px] text-slate-400 pt-2">
                +{upcoming.length - 6} more beds in next 30 days
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
