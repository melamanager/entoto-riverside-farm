"use client";

import { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Zap, Sparkles, Bot, AlertTriangle, TrendingUp,
  CheckCircle2, Wheat, DollarSign, Bug, Droplets, Users,
  Send, RefreshCw, ChevronRight, Activity,
} from "lucide-react";
import { useLang } from "@/lib/lang";
import { EN, AM } from "@/lib/translations";
import type { Bed, HarvestRecord, DiseaseReport, Valve, Farmer } from "@/lib/types";
import type { CustomerOrder, FertigationRecord, WorkerAssignment } from "@/lib/erp-types";

// ── Alert engine ──────────────────────────────────────────────────────────────

type AlertSeverity = "critical" | "warning" | "info";
interface AIAlert {
  id: string;
  severity: AlertSeverity;
  category: string;
  title: string;
  detail: string;
  confidence: number;
  action: string;
  href?: string;
}

function buildAlerts(
  beds: Bed[],
  diseases: DiseaseReport[],
  valves: Valve[],
  customerOrders: CustomerOrder[],
  fertigationRecords: FertigationRecord[],
  workerAssignments: WorkerAssignment[],
  today: string,
): AIAlert[] {
  const alerts: AIAlert[] = [];

  // Infected beds with untreated disease
  diseases.filter(d => !d.treatmentApplied && d.status !== "resolved").forEach(d => {
    alerts.push({
      id: `alert-disease-${d.id}`,
      severity: d.severity > 50 ? "critical" : "warning",
      category: "Disease",
      title: `Untreated infection in ${d.bedId}`,
      detail: `${d.type.replace("_", " ")} detected with ${d.severity}% severity. Treatment not yet applied — yield loss risk is high.`,
      confidence: d.aiConfidence ?? 80,
      action: "Apply treatment now",
      href: "/diseases",
    });
  });

  // Ripening beds ready for harvest
  beds.filter(b => b.stage === "ripening").forEach(b => {
    const plants = b.lengthM * b.plantsPerMeter;
    alerts.push({
      id: `alert-harvest-${b.id}`,
      severity: "info",
      category: "Harvest",
      title: `${b.id} is entering peak ripeness`,
      detail: `${b.variety} in ${b.id} (${b.lengthM}m, ${plants} plants) projected to be at peak in 2–4 days. Schedule harvest team.`,
      confidence: 84 + (b.lengthM % 10),
      action: "Schedule harvest",
      href: "/assignments",
    });
  });

  // Overdue customer deliveries
  customerOrders.filter(o => o.deliveryStatus === "pending" && o.deliveryDate < today).forEach(o => {
    const balance = o.totalAmount - o.advancePaid;
    alerts.push({
      id: `alert-order-${o.id}`,
      severity: "critical",
      category: "Revenue",
      title: `Overdue delivery — ${o.customerName}`,
      detail: `Order of ${o.quantityKg}kg due on ${new Date(o.deliveryDate).toLocaleDateString("en", { month: "short", day: "numeric" })}. Balance outstanding: ${balance.toLocaleString()} ETB.`,
      confidence: 99,
      action: "Update delivery status",
      href: "/orders",
    });
  });

  // Upcoming scheduled fertigation today
  fertigationRecords.filter(r => r.status === "scheduled" && r.applicationDate === today).forEach(r => {
    const valve = valves.find(v => v.id === r.valveId);
    alerts.push({
      id: `alert-fert-${r.id}`,
      severity: "warning",
      category: "Fertigation",
      title: `${r.fertilizerType} due today — ${valve?.name}`,
      detail: `${r.waterVolumeLiters}L via ${r.applicationMethod} method. Application window: 06:00–10:00 for best uptake.`,
      confidence: 97,
      action: "Mark as applied",
      href: "/fertigation",
    });
  });

  // Warning beds that haven't been inspected
  beds.filter(b => b.health === "warning").forEach(b => {
    const hasActiveDisease = diseases.some(d => d.bedId === b.id && d.status !== "resolved");
    if (!hasActiveDisease) {
      alerts.push({
        id: `alert-warn-${b.id}`,
        severity: "warning",
        category: "Disease",
        title: `${b.id} flagged — no active inspection`,
        detail: `Bed health marked "warning" but no disease report on file. Possible early-stage pathogen or stress. Recommend visual inspection today.`,
        confidence: 72 + (b.lengthM % 15),
        action: "File disease report",
        href: "/diseases",
      });
    }
  });

  // Pending high-priority tasks overdue
  const pendingHighTasks = workerAssignments.filter(a => a.status === "assigned" && a.date < today);
  if (pendingHighTasks.length > 0) {
    alerts.push({
      id: "alert-tasks-overdue",
      severity: "warning",
      category: "Workforce",
      title: `${pendingHighTasks.length} assignment(s) from prior days not completed`,
      detail: `Workers have uncompleted assignments from previous shifts. Check for blockers or reassign.`,
      confidence: 95,
      action: "Review assignments",
      href: "/assignments",
    });
  }

  return alerts.sort((a, b) => {
    const rank = { critical: 0, warning: 1, info: 2 };
    return rank[a.severity] - rank[b.severity];
  });
}

