import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Sprout, Calendar, MapPin, User, Wheat, AlertTriangle, FlaskConical } from "lucide-react";
import { AIDetectDialog } from "@/components/ai-detect-dialog";
import { BedQR } from "@/components/bed-qr";
import { HarvestChart } from "@/components/harvest-chart";
import {
  getBed, getValve, getFarmer, harvestsForBed, diseasesForBed,
  plantsInBed, totalKgBed,
} from "@/lib/data";
import { DISEASE_LABELS } from "@/lib/types";

const STAGES = ["planted", "vegetative", "flowering", "fruiting", "ripening", "harvest"] as const;

export default async function BedPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bed = getBed(id);
  if (!bed) notFound();

  const valve = getValve(bed.valveId)!;
  const farmer = getFarmer(bed.farmerId)!;
  const harvests = harvestsForBed(bed.id).sort((a,b) => b.date.localeCompare(a.date));
  const diseases = diseasesForBed(bed.id);
  const totalKg = totalKgBed(bed.id);
  const stageIdx = STAGES.indexOf(bed.stage);

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

  const plants = plantsInBed(bed);
  const yieldPerMeter = totalKg / bed.lengthM;
  const yieldPerPlant = totalKg / plants;

  return (
    <div className="p-6 md:p-8 max-w-[1400px] mx-auto space-y-6">
      <Link href="/beds" className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-900">
        <ArrowLeft className="size-4" /> All beds
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="size-14 rounded-2xl grid place-items-center text-2xl shadow-lg" style={{background:`linear-gradient(135deg, ${valve.color}, ${valve.color}dd)`}}>
            <span className="text-white">🛏</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold font-mono">{bed.id}</h1>
            <p className="text-sm text-stone-500 flex items-center gap-2">
              <Link href={`/valves/${valve.id}`} className="hover:underline" style={{color: valve.color}}>{valve.name}</Link>
              <span>·</span>
              <span>{bed.variety}</span>
              <span>·</span>
              <span>{bed.origin}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className={`${bed.health==="healthy"?"bg-emerald-100 text-emerald-700":bed.health==="warning"?"bg-amber-100 text-amber-700":"bg-rose-100 text-rose-700"} capitalize`}>● {bed.health}</Badge>
          <Badge variant="outline" className="capitalize">{bed.stage}</Badge>
          <AIDetectDialog bedId={bed.id} />
        </div>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-xs text-stone-500 flex items-center gap-1.5"><MapPin className="size-3.5" /> Length</div>
          <div className="text-2xl font-bold mt-1">{bed.lengthM}<span className="text-sm text-stone-500"> m</span></div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-stone-500 flex items-center gap-1.5"><Sprout className="size-3.5" /> Plants</div>
          <div className="text-2xl font-bold mt-1">{plants}</div>
          <div className="text-[10px] text-stone-400 mt-0.5">{bed.plantsPerMeter}/m</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-stone-500 flex items-center gap-1.5"><Calendar className="size-3.5" /> Planted</div>
          <div className="text-base font-bold mt-1">{new Date(bed.plantedDate).toLocaleDateString("en",{year:"numeric",month:"short",day:"numeric"})}</div>
          <div className="text-[10px] text-stone-400">{Math.floor((Date.now()-new Date(bed.plantedDate).getTime())/86400000)} days ago</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-stone-500 flex items-center gap-1.5"><User className="size-3.5" /> Farmer</div>
          <div className="flex items-center gap-2 mt-1.5">
            <Avatar className="size-7"><AvatarFallback className="bg-emerald-100 text-emerald-700 text-[10px] font-semibold">{farmer.avatar}</AvatarFallback></Avatar>
            <div className="text-sm font-medium truncate">{farmer.name}</div>
          </div>
        </Card>
      </div>

      {/* Growth progress */}
      <Card className="p-5">
        <h3 className="font-bold mb-3">🌿 Growth progress</h3>
        <div className="relative">
          <div className="flex justify-between mb-2">
            {STAGES.map((s, i) => (
              <div key={s} className="flex flex-col items-center gap-1 flex-1">
                <div className={`size-7 rounded-full grid place-items-center text-[10px] font-bold ${i<=stageIdx?"bg-emerald-500 text-white":"bg-stone-100 text-stone-400"}`}>
                  {i+1}
                </div>
                <span className={`text-[10px] capitalize ${i<=stageIdx?"text-emerald-700 font-medium":"text-stone-400"}`}>{s}</span>
              </div>
            ))}
          </div>
          <div className="absolute top-3.5 left-0 right-0 h-0.5 bg-stone-100 -z-10">
            <div className="h-full bg-emerald-500" style={{width:`${(stageIdx/(STAGES.length-1))*100}%`}} />
          </div>
        </div>
      </Card>

      {/* Health + Harvest analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold">🍓 Harvest history</h3>
            <div className="text-right">
              <div className="text-xl font-bold">{totalKg.toFixed(1)}<span className="text-sm font-normal text-stone-500"> kg total</span></div>
              <div className="text-[11px] text-stone-500 tabular-nums">{yieldPerMeter.toFixed(2)} kg/m · {(yieldPerPlant*1000).toFixed(0)}g/plant</div>
            </div>
          </div>
          <HarvestChart data={chartData} />
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-stone-500"><tr><th className="text-left py-1">Date</th><th className="text-right py-1">KG</th><th className="text-right py-1">Grade</th></tr></thead>
              <tbody>
                {harvests.slice(0,6).map(h => (
                  <tr key={h.id} className="border-t">
                    <td className="py-1.5">{new Date(h.date).toLocaleDateString("en",{month:"short",day:"numeric",year:"numeric"})}</td>
                    <td className="py-1.5 text-right tabular-nums">{h.kg.toFixed(1)}</td>
                    <td className="py-1.5 text-right"><Badge variant="outline" className="text-[10px]">Grade {h.qualityGrade}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <h3 className="font-bold mb-2 flex items-center gap-2">🩺 Health</h3>
            {diseases.length === 0 ? (
              <div className="text-sm text-emerald-700 flex items-center gap-2">
                <span className="size-2 rounded-full bg-emerald-500" />
                No active issues detected.
              </div>
            ) : (
              <div className="space-y-2">
                {diseases.map(d => (
                  <div key={d.id} className="border rounded-lg p-3 bg-rose-50/50">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-sm">{DISEASE_LABELS[d.type]}</div>
                      <Badge variant="destructive" className="text-[10px]">{d.severity}%</Badge>
                    </div>
                    <Progress value={d.severity} className="my-2 h-1.5" />
                    <div className="text-[11px] text-stone-600">💊 {d.suggestedTreatment}</div>
                    <div className="flex items-center justify-between mt-2 text-[10px] text-stone-500">
                      <span>AI confidence {d.aiConfidence}%</span>
                      <Badge variant={d.treatmentApplied?"default":"outline"} className="text-[10px]">
                        {d.treatmentApplied ? "✓ Treated" : "Pending treatment"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-5 flex flex-col items-center">
            <h3 className="font-bold mb-3 self-start">📷 QR Sticker</h3>
            <BedQR bedId={bed.id} />
            <div className="text-[11px] text-stone-500 mt-2 text-center">Print and stick on bed marker. Scanning opens this profile.</div>
          </Card>
        </div>
      </div>
    </div>
  );
}
