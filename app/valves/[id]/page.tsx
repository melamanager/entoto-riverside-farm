import { notFound } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ArrowLeft, Sprout, Wheat, AlertTriangle, Calendar, Package, Bug, Droplets, CheckCircle2, Camera } from "lucide-react";
import { ValveIcon } from "@/components/valve-icon";
import { HarvestChart } from "@/components/harvest-chart";
import { VALVE_STATES, SOIL_READINGS, CAMERA_ALERTS } from "@/lib/data";
import { DISEASE_LABELS } from "@/lib/types";
import type { HarvestRecord, DiseaseReport } from "@/lib/types";
import type { FertigationRecord, PackagingRecord } from "@/lib/erp-types";
import { prisma } from "@/lib/prisma";

function plantsInBed(bed: { lengthM: number; plantsPerMeter: number }): number {
  return bed.lengthM * bed.plantsPerMeter;
}

export default async function ValvePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const valve = await prisma.valve.findUnique({ where: { id } });
  if (!valve) notFound();

  const [beds, farmersAll, harvestRows, diseaseRows, fertigations, packagingRows] = await Promise.all([
    prisma.bed.findMany({ where: { valveId: id } }),
    prisma.farmer.findMany(),
    prisma.harvestRecord.findMany({ where: { bed: { valveId: id } } }),
    prisma.diseaseReport.findMany({ where: { bed: { valveId: id } } }),
    prisma.fertigationRecord.findMany({ where: { valveId: id } }),
    prisma.packagingRecord.findMany({ where: { valveId: id } }),
  ]);
  const harvests = harvestRows.map(h => ({ ...h, kg: Number(h.kg) }));
  const diseases = diseaseRows.map(d => ({ ...d, reportedAt: d.reportedAt.toISOString() }));
  const packagings = packagingRows.map(p => ({ ...p, packedKg: Number(p.packedKg), lostKg: Number(p.lostKg) }));
  const supervisor = farmersAll.find(f => f.id === valve.supervisorId);
  const valveFarmers = farmersAll.filter(f =>
    Array.isArray(f.assignedValves) && (f.assignedValves as string[]).includes(valve.id) && f.role === "farmer");
  const totalKg = harvests.reduce((s, h) => s + h.kg, 0);
  const valveState = VALVE_STATES.find(vs => vs.valveId === valve.id);
  const soilReadings = SOIL_READINGS().filter(sr => beds.some(b => b.id === sr.bedId));
  const cameraAlerts = CAMERA_ALERTS.filter(ca => beds.some(b => b.id === ca.bedId));

  function getFarmer(farmerId: string) {
    return farmersAll.find(f => f.id === farmerId);
  }

  const series: Record<string, number> = {};
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    series[d.toISOString().split("T")[0]] = 0;
  }
  harvests.forEach(h => { if (series[h.date] !== undefined) series[h.date] += Number(h.kg); });
  const chartData = Object.entries(series).map(([date, kg]) => ({
    date: new Date(date).toLocaleDateString("en", { month: "short", day: "numeric" }),
    kg: Math.round(kg * 10) / 10,
  }));

  const bedsRanked = beds.map(b => ({
    b,
    kg: harvests.filter(h => h.bedId === b.id).reduce((s, h) => s + h.kg, 0),
  })).sort((a, b_) => b_.kg - a.kg);

  const avgSoilMoisture = soilReadings.length > 0
    ? Math.round(soilReadings.reduce((s, sr) => s + sr.moisturePct, 0) / soilReadings.length)
    : 0;
  const warningSoil = soilReadings.filter(sr => sr.status !== "optimal").length;

  type LogEntry = { date: string; kind: "harvest" | "disease" | "fertigation" | "packaging"; data: unknown };
  const log: LogEntry[] = [
    ...harvests.map(h => ({ date: h.date, kind: "harvest" as const, data: h })),
    ...diseases.map(d => ({ date: d.reportedAt.slice(0, 10), kind: "disease" as const, data: d })),
    ...fertigations.map(f => ({ date: f.applicationDate, kind: "fertigation" as const, data: f })),
    ...packagings.map(p => ({ date: p.packedDate, kind: "packaging" as const, data: p })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="p-6 md:p-8 max-w-[1400px] mx-auto space-y-6">
      <Link href="/valves" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> All valves
      </Link>

      <div className="flex items-center justify-between gap-6 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="size-14 rounded-2xl grid place-items-center text-white font-bold text-xl shadow-lg" style={{ background: valve.color }}>
            {valve.name.split(" ")[1]}
          </div>
          <div>
            <h1 className="text-2xl font-bold">{valve.name}</h1>
            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
              <ValveIcon size={14} /> {valve.irrigationSchedule}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Avatar className="size-10 ring-2 ring-border">
            <AvatarFallback className="bg-muted text-muted-foreground text-xs font-semibold">{supervisor?.avatar}</AvatarFallback>
          </Avatar>
          <div className="text-sm">
            <div className="font-medium">{supervisor?.name}</div>
            <div className="text-xs text-muted-foreground">Supervisor</div>
          </div>
        </div>
      </div>

      {/* IoT Live Panel */}
      {valveState && (
        <div className="rounded-2xl bg-card border border-border p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className={`size-2 rounded-full ${valveState.isOpen ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground"}`} />
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Live IoT — {valve.name}</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-muted/40 rounded-xl p-3 border border-border">
              <div className="text-[9px] text-muted-foreground uppercase tracking-wide mb-1">Status</div>
              <div className={`text-sm font-bold ${valveState.isOpen ? "text-emerald-600" : "text-muted-foreground"}`}>
                {valveState.isOpen ? "● Open" : "○ Closed"}
              </div>
              <div className="text-[9px] text-muted-foreground mt-0.5 capitalize">{valveState.mode} mode</div>
            </div>
            <div className="bg-muted/40 rounded-xl p-3 border border-border">
              <div className="text-[9px] text-muted-foreground uppercase tracking-wide mb-1">Flow Rate</div>
              <div className="text-sm font-bold text-foreground tabular-nums">{valveState.flowRateLph.toLocaleString()} L/h</div>
              <div className="text-[9px] text-muted-foreground mt-0.5">{valveState.pressureBar} bar pressure</div>
            </div>
            <div className="bg-muted/40 rounded-xl p-3 border border-border">
              <div className="text-[9px] text-muted-foreground uppercase tracking-wide mb-1">Today Used</div>
              <div className="text-sm font-bold text-foreground tabular-nums">{valveState.totalLitersToday?.toLocaleString()} L</div>
              <div className="text-[9px] text-muted-foreground mt-0.5">liters today</div>
            </div>
            <div className="bg-muted/40 rounded-xl p-3 border border-border">
              <div className="text-[9px] text-muted-foreground uppercase tracking-wide mb-1">Avg Soil Moisture</div>
              <div className={`text-sm font-bold tabular-nums ${avgSoilMoisture >= 60 ? "text-emerald-600" : avgSoilMoisture >= 40 ? "text-amber-600" : "text-red-600"}`}>
                {avgSoilMoisture}%
              </div>
              <div className="text-[9px] text-muted-foreground mt-0.5">{warningSoil} beds need attention</div>
            </div>
            <div className="bg-muted/40 rounded-xl p-3 border border-border">
              <div className="text-[9px] text-muted-foreground uppercase tracking-wide mb-1">Next Event</div>
              <div className="text-xs font-bold text-foreground leading-snug">{valveState.nextScheduledEvent}</div>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Sprout className="size-3.5" /> Beds</div>
          <div className="text-3xl font-bold mt-1">{beds.length}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><ValveIcon size={14} /> Plants</div>
          <div className="text-3xl font-bold mt-1">{beds.reduce((s, b) => s + plantsInBed(b), 0).toLocaleString()}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Wheat className="size-3.5" /> Total harvest</div>
          <div className="text-3xl font-bold mt-1">{totalKg.toFixed(1)}<span className="text-sm font-normal text-muted-foreground"> kg</span></div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><AlertTriangle className="size-3.5" /> Active alerts</div>
          <div className="text-3xl font-bold mt-1 text-rose-600">{diseases.filter(d => d.status !== "resolved").length}</div>
        </Card>
      </div>

      {/* Camera alerts */}
      {cameraAlerts.length > 0 && (
        <Card className="p-5">
          <h3 className="font-bold mb-3 flex items-center gap-2">
            <Camera className="size-4 text-muted-foreground" /> Camera Alerts — {valve.name}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {cameraAlerts.map(ca => (
              <div key={ca.id} className={`rounded-xl p-3 border border-border bg-gradient-to-br ${ca.bgGradient}`}>
                <div className="flex items-start justify-between mb-1.5">
                  <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${
                    ca.alertType === "disease" ? "bg-red-900/80 text-red-200"
                    : ca.alertType === "ripeness" ? "bg-emerald-900/80 text-emerald-200"
                    : ca.alertType === "pest" ? "bg-amber-900/80 text-amber-200"
                    : "bg-slate-900/80 text-slate-200"
                  }`}>
                    {ca.alertType}
                  </span>
                  <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${
                    ca.status === "new" ? "bg-red-900/60 text-red-300"
                    : ca.status === "reviewed" ? "bg-amber-900/60 text-amber-300"
                    : "bg-emerald-900/60 text-emerald-300"
                  }`}>
                    {ca.status}
                  </span>
                </div>
                <div className="text-xs font-bold text-white">{ca.label}</div>
                <div className="text-[10px] text-white/70 mt-0.5">
                  <Link href={`/beds/${ca.bedId}`} className="hover:underline">{ca.bedId}</Link>
                  {" "}· {Math.round(ca.confidence * 100)}% confidence
                </div>
                <div className="text-[10px] text-white/60 mt-1 leading-snug line-clamp-2">{ca.description}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

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
              const soil = soilReadings.find(sr => sr.bedId === b.id);
              return (
                <Link href={`/beds/${b.id}`} key={b.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent">
                  <div className="text-muted-foreground font-mono text-xs w-5 text-center">#{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between text-sm">
                      <span className="font-mono font-semibold">{b.id}</span>
                      <span className="tabular-nums">{kg.toFixed(1)} kg</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                      {b.variety}
                      {soil && (
                        <span className={`text-[9px] px-1 rounded ${soil.status === "optimal" ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30" : "text-amber-600 bg-amber-50 dark:bg-amber-950/30"}`}>
                          💧 {soil.moisturePct}%
                        </span>
                      )}
                    </div>
                    <div className="mt-1 h-1 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${(kg / max) * 100 || 3}%` }} />
                    </div>
                  </div>
                  <span className={`size-2.5 rounded-full ${b.health === "healthy" ? "bg-emerald-500" : b.health === "warning" ? "bg-amber-500" : "bg-rose-500"}`} />
                </Link>
              );
            })}
          </div>
        </Card>

        {/* Farmers */}
        <Card className="p-5">
          <h3 className="font-bold mb-3">👥 Assigned farmers</h3>
          <div className="space-y-2">
            {[supervisor, ...valveFarmers].filter(Boolean).map(f => (
              <div key={f!.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent">
                <Avatar className="size-10">
                  <AvatarFallback className="bg-muted text-muted-foreground text-xs font-semibold">{f!.avatar}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="text-sm font-medium">{f!.name}</div>
                  <div className="text-[11px] text-muted-foreground capitalize">{f!.role} · {f!.phone}</div>
                </div>
                <Badge variant="outline" className="text-[10px]">Score {f!.performanceScore}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Soil readings table */}
      {soilReadings.length > 0 && (
        <Card className="p-5">
          <h3 className="font-bold mb-3 flex items-center gap-2">
            <Droplets className="size-4 text-blue-500" /> Soil Sensor Readings
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground border-b border-border">
                  <th className="text-left py-2 pr-4">Bed</th>
                  <th className="text-right py-2 pr-4">Moisture</th>
                  <th className="text-right py-2 pr-4">Temp</th>
                  <th className="text-right py-2 pr-4">EC</th>
                  <th className="text-right py-2 pr-4">pH</th>
                  <th className="text-right py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {soilReadings.map(sr => (
                  <tr key={sr.bedId} className="border-b border-border/50 hover:bg-accent/30">
                    <td className="py-1.5 pr-4 font-mono font-semibold">
                      <Link href={`/beds/${sr.bedId}`} className="hover:text-primary">{sr.bedId}</Link>
                    </td>
                    <td className="py-1.5 pr-4 text-right tabular-nums">
                      <span className={sr.moisturePct < 50 ? "text-amber-600 font-bold" : ""}>{sr.moisturePct}%</span>
                    </td>
                    <td className="py-1.5 pr-4 text-right tabular-nums">{sr.tempC}°C</td>
                    <td className="py-1.5 pr-4 text-right tabular-nums">
                      <span className={sr.ecMsCm > 2.5 ? "text-amber-600 font-bold" : ""}>{sr.ecMsCm}</span>
                    </td>
                    <td className="py-1.5 pr-4 text-right tabular-nums">
                      <span className={sr.ph < 5.8 ? "text-amber-600 font-bold" : ""}>{sr.ph}</span>
                    </td>
                    <td className="py-1.5 text-right">
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                        sr.status === "optimal" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                        : sr.status === "warning" ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
                        : "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400"
                      }`}>
                        {sr.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Activity log */}
      <Card className="p-5">
        <h3 className="font-bold mb-4 flex items-center gap-2 text-foreground">
          <Calendar className="size-4 text-muted-foreground" /> Zone Activity Log
        </h3>
        <div className="relative pl-7 space-y-3">
          <div className="absolute left-2.5 top-1 bottom-1 w-px bg-border" />
          {log.slice(0, 25).map((entry, i) => {
            const iconClass = "absolute -left-[18px] top-1 size-5 rounded-full border-2 grid place-items-center";
            if (entry.kind === "harvest") {
              const h = entry.data as HarvestRecord;
              const bed = beds.find(b => b.id === h.bedId);
              const farmer = getFarmer(h.farmerId);
              return (
                <div key={i} className="relative">
                  <div className={`${iconClass} bg-primary/15 border-primary/40`}><Wheat className="size-2.5 text-primary" /></div>
                  <div className="bg-primary/10 border border-primary/20 rounded-lg px-3 py-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-primary">Harvest — {Number(h.kg).toFixed(1)} kg · {bed?.id}</span>
                      <span className="text-primary/70 tabular-nums">{new Date(h.date).toLocaleDateString("en", { day: "numeric", month: "short" })}</span>
                    </div>
                    <div className="text-primary/70 mt-0.5">Grade {h.qualityGrade} · {bed?.variety} · {farmer?.name}</div>
                  </div>
                </div>
              );
            }
            if (entry.kind === "disease") {
              const d = entry.data as DiseaseReport;
              const bed = beds.find(b => b.id === d.bedId);
              return (
                <div key={i} className="relative">
                  <div className={`${iconClass} bg-red-100 border-red-400 dark:bg-red-950/40`}><Bug className="size-2.5 text-red-700" /></div>
                  <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-xs dark:bg-red-950/20 dark:border-red-900/40">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-red-800 dark:text-red-400">{DISEASE_LABELS[d.type]} · {bed?.id}</span>
                      <span className="text-red-500 tabular-nums">{new Date(entry.date).toLocaleDateString("en", { day: "numeric", month: "short" })}</span>
                    </div>
                    <div className="text-red-600 dark:text-red-500 mt-0.5 flex items-center gap-2">
                      Severity {d.severity}%
                      {d.treatmentApplied && <span className="flex items-center gap-0.5 text-primary"><CheckCircle2 className="size-2.5" /> Treated</span>}
                    </div>
                  </div>
                </div>
              );
            }
            if (entry.kind === "fertigation") {
              const f = entry.data as FertigationRecord;
              const worker = getFarmer(f.responsibleWorkerId);
              return (
                <div key={i} className="relative">
                  <div className={`${iconClass} bg-blue-100 border-blue-400 dark:bg-blue-950/40`}><Droplets className="size-2.5 text-blue-700" /></div>
                  <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-xs dark:bg-blue-950/20 dark:border-blue-900/40">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-blue-800 dark:text-blue-400">{f.fertilizerType}</span>
                      <span className="text-blue-500 tabular-nums">{new Date(f.applicationDate).toLocaleDateString("en", { day: "numeric", month: "short" })}</span>
                    </div>
                    <div className="text-blue-600 dark:text-blue-500 mt-0.5">{f.dosageGPerL}g/L · {f.waterVolumeLiters}L · {f.applicationMethod} · {worker?.name}{f.notes ? ` — ${f.notes}` : ""}</div>
                  </div>
                </div>
              );
            }
            if (entry.kind === "packaging") {
              const p = entry.data as PackagingRecord;
              const packer = getFarmer(p.packedBy);
              return (
                <div key={i} className="relative">
                  <div className={`${iconClass} bg-amber-100 border-amber-400 dark:bg-amber-950/40`}><Package className="size-2.5 text-amber-700" /></div>
                  <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-xs dark:bg-amber-950/20 dark:border-amber-900/40">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-amber-800 dark:text-amber-400">{p.batchNumber} · {p.purpose} · {p.variety}</span>
                      <span className="text-amber-600 tabular-nums">{new Date(p.packedDate).toLocaleDateString("en", { day: "numeric", month: "short" })}</span>
                    </div>
                    <div className="text-amber-700 dark:text-amber-500 mt-0.5">
                      {p.packedKg}kg · {p.cartonCount} cartons · {p.plateCount} plates{p.lostKg > 0 ? ` · ${p.lostKg.toFixed(1)} kg lost` : ""} · {packer?.name}
                    </div>
                  </div>
                </div>
              );
            }
            return null;
          })}
          {log.length === 0 && <p className="text-sm text-muted-foreground">No activity recorded yet.</p>}
        </div>
      </Card>
    </div>
  );
}