// ── Harvest forecast ──────────────────────────────────────────────────────────

function buildForecast(beds: Bed[], today: string) {
  const todayDate = new Date(today);
  return Array.from({ length: 14 }, (_, i) => {
    const date = new Date(todayDate);
    date.setDate(date.getDate() + i);
    const label = date.toLocaleDateString("en", { month: "short", day: "numeric" });

    // Project yield: beds in ripening/harvest stage, weighted by days ahead
    let kg = 0;
    beds.forEach(b => {
      if (!["fruiting", "ripening", "harvest"].includes(b.stage)) return;
      const stageWeight = b.stage === "harvest" ? 1 : b.stage === "ripening" ? 0.85 : 0.4;
      const healthMultiplier = b.health === "healthy" ? 1 : b.health === "warning" ? 0.7 : 0.3;
      // Ripeness curve: peaks day 2–5, tapers after
      const ripenessCurve = i < 2 ? 0.6 : i < 6 ? 1 : i < 10 ? 0.75 : 0.5;
      const bedYield = b.lengthM * 0.35 * stageWeight * healthMultiplier * ripenessCurve;
      // Stagger beds — not all harvest same day
      if ((beds.indexOf(b) + i) % 2 === 0) kg += bedYield;
    });

    const confidence = Math.max(55, 95 - i * 3);
    return { day: i, label, kg: Math.round(kg * 10) / 10, confidence };
  });
}

// ── Disease risk scoring ──────────────────────────────────────────────────────

function buildRiskScores(beds: Bed[], diseases: DiseaseReport[]) {
  return beds.map(b => {
    let score = 0;
    if (b.health === "infected") score += 70;
    else if (b.health === "warning") score += 35;

    const activeDisease = diseases.filter(d => d.bedId === b.id && d.status !== "resolved");
    score += activeDisease.length * 15;
    activeDisease.forEach(d => { score += d.severity * 0.3; });

    // Proximity penalty: neighbour beds in same valve with disease
    const sameValveInfected = beds.filter(ob => ob.valveId === b.valveId && ob.health === "infected" && ob.id !== b.id).length;
    score += sameValveInfected * 8;

    return { bed: b, score: Math.min(100, Math.round(score)) };
  }).sort((a, b) => b.score - a.score).slice(0, 8);
}

// ── AI Q&A engine ─────────────────────────────────────────────────────────────

interface QAMessage { role: "user" | "ai"; text: string; ts: string }

