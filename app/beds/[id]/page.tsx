import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Sprout, Calendar, MapPin, User, Wheat, AlertTriangle, FlaskConical, Package, Bug, Droplets, CheckCircle2, TrendingUp } from "lucide-react";
import { AIDetectDialog } from "@/components/ai-detect-dialog";
import { BedQR } from "@/components/bed-qr";
import { HarvestChart } from "@/components/harvest-chart";
import { prisma } from "@/lib/prisma";
import { DISEASE_LABELS, GROWTH_STAGE_LABELS } from "@/lib/types";

const STAGES = ["planted", "vegetative", "flowering", "fruiting", "ripening", "harvest"] as const;

const STAGE_DAYS_FROM_PLANTED: Record<string, number> = {
  planted: 0, vegetative: 14, flowering: 28, fruiting: 38, ripening: 52, harvest: 56,
};
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

export default async function BedPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const bed = await prisma.bed.findUnique({
    where: { id },
    include: {
      valve: true,
      farmer: true,
      harvestRecords: { orderBy: { date: "desc" } },
      diseaseReports: { orderBy: { reportedAt: "desc" } },
      fertigationRecords: { orderBy: { applicationDate: "desc" }, include: { worker: true } },
      plantingRecords: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!bed) notFound();

  // Fetch packaging records for this bed's valve+variety
  const packagingRecords = await prisma.packagingRecord.findMany({
    where: { valveId: bed.valveId, variety: bed.variety },
    orderBy: { packedDate: "desc" },
  });

  // Fetch fertigation records for the whole valve (for activity log, matching original logic)
  const valveFertigationRecords = await prisma.fertigationRecord.findMany({
    where: { valveId: bed.valveId, status: "applied" },
    include: { worker: true },
    orderBy: { applicationDate: "desc" },
  });

  const valve = bed.valve;
  const farmer = bed.farmer;
  const harvests = bed.harvestRecords.map(h => ({
    ...h,
    kg: parseFloat(h.kg.toString()),
    reportedAt: undefined,
  })).sort((a, b) => b.date.localeCompare(a.date));
  const diseases = bed.diseaseReports.map(d => ({
    ...d,
    reportedAt: d.reportedAt instanceof Date ? d.reportedAt.toISOString() : String(d.reportedAt),
    treatmentSteps: (d.treatmentSteps as string[]) ?? [],
    notificationChannels: (d.notificationChannels as Array<"telegram" | "sms">) ?? [],
  }));
  const totalKg = harvests.reduce((s, h) => s + h.kg, 0);
  const plants = Math.round(bed.lengthM * bed.plantsPerMeter);
  const stageIdx = STAGES.indexOf(bed.stage as typeof STAGES[number]);

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

  const yieldPerMeter = totalKg / bed.lengthM;
  const yieldPerPlant = totalKg / plants;

  const KG_PER_M_TARGET = 0.38;
  const plannedHarvestStart = addDays(bed.plantedDate, 56);
  const harvestsSorted = [...harvests].sort((a, b) => a.date.localeCompare(b.date));
  const actualHarvestStart = harvestsSorted[0]?.date ?? null;
  const plannedKgPerPick = Math.round(bed.lengthM * KG_PER_M_TARGET * 10) / 10;
  const avgKgPerPick = harvests.length > 0 ? Math.round((totalKg / harvests.length) * 10) / 10 : 0;
  const gradeACount = harvests.filter(h => h.qualityGrade === "A").length;
  const gradeAPct = harvests.length > 0 ? Math.round((gradeACount / harvests.length) * 100) : 0;
  const gradeATarget = 75;
  const yieldEfficiency = KG_PER_M_TARGET > 0 ? Math.round((yieldPerMeter / KG_PER_M_TARGET) * 100) : 0;

  // ── Activity log ──────────────────────────────────────────────────────────
  type LogEntry = { date: string; kind: "harvest" | "disease" | "fertigation" | "packaging" | "stage"; data: unknown };
  const stageHistory = STAGES.slice(0, stageIdx + 1).map(s => ({
    date: addDays(bed.plantedDate, STAGE_DAYS_FROM_PLANTED[s]),
    kind: "stage" as const,
    data: s,
  }));
  const log: LogEntry[] = [
    ...harvests.map(h => ({ date: h.date, kind: "harvest" as const, data: h })),
    ...diseases.map(d => ({ date: d.reportedAt.slice(0, 10), kind: "disease" as const, data: d })),
    ...valveFertigationRecords.map(f => ({ date: f.applicationDate, kind: "fertigation" as const, data: f })),
    ...packagingRecords.map(p => ({
      date: p.packedDate,
      kind: "packaging" as const,
      data: {
        ...p,
        packedKg: parseFloat(p.packedKg.toString()),
        lostKg: parseFloat(p.lostKg.toString()),
      },
    })),
    ...stageHistory,
  ].sort((a, b) => b.date.localeCompare(a.date));

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
          <Badge variant="outline">{GROWTH_STAGE_LABELS[bed.stage as keyof typeof GROWTH_STAGE_LABELS]}</Badge>
          <AIDetectDialog bedId={bed.id} />
        </div>
      </div>

      {/* Bed Summary */}
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-800 to-slate-700 p-4 shadow-lg">
        <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-3">Bed Summary</div>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {[
            { icon: "🌾", label: "Total Yield",   value: `${totalKg.toFixed(1)} kg`,           sub: `${harvests.length} picks` },
            { icon: "📏", label: "Efficiency",     value: `${yieldPerMeter.toFixed(2)} kg/m`,   sub: "yield per metre" },
            { icon: "🌱", label: "Age",            value: `${Math.floor((new Date("2026-05-20").getTime() - new Date(bed.plantedDate).getTime()) / 86400000)}d`, sub: "days growing" },
            { icon: "📊", label: "Stage",          value: GROWTH_STAGE_LABELS[bed.stage as keyof typeof GROWTH_STAGE_LABELS], sub: `${stageIdx + 1} of ${STAGES.length}` },
            { icon: "⭐", label: "Grade A",         value: `${gradeAPct}%`,                      sub: `${gradeACount}/${harvests.length} picks` },
            { icon: "💚", label: "Health",          value: bed.health.charAt(0).toUpperCase() + bed.health.slice(1), sub: diseases.length > 0 ? `${diseases.length} issue${diseases.length > 1 ? "s" : ""}` : "No issues" },
          ].map(kpi => (
            <div key={kpi.label} className="bg-white/8 rounded-xl p-3 border border-white/8">
              <div className="text-lg mb-1">{kpi.icon}</div>
              <div className="text-white font-bold text-sm tabular-nums leading-tight">{kpi.value}</div>
              <div className="text-slate-400 text-[9px] mt-0.5 uppercase tracking-wide">{kpi.label}</div>
              <div className="text-slate-500 text-[9px]">{kpi.sub}</div>
            </div>
          ))}
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
                <span className={`text-[10px] text-center leading-tight ${i<=stageIdx?"text-emerald-700 font-medium":"text-stone-400"}`}>{GROWTH_STAGE_LABELS[s]}</span>
              </div>
            ))}
          </div>
          <div className="absolute top-3.5 left-0 right-0 h-0.5 bg-stone-100 -z-10">
            <div className="h-full bg-emerald-500" style={{width:`${(stageIdx/(STAGES.length-1))*100}%`}} />
          </div>
        </div>
      </Card>

      {/* Planned vs Achievement */}
      <Card className="p-5">
        <h3 className="font-bold mb-4 flex items-center gap-2">
          <TrendingUp className="size-4 text-blue-500" /> Planned vs Achievement
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {
              label: "Harvest Start",
              planned: new Date(plannedHarvestStart).toLocaleDateString("en", { month: "short", day: "numeric" }),
              actual: actualHarvestStart
                ? new Date(actualHarvestStart).toLocaleDateString("en", { month: "short", day: "numeric" })
                : "Not yet",
              good: actualHarvestStart !== null && actualHarvestStart <= plannedHarvestStart,
              unit: "",
            },
            {
              label: "Avg kg / Pick",
              planned: `${plannedKgPerPick} kg`,
              actual: `${avgKgPerPick} kg`,
              good: avgKgPerPick >= plannedKgPerPick,
              unit: "kg",
            },
            {
              label: "Grade A Rate",
              planned: `${gradeATarget}%`,
              actual: `${gradeAPct}%`,
              good: gradeAPct >= gradeATarget,
              unit: "%",
            },
            {
              label: "Yield Efficiency",
              planned: "100%",
              actual: `${yieldEfficiency}%`,
              good: yieldEfficiency >= 100,
              unit: "%",
            },
          ].map(item => (
            <div key={item.label} className="rounded-xl border border-slate-200 p-3">
              <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide mb-2">{item.label}</div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-400">Planned</span>
                  <span className="text-xs font-semibold text-slate-600">{item.planned}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-400">Actual</span>
                  <span className={`text-xs font-bold ${item.actual === "Not yet" ? "text-slate-400" : item.good ? "text-emerald-600" : "text-red-500"}`}>
                    {item.actual}
                  </span>
                </div>
              </div>
              {item.actual !== "Not yet" && (
                <div className={`mt-2 text-[10px] font-semibold flex items-center gap-0.5 ${item.good ? "text-emerald-600" : "text-red-500"}`}>
                  {item.good ? "↑ On track" : "↓ Below target"}
                </div>
              )}
            </div>
          ))}
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
                      <div className="font-semibold text-sm">{DISEASE_LABELS[d.type as keyof typeof DISEASE_LABELS]}</div>
                      <Badge variant="destructive" className="text-[10px]">{d.severity}%</Badge>
                    </div>
                    <Progress value={d.severity} className="my-2 h-1.5" />
                    <div className="text-[11px] text-stone-600">💊 {d.suggestedTreatment}</div>
                    <div className="flex items-center justify-between mt-2 text-[10px] text-stone-500">
                      <span>AI confidence {d.aiConfidence ?? 0}%</span>
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
      {/* Activity log */}
      <Card className="p-5">
        <h3 className="font-bold mb-4 flex items-center gap-2 text-slate-800">
          <Calendar className="size-4 text-slate-500" /> Activity Log
        </h3>
        {log.length === 0 ? (
          <p className="text-sm text-slate-400">No activity recorded yet.</p>
        ) : (
          <div className="relative pl-7 space-y-3">
            <div className="absolute left-2.5 top-1 bottom-1 w-px bg-slate-100" />
            {log.slice(0, 20).map((entry, i) => {
              const iconClass = "absolute -left-[18px] top-1 size-5 rounded-full border-2 grid place-items-center";
              if (entry.kind === "harvest") {
                const h = entry.data as typeof harvests[0];
                const f = farmer.id === h.farmerId ? farmer : null;
                return (
                  <div key={i} className="relative">
                    <div className={`${iconClass} bg-emerald-100 border-emerald-400`}><Wheat className="size-2.5 text-emerald-700" /></div>
                    <div className="bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-emerald-800">Harvest — {h.kg.toFixed(1)} kg</span>
                        <span className="text-emerald-600 tabular-nums">{new Date(h.date).toLocaleDateString("en",{day:"numeric",month:"short"})}</span>
                      </div>
                      <div className="text-emerald-600 mt-0.5">Grade {h.qualityGrade} · {f?.name ?? h.farmerId}</div>
                    </div>
                  </div>
                );
              }
              if (entry.kind === "disease") {
                const d = entry.data as typeof diseases[0];
                return (
                  <div key={i} className="relative">
                    <div className={`${iconClass} bg-red-100 border-red-400`}><Bug className="size-2.5 text-red-700" /></div>
                    <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-red-800">{DISEASE_LABELS[d.type as keyof typeof DISEASE_LABELS]}</span>
                        <span className="text-red-500 tabular-nums">{new Date(entry.date).toLocaleDateString("en",{day:"numeric",month:"short"})}</span>
                      </div>
                      <div className="text-red-600 mt-0.5 flex items-center gap-2">
                        Severity {d.severity}%
                        {d.treatmentApplied && <span className="flex items-center gap-0.5 text-emerald-700"><CheckCircle2 className="size-2.5" /> Treated</span>}
                      </div>
                    </div>
                  </div>
                );
              }
              if (entry.kind === "fertigation") {
                const f = entry.data as (typeof valveFertigationRecords[0]);
                const worker = f.worker;
                return (
                  <div key={i} className="relative">
                    <div className={`${iconClass} bg-blue-100 border-blue-400`}><Droplets className="size-2.5 text-blue-700" /></div>
                    <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-blue-800">{f.fertilizerType}</span>
                        <span className="text-blue-500 tabular-nums">{new Date(f.applicationDate).toLocaleDateString("en",{day:"numeric",month:"short"})}</span>
                      </div>
                      <div className="text-blue-600 mt-0.5">{f.dosageGPerL}g/L · {f.waterVolumeLiters}L · {f.applicationMethod} · {worker?.name}</div>
                    </div>
                  </div>
                );
              }
              if (entry.kind === "packaging") {
                const p = entry.data as { batchNumber: string; purpose: string; packedDate: string; packedKg: number; cartonCount: number; plateCount: number; lostKg: number };
                return (
                  <div key={i} className="relative">
                    <div className={`${iconClass} bg-amber-100 border-amber-400`}><Package className="size-2.5 text-amber-700" /></div>
                    <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-amber-800">{p.batchNumber} · {p.purpose}</span>
                        <span className="text-amber-600 tabular-nums">{new Date(p.packedDate).toLocaleDateString("en",{day:"numeric",month:"short"})}</span>
                      </div>
                      <div className="text-amber-700 mt-0.5">{p.packedKg}kg packed · {p.cartonCount} cartons · {p.plateCount} plates{p.lostKg > 0 ? ` · ${p.lostKg.toFixed(1)} kg lost` : ""}</div>
                    </div>
                  </div>
                );
              }
              if (entry.kind === "stage") {
                const s = entry.data as string;
                const isCurrentStage = s === bed.stage;
                return (
                  <div key={`stage-${s}`} className="relative">
                    <div className={`${iconClass} ${isCurrentStage ? "bg-emerald-500 border-emerald-600" : "bg-slate-100 border-slate-300"}`}>
                      <Sprout className={`size-2.5 ${isCurrentStage ? "text-white" : "text-slate-500"}`} />
                    </div>
                    <div className={`border rounded-lg px-3 py-2 text-xs ${isCurrentStage ? "bg-emerald-50 border-emerald-200" : "bg-slate-50 border-slate-100"}`}>
                      <div className="flex items-center justify-between">
                        <span className={`font-semibold ${isCurrentStage ? "text-emerald-800" : "text-slate-700"}`}>
                          Stage: {GROWTH_STAGE_LABELS[s as keyof typeof GROWTH_STAGE_LABELS]}
                          {isCurrentStage && <span className="ml-1.5 text-[10px] bg-emerald-200 text-emerald-800 px-1.5 py-0.5 rounded-full">Current</span>}
                        </span>
                        <span className={`tabular-nums ${isCurrentStage ? "text-emerald-600" : "text-slate-400"}`}>
                          {new Date(entry.date).toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      </div>
                      <div className={`mt-0.5 text-[10px] ${isCurrentStage ? "text-emerald-600" : "text-slate-400"}`}>
                        {STAGE_DAYS_FROM_PLANTED[s]} days from planting
                      </div>
                    </div>
                  </div>
                );
              }
              return null;
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
