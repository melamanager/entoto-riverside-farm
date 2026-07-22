"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ClipboardCheck, CalendarCheck, Droplets, MessageSquareText,
  AlertTriangle, CheckCircle2, ArrowRight, ShieldCheck,
} from "lucide-react";
import { useLang } from "@/lib/lang";

// Daily Routines status, surfaced on the dashboards because recording them is
// MANDATORY: a supervisor's day only counts as worked if they took attendance,
// logged watering, or posted a Day Log note (lib/compliance.ts) — otherwise a
// manager must acknowledge it. Supervisor mode shows their own checklist for
// today; manager mode shows every supervisor's state for today.

type Row = {
  date: string;
  supervisorId: string;
  name: string;
  attendance: boolean;
  watering: boolean;
  dayLog: boolean;
  recorded: boolean;
  acknowledged: boolean;
};

function ItemChip({ done, icon, label, href }: { done: boolean; icon: React.ReactNode; label: string; href: string }) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
        done
          ? "bg-primary/10 border-primary/30 text-primary"
          : "bg-muted border-border text-muted-foreground hover:bg-accent hover:text-foreground"
      }`}
    >
      {icon} {label} {done ? "✓" : ""}
    </Link>
  );
}

export function RoutineStatusCard({ mode, supervisorId }: { mode: "supervisor" | "manager"; supervisorId?: string }) {
  const { isAm } = useLang();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [today, setToday] = useState<string>("");

  useEffect(() => {
    fetch("/api/routines/compliance")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j?.rows) return;
        setToday(j.today);
        setRows((j.rows as Row[]).filter((r) => r.date === j.today));
      })
      .catch(() => {});
  }, []);

  if (rows === null) return null; // no skeleton — the card pops in when known

  // ── supervisor: my own mandatory checklist for today ─────────────────────
  if (mode === "supervisor") {
    const me = rows.find((r) => r.supervisorId === supervisorId);
    if (!me) return null;
    const ok = me.recorded;
    return (
      <Card className={`p-4 md:p-5 border ${ok ? "border-primary/30" : "border-red-500/40 bg-red-500/10"}`}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`size-9 rounded-xl grid place-items-center shrink-0 ${ok ? "bg-primary/15" : "bg-red-500/20"}`}>
              {ok ? <CheckCircle2 className="size-5 text-primary" /> : <AlertTriangle className="size-5 text-red-400" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-foreground text-sm">
                  {isAm ? "የቀን ተግባራት" : "Daily Routines"}
                </span>
                <Badge className="bg-red-500/15 text-red-300 border-red-500/30 text-[10px]">
                  {isAm ? "ግዴታ" : "Mandatory"}
                </Badge>
              </div>
              <div className={`text-xs mt-0.5 ${ok ? "text-muted-foreground" : "text-red-300 font-semibold"}`}>
                {ok
                  ? isAm ? "ዛሬ እንደ የስራ ቀን ተቆጥሯል ✓" : "Today counts as a worked day ✓"
                  : isAm
                    ? "ማስጠንቀቂያ፦ ቢያንስ አንዱን እስኪመዘግቡ ድረስ ዛሬ እንደ የስራ ቀን አይቆጠርም!"
                    : "Today will NOT count as worked until you record at least one!"}
              </div>
            </div>
          </div>
          <Link
            href="/routines"
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold shrink-0 ${
              ok ? "border border-border text-foreground hover:bg-accent" : "bg-primary text-primary-foreground hover:bg-primary/90"
            }`}
          >
            {isAm ? "አሁን መዝግብ" : "Record now"} <ArrowRight className="size-3.5" />
          </Link>
        </div>
        <div className="flex items-center gap-2 flex-wrap mt-3">
          <ItemChip done={me.attendance} icon={<CalendarCheck className="size-3.5" />} label={isAm ? "ክትትል" : "Attendance"} href="/attendance" />
          <ItemChip done={me.watering} icon={<Droplets className="size-3.5" />} label={isAm ? "ውሃ ማጠጣት" : "Watering"} href="/routines" />
          <ItemChip done={me.dayLog} icon={<MessageSquareText className="size-3.5" />} label={isAm ? "የቀን ማስታወሻ" : "Day Log"} href="/routines" />
        </div>
      </Card>
    );
  }

  // ── manager: every supervisor's state for today ──────────────────────────
  const done = rows.filter((r) => r.recorded || r.acknowledged).length;
  const allOk = done === rows.length;
  return (
    <Card className={`p-4 md:p-5 border ${allOk ? "border-border" : "border-amber-500/40"}`}>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          <div className="size-9 rounded-xl bg-primary/15 grid place-items-center">
            <ClipboardCheck className="size-5 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-foreground text-sm">
                {isAm ? "የቀን ተግባራት ክትትል — ዛሬ" : "Routine compliance — today"}
              </span>
              <Badge
                className={`text-[10px] ${allOk ? "bg-primary/15 text-primary border-primary/30" : "bg-amber-500/15 text-amber-300 border-amber-500/30"}`}
              >
                {done}/{rows.length} {isAm ? "ተመዝግቧል" : "recorded"}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {isAm ? "ግዴታ ነው — ያልመዘገበ ተቆጣጣሪ ቀኑ አይቆጠርለትም" : "Mandatory — an unrecorded day doesn't count as worked"} · {today}
            </div>
          </div>
        </div>
        <Link
          href="/routines"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-border text-xs font-bold text-foreground hover:bg-accent shrink-0"
        >
          {isAm ? "ሁሉንም እይ" : "Open Routines"} <ArrowRight className="size-3.5" />
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {rows.map((r) => (
          <div
            key={r.supervisorId}
            className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 ${
              r.recorded ? "border-border bg-muted/40" : r.acknowledged ? "border-amber-500/30 bg-amber-500/10" : "border-red-500/40 bg-red-500/10"
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <ShieldCheck className={`size-4 shrink-0 ${r.recorded ? "text-primary" : r.acknowledged ? "text-amber-400" : "text-red-400"}`} />
              <span className="text-xs font-semibold text-foreground truncate">{r.name}</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] shrink-0">
              <span title="Attendance" className={r.attendance ? "text-primary" : "text-muted-foreground/50"}><CalendarCheck className="size-3.5" /></span>
              <span title="Watering" className={r.watering ? "text-primary" : "text-muted-foreground/50"}><Droplets className="size-3.5" /></span>
              <span title="Day Log" className={r.dayLog ? "text-primary" : "text-muted-foreground/50"}><MessageSquareText className="size-3.5" /></span>
              <span className={`ml-1 font-bold ${r.recorded ? "text-primary" : r.acknowledged ? "text-amber-300" : "text-red-300"}`}>
                {r.recorded ? (isAm ? "ተመዝግቧል" : "recorded") : r.acknowledged ? (isAm ? "ታውቋል" : "acknowledged") : (isAm ? "አልተመዘገበም" : "missing")}
              </span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
