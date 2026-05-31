import { Card } from "@/components/ui/card";
import type { ComponentType } from "react";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";

interface Props {
  label: string;
  value: string | number;
  hint?: string;
  icon: ComponentType<{ className?: string }>;
  tone?: "emerald" | "amber" | "red" | "blue" | "purple" | "slate";
  trend?: { value: string; up?: boolean };
  large?: boolean;
}

const TONES = {
  emerald: { icon: "bg-primary/10 text-primary border-primary/20", dot: "bg-primary" },
  amber:   { icon: "bg-amber-50 text-amber-600 border-amber-100",   dot: "bg-amber-500" },
  red:     { icon: "bg-red-50 text-red-600 border-red-100",         dot: "bg-red-500" },
  blue:    { icon: "bg-blue-50 text-blue-600 border-blue-100",      dot: "bg-blue-500" },
  purple:  { icon: "bg-purple-50 text-purple-600 border-purple-100",dot: "bg-purple-500" },
  slate:   { icon: "bg-muted text-muted-foreground border-border",  dot: "bg-muted-foreground/50" },
};

export function StatCard({ label, value, hint, icon: Icon, tone = "slate", trend, large }: Props) {
  const t = TONES[tone];
  return (
    <Card className="bg-card border border-border shadow-sm hover:shadow-md transition-shadow p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className={cn("font-bold text-foreground mt-1 tabular-nums", large ? "text-4xl" : "text-2xl")}>{value}</p>
          {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
          {trend && (
            <div className={cn("flex items-center gap-1 text-xs font-medium mt-2", trend.up ? "text-primary" : "text-red-600")}>
              {trend.up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
              {trend.value}
            </div>
          )}
        </div>
        <div className={cn("size-10 rounded-lg border grid place-items-center shrink-0", t.icon)}>
          <Icon className="size-5" />
        </div>
      </div>
    </Card>
  );
}
