"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface TooltipProps {
  content: string;
  children: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
  maxWidth?: string;
  wrapperClassName?: string;
}

export function Tooltip({ content, children, side = "top", className, maxWidth = "200px", wrapperClassName }: TooltipProps) {
  const posClass = {
    top:    "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left:   "right-full top-1/2 -translate-y-1/2 mr-2",
    right:  "left-full top-1/2 -translate-y-1/2 ml-2",
  }[side];

  const arrowClass = {
    top:    "top-full left-1/2 -translate-x-1/2 border-t-slate-900 border-x-transparent border-b-transparent",
    bottom: "bottom-full left-1/2 -translate-x-1/2 border-b-slate-900 border-x-transparent border-t-transparent",
    left:   "left-full top-1/2 -translate-y-1/2 border-l-slate-900 border-y-transparent border-r-transparent",
    right:  "right-full top-1/2 -translate-y-1/2 border-r-slate-900 border-y-transparent border-l-transparent",
  }[side];

  return (
    <span className={cn("relative group/tip", wrapperClassName ?? "inline-flex items-center", className)}>
      {children}
      <span
        role="tooltip"
        style={{ maxWidth }}
        className={cn(
          "absolute z-50 pointer-events-none",
          "bg-slate-900 text-white text-[10px] leading-snug rounded px-2 py-1.5 shadow-lg",
          "opacity-0 group-hover/tip:opacity-100 transition-opacity duration-150",
          "whitespace-normal text-center",
          posClass
        )}
      >
        {content}
        <span className={cn("absolute border-4", arrowClass)} />
      </span>
    </span>
  );
}

// Inline question-mark helper for jargon terms
export function Term({ label, explain }: { label: string; explain: string }) {
  return (
    <Tooltip content={explain} side="top">
      <span className="border-b border-dotted border-slate-400 cursor-help">{label}</span>
    </Tooltip>
  );
}

// ── Rich tooltip with range bars ─────────────────────────────────────────────

export interface SensorInfo {
  name: string;
  unit: string;
  description: string;
  min: number;
  max: number;
  optimalLow: number;
  optimalHigh: number;
  current: number;
  lowLabel?: string;
  highLabel?: string;
  tip?: string;
}

interface RichTooltipProps {
  info: SensorInfo;
  children: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
}

export function RichTooltip({ info, children, side = "top", className }: RichTooltipProps) {
  const posClass = {
    top:    "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left:   "right-full top-1/2 -translate-y-1/2 mr-2",
    right:  "left-full top-1/2 -translate-y-1/2 ml-2",
  }[side];

  const arrowClass = {
    top:    "top-full left-1/2 -translate-x-1/2 border-t-[#1e2a3a] border-x-transparent border-b-transparent",
    bottom: "bottom-full left-1/2 -translate-x-1/2 border-b-[#1e2a3a] border-x-transparent border-t-transparent",
    left:   "left-full top-1/2 -translate-y-1/2 border-l-[#1e2a3a] border-y-transparent border-r-transparent",
    right:  "right-full top-1/2 -translate-y-1/2 border-r-[#1e2a3a] border-y-transparent border-l-transparent",
  }[side];

  const range = info.max - info.min;
  const currentPct  = Math.min(100, Math.max(0, ((info.current  - info.min) / range) * 100));
  const optLowPct   = Math.min(100, Math.max(0, ((info.optimalLow  - info.min) / range) * 100));
  const optHighPct  = Math.min(100, Math.max(0, ((info.optimalHigh - info.min) / range) * 100));
  const inRange     = info.current >= info.optimalLow && info.current <= info.optimalHigh;

  return (
    <span className={cn("relative group/rich inline-flex items-center cursor-help", className)}>
      {children}
      <span
        role="tooltip"
        className={cn(
          "absolute z-50 pointer-events-none w-56",
          "bg-[#1e2a3a] border border-white/10 text-white rounded-xl shadow-2xl p-3",
          "opacity-0 group-hover/rich:opacity-100 transition-opacity duration-150",
          posClass
        )}
      >
        {/* Header */}
        <span className="block text-[11px] font-bold text-white mb-0.5">{info.name}</span>
        <span className="block text-[10px] text-slate-400 leading-snug mb-2">{info.description}</span>

        {/* Range bar */}
        <span className="block mb-1.5">
          <span className="flex justify-between text-[9px] text-slate-600 mb-1">
            <span>{info.min}{info.unit}</span>
            <span className="text-slate-400">Optimal: {info.optimalLow}–{info.optimalHigh}{info.unit}</span>
            <span>{info.max}{info.unit}</span>
          </span>
          <span className="relative block h-2 bg-white/8 rounded-full overflow-hidden">
            {/* Optimal zone */}
            <span
              className="absolute top-0 h-full bg-emerald-500/30 rounded-full"
              style={{ left: `${optLowPct}%`, width: `${optHighPct - optLowPct}%` }}
            />
            {/* Current value needle */}
            <span
              className={cn("absolute top-0 w-0.5 h-full rounded-full transition-all", inRange ? "bg-emerald-400" : "bg-amber-400")}
              style={{ left: `${currentPct}%` }}
            />
          </span>
          <span className="flex justify-between text-[9px] mt-1">
            <span className="text-slate-600">{info.lowLabel ?? "Low"}</span>
            <span className={cn("font-semibold", inRange ? "text-emerald-400" : "text-amber-400")}>
              Current: {info.current}{info.unit} — {inRange ? "Optimal" : "Out of range"}
            </span>
            <span className="text-slate-600">{info.highLabel ?? "High"}</span>
          </span>
        </span>

        {/* Tip */}
        {info.tip && (
          <span className="block text-[9px] text-slate-500 border-t border-white/8 pt-1.5 leading-snug">{info.tip}</span>
        )}

        <span className={cn("absolute border-4", arrowClass)} />
      </span>
    </span>
  );
}
