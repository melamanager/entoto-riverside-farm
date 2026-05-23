"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wheat, Bug, ClipboardList, Sprout, ArrowRight, Scan } from "lucide-react";
import type { Bed, Valve, DiseaseReport } from "@/lib/types";

export default function ScanPage({ params }: { params: Promise<{ bedId: string }> }) {
  const { bedId } = use(params);
  const [bed, setBed] = useState<Bed | null | undefined>(undefined);
  const [valve, setValve] = useState<Valve | null>(null);
  const [activeDiseases, setActiveDiseases] = useState<DiseaseReport[]>([]);

  useEffect(() => {
    Promise.all([
      fetch(`/api/beds/${bedId}`).then(r => r.ok ? r.json() : null),
      fetch("/api/valves").then(r => r.json()),
      fetch("/api/diseases").then(r => r.json()),
    ]).then(([b, valves, diseases]: [Bed | null, Valve[], DiseaseReport[]]) => {
      setBed(b);
      if (b) {
        const v = valves.find((vl: Valve) => vl.id === b.valveId) ?? null;
        setValve(v);
        setActiveDiseases(diseases.filter((d: DiseaseReport) => d.bedId === bedId && d.status !== "resolved"));
      }
    });
  }, [bedId]);

  if (bed === undefined) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50">
        <Scan className="size-12 text-slate-300 mb-4" />
        <p className="text-slate-400 text-sm">Loading…</p>
      </div>
    );
  }

  if (!bed) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50">
        <Scan className="size-12 text-slate-300 mb-4" />
        <h1 className="text-xl font-bold text-slate-700 mb-2">Bed Not Found</h1>
        <p className="text-slate-500 text-sm mb-4">No bed with ID <span className="font-mono font-bold">{bedId}</span> was found.</p>
        <Link href="/beds" className="text-emerald-600 hover:underline text-sm">← Back to all beds</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 max-w-md mx-auto">
      {/* Bed header */}
      <div className="mt-8 mb-6 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-200 text-slate-600 text-xs font-semibold mb-3">
          <Scan className="size-3" /> QR Scan
        </div>
        <h1 className="text-3xl font-black text-slate-900 font-mono">{bed.id}</h1>
        <div className="text-slate-500 text-sm mt-1">{bed.variety}</div>
        <div className="flex items-center justify-center gap-2 mt-2">
          <span className="text-xs font-semibold" style={{ color: valve?.color }}>{valve?.name}</span>
          <span className="text-slate-300">·</span>
          <span className={`text-xs font-semibold capitalize ${bed.health === "healthy" ? "text-emerald-600" : bed.health === "warning" ? "text-amber-600" : "text-red-600"}`}>
            {bed.health}
          </span>
          <span className="text-slate-300">·</span>
          <span className="text-xs text-slate-500 capitalize">{bed.stage}</span>
        </div>
        {activeDiseases.length > 0 && (
          <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-100 text-red-700 text-xs font-semibold">
            <Bug className="size-3" /> {activeDiseases.length} active disease alert{activeDiseases.length > 1 ? "s" : ""}
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="space-y-3">
        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1 mb-2">Quick Actions</div>

        <Link href={`/harvest?bedId=${bed.id}`}>
          <Card className="p-4 border-2 border-emerald-200 bg-emerald-50 hover:bg-emerald-100 transition-colors cursor-pointer">
            <div className="flex items-center gap-4">
              <div className="size-12 rounded-xl bg-emerald-600 grid place-items-center">
                <Wheat className="size-6 text-white" />
              </div>
              <div className="flex-1">
                <div className="font-bold text-emerald-900">Log Harvest</div>
                <div className="text-xs text-emerald-700 mt-0.5">Record today's berry collection for this bed</div>
              </div>
              <ArrowRight className="size-5 text-emerald-600" />
            </div>
          </Card>
        </Link>

        <Link href={`/diseases?reportBed=${bed.id}`}>
          <Card className="p-4 border-2 border-red-200 bg-red-50 hover:bg-red-100 transition-colors cursor-pointer">
            <div className="flex items-center gap-4">
              <div className="size-12 rounded-xl bg-red-600 grid place-items-center">
                <Bug className="size-6 text-white" />
              </div>
              <div className="flex-1">
                <div className="font-bold text-red-900">Report Disease</div>
                <div className="text-xs text-red-700 mt-0.5">
                  {activeDiseases.length > 0
                    ? `${activeDiseases.length} open report${activeDiseases.length > 1 ? "s" : ""} — add new observation`
                    : "Spotted a problem? File a disease report"}
                </div>
              </div>
              <ArrowRight className="size-5 text-red-600" />
            </div>
          </Card>
        </Link>

        <Link href={`/tasks?bedId=${bed.id}`}>
          <Card className="p-4 border-2 border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors cursor-pointer">
            <div className="flex items-center gap-4">
              <div className="size-12 rounded-xl bg-blue-600 grid place-items-center">
                <ClipboardList className="size-6 text-white" />
              </div>
              <div className="flex-1">
                <div className="font-bold text-blue-900">Start Inspection</div>
                <div className="text-xs text-blue-700 mt-0.5">Log a bed inspection task and record observations</div>
              </div>
              <ArrowRight className="size-5 text-blue-600" />
            </div>
          </Card>
        </Link>

        <Link href={`/beds/${bed.id}`}>
          <Card className="p-4 border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer">
            <div className="flex items-center gap-4">
              <div className="size-12 rounded-xl bg-slate-200 grid place-items-center">
                <Sprout className="size-6 text-slate-600" />
              </div>
              <div className="flex-1">
                <div className="font-bold text-slate-900">View Bed Details</div>
                <div className="text-xs text-slate-500 mt-0.5">Full history, harvest records & disease reports</div>
              </div>
              <ArrowRight className="size-5 text-slate-400" />
            </div>
          </Card>
        </Link>
      </div>

      {/* Bed stats */}
      <Card className="mt-4 p-4 border border-slate-200">
        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Bed Info</div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-lg font-bold text-slate-800">{bed.lengthM}m</div>
            <div className="text-[10px] text-slate-500">Length</div>
          </div>
          <div>
            <div className="text-lg font-bold text-slate-800">{bed.lengthM * bed.plantsPerMeter}</div>
            <div className="text-[10px] text-slate-500">Plants</div>
          </div>
          <div>
            <div className="text-lg font-bold text-slate-800 capitalize">{bed.stage}</div>
            <div className="text-[10px] text-slate-500">Stage</div>
          </div>
        </div>
      </Card>

      <div className="mt-6 text-center">
        <Link href="/" className="text-xs text-slate-400 hover:text-slate-600">← Back to Dashboard</Link>
      </div>
    </div>
  );
}
