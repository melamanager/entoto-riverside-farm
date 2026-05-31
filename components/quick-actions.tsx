"use client";

import Link from "next/link";
import { Wheat, Bug, ListChecks, CalendarCheck, ArrowRight } from "lucide-react";

const ACTIONS = [
  {
    href: "/harvest",
    label: "Log Harvest",
    sub: "Record today's yield",
    icon: Wheat,
    bg: "bg-primary hover:bg-primary/90",
    iconBg: "bg-primary/80",
    text: "text-background",
  },
  {
    href: "/diseases",
    label: "Flag Disease",
    sub: "Report a bed issue",
    icon: Bug,
    bg: "bg-red-600 hover:bg-red-700",
    iconBg: "bg-red-500",
    text: "text-white",
  },
  {
    href: "/tasks",
    label: "Create Task",
    sub: "Assign to supervisor",
    icon: ListChecks,
    bg: "bg-blue-600 hover:bg-blue-700",
    iconBg: "bg-blue-500",
    text: "text-white",
  },
  {
    href: "/attendance",
    label: "Attendance",
    sub: "Mark today's register",
    icon: CalendarCheck,
    bg: "bg-amber-500 hover:bg-amber-600",
    iconBg: "bg-amber-400",
    text: "text-white",
  },
];

export function QuickActions() {
  return (
    <div>
      <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">Quick Actions</div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {ACTIONS.map(a => {
          const Icon = a.icon;
          return (
            <Link
              key={a.href}
              href={a.href}
              className={`group flex items-center gap-3 p-4 rounded-xl transition-all shadow-sm ${a.bg}`}
            >
              <div className={`size-9 rounded-lg ${a.iconBg} grid place-items-center shrink-0`}>
                <Icon className="size-4.5 text-white" />
              </div>
              <div className="min-w-0">
                <div className={`text-sm font-bold ${a.text} leading-tight`}>{a.label}</div>
                <div className={`text-[11px] opacity-80 ${a.text} mt-0.5 hidden sm:block`}>{a.sub}</div>
              </div>
              <ArrowRight className={`size-3.5 ${a.text} opacity-60 ml-auto shrink-0 group-hover:translate-x-0.5 transition-transform`} />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
