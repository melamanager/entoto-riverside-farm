"use client";

import { useEffect, useMemo, useState } from "react";
import { computedInsight, type OriginInsightStats, type OriginInsightText } from "@/lib/origin-insight";

// The dashboard ማጠቃለያ card. Text comes from /api/ai/origin-insight (Gemini,
// cached until the numbers change); the deterministic computed fallback covers
// no-key/error/offline, so the prose always matches the chips below it.

type State = (OriginInsightText & { mode: "live" | "computed" }) | null;

export function OriginInsight({ stats }: { stats: OriginInsightStats }) {
  const statsKey = useMemo(() => JSON.stringify(stats), [stats]);
  const [data, setData] = useState<State>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/ai/origin-insight", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: statsKey ? `{"stats":${statsKey}}` : "{}",
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!alive) return;
        if (j?.paragraph && j?.question) setData({ mode: j.mode === "live" ? "live" : "computed", paragraph: j.paragraph, question: j.question });
        else setData({ mode: "computed", ...computedInsight(stats) });
      })
      .catch(() => alive && setData({ mode: "computed", ...computedInsight(stats) }));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statsKey]);

  const live = data?.mode === "live";

  return (
    <div className="rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-500/10 via-purple-500/10 to-fuchsia-500/10 p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-4">
        <div className="size-8 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 grid place-items-center shrink-0 shadow-sm">
          <span className="text-white text-sm">✨</span>
        </div>
        <div>
          <div className="text-sm font-bold text-violet-200">ማጠቃለያ (Summary)</div>
          <div className="text-[10px] text-violet-300 font-medium">
            {data === null ? "Generating from live data…" : live ? "AI-generated from live origin data" : "Computed from live origin data"}
          </div>
        </div>
        <span className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/30">
          {data === null ? "…" : live ? "AI Insight" : "Auto summary"}
        </span>
      </div>

      {/* Body */}
      {data === null ? (
        <div className="space-y-2 mb-4 animate-pulse">
          <div className="h-3.5 rounded bg-violet-500/15 w-full" />
          <div className="h-3.5 rounded bg-violet-500/15 w-11/12" />
          <div className="h-3.5 rounded bg-violet-500/15 w-2/3" />
        </div>
      ) : (
        <p className="text-sm text-foreground leading-7 mb-4">{data.paragraph}</p>
      )}

      {/* Data chips — computed, never model-generated */}
      <div className="flex items-center gap-2 flex-wrap mb-4">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-100 border border-blue-200 text-xs font-semibold text-blue-700">
          🏅 Best efficiency: {stats.effLeader.origin} · {stats.effLeader.kgPerM.toFixed(2)} kg/m
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/15 border border-primary/30 text-xs font-semibold text-primary">
          🌾 Highest volume: {stats.volLeader.origin} · {stats.volLeader.kg.toFixed(0)} kg total
        </div>
        {!stats.sameLeader && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-100 border border-amber-200 text-xs font-semibold text-amber-700">
            ⚡ Efficiency ≠ Volume leader
          </div>
        )}
      </div>

      {/* Question prompt */}
      <div className="rounded-xl border border-violet-500/30 bg-card px-4 py-3.5">
        <div className="flex items-start gap-2.5">
          <span className="text-base shrink-0 mt-0.5">💬</span>
          {data === null ? (
            <div className="h-3.5 rounded bg-violet-500/15 w-3/4 mt-1 animate-pulse" />
          ) : (
            <p className="text-sm text-violet-200 font-medium leading-relaxed">{data.question}</p>
          )}
        </div>
      </div>
    </div>
  );
}
