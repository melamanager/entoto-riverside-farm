"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Layers, ArrowLeft, Download, Wheat, Package, DollarSign, Bug, Shovel,
  TrendingUp, TrendingDown, User, AlertTriangle,
} from "lucide-react";
import type { GroupScore, WorkerScore } from "@/lib/group-scores";

type Payload = { from: string; to: string; groups: GroupScore[]; workers: WorkerScore[] };

const RANGES = [
  { key: "7",  label: "7 days" },
  { key: "30", label: "30 days" },
  { key: "90", label: "Season" },
] as const;

function iso(d: Date) { return d.toLocaleDateString("en-CA"); }
function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - (n - 1)); return iso(d); }

/**
 * Group and worker performance.
 *
 * Deliberately shows the stretch of beds and the person on it side by side:
 * a weak week is either the picker or the beds, and only both together say
 * which. That distinction is the reason the farm groups beds at all.
 */
export default function GroupScorecardPage() {
  const [range, setRange] = useState<(typeof RANGES)[number]["key"]>("30");
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"groups" | "workers">("groups");

  useEffect(() => {
    setLoading(true);
    const from = daysAgo(Number(range));
    fetch(`/api/group-scores?from=${from}&to=${iso(new Date())}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { setData(d); setLoading(false); });
  }, [range]);

  const totals = useMemo(() => {
    const g = data?.groups ?? [];
    const picked = g.reduce((s, x) => s + x.pickedKg, 0);
    const waste = g.reduce((s, x) => s + x.fieldWasteKg, 0);
    return {
      picked: Math.round(picked * 10) / 10,
      waste: Math.round(waste * 10) / 10,
      wastePct: picked + waste > 0 ? Math.round((waste / (picked + waste)) * 1000) / 10 : null,
      sold: g.reduce((s, x) => s + x.soldETB, 0),
      disease: Math.round(g.reduce((s, x) => s + x.diseasedKg, 0) * 10) / 10,
      active: g.filter(x => x.pickedKg > 0).length,
    };
  }, [data]);

  function exportCsv() {
    if (!data) return;
    const head = "Code,Group,Valve,Owner,Beds,Picked kg,Field waste kg,Waste %,Grade A %,Packed kg,Rejected kg,Disease kg,Sold ETB,Open disease,Maintenance";
    const rows = data.groups.map(g => [
      g.code, g.name, g.valveName, g.owner?.name ?? "", g.bedCount,
      g.pickedKg, g.fieldWasteKg, g.fieldWastePct ?? "", g.gradeAPct ?? "",
      g.packedKg, g.rejectedKg, g.diseasedKg, g.soldETB, g.openDiseaseReports, g.maintenanceLogs,
    ].join(","));
    const blob = new Blob([[`Group performance ${data.from} to ${data.to}`, head, ...rows].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `group-performance-${data.from}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const ranked = [...(data?.groups ?? [])].sort((a, b) => b.pickedKg - a.pickedKg);
  const best = ranked.filter(g => g.pickedKg > 0);

  return (
    <div className="p-4 md:p-8 max-w-[1200px] mx-auto space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap no-print">
        <div>
          <Link href="/bed-groups" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-1">
            <ArrowLeft className="size-3" /> Bed groups
          </Link>
          <div className="flex items-center gap-2 mb-1">
            <Layers className="size-5 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Group Performance</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            Each stretch of beds and the people who worked it — so a weak patch can be told from a weak week.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-border overflow-hidden">
            {RANGES.map(r => (
              <button key={r.key} onClick={() => setRange(r.key)}
                className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                  range === r.key ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-accent"}`}>
                {r.label}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={exportCsv} disabled={!data}>
            <Download className="size-3.5" /> CSV
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-muted-foreground text-sm">Loading…</div>
      ) : !data || data.groups.length === 0 ? (
        <Card className="p-10 text-center">
          <Layers className="size-8 text-muted-foreground/40 mx-auto mb-3" />
          <div className="font-semibold text-foreground mb-1">No sub-groups yet</div>
          <p className="text-sm text-muted-foreground mb-4">
            Define groups first, then harvest and packing will roll up here.
          </p>
          <Link href="/bed-groups"><Button size="sm">Set up bed groups</Button></Link>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Kpi icon={Wheat} tone="primary" label="Picked" value={`${totals.picked} kg`} sub={`${totals.active} groups active`} />
            <Kpi icon={TrendingDown} tone="amber" label="Field waste"
                 value={totals.wastePct !== null ? `${totals.wastePct}%` : "—"} sub={`${totals.waste} kg thrown`} />
            <Kpi icon={Bug} tone="red" label="Disease at packing" value={`${totals.disease} kg`} sub="sorted out" />
            <Kpi icon={DollarSign} tone="blue" label="Sold" value={totals.sold.toLocaleString()} sub="ETB, traced to groups" />
            <Kpi icon={Package} tone="slate" label="Groups" value={`${data.groups.length}`} sub={`${data.from} → ${data.to}`} />
          </div>

          <div className="inline-flex rounded-lg border border-border overflow-hidden">
            {(["groups", "workers"] as const).map(k => (
              <button key={k} onClick={() => setTab(k)}
                className={`px-4 py-1.5 text-xs font-semibold capitalize transition-colors ${
                  tab === k ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-accent"}`}>
                {k === "groups" ? "By sub-group" : "By worker"}
              </button>
            ))}
          </div>

          {tab === "groups" ? (
            <div className="space-y-2">
              {ranked.map((g, i) => (
                <Card key={g.groupId} className="p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {best.length > 1 && g.pickedKg > 0 && i === 0 && (
                          <Badge className="bg-primary/15 text-primary border-primary/30 text-[10px]">
                            <TrendingUp className="size-3 mr-1" />Top
                          </Badge>
                        )}
                        <span className="font-mono font-bold text-sm">{g.code}</span>
                        <span className="font-semibold text-foreground">{g.name}</span>
                        {g.nameAm && <span className="text-muted-foreground text-sm">{g.nameAm}</span>}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
                        <span>{g.valveName}</span><span>·</span><span>{g.bedCount} beds</span>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1">
                          <User className="size-3" />{g.owner?.name ?? <span className="text-amber-600">unassigned</span>}
                        </span>
                      </div>
                    </div>
                    {g.openDiseaseReports > 0 && (
                      <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px] shrink-0">
                        <AlertTriangle className="size-3 mr-1" />{g.openDiseaseReports} open
                      </Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-center">
                    <Stat label="Picked" value={`${g.pickedKg}`} unit="kg" />
                    <Stat label="Waste" value={g.fieldWastePct !== null ? `${g.fieldWastePct}%` : "—"}
                          unit={`${g.fieldWasteKg} kg`} tone={g.fieldWastePct !== null && g.fieldWastePct > 10 ? "amber" : undefined} />
                    <Stat label="Grade A" value={g.gradeAPct !== null ? `${g.gradeAPct}%` : "—"} unit="of picked" />
                    <Stat label="Packed" value={`${g.packedKg}`} unit="kg" />
                    <Stat label="Disease" value={`${g.diseasedKg}`} unit="kg at packing"
                          tone={g.diseasedKg > 0 ? "red" : undefined} />
                    <Stat label="Sold" value={g.soldETB.toLocaleString()} unit="ETB" tone="blue" />
                  </div>

                  {g.pickers.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">
                        Who picked here
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {g.pickers.map(pk => (
                          <span key={pk.id} className="inline-flex items-center gap-1.5 text-[11px] border border-border rounded-md px-2 py-1">
                            <Avatar className="size-4"><AvatarFallback className="text-[7px] bg-muted">{pk.name.split(" ").map(x => x[0]).join("")}</AvatarFallback></Avatar>
                            <span className="font-medium">{pk.name}</span>
                            <span className="text-muted-foreground tabular-nums">{pk.kg} kg</span>
                            {pk.kgPerHour !== null && (
                              <span className="text-primary font-semibold tabular-nums">{pk.kgPerHour} kg/h</span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {g.maintenanceLogs > 0 && (
                    <div className="mt-2 text-[11px] text-muted-foreground inline-flex items-center gap-1">
                      <Shovel className="size-3" /> {g.maintenanceLogs} maintenance round{g.maintenanceLogs === 1 ? "" : "s"}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full pro-table">
                  <thead>
                    <tr>
                      <th>Worker</th><th>Owns</th><th>Picked</th><th>Waste</th>
                      <th>Waste %</th><th>Hours</th><th>kg / hour</th><th>Days</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.workers.map(w => (
                      <tr key={w.farmerId}>
                        <td className="font-medium">{w.name}</td>
                        <td className="text-[11px] font-mono text-muted-foreground">{w.ownsGroups.join(", ") || "—"}</td>
                        <td className="tabular-nums">{w.pickedKg} kg</td>
                        <td className="tabular-nums text-foreground/70">{w.wasteKg} kg</td>
                        <td className={`tabular-nums ${w.wastePct !== null && w.wastePct > 10 ? "text-amber-600 font-semibold" : "text-foreground/70"}`}>
                          {w.wastePct !== null ? `${w.wastePct}%` : "—"}
                        </td>
                        <td className="tabular-nums text-foreground/70">{w.hoursWorked}</td>
                        <td className="tabular-nums font-semibold text-primary">
                          {w.kgPerHour !== null ? w.kgPerHour : "—"}
                        </td>
                        <td className="tabular-nums text-foreground/70">{w.daysWorked}</td>
                      </tr>
                    ))}
                    {data.workers.length === 0 && (
                      <tr><td colSpan={8} className="text-center text-sm text-muted-foreground py-6">
                        Nothing picked against a sub-group in this period.
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-2.5 bg-muted border-t border-border text-[11px] text-muted-foreground">
                kg per hour uses the hours already recorded on attendance, so it compares pickers fairly
                regardless of how many days each worked.
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub, tone }: {
  icon: React.ElementType; label: string; value: string; sub?: string; tone: string;
}) {
  const tones: Record<string, string> = {
    primary: "bg-primary/10 border-primary/30 text-primary",
    amber: "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300",
    red: "bg-red-50 border-red-200 text-red-700",
    blue: "bg-blue-50 border-blue-200 text-blue-700",
    slate: "bg-muted border-border text-foreground/80",
  };
  return (
    <Card className={`p-3 ${tones[tone] ?? tones.slate}`}>
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide opacity-80">
        <Icon className="size-3" /> {label}
      </div>
      <div className="text-xl font-bold tabular-nums mt-0.5">{value}</div>
      {sub && <div className="text-[10px] opacity-70 mt-0.5">{sub}</div>}
    </Card>
  );
}

function Stat({ label, value, unit, tone }: { label: string; value: string; unit?: string; tone?: string }) {
  const c = tone === "amber" ? "text-amber-600 dark:text-amber-400" : tone === "red" ? "text-red-600 dark:text-red-400" : tone === "blue" ? "text-blue-600 dark:text-blue-400" : "text-foreground";
  return (
    <div className="rounded-md border border-border py-2 px-1">
      <div className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-sm font-bold tabular-nums ${c}`}>{value}</div>
      {unit && <div className="text-[9px] text-muted-foreground">{unit}</div>}
    </div>
  );
}