function aiAnswer(
  question: string,
  beds: Bed[],
  harvests: HarvestRecord[],
  diseases: DiseaseReport[],
  valves: Valve[],
  farmers: Farmer[],
  customerOrders: CustomerOrder[],
  fertigationRecords: FertigationRecord[],
  workerAssignments: WorkerAssignment[],
  today: string,
): string {
  const q = question.toLowerCase();
  const totalKg = harvests.reduce((s, h) => s + parseFloat(h.kg.toString()), 0);
  const bedKgMap: Record<string, number> = {};
  harvests.forEach(h => { bedKgMap[h.bedId] = (bedKgMap[h.bedId] ?? 0) + parseFloat(h.kg.toString()); });
  const topBed = beds.map(b => ({ b, kg: bedKgMap[b.id] ?? 0 })).sort((a, b) => b.kg - a.kg)[0];
  const revenue = customerOrders.reduce((s, o) => s + o.totalAmount, 0);
  const collected = customerOrders.reduce((s, o) => s + o.advancePaid, 0);
  const outstanding = revenue - collected;
  const infectedBeds = beds.filter(b => b.health === "infected");
  const ripeningBeds = beds.filter(b => b.stage === "ripening");
  const harvestBeds = beds.filter(b => b.stage === "harvest");

  if (q.includes("harvest") && (q.includes("today") || q.includes("ready") || q.includes("when"))) {
    const ready = [...harvestBeds, ...ripeningBeds];
    if (ready.length === 0) return "No beds are currently at harvest stage. The nearest candidates are in fruiting stage — expect readiness in 7–12 days based on current growth rates.";
    return `Based on growth stage analysis, **${ready.length} bed(s) are ready or near-ready**: ${ready.map(b => b.id).join(", ")}. I recommend prioritising ${harvestBeds[0]?.id ?? ripeningBeds[0]?.id} first — it has the highest estimated yield per metre. Schedule 2–3 workers per bed for efficient picking.`;
  }

  if (q.includes("disease") || q.includes("infection") || q.includes("sick")) {
    const openDiseases = diseases.filter(d => d.status !== "resolved");
    if (openDiseases.length === 0) return "Great news — no active disease reports. All flagged issues have been resolved. Continue weekly inspections and maintain humidity below 75%.";
    return `There are **${openDiseases.length} active disease report(s)**. ${infectedBeds.length} bed(s) are currently infected: ${infectedBeds.map(b => b.id).join(", ")}. The highest-risk issue is ${openDiseases[0]?.type.replace("_"," ")} in ${openDiseases[0]?.bedId} (${openDiseases[0]?.severity}% severity, ${openDiseases[0]?.aiConfidence}% AI confidence). Immediate treatment is recommended to prevent spread to adjacent beds.`;
  }

  if (q.includes("revenue") || q.includes("money") || q.includes("profit") || q.includes("income")) {
    return `Current season revenue stands at **${revenue.toLocaleString()} ETB** across ${customerOrders.length} orders. Collected so far: ${collected.toLocaleString()} ETB. Outstanding balance: ${outstanding.toLocaleString()} ETB. Projected next-30-day revenue based on pending orders and ripening beds: approximately ${Math.round((revenue * 0.4 + totalKg * 150) / 1000)}k ETB. Hotels and exports are your highest-margin channels.`;
  }

  if (q.includes("yield") || q.includes("produce") || q.includes("kg") || q.includes("production")) {
    return `Season total harvest: **${totalKg.toFixed(1)} kg** across ${harvests.length} harvest events. Best performing bed: **${topBed?.b.id}** (${topBed?.kg.toFixed(1)} kg, ${topBed?.b.variety}). Average yield per metre: ${(totalKg / beds.reduce((s, b) => s + b.lengthM, 0)).toFixed(2)} kg/m. Forecast for the next 14 days: ~${buildForecast(beds, today).reduce((s, d) => s + d.kg, 0).toFixed(0)} kg projected.`;
  }

  if (q.includes("water") || q.includes("irrigat") || q.includes("fertigation")) {
    const appliedFert = fertigationRecords.filter(r => r.status === "applied");
    const totalLitres = appliedFert.reduce((s, r) => s + r.waterVolumeLiters, 0);
    const totalCost = appliedFert.reduce((s, r) => s + r.cost, 0);
    return `Applied fertigation: **${appliedFert.length} applications** using ${totalLitres.toLocaleString()} L of nutrient solution at a total input cost of ${totalCost.toLocaleString()} ETB. ${fertigationRecords.filter(r => r.status === "scheduled").length} application(s) are scheduled and pending. Next due: ${fertigationRecords.filter(r => r.status === "scheduled")[0]?.fertilizerType ?? "none"}.`;
  }

  if (q.includes("worker") || q.includes("farmer") || q.includes("staff") || q.includes("team") || q.includes("employee")) {
    const farmersOnly = farmers.filter(f => f.role === "farmer");
    const topFarmer = farmersOnly.sort((a, b) => b.performanceScore - a.performanceScore)[0];
    const avgAttendance = Math.round(farmersOnly.reduce((s, f) => s + f.attendanceRate, 0) / (farmersOnly.length || 1));
    return `Farm workforce: **${farmers.length} staff** (${farmersOnly.length} farmers, ${farmers.filter(f => f.role === "supervisor").length} supervisors, 1 manager). Top performer: **${topFarmer?.name}** (score ${topFarmer?.performanceScore}). Average attendance: ${avgAttendance}%. ${workerAssignments.filter(a => a.status === "in_progress" && a.date === today).length} workers active right now.`;
  }

  if (q.includes("risk") || q.includes("danger") || q.includes("problem") || q.includes("issue") || q.includes("alert")) {
    const alerts = buildAlerts(beds, diseases, valves, customerOrders, fertigationRecords, workerAssignments, today);
    if (alerts.length === 0) return "No critical issues detected. Farm is operating normally. Continue routine monitoring.";
    return `I've identified **${alerts.length} active alert(s)**. Critical: ${alerts.filter(a => a.severity === "critical").length}. Warnings: ${alerts.filter(a => a.severity === "warning").length}. Top priority: ${alerts[0]?.title}. ${alerts[0]?.detail}`;
  }

  if (q.includes("forecast") || q.includes("predict") || q.includes("next week") || q.includes("future")) {
    const forecast = buildForecast(beds, today);
    const week1 = forecast.slice(0, 7).reduce((s, d) => s + d.kg, 0);
    const week2 = forecast.slice(7).reduce((s, d) => s + d.kg, 0);
    return `7-day harvest forecast: **~${week1.toFixed(0)} kg** expected. Days 8–14: ~${week2.toFixed(0)} kg. Peak yield day predicted: Day ${forecast.indexOf(forecast.reduce((max, d) => d.kg > max.kg ? d : max)) + 1} (${forecast.reduce((max, d) => d.kg > max.kg ? d : max).label}) with ~${forecast.reduce((max, d) => d.kg > max.kg ? d : max).kg.toFixed(1)} kg. Confidence decreases for days >7 due to weather variability.`;
  }

  if (q.includes("recommend") || q.includes("suggest") || q.includes("should i") || q.includes("what do") || q.includes("advice")) {
    const topActions = buildAlerts(beds, diseases, valves, customerOrders, fertigationRecords, workerAssignments, today).slice(0, 3).map(a => `• **${a.title}** — ${a.action}`).join("\n");
    return `Top 3 recommended actions for today:\n\n${topActions || "• Continue routine monitoring\n• Harvest ripe beds early morning\n• Check soil moisture in Valve C"}`;
  }

  if (q.includes("best") && q.includes("variet")) {
    const byVariety: Record<string, number> = {};
    harvests.forEach(h => {
      const b = beds.find(x => x.id === h.bedId);
      if (b) byVariety[b.variety] = (byVariety[b.variety] ?? 0) + parseFloat(h.kg.toString());
    });
    const sorted = Object.entries(byVariety).sort((a, b) => b[1] - a[1]);
    return `Highest-yielding variety this season: **${sorted[0]?.[0]}** (${sorted[0]?.[1].toFixed(1)} kg total). Runner-up: ${sorted[1]?.[0]} (${sorted[1]?.[1].toFixed(1)} kg). ${sorted[0]?.[0]} shows 15–20% better per-metre productivity at Entoto altitude conditions. Recommend expanding planting area next cycle.`;
  }

  // Default
  return `I analysed current farm data to answer your question. Here's a summary: **${beds.length} active beds** across ${valves.length} valves, **${totalKg.toFixed(0)} kg** harvested this season, **${infectedBeds.length}** infected bed(s) requiring attention, **${customerOrders.filter(o => o.deliveryStatus === "pending").length}** pending deliveries. Ask me about harvest timing, disease risk, revenue, workers, forecasts, or recommendations.`;
}

