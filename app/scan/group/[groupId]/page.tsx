"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wheat, Bug, ClipboardList, Shovel, ArrowRight, Scan, User, Layers } from "lucide-react";
import type { Bed, DiseaseReport } from "@/lib/types";

type GroupDetail = {
  id: string; name: string; nameAm?: string | null; code: string; note?: string | null;
  valve: { id: string; name: string; color: string };
  beds: Bed[];
  assignments: { id: string; farmerId: string; fromDate: string; toDate: string | null; farmer: { id: string; name: string } }[];
};

/**
 * What a worker sees after scanning the stake on a sub-group.
 *
 * The point of the stake is to skip the "which bed was that again?" step, so
 * this leads with who owns the group and what needs doing, then hands off to
 * the logging screens pre-filtered to these beds.
 */
export default function ScanGroupPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = use(params);
  const [group, setGroup] = useState<GroupDetail | null | undefined>(undefined);
  const [diseases, setDiseases] = useState<DiseaseReport[]>([]);

  useEffect(() => {
    Promise.all([
      fetch(`/api/bed-groups/${groupId}`).then(r => (r.ok ? r.json() : null)),
      fetch("/api/diseases").then(r => (r.ok ? r.json() : [])),
    ]).then(([g, d]: [GroupDetail | null, DiseaseReport[]]) => {
      setGroup(g);
      if (g) {
        const ids = new Set(g.beds.map(b => b.id));
        setDiseases(d.filter(x => ids.has(x.bedId) && x.status !== "resolved"));
      }
    });
  }, [groupId]);

  if (group === undefined) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
        <Scan className="size-12 text-muted-foreground/40 mb-4" />
        <p className="text-muted-foreground text-sm">Loading…</p>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
        <Scan className="size-12 text-muted-foreground/40 mb-4" />
        <h1 className="text-xl font-bold text-foreground mb-2">Group not found</h1>
        <p className="text-muted-foreground text-sm mb-4">
          This stake points to a group that no longer exists.
        </p>
        <Link href="/beds" className="text-primary hover:underline text-sm">← Back to all beds</Link>
      </div>
    );
  }

  const owner = group.assignments.find(a => !a.toDate);
  const bedIds = group.beds.map(b => b.id);
  const bedQuery = bedIds.join(",");

  return (
    <div className="min-h-screen bg-background p-4 max-w-md mx-auto">
      <div className="mt-8 mb-6 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-muted text-muted-foreground text-xs font-semibold mb-3">
          <Scan className="size-3" /> QR Scan
        </div>
        <h1 className="text-3xl font-black text-foreground">{group.name}</h1>
        {group.nameAm && <div className="text-lg font-semibold text-foreground/80 mt-0.5">{group.nameAm}</div>}
        <div className="flex items-center justify-center gap-2 mt-2 flex-wrap">
          <Badge variant="outline" className="text-[11px] font-semibold" style={{ color: group.valve.color }}>
            {group.valve.name}
          </Badge>
          <Badge variant="outline" className="text-[11px] font-mono">{group.code}</Badge>
          <Badge variant="outline" className="text-[11px]">
            <Layers className="size-3 mr-1" />{group.beds.length} bed{group.beds.length === 1 ? "" : "s"}
          </Badge>
        </div>
      </div>

      {/* Who is accountable for this stretch */}
      <Card className="p-3 mb-3 flex items-center gap-3">
        <div className="size-9 rounded-full bg-muted grid place-items-center shrink-0">
          <User className="size-4 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Responsible</div>
          <div className="font-semibold text-sm text-foreground truncate">
            {owner ? owner.farmer.name : "Not assigned"}
          </div>
        </div>
        {owner && (
          <div className="text-[10px] text-muted-foreground tabular-nums shrink-0">since {owner.fromDate}</div>
        )}
      </Card>

      {/* The beds this stake covers */}
      <Card className="p-3 mb-3">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">Beds in this group</div>
        <div className="flex flex-wrap gap-1.5">
          {group.beds.map(b => (
            <Link key={b.id} href={`/scan/${b.id}`}>
              <span className="inline-block text-[11px] font-mono font-semibold border border-border rounded px-2 py-1 hover:bg-accent transition-colors">
                {b.id}
              </span>
            </Link>
          ))}
          {group.beds.length === 0 && <span className="text-xs text-muted-foreground">No beds assigned yet</span>}
        </div>
      </Card>

      {diseases.length > 0 && (
        <Card className="p-3 mb-3 border-red-300 bg-red-50">
          <div className="flex items-center gap-2 text-red-700 text-sm font-semibold">
            <Bug className="size-4" />
            {diseases.length} active disease alert{diseases.length === 1 ? "" : "s"} in this group
          </div>
          <div className="text-[11px] text-red-700/80 mt-1">
            {diseases.map(d => d.bedId).join(", ")}
          </div>
        </Card>
      )}

      <div className="space-y-2">
        <Action href={`/harvest?beds=${bedQuery}&group=${group.id}`} icon={Wheat} tone="text-amber-600"
          title="Log harvest" sub="Record what this group picked" />
        <Action href={`/diseases?reportBed=${bedIds[0] ?? ""}`} icon={Bug} tone="text-red-600"
          title="Report a disease" sub="Pick the affected bed" />
        <Action href={`/routines`} icon={Shovel} tone="text-orange-600"
          title="Log maintenance" sub="Weeding, bed upkeep, repairs" />
        <Action href={`/tasks?group=${group.id}`} icon={ClipboardList} tone="text-blue-600"
          title="Tasks" sub="What's outstanding here" />
      </div>

      <div className="mt-6 text-center">
        <Link href="/" className="text-xs text-muted-foreground hover:text-foreground">← Back to Dashboard</Link>
      </div>
    </div>
  );
}

function Action({ href, icon: Icon, tone, title, sub }: {
  href: string; icon: React.ElementType; tone: string; title: string; sub: string;
}) {
  return (
    <Link href={href}>
      <Card className="p-3.5 flex items-center gap-3 hover:bg-accent transition-colors">
        <Icon className={`size-5 shrink-0 ${tone}`} />
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-sm text-foreground">{title}</div>
          <div className="text-xs text-muted-foreground truncate">{sub}</div>
        </div>
        <ArrowRight className="size-4 text-muted-foreground shrink-0" />
      </Card>
    </Link>
  );
}
