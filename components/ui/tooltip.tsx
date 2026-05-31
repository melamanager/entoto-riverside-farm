"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface TooltipProps {
  content: string;
  children: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
  maxWidth?: string;
}

export function Tooltip({ content, children, side = "top", className, maxWidth = "200px" }: TooltipProps) {
  const posClass = {
    top:    "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left:   "right-full top-1/2 -translate-y-1/2 mr-2",
    right:  "left-full top-1/2 -translate-y-1/2 ml-2",
  }[side];

  const arrowClass = {
    top:    "top-full left-1/2 -translate-x-1/2 border-t-foreground border-x-transparent border-b-transparent",
    bottom: "bottom-full left-1/2 -translate-x-1/2 border-b-foreground border-x-transparent border-t-transparent",
    left:   "left-full top-1/2 -translate-y-1/2 border-l-foreground border-y-transparent border-r-transparent",
    right:  "right-full top-1/2 -translate-y-1/2 border-r-foreground border-y-transparent border-l-transparent",
  }[side];

  return (
    <span className={cn("relative group/tip inline-flex items-center", className)}>
      {children}
      <span
        role="tooltip"
        style={{ maxWidth }}
        className={cn(
          "absolute z-50 pointer-events-none",
          "bg-foreground text-background text-[10px] leading-snug rounded px-2 py-1.5 shadow-lg",
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
      <span className="border-b border-dotted border-muted-foreground cursor-help">{label}</span>
    </Tooltip>
  );
}