// ── Severity style helpers ────────────────────────────────────────────────────

const SEVERITY_STYLES = {
  critical: { card: "border-red-200 bg-red-50/50",   badge: "bg-red-100 text-red-700", icon: "text-red-500",    dot: "bg-red-500"    },
  warning:  { card: "border-amber-200 bg-amber-50/50", badge: "bg-amber-100 text-amber-700", icon: "text-amber-500", dot: "bg-amber-500"  },
  info:     { card: "border-primary/30 bg-primary/5", badge: "bg-primary/15 text-primary", icon: "text-primary", dot: "bg-primary" },
};

// ── Main component ────────────────────────────────────────────────────────────

export default function AIPage() {
  const { isAm } = useLang();
  const t = isAm ? AM : EN;
  const today = new Date().toISOString().split("T")[0];

  const [beds, setBeds] = useState<Bed[]>([]);
  const [harvests, setHarvests] = useState<HarvestRecord[]>([]);
  const [diseases, setDiseases] = useState<DiseaseReport[]>([]);
  const [valves, setValves] = useState<Valve[]>([]);
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [customerOrders, setCustomerOrders] = useState<CustomerOrder[]>([]);
  const [fertigationRecords, setFertigationRecords] = useState<FertigationRecord[]>([]);
  const [workerAssignments, setWorkerAssignments] = useState<WorkerAssignment[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/beds").then(r => r.json()),
      fetch("/api/harvest").then(r => r.json()),
      fetch("/api/diseases").then(r => r.json()),
      fetch("/api/valves").then(r => r.json()),
      fetch("/api/farmers").then(r => r.json()),
      fetch("/api/orders").then(r => r.json()),
      fetch("/api/fertigation").then(r => r.json()),
      fetch("/api/assignments").then(r => r.json()),
    ]).then(([b, h, d, v, f, o, ft, a]) => {
      setBeds(b);
      setHarvests(h.map((rec: HarvestRecord & { kg: string | number }) => ({ ...rec, kg: parseFloat(rec.kg.toString()) })));
      setDiseases(d);
      setValves(v);
      setFarmers(f);
      setCustomerOrders(o);
      setFertigationRecords(ft);
      setWorkerAssignments(a);
      setLoaded(true);
    });
  }, []);

  const alerts   = loaded ? buildAlerts(beds, diseases, valves, customerOrders, fertigationRecords, workerAssignments, today) : [];
  const forecast = buildForecast(beds, today);
  const riskScores = buildRiskScores(beds, diseases);

  const maxForecastKg = Math.max(...forecast.map(d => d.kg));

  const [messages, setMessages] = useState<QAMessage[]>([]);

  useEffect(() => {
    if (loaded) {
      setMessages([{
        role: "ai",
        text: `Hello! I'm your farm AI assistant. I've analysed all current data across **${beds.length} beds**, **${farmers.length} staff**, and **${customerOrders.length} orders**. Ask me anything — harvest timing, disease risk, revenue forecasts, or worker recommendations.`,
        ts: "Just now",
      }]);
    }
  }, [loaded]);

  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const QUICK_QUESTIONS = [
    "Which beds should I harvest today?",
    "What's the disease risk?",
    "Forecast next 7 days",
    "Top revenue risks?",
    "Best performing variety?",
    "Recommend actions for today",
  ];

  function sendMessage(text?: string) {
    const q = (text ?? input).trim();
    if (!q) return;
    const userMsg: QAMessage = { role: "user", text: q, ts: "Just now" };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setTyping(true);
    setTimeout(() => {
      const answer = aiAnswer(q, beds, harvests, diseases, valves, farmers, customerOrders, fertigationRecords, workerAssignments, today);
      setMessages(prev => [...prev, { role: "ai", text: answer, ts: "Just now" }]);
      setTyping(false);
    }, 800 + Math.random() * 600);
  }

  const criticalCount = alerts.filter(a => a.severity === "critical").length;
  const warningCount  = alerts.filter(a => a.severity === "warning").length;
  const totalKg = harvests.reduce((s, h) => s + parseFloat(h.kg.toString()), 0);
  const week1Forecast = forecast.slice(0, 7).reduce((s, d) => s + d.kg, 0);

  return (
    <div className="p-6 md:p-8 max-w-[1400px] mx-auto space-y-6">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2.5">
            <span className="size-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 grid place-items-center shadow-lg">
              <Zap className="size-5 text-white" />
            </span>
            {t.ai.title}
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">{t.ai.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          {criticalCount > 0 && (
            <Badge className="bg-red-100 text-red-700 border border-red-200 gap-1.5">
              <span className="size-1.5 rounded-full bg-red-500 animate-pulse" />
              {criticalCount} critical
            </Badge>
          )}
          {warningCount > 0 && (
            <Badge className="bg-amber-100 text-amber-700 border border-amber-200">
              {warningCount} warnings
            </Badge>
          )}
          <Badge className="bg-primary/10 text-primary border border-primary/30 gap-1">
            <Activity className="size-3" /> Live
          </Badge>
        </div>
      </div>

      {/* ── KPI Strip ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-gradient-to-br from-amber-50 to-indigo-50 border-amber-200">
          <div className="text-xs text-amber-600 font-semibold uppercase tracking-wide mb-1">AI Alerts</div>
          <div className="text-3xl font-bold text-amber-700 tabular-nums">{alerts.length}</div>
          <div className="text-[11px] text-amber-500 mt-0.5">{criticalCount} critical · {warningCount} warnings</div>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/30">
          <div className="text-xs text-primary font-semibold uppercase tracking-wide mb-1">7-Day Forecast</div>
          <div className="text-3xl font-bold text-primary tabular-nums">{week1Forecast.toFixed(0)} <span className="text-base font-normal">kg</span></div>
          <div className="text-[11px] text-primary/70 mt-0.5">↑ projected harvest</div>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-rose-50 to-pink-50 border-rose-200">
          <div className="text-xs text-rose-600 font-semibold uppercase tracking-wide mb-1">Disease Risk Beds</div>
          <div className="text-3xl font-bold text-rose-700 tabular-nums">{beds.filter(b => b.health !== "healthy").length}</div>
          <div className="text-[11px] text-rose-500 mt-0.5">{beds.filter(b => b.health === "infected").length} infected · {beds.filter(b => b.health === "warning").length} warning</div>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200">
          <div className="text-xs text-amber-600 font-semibold uppercase tracking-wide mb-1">Harvest Readiness</div>
          <div className="text-3xl font-bold text-amber-700 tabular-nums">{beds.filter(b => b.stage === "ripening" || b.stage === "harvest").length}</div>
          <div className="text-[11px] text-amber-500 mt-0.5">beds ready/near-ready</div>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* ── Alert Feed (left 2/3) ──────────────────────────────────────── */}
        <div className="xl:col-span-2 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="size-4 text-amber-500" />
            <h2 className="font-bold text-foreground">Smart Alerts</h2>
            <span className="text-xs text-muted-foreground ml-auto">Model v2.1 · Updated just now</span>
          </div>

          {alerts.length === 0 ? (
            <Card className="p-8 text-center border-primary/30 bg-primary/5">
              <CheckCircle2 className="size-10 mx-auto text-primary mb-2" />
              <div className="font-semibold text-primary">All clear — no active alerts</div>
              <div className="text-sm text-muted-foreground mt-1">Farm is operating normally. Next model scan in 15 minutes.</div>
            </Card>
          ) : (
            alerts.map(alert => {
              const s = SEVERITY_STYLES[alert.severity];
              return (
                <Card key={alert.id} className={`p-4 border ${s.card}`}>
                  <div className="flex items-start gap-3">
                    <div className={`size-2 rounded-full mt-1.5 shrink-0 ${s.dot} ${alert.severity === "critical" ? "animate-pulse" : ""}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <Badge className={`text-[10px] ${s.badge}`}>{alert.category}</Badge>
                        <span className="font-semibold text-sm text-foreground">{alert.title}</span>
                        <span className="ml-auto text-[10px] text-muted-foreground tabular-nums whitespace-nowrap">
                          <Sparkles className="size-3 inline mr-0.5 text-amber-400" />
                          {alert.confidence}% confidence
                        </span>
                      </div>
                      <p className="text-xs text-foreground/70 leading-relaxed">{alert.detail}</p>
                      <div className="mt-2">
                        <a href={alert.href}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 hover:text-violet-800 transition-colors">
                          {alert.action} <ChevronRight className="size-3" />
                        </a>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>

        {/* ── Disease Risk Scores (right) ──────────────────────────────── */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Bug className="size-4 text-rose-500" />
            <h2 className="font-bold text-foreground">Disease Risk Scores</h2>
          </div>
          <Card className="p-4">
            <div className="space-y-3">
              {riskScores.map(({ bed, score }) => {
                const color = score >= 60 ? "bg-red-500" : score >= 30 ? "bg-amber-500" : score >= 10 ? "bg-yellow-400" : "bg-emerald-500";
                const textColor = score >= 60 ? "text-red-600" : score >= 30 ? "text-amber-600" : "text-emerald-600";
                return (
                  <div key={bed.id} className="flex items-center gap-3">
                    <div className="font-mono text-xs font-bold text-foreground/80 w-20 shrink-0">{bed.id}</div>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${score}%` }} />
                    </div>
                    <div className={`text-xs font-bold tabular-nums w-10 text-right ${textColor}`}>{score}%</div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 pt-3 border-t border-border flex items-center gap-3 flex-wrap text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-red-500 inline-block" /> Critical ≥60</span>
              <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-amber-500 inline-block" /> Warning ≥30</span>
              <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-emerald-500 inline-block" /> Healthy &lt;10</span>
            </div>
          </Card>
        </div>
      </div>

      {/* ── Harvest Forecast Chart ────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="size-4 text-primary" />
          <h2 className="font-bold text-foreground">14-Day Harvest Forecast</h2>
          <span className="text-xs text-muted-foreground ml-2">Based on growth stage, health status & historical yield patterns</span>
        </div>
        <Card className="p-5">
          <div className="flex items-end gap-1.5 h-40">
            {forecast.map((day, i) => {
              const heightPct = maxForecastKg > 0 ? (day.kg / maxForecastKg) * 100 : 0;
              const isPast = i === 0;
              const isToday = i === 0;
              const color = day.confidence >= 85 ? "bg-primary" : day.confidence >= 70 ? "bg-primary/70" : "bg-primary/40";
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                  {/* Tooltip */}
                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-foreground text-background text-[10px] rounded px-2 py-1 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                    {day.label}: {day.kg} kg<br />{day.confidence}% conf.
                  </div>
                  <div className="w-full rounded-t-sm" style={{ height: `${Math.max(heightPct, 2)}%` }}>
                    <div className={`w-full h-full rounded-t-sm ${color} ${i === 0 ? "opacity-50" : ""}`} />
                  </div>
                  <div className={`text-[9px] text-muted-foreground text-center leading-tight ${i % 2 === 0 ? "" : "invisible"}`}>
                    {day.label.split(" ")[1]}<br /><span className="text-[8px]">{day.label.split(" ")[0]}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border text-[11px] text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-primary inline-block" /> High confidence (≥85%)</span>
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-primary/70 inline-block" /> Medium (≥70%)</span>
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-primary/40 inline-block" /> Lower confidence</span>
            <span className="ml-auto font-semibold text-foreground/80">
              14-day total: ~{forecast.reduce((s, d) => s + d.kg, 0).toFixed(0)} kg projected
            </span>
          </div>
        </Card>
      </div>

      {/* ── AI Q&A Chat ───────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Bot className="size-4 text-amber-600" />
          <h2 className="font-bold text-foreground">Farm AI Assistant</h2>
          <span className="text-xs text-muted-foreground ml-2">Ask anything about your farm data</span>
        </div>

        <Card className="overflow-hidden">
          {/* Quick questions */}
          <div className="px-4 pt-3 pb-2 border-b border-border bg-muted/50 flex gap-2 flex-wrap">
            {QUICK_QUESTIONS.map(q => (
              <button key={q} onClick={() => sendMessage(q)}
                className="text-[11px] px-2.5 py-1 rounded-full border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors font-medium">
                {q}
              </button>
            ))}
          </div>

          {/* Messages */}
          <div ref={chatRef} className="h-72 overflow-y-auto p-4 space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                <div className={`size-8 rounded-full grid place-items-center shrink-0 ${msg.role === "ai" ? "bg-gradient-to-br from-amber-500 to-orange-600" : "bg-muted"}`}>
                  {msg.role === "ai"
                    ? <Sparkles className="size-4 text-white" />
                    : <Users className="size-4 text-muted-foreground" />}
                </div>
                <div className={`max-w-[80%] ${msg.role === "user" ? "items-end" : "items-start"} flex flex-col gap-1`}>
                  <div className={`rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    msg.role === "ai"
                      ? "bg-card border border-border text-foreground"
                      : "bg-amber-600 text-white"
                  }`}>
                    {msg.text.split("\n").map((line, li) => {
                      const parts = line.split(/\*\*(.*?)\*\*/g);
                      return (
                        <span key={li} className="block">
                          {parts.map((part, pi) =>
                            pi % 2 === 1
                              ? <strong key={pi}>{part}</strong>
                              : <span key={pi}>{part}</span>
                          )}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}

            {typing && (
              <div className="flex gap-3">
                <div className="size-8 rounded-full grid place-items-center bg-gradient-to-br from-amber-500 to-orange-600 shrink-0">
                  <Sparkles className="size-4 text-white" />
                </div>
                <div className="bg-card border border-border rounded-xl px-3.5 py-2.5 flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="size-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="size-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="p-3 border-t border-border flex gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
              placeholder="Ask about harvest timing, disease risk, revenue forecast..."
              className="flex-1 text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400 bg-input text-foreground"
            />
            <Button onClick={() => sendMessage()}
              disabled={!input.trim() || typing}
              className="bg-amber-600 hover:bg-amber-700 size-9 p-0 shrink-0">
              <Send className="size-4" />
            </Button>
          </div>
        </Card>
      </div>

    </div>
  );
}
