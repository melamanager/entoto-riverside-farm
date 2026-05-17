"use client";

import Link from "next/link";
import { useState } from "react";
import type { Bed, Valve } from "@/lib/types";

interface Props { beds: Bed[]; valves: Valve[]; }

const STAGE_CONFIG = {
  planted:    { label: "Planted",    bg: "bg-slate-200",       text: "text-slate-600",   dot: "#94a3b8", order: 0 },
  vegetative: { label: "Vegetative", bg: "bg-emerald-100",     text: "text-emerald-700", dot: "#4ade80", order: 1 },
  flowering:  { label: "Flowering",  bg: "bg-pink-100",        text: "text-pink-700",    dot: "#f472b6", order: 2 },
  fruiting:   { label: "Fruiting",   bg: "bg-amber-100",       text: "text-amber-700",   dot: "#fbbf24", order: 3 },
  ripening:   { label: "Ripening",   bg: "bg-orange-200",      text: "text-orange-800",  dot: "#f97316", order: 4 },
  harvest:    { label: "Harvest-ready", bg: "bg-red-400",      text: "text-white",       dot: "#ef4444", order: 5 },
} as const;

type Stage = keyof typeof STAGE_CONFIG;

export function RipenessHeatmap({ beds, valves }: Props) {
  const [filter, setFilter] = useState<Stage | "all">("all");
  const [hovered, setHovered] = useState<Bed | null>(null);

  const stageCounts = Object.entries(STAGE_CONFIG).map(([stage, cfg]) => ({
    stage: stage as Stage,
    count: beds.filter(b => b.stage === stage).length,
    cfg,
  }));

  const filtered = filter === "all" ? beds : beds.filter(b => b.stage === filter);

  // Group by valve
  const byValve = valves.map(v => ({
    valve: v,
    beds: filtered.filter(b => b.valveId === v.id),
  })).filter(g => g.beds.length > 0);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="font-semibold text-slate-900">Bed Ripeness Heatmap</div>
            <div className="text-[11px] text-slate-400 mt-0.5">All {beds.length} beds · click to open</div>
          </div>
          {/* Stage legend / filter pills */}
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setFilter("all")}
              className={`text-[10px] px-2.5 py-1 rounded-full font-semibold transition-all border ${filter === "all" ? "bg-slate-800 text-white border-slate-800" : "bg-slate-100 text-slate-500 border-slate-200 hover:border-slate-300"}`}
            >
              All
            </button>
            {stageCounts.map(({ stage, count, cfg }) => count > 0 && (
              <button
                key={stage}
                onClick={() => setFilter(filter === stage ? "all" : stage)}
                className={`flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full font-semibold transition-all border ${filter === stage ? `${cfg.bg} ${cfg.text} border-transparent` : "bg-slate-100 text-slate-500 border-slate-200 hover:border-slate-300"}`}
              >
                <span className="size-1.5 rounded-full shrink-0" style={{ background: cfg.dot }} />
                {cfg.label} <span className="opacity-60">({count})</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {byValve.map(({ valve, beds: vBeds }) => (
          <div key={valve.id}>
            <div className="flex items-center gap-2 mb-2.5">
              <div className="size-4 rounded" style={{ background: valve.color }} />
              <span className="text-xs font-semibold text-slate-700">{valve.name}</span>
              <span className="text-[10px] text-slate-400">· {vBeds.length} beds</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {vBeds.map(bed => {
                const stage = bed.stage as Stage;
                const cfg = STAGE_CONFIG[stage];
                const isHovered = hovered?.id === bed.id;
                return (
                  <div key={bed.id} className="relative">
                    <Link
                      href={`/beds/${bed.id}`}
                      onMouseEnter={() => setHovered(bed)}
                      onMouseLeave={() => setHovered(null)}
                      className={`group flex flex-col items-center justify-center w-16 h-12 rounded-lg border-2 transition-all cursor-pointer ${cfg.bg} ${
                        isHovered ? "border-slate-400 scale-105 shadow-md" : "border-transparent hover:border-slate-300"
                      }`}
                    >
                      <span className={`text-[9px] font-bold font-mono ${cfg.text}`}>{bed.id.split("-").slice(1).join("-")}</span>
                      <span className={`text-[8px] ${cfg.text} opacity-80 mt-0.5`}>{cfg.label.split("-")[0]}</span>
                      <span className="text-[10px] mt-0.5">
                        {stage === "harvest" ? "🍓" : stage === "ripening" ? "🟠" : stage === "flowering" ? "🌸" : stage === "fruiting" ? "🟡" : stage === "vegetative" ? "🌿" : "🌱"}
                      </span>
                    </Link>
                    {/* Tooltip */}
                    {isHovered && (
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-20 bg-slate-900 text-white rounded-lg shadow-xl px-3 py-2 text-[11px] whitespace-nowrap pointer-events-none">
                        <div className="font-bold">{bed.id}</div>
                        <div className="text-slate-300">{bed.variety} · {bed.lengthM}m</div>
                        <div className="text-slate-300 capitalize">{bed.stage} · {bed.health}</div>
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
