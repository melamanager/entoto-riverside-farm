"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Scan, Layers, ArrowRight, Droplets, Bug, User } from "lucide-react";
import type { Valve, BedGroup, Bed, DiseaseReport } from "@/lib/types";

/**
 * The stake at the head of a whole irrigation zone.
 *
 * A valve covers more ground than one person works, so this is a directory:
 * it hands you straight to the right sub-group rather than trying to be a
 * logging screen itself.
 */
export default function ScanValvePage({ params }: { params: Promise<{ valveId: string }> }) {
  const { valveId } = use(params);
  const [valve, setValve] = useState<Valve | null | undefined>(undefined);
  const [groups, setGroups] = useState<BedGroup[]>([]);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [diseases, setDiseases] = useState<DiseaseReport[]>([]);

  useEffect(() => {
    Promise.all([
      fetch("/api/valves").then(r => (r.ok ? r.json() : [])),
      fetch(`/api/bed-groups?valveId=${valveId}`).then(r => (r.ok ? r.json() : [])),
      fetch("/api/beds").then(r => (r.ok ? r.json() : [])),
      fetch("/api/diseases").then(r => (r.ok ? r.json() : [])),
    ]).then(([vs, gs, bs, ds]: [Valve[], BedGroup[], Bed[], DiseaseReport[]]) => {
      setValve(vs.find(v => v.id === valveId) ?? null);
      setGroups(gs);
      const mine = bs.filter(b => b.valveId === valveId);
      setBeds(mine);
      const ids = new Set(mine.map(b => b.id));
      setDiseases(ds.filter(d => ids.has(d.bedId) && d.status !== "resolved"));
    });
  }, [valveId]);

  if (valve === undefined) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
        <Scan className="size-12 text-muted-foreground/40 mb-4" />
        <p className="text-muted-foreground text-sm">Loading…</p>
      </div>
    );
  }

  if (!valve) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
        <Scan className="size-12 text-muted-foreground/40 mb-4" />
        <h1 className="text-xl font-bold text-foreground mb-2">Valve not found</h1>
        <Link href="/valves" className="text-primary hover:underline text-sm">← Back to valves</Link>
      </div>
    );
  }

  const ungrouped = beds.filter(b => !groups.some(g => (g.bedIds ?? []).includes(b.id)));

  return (
    <div className="min-h-screen bg-background p-4 max-w-md mx-auto">
      <div className="mt-8 mb-6 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-muted text-muted-foreground text-xs font-semibold mb-3">
          <Scan className="size-3" /> QR Scan
        </div>
        <h1 className="text-3xl font-black" style={{ color: valve.color }}>{valve.name}</h1>
        <div className="flex items-center justify-center gap-2 mt-2 flex-wrap">
          <Badge variant="outline" className="text-[11px]">
            <Layers className="size-3 mr-1" />{beds.length} beds
          </Badge>
          <Badge variant="outline" className="text-[11px]">{groups.length} sub-group{groups.length === 1 ? "" : "s"}</Badge>
          <Badge variant="outline" className="text-[11px]">
            <Droplets className="size-3 mr-1" />{valve.irrigationSchedule}
          </Badge>
        </div>
      </div>

      {diseases.length > 0 && (
        <Card className="p-3 mb-3 border-red-300 bg-red-50">
          <div className="flex items-center gap-2 text-red-700 text-sm font-semibold">
            <Bug className="size-4" /> {diseases.length} active alert{diseases.length === 1 ? "" : "s"} in this zone
          </div>
        </Card>
      )}

      <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2 px-1">Sub-groups</div>
      <div className="space-y-2">
        {groups.map(g => (
          <Link key={g.id} href={`/scan/group/${g.id}`}>
            <Card className="p-3.5 flex items-center gap-3 hover:bg-accent transition-colors">
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-sm text-foreground truncate">
                  {g.name}
                  {g.nameAm && <span className="text-muted-foreground font-normal"> · {g.nameAm}</span>}
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                  <span className="font-mono">{g.code}</span>
                  <span>·</span>
                  <span>{(g.bedIds ?? []).length} beds</span>
                  {g.owner && (
                    <>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1 truncate">
                        <User className="size-3" />{g.owner.name}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <ArrowRight className="size-4 text-muted-foreground shrink-0" />
            </Card>
          </Link>
        ))}
        {groups.length === 0 && (
          <Card className="p-4 text-center text-sm text-muted-foreground">
            No sub-groups defined for this valve yet.
          </Card>
        )}
      </div>

      {ungrouped.length > 0 && (
        <>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground mt-5 mb-2 px-1">
            Not in a group ({ungrouped.length})
          </div>
          <div className="flex flex-wrap gap-1.5">
            {ungrouped.map(b => (
              <Link key={b.id} href={`/scan/${b.id}`}>
                <span className="inline-block text-[11px] font-mono font-semibold border border-border rounded px-2 py-1 hover:bg-accent transition-colors">
                  {b.id}
                </span>
              </Link>
            ))}
          </div>
        </>
      )}

      <div className="mt-6 text-center">
        <Link href="/" className="text-xs text-muted-foreground hover:text-foreground">← Back to Dashboard</Link>
      </div>
    </div>
  );
}
