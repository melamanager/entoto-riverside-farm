"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Layers, ArrowRight, User, TrendingUp, AlertTriangle } from "lucide-react";
import type { GroupScore } from "@/lib/group-scores";

/**
 * Sub-group standings on the dashboard.
 *
 * Deliberately short: the best and the worst stretch, and anything with a
 * problem. A manager glancing at this should learn where to walk today, not
 * read a table — the full picture lives on the performance page.
 */
export function GroupStandings() {
  const [groups, setGroups] = useState<GroupScore[] | null>(null);

  useEffect(() => {
    fetch("/api/group-scores")
      .then(r => (r.ok ? r.json() : null))
      .then(d => setGroups(d?.groups ?? []))
      .catch(() => setGroups([]));
  }, []);

  if (groups === null) return null;
  if (groups.length === 0) return null;   // nothing to say until groups exist

  const active = groups.filter(g => g.pickedKg > 0).sort((a, b) => b.pickedKg - a.pickedKg);
  const top = active[0];
  const bottom = active.length > 2 ? active[active.length - 1] : null;
  // worth walking to: open disease, or more than a tenth of the pick thrown away
  const needsAttention = groups.filter(
    g => g.openDiseaseReports > 0 || (g.fieldWastePct !== null && g.fieldWastePct > 10),
  );
  const unassigned = groups.filter(g => !g.owner);

  return (
    <Card className="border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 md:px-5 py-3.5 border-b border-border">
        <div>
          <div className="font-bold text-foreground text-sm md:text-base flex items-center gap-2">
            <Layers className="size-4 text-primary" /> Sub-groups
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            Last 30 days · {active.length} of {groups.length} picking
          </div>
        </div>
        <Link href="/bed-groups/performance">
          <span className="text-[11px] font-semibold text-primary hover:underline inline-flex items-center gap-1">
            Full performance <ArrowRight className="size-3" />
          </span>
        </Link>
      </div>

      <div className="p-4 md:p-5 space-y-3">
        {active.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No harvest logged against a sub-group yet in the last 30 days.
          </p>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {top && <Standing g={top} tone="top" />}
            {bottom && <Standing g={bottom} tone="bottom" />}
          </div>
        )}

        {needsAttention.length > 0 && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
            <div className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-1.5 mb-1.5">
              <AlertTriangle className="size-3.5" /> Worth walking to
            </div>
            <div className="flex flex-wrap gap-1.5">
              {needsAttention.map(g => (
                <Link key={g.groupId} href={`/scan/group/${g.groupId}`}>
                  <span className="inline-flex items-center gap-1 text-[11px] bg-card border border-amber-500/30 rounded px-2 py-1 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 transition-colors">
                    <span className="font-mono font-semibold">{g.code}</span>
                    {g.openDiseaseReports > 0 && <span>· {g.openDiseaseReports} disease</span>}
                    {g.fieldWastePct !== null && g.fieldWastePct > 10 && <span>· {g.fieldWastePct}% waste</span>}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {unassigned.length > 0 && (
          <p className="text-[11px] text-muted-foreground">
            <span className="font-semibold text-amber-600">{unassigned.length}</span> group
            {unassigned.length === 1 ? " has" : "s have"} nobody assigned —{" "}
            <Link href="/bed-groups" className="text-primary hover:underline">assign an owner</Link>.
          </p>
        )}
      </div>
    </Card>
  );
}

function Standing({ g, tone }: { g: GroupScore; tone: "top" | "bottom" }) {
  return (
    <Link href={`/scan/group/${g.groupId}`}>
      <div className={`rounded-lg border p-3 transition-colors hover:bg-accent ${
        tone === "top" ? "border-primary/40 bg-primary/5" : "border-border"}`}>
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="outline" className="text-[9px] uppercase tracking-wide">
            {tone === "top" ? <><TrendingUp className="size-2.5 mr-1" />Most picked</> : "Least picked"}
          </Badge>
          <span className="font-mono text-xs font-bold">{g.code}</span>
        </div>
        <div className="font-semibold text-sm text-foreground truncate">{g.name}</div>
        <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
          <User className="size-3" />{g.owner?.name ?? "unassigned"}
          <span>·</span><span>{g.valveName}</span>
        </div>
        <div className="flex items-baseline gap-3 mt-2">
          <span className="text-lg font-bold tabular-nums text-foreground">{g.pickedKg}<span className="text-[11px] font-normal text-muted-foreground"> kg</span></span>
          {g.fieldWastePct !== null && (
            <span className={`text-[11px] tabular-nums ${g.fieldWastePct > 10 ? "text-amber-600 font-semibold" : "text-muted-foreground"}`}>
              {g.fieldWastePct}% waste
            </span>
          )}
          {g.soldETB > 0 && (
            <span className="text-[11px] tabular-nums text-blue-600 dark:text-blue-400">{g.soldETB.toLocaleString()} ETB</span>
          )}
        </div>
      </div>
    </Link>
  );
}
