"use client";

import { useEffect, useState } from "react";
import { use } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ArrowLeft, Sprout, Users, Wheat, AlertTriangle, Calendar, Package, Bug, Droplets, CheckCircle2, FlaskConical } from "lucide-react";
import { ValveIcon } from "@/components/valve-icon";
import { HarvestChart } from "@/components/harvest-chart";
import type { Valve, Bed, Farmer, HarvestRecord, DiseaseReport } from "@/lib/types";
import type { FertigationRecord, PackagingRecord } from "@/lib/erp-types";
import { DISEASE_LABELS } from "@/lib/types";

interface BedWithRelations extends Bed {
  harvestRecords: HarvestRecord[];
  diseaseReports: DiseaseReport[];
}

interface ValveWithBeds extends Valve {
  beds: BedWithRelations[];
}

function plantsInBed(bed: Bed): number { return bed.lengthM * bed.plantsPerMeter; }

function totalKgBed(bed: BedWithRelations): number {
  return bed.harvestRecords.reduce((s, h) => s + Number(h.kg), 0);
}

export default function ValvePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [valve, setValve]               = useState<ValveWithBeds | null>(null);
  const [farmers, setFarmers]           = useState<Farmer[]>([]);
  const [fertigations, setFertigations] = useState<FertigationRecord[]>([]);
  const [packagingRecords, setPackagingRecords] = useState<PackagingRecord[]>([]);
  const [notFound404, setNotFound404]   = useState(false);

  useEffect(() => {
    fetch(`/api/valves/${id}`)
      .then(r => {
        if (r.status === 404) { setNotFound404(true); return null; }
        return r.json();
      })
      .then(data => { if (data) setValve(data as ValveWithBeds); });
    fetch("/api/farmers").then(r => r.json()).then(setFarmers);
    fetch("/api/fertigation").then(r => r.json()).then(setFertigations);
    fetch("/api/packaging").then(r => r.json()).then(setPackagingRecords);
  }, [id]);

  if (notFound404) return notFound();
  if (!valve) return null;

  const vBeds = valve.beds;
  const harvests = vBeds.flatMap(b => b.harvestRecords);
  const diseases = vBeds.flatMap(b => b.diseaseReports);
  const supervisor = farmers.find(f => f.id === valve.supervisorId);
  const valveFarmers = farmers.filter(f => f.assignedValves.includes(valve.id) && f.role === "farmer");

  function getFarmer(farmerId: string) {
    return farmers.find(f => f.id === farmerId);
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

  const bedsRanked = [...vBeds].map(b => ({ b, kg: totalKgBed(b) })).sort((a, b) => b.kg - a.kg);

  const totalKgValveValue = vBeds.reduce((s, b) => s + totalKgBed(b), 0);

  // ── Activity log ──────────────────────────────────────────────────────────
  type LogEntry = { date: string; kind: "harvest"|"disease"|"fertigation"|"packaging"; data: unknown };
  const log: LogEntry[] = [
    ...harvests.map(h => ({ date: h.date, kind: "harvest" as const, data: h })),
    ...diseases.map(d => ({ date: d.reportedAt.slice(0,10), kind: "disease" as const, data: d })),
    ...fertigations.filter(f => f.valveId === valve.id).map(f => ({ date: f.applicationDate, kind: "fertigation" as const, data: f })),
    ...packagingRecords.filter(p => p.valveId === valve.id).map(p => ({ date: p.packedDate, kind: "packaging" as const, data: p })),
  ].sort((a,b) => b.date.localeCompare(a.date));

  return (
    <div className="p-6 md:p-8 max-w-[1400px] mx-auto space-y-6">
      <Link href="/valves" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> All valves
      </Link>

      <div className="flex items-center justify-between gap-6 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="size-14 rounded-2xl grid place-items-center text-white font-bold text-xl shadow-lg" style={{background: valve.color}}>
            {valve.name.split(" ")[1]}
          </div>
          <div>
            <h1 className="text-2xl font-bold">{valve.name}</h1>
            <p className="text-sm text-muted-foreground flex items-center gap-1.5"><ValveIcon size={14} /> {valve.irrigationSchedule}</p>
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

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Sprout className="size-3.5" /> Beds</div>
          <div className="text-3xl font-bold mt-1">{vBeds.length}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><ValveIcon size={14} /> Plants</div>
          <div className="text-3xl font-bold mt-1">{vBeds.reduce((s,b)=>s+plantsInBed(b),0).toLocaleString()}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Wheat className="size-3.5" /> Total harvest</div>
          <div className="text-3xl font-bold mt-1">{totalKgValveValue.toFixed(1)}<span className="text-sm font-normal text-muted-foreground"> kg</span></div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><AlertTriangle className="size-3.5" /> Active alerts</div>
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
                <Link href={`/beds/${b.id}`} key={b.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent">
                  <div className="text-muted-foreground font-mono text-xs w-5 text-center">#{i+1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between text-sm">
                      <span className="font-mono font-semibold">{b.id}</span>
                      <span className="tabular-nums">{kg.toFixed(1)} kg</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">{b.variety}</div>
                    <div className="mt-1 h-1 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{width:`${(kg/max)*100||3}%`}} />
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
              const bed = vBeds.find(b => b.id === h.bedId);
              const farmer = getFarmer(h.farmerId);
              return (
                <div key={i} className="relative">
                  <div className={`${iconClass} bg-primary/15 border-primary/40`}><Wheat className="size-2.5 text-primary" /></div>
                  <div className="bg-primary/10 border border-primary/20 rounded-lg px-3 py-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-primary">Harvest — {Number(h.kg).toFixed(1)} kg · {bed?.id}</span>
                      <span className="text-primary/70 tabular-nums">{new Date(h.date).toLocaleDateString("en",{day:"numeric",month:"short"})}</span>
                    </div>
                    <div className="text-primary/70 mt-0.5">Grade {h.qualityGrade} · {bed?.variety} · {farmer?.name}</div>
                  </div>
                </div>
              );
            }
            if (entry.kind === "disease") {
              const d = entry.data as DiseaseReport;
              const bed = vBeds.find(b => b.id === d.bedId);
              return (
                <div key={i} className="relative">
                  <div className={`${iconClass} bg-red-100 border-red-400`}><Bug className="size-2.5 text-red-700" /></div>
                  <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-red-800">{DISEASE_LABELS[d.type]} · {bed?.id}</span>
                      <span className="text-red-500 tabular-nums">{new Date(entry.date).toLocaleDateString("en",{day:"numeric",month:"short"})}</span>
                    </div>
                    <div className="text-red-600 mt-0.5 flex items-center gap-2">
                      Severity {d.severity}%
                      {d.treatmentApplied && <span className="flex items-center gap-0.5 text-primary"><CheckCircle2 className="size-2.5" /> Treated</span>}
                    </div>
                  </div>
                </div>
              );
            }
            if (entry.kind === "fertigation") {
              const f = entry.data as FertigationRecord;
              const worker = farmers.find(x => x.id === f.responsibleWorkerId);
              return (
                <div key={i} className="relative">
                  <div className={`${iconClass} bg-blue-100 border-blue-400`}><Droplets className="size-2.5 text-blue-700" /></div>
                  <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-blue-800">{f.fertilizerType}</span>
                      <span className="text-blue-500 tabular-nums">{new Date(f.applicationDate).toLocaleDateString("en",{day:"numeric",month:"short"})}</span>
                    </div>
                    <div className="text-blue-600 mt-0.5">{f.dosageGPerL}g/L · {f.waterVolumeLiters}L · {f.applicationMethod} · {worker?.name}{f.notes ? ` — ${f.notes}` : ""}</div>
                  </div>
                </div>
              );
            }
            if (entry.kind === "packaging") {
              const p = entry.data as PackagingRecord;
              const packer = getFarmer(p.packedBy);
              return (
                <div key={i} className="relative">
                  <div className={`${iconClass} bg-amber-100 border-amber-400`}><Package className="size-2.5 text-amber-700" /></div>
                  <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-amber-800">{p.batchNumber} · {p.purpose} · {p.variety}</span>
                      <span className="text-amber-600 tabular-nums">{new Date(p.packedDate).toLocaleDateString("en",{day:"numeric",month:"short"})}</span>
                    </div>
                    <div className="text-amber-700 mt-0.5">
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
