import { notFound } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ArrowLeft, Sprout, Wheat, AlertTriangle, Calendar, Package, Bug, Droplets, CheckCircle2 } from "lucide-react";
import { ValveIcon } from "@/components/valve-icon";
import { HarvestChart } from "@/components/harvest-chart";
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

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 6);
  const weekAgoStr = weekAgo.toISOString().split("T")[0];
  const [beds, farmersAll, harvestRows, diseaseRows, fertigations, packagingRows, wateringLogs] = await Promise.all([
    prisma.bed.findMany({ where: { valveId: id } }),
    prisma.farmer.findMany(),
    prisma.harvestRecord.findMany({ where: { bed: { valveId: id } } }),
    prisma.diseaseReport.findMany({ where: { bed: { valveId: id } } }),
    prisma.fertigationRecord.findMany({ where: { valveId: id } }),
    prisma.packagingRecord.findMany({ where: { valveId: id } }),
    prisma.irrigationLog.findMany({ where: { valveId: id, date: { gte: weekAgoStr } }, orderBy: [{ date: "desc" }, { createdAt: "desc" }] }),
  ]);
  const harvests = harvestRows.map(h => ({ ...h, kg: Number(h.kg) }));
  const diseases = diseaseRows.map(d => ({ ...d, reportedAt: d.reportedAt.toISOString() }));
  const packagings = packagingRows.map(p => ({ ...p, packedKg: Number(p.packedKg), lostKg: Number(p.lostKg) }));
  const supervisor = farmersAll.find(f => f.id === valve.supervisorId);
  const valveFarmers = farmersAll.filter(f =>
    Array.isArray(f.assignedValves) && (f.assignedValves as string[]).includes(valve.id) && f.role === "farmer");
  const totalKg = harvests.reduce((s, h) => s + h.kg, 0);

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

      {/* Watering — real irrigation log data */}
      <div className="rounded-2xl bg-card border border-border p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className={`size-2 rounded-full ${wateringLogs[0]?.date === new Date().toISOString().split("T")[0] ? "bg-emerald-500" : "bg-amber-500"}`} />
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Watering — {valve.name} · last 7 days</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-muted/40 rounded-xl p-3 border border-border">
            <div className="text-[9px] text-muted-foreground uppercase tracking-wide mb-1">Last Watered</div>
            <div className="text-sm font-bold text-foreground">
              {wateringLogs[0]
                ? `${new Date(`${wateringLogs[0].date}T00:00:00`).toLocaleDateString("en", { month: "short", day: "numeric" })}${wateringLogs[0].startTime ? ` · ${wateringLogs[0].startTime}` : ""}`
                : "No log yet"}
            </div>
            <div className="text-[9px] text-muted-foreground mt-0.5 capitalize">{wateringLogs[0]?.status ?? "log via Daily Routines"}</div>
          </div>
          <div className="bg-muted/40 rounded-xl p-3 border border-border">
            <div className="text-[9px] text-muted-foreground uppercase tracking-wide mb-1">Sessions</div>
            <div className="text-sm font-bold text-foreground tabular-nums">{wateringLogs.filter(l => l.status !== "skipped").length}</div>
            <div className="text-[9px] text-muted-foreground mt-0.5">{wateringLogs.filter(l => l.status === "skipped").length} skipped</div>
          </div>
          <div className="bg-muted/40 rounded-xl p-3 border border-border">
            <div className="text-[9px] text-muted-foreground uppercase tracking-wide mb-1">Water This Week</div>
            <div className="text-sm font-bold text-foreground tabular-nums">{Math.round(wateringLogs.reduce((s, l) => s + (l.waterVolumeL ?? 0), 0)).toLocaleString()} L</div>
            <div className="text-[9px] text-muted-foreground mt-0.5">{Math.round(wateringLogs.reduce((s, l) => s + (l.durationMin ?? 0), 0))} min total</div>
          </div>
          <div className="bg-muted/40 rounded-xl p-3 border border-border">
            <div className="text-[9px] text-muted-foreground uppercase tracking-wide mb-1">Schedule</div>
            <div className="text-xs font-bold text-foreground leading-snug">{valve.irrigationSchedule}</div>
          </div>
        </div>
      </div>

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
                <Link href={`/beds/${b.id}`} key={b.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent">
                  <div className="text-muted-foreground font-mono text-xs w-5 text-center">#{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between text-sm">
                      <span className="font-mono font-semibold">{b.id}</span>
                      <span className="tabular-nums">{kg.toFixed(1)} kg</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                      {b.variety}
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
                <Badge variant="outline" className="text-[10px]">Score {f!.performanceScore ?? "—"}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>

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
                  <div className={`${iconClass} bg-red-500/15 border-red-500/40`}><Bug className="size-2.5 text-red-300" /></div>
                  <div className="bg-red-500/10 border border-red-500/25 rounded-lg px-3 py-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-red-300">{DISEASE_LABELS[d.type]} · {bed?.id}</span>
                      <span className="text-red-400 tabular-nums">{new Date(entry.date).toLocaleDateString("en", { day: "numeric", month: "short" })}</span>
                    </div>
                    <div className="text-red-400 mt-0.5 flex items-center gap-2">
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
