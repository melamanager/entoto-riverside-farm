import { FarmMap } from "@/components/farm-map";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { VALVES, BEDS, HARVESTS, FARM, plantsInBed } from "@/lib/data";
import { Mountain, Sprout } from "lucide-react";
import { ValveIcon } from "@/components/valve-icon";

export default function MapPage() {
  const beds = BEDS();
  const today = "2026-05-17";
  const harvestKgByBed: Record<string, number> = {};
  HARVESTS().filter(h => h.date === today).forEach(h => {
    harvestKgByBed[h.bedId] = (harvestKgByBed[h.bedId] ?? 0) + h.kg;
  });

  return (
    <div className="p-6 md:p-8 max-w-[1600px] mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">🗺 Virtual Farm Map</h1>
          <p className="text-stone-500 text-sm flex items-center gap-2">
            <Mountain className="size-3.5" /> {FARM.location} · {FARM.altitudeM}m · {FARM.totalAreaHa} ha
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Badge variant="outline" className="gap-1"><Sprout className="size-3 text-emerald-600" /> {beds.length} beds</Badge>
          <Badge variant="outline" className="gap-1"><ValveIcon size={12} /> {beds.reduce((s,b)=>s+plantsInBed(b),0).toLocaleString()} plants</Badge>
        </div>
      </div>

      <FarmMap valves={VALVES} beds={beds} harvestKgByBed={harvestKgByBed} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-3 text-xs">
          <div className="font-bold mb-1 flex items-center gap-1.5"><span className="size-3 rounded bg-emerald-500" /> Healthy</div>
          <div className="text-stone-500">{beds.filter(b=>b.health==="healthy").length} beds. Continue routine inspection.</div>
        </Card>
        <Card className="p-3 text-xs">
          <div className="font-bold mb-1 flex items-center gap-1.5"><span className="size-3 rounded bg-amber-500" /> Warning</div>
          <div className="text-stone-500">{beds.filter(b=>b.health==="warning").length} beds with mild issues (nutrient / yield).</div>
        </Card>
        <Card className="p-3 text-xs">
          <div className="font-bold mb-1 flex items-center gap-1.5"><span className="size-3 rounded bg-rose-500" /> Infected</div>
          <div className="text-stone-500">{beds.filter(b=>b.health==="infected").length} beds need immediate treatment.</div>
        </Card>
        <Card className="p-3 text-xs">
          <div className="font-bold mb-1">🍓 Ready to harvest</div>
          <div className="text-stone-500">{beds.filter(b=>b.stage==="ripening"||b.stage==="harvest").length} beds at peak ripeness.</div>
        </Card>
      </div>
    </div>
  );
}
