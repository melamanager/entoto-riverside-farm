"use client";

import { Card } from "@/components/ui/card";
import { CalendarRange, Sprout, PackageOpen, ArrowRight } from "lucide-react";
import type { PlantingRecord } from "@/lib/erp-types";
import type { Bed } from "@/lib/types";
import { daysToHarvest, occupiesBed } from "@/lib/planting";
import { useLang } from "@/lib/lang";

// Turns the planting list into two planning views the page was missing:
//   1. HARVEST WINDOW FORECAST — which beds enter harvest in the coming weeks,
//      grouped by week, with a rough kg estimate (bed length × a stated yield
//      assumption). Answers "what's coming and roughly how much".
//   2. BED OCCUPANCY — which beds are free to plant now vs occupied, and which
//      free up soon. Answers "where can I plant next" (succession planning).

// Seasonal yield assumption for the estimate — clearly labelled "est." in the
// UI so it's never mistaken for recorded harvest data.
const EST_KG_PER_M = 2.2;

function weekStart(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const dow = d.getUTCDay(); // 0=Sun
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().split("T")[0];
}
function fmt(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en", { month: "short", day: "numeric" });
}

export function PlantingPlanner({
  plantings, beds, today,
}: { plantings: PlantingRecord[]; beds: Bed[]; today: string }) {
  const { isAm } = useLang();
  const bedById = new Map(beds.map((b) => [b.id, b]));

  // ── 1. Harvest window forecast (next 8 weeks) ────────────────────────────
  const horizon = new Date(`${today}T00:00:00Z`);
  horizon.setUTCDate(horizon.getUTCDate() + 56);
  const horizonStr = horizon.toISOString().split("T")[0];

  const upcoming = plantings.filter(
    (p) => (p.status === "planted" || p.status === "growing") &&
      p.expectedHarvestDate >= today && p.expectedHarvestDate <= horizonStr,
  );
  const byWeek = new Map<string, PlantingRecord[]>();
  for (const p of upcoming) {
    const w = weekStart(p.expectedHarvestDate);
    (byWeek.get(w) ?? byWeek.set(w, []).get(w)!).push(p);
  }
  const weeks = [...byWeek.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const estKg = (p: PlantingRecord) => (bedById.get(p.bedId)?.lengthM ?? 0) * EST_KG_PER_M;
  const totalEst = upcoming.reduce((s, p) => s + estKg(p), 0);

  // ── 2. Bed occupancy ─────────────────────────────────────────────────────
  const occupied = new Map<string, PlantingRecord>();
  for (const p of plantings) if (occupiesBed(p.status)) occupied.set(p.bedId, p);
  const freeBeds = beds.filter((b) => !occupied.has(b.id));
  const freeingSoon = [...occupied.values()]
    .map((p) => ({ p, d: daysToHarvest(p, today) }))
    .filter((x) => x.d >= 0 && x.d <= 21)
    .sort((a, b) => a.d - b.d);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* ── Harvest window forecast ──────────────────────────────────────── */}
      <Card className="p-5 border border-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CalendarRange className="size-4 text-primary" />
            <span className="font-bold text-foreground text-sm">
              {isAm ? "የመኸር መስኮት ትንበያ" : "Harvest window forecast"}
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground">{isAm ? "የሚቀጥሉት 8 ሳምንታት" : "next 8 weeks"}</span>
        </div>

        {weeks.length === 0 ? (
          <div className="text-xs text-muted-foreground py-6 text-center">
            {isAm ? "በሚቀጥሉት 8 ሳምንታት ውስጥ የሚደርስ መከር የለም።" : "No beds entering harvest in the next 8 weeks."}
          </div>
        ) : (
          <>
            <div className="space-y-2.5">
              {weeks.map(([w, items]) => {
                const kg = items.reduce((s, p) => s + estKg(p), 0);
                return (
                  <div key={w} className="flex items-start gap-3">
                    <div className="w-20 shrink-0 text-xs font-semibold text-foreground tabular-nums pt-0.5">
                      {fmt(w)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap gap-1">
                        {items.map((p) => (
                          <span key={p.id} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/25 font-medium">
                            {p.bedId} · {p.variety}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-xs font-bold text-foreground tabular-nums">~{kg.toFixed(0)} kg</div>
                      <div className="text-[9px] text-muted-foreground">{items.length} {isAm ? "መደብ" : "beds"}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">
                {isAm ? "ግምት፦" : "Est."} {EST_KG_PER_M} kg/m · {isAm ? "የተመዘገበ አይደለም" : "not recorded data"}
              </span>
              <span className="text-xs font-bold text-primary tabular-nums">~{totalEst.toFixed(0)} kg {isAm ? "ጠቅላላ" : "total"}</span>
            </div>
          </>
        )}
      </Card>

      {/* ── Bed occupancy / succession ───────────────────────────────────── */}
      <Card className="p-5 border border-border">
        <div className="flex items-center gap-2 mb-4">
          <PackageOpen className="size-4 text-primary" />
          <span className="font-bold text-foreground text-sm">
            {isAm ? "የመደብ አጠቃቀም" : "Bed occupancy"}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="rounded-xl border border-primary/30 bg-primary/10 p-3">
            <div className="text-2xl font-bold text-primary tabular-nums">{freeBeds.length}</div>
            <div className="text-[11px] text-primary font-medium">{isAm ? "ነፃ መደቦች (መትከል ይቻላል)" : "Free beds (plantable now)"}</div>
          </div>
          <div className="rounded-xl border border-border bg-muted/40 p-3">
            <div className="text-2xl font-bold text-foreground tabular-nums">{occupied.size}</div>
            <div className="text-[11px] text-muted-foreground font-medium">{isAm ? "በአገልግሎት ላይ" : "Occupied"}</div>
          </div>
        </div>

        {freeBeds.length > 0 && (
          <div className="mb-3">
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1">
              <Sprout className="size-3" /> {isAm ? "አሁን መትከል የሚቻል" : "Ready to plant now"}
            </div>
            <div className="flex flex-wrap gap-1">
              {freeBeds.slice(0, 14).map((b) => (
                <span key={b.id} className="text-[10px] px-2 py-0.5 rounded-full bg-muted border border-border font-mono text-foreground">
                  {b.id}
                </span>
              ))}
              {freeBeds.length > 14 && <span className="text-[10px] text-muted-foreground">+{freeBeds.length - 14}</span>}
            </div>
          </div>
        )}

        {freeingSoon.length > 0 && (
          <div className="pt-3 border-t border-border">
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-1.5">
              {isAm ? "በቅርቡ ነፃ የሚሆኑ (≤3 ሳምንት)" : "Freeing up soon (≤3 weeks)"}
            </div>
            <div className="space-y-1">
              {freeingSoon.slice(0, 6).map(({ p, d }) => (
                <div key={p.id} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-foreground">
                    <span className="font-mono font-semibold">{p.bedId}</span>
                    <ArrowRight className="size-3 text-muted-foreground" />
                    <span className="text-muted-foreground">{p.variety}</span>
                  </span>
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    {d === 0 ? (isAm ? "ዛሬ" : "today") : `${d}${isAm ? " ቀን" : "d"}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
