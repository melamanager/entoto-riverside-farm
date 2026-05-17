import type { Bed } from "@/lib/types";
import { plantsInBed } from "@/lib/data";
import { Wheat, TrendingUp, CalendarDays } from "lucide-react";

interface Props { beds: Bed[]; today: string; }

// kg/day per meter of bed at ripening/harvest stage (approximate for Addis climate)
const KG_PER_M_PER_DAY = 0.38;

export function HarvestForecast({ beds, today }: Props) {
  const todayDate = new Date(today);

  // Determine days-to-harvest per stage
  const DAYS_TO_HARVEST: Record<string, number> = {
    harvest:    0,
    ripening:   4,
    fruiting:  10,
    flowering: 18,
    vegetative:30,
    planted:   45,
  };

  // Build 7-day forecast
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(todayDate);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split("T")[0];
    const label = i === 0 ? "Today" : i === 1 ? "Tomorrow" : d.toLocaleDateString("en", { weekday: "short", month: "short", day: "numeric" });

    // Beds contributing on day i
    const contributing = beds.filter(b => {
      const daysLeft = DAYS_TO_HARVEST[b.stage] ?? 99;
      return daysLeft <= i && daysLeft > i - 3; // 3-day harvest window per bed
    });
    const kg = contributing.reduce((s, b) => s + b.lengthM * KG_PER_M_PER_DAY, 0);
    return { label, kg: Math.round(kg * 10) / 10, beds: contributing.length, dateStr };
  });

  const maxKg = Math.max(...days.map(d => d.kg), 1);
  const totalWeek = days.reduce((s, d) => s + d.kg, 0);

  const READY_NOW = beds.filter(b => b.stage === "harvest" || b.stage === "ripening").length;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <CalendarDays className="size-4 text-emerald-600" />
            <span className="font-semibold text-slate-900">7-Day Harvest Forecast</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">{READY_NOW} beds ready/ripening now</div>
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
            const isToday = i === 0;
            return (
              <div key={day.dateStr} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                <div className="text-[10px] font-semibold text-slate-700 tabular-nums">
                  {day.kg > 0 ? `${day.kg}` : "—"}
                </div>
                <div className="w-full flex-1 flex items-end">
                  <div
                    className={`w-full rounded-t-md transition-all ${
                      isToday
                        ? "bg-emerald-500"
                        : day.kg > 0
                        ? "bg-emerald-200"
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

        {/* Ready-now beds */}
        {READY_NOW > 0 && (
          <div className="mt-4 flex items-center gap-2 px-3 py-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
            <Wheat className="size-4 text-emerald-600 shrink-0" />
            <div className="text-xs text-emerald-800">
              <span className="font-bold">{READY_NOW} beds</span> ready to harvest or in final ripening stage today
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
