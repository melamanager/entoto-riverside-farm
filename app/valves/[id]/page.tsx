import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ArrowLeft, Sprout, Users, Wheat, AlertTriangle, Calendar } from "lucide-react";
import { ValveIcon } from "@/components/valve-icon";
import { HarvestChart } from "@/components/harvest-chart";
import {
  getValve, BEDS, FARMERS, HARVESTS, DISEASES,
  plantsInBed, totalKgValve, totalKgBed, getFarmer,
} from "@/lib/data";

export default async function ValvePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const valve = getValve(id);
  if (!valve) notFound();

  const vBeds = BEDS().filter(b => b.valveId === valve.id);
  const harvests = HARVESTS().filter(h => vBeds.some(b => b.id === h.bedId));
  const diseases = DISEASES().filter(d => vBeds.some(b => b.id === d.bedId));
  const supervisor = getFarmer(valve.supervisorId);
  const farmers = FARMERS.filter(f => f.assignedValves.includes(valve.id) && f.role === "farmer");

  const series: Record<string, number> = {};
  for (let i = 13; i >= 0; i--) {
    const d = new Date("2026-05-17");
    d.setDate(d.getDate() - i);
    series[d.toISOString().split("T")[0]] = 0;
  }
  harvests.forEach(h => { if (series[h.date] !== undefined) series[h.date] += h.kg; });
  const chartData = Object.entries(series).map(([date, kg]) => ({
    date: new Date(date).toLocaleDateString("en", { month: "short", day: "numeric" }),
    kg: Math.round(kg * 10) / 10,
  }));

  const bedsRanked = [...vBeds].map(b => ({ b, kg: totalKgBed(b.id) })).sort((a,b) => b.kg - a.kg);

  return (
    <div className="p-6 md:p-8 max-w-[1400px] mx-auto space-y-6">
      <Link href="/valves" className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-900">
        <ArrowLeft className="size-4" /> All valves
      </Link>

      <div className="flex items-center justify-between gap-6 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="size-14 rounded-2xl grid place-items-center text-white font-bold text-xl shadow-lg" style={{background: valve.color}}>
            {valve.name.split(" ")[1]}
          </div>
          <div>
            <h1 className="text-2xl font-bold">{valve.name}</h1>
            <p className="text-sm text-stone-500 flex items-center gap-1.5"><ValveIcon size={14} /> {valve.irrigationSchedule}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Avatar className="size-10 ring-2 ring-emerald-200">
            <AvatarFallback className="bg-emerald-100 text-emerald-700 text-xs font-semibold">{supervisor?.avatar}</AvatarFallback>
          </Avatar>
          <div className="text-sm">
            <div className="font-medium">{supervisor?.name}</div>
            <div className="text-xs text-stone-500">Supervisor</div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-stone-500"><Sprout className="size-3.5" /> Beds</div>
          <div className="text-3xl font-bold mt-1">{vBeds.length}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-stone-500"><ValveIcon size={14} /> Plants</div>
          <div className="text-3xl font-bold mt-1">{vBeds.reduce((s,b)=>s+plantsInBed(b),0).toLocaleString()}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-stone-500"><Wheat className="size-3.5" /> Total harvest</div>
          <div className="text-3xl font-bold mt-1">{totalKgValve(valve.id).toFixed(1)}<span className="text-sm font-normal text-stone-500"> kg</span></div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-stone-500"><AlertTriangle className="size-3.5" /> Active alerts</div>
          <div className="text-3xl font-bold mt-1 text-rose-600">{diseases.filter(d=>d.status!=="resolved").length}</div>
        </Card>
      </div>

      {/* Chart */}
      <Card className="p-5">
        <h3 className="font-bold mb-3">Harvest trend — 14 days</h3>
        <HarvestChart data={chartData} />
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Beds ranking */}
        <Card className="p-5">
          <h3 className="font-bold mb-3">🏆 Bed productivity ranking</h3>
          <div className="space-y-2">
            {bedsRanked.map(({ b, kg }, i) => {
              const max = bedsRanked[0]?.kg || 1;
              return (
                <Link href={`/beds/${b.id}`} key={b.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-stone-50">
                  <div className="text-stone-400 font-mono text-xs w-5 text-center">#{i+1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between text-sm">
                      <span className="font-mono font-semibold">{b.id}</span>
                      <span className="tabular-nums">{kg.toFixed(1)} kg</span>
                    </div>
                    <div className="text-[11px] text-stone-500">{b.variety}</div>
                    <div className="mt-1 h-1 rounded-full bg-stone-100 overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{width:`${(kg/max)*100||3}%`}} />
                    </div>
                  </div>
                  <span className={`size-2.5 rounded-full ${b.health==="healthy"?"bg-emerald-500":b.health==="warning"?"bg-amber-500":"bg-rose-500"}`} />
                </Link>
              );
            })}
          </div>
        </Card>

        {/* Farmers */}
        <Card className="p-5">
          <h3 className="font-bold mb-3">👥 Assigned farmers</h3>
          <div className="space-y-2">
            {[supervisor, ...farmers].filter(Boolean).map(f => (
              <div key={f!.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-stone-50">
                <Avatar className="size-10">
                  <AvatarFallback className="bg-emerald-100 text-emerald-700 text-xs font-semibold">{f!.avatar}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="text-sm font-medium">{f!.name}</div>
                  <div className="text-[11px] text-stone-500 capitalize">{f!.role} · {f!.phone}</div>
                </div>
                <Badge variant="outline" className="text-[10px]">Score {f!.performanceScore}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
