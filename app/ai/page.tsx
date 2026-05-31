"use client";

import { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Zap, Sparkles, Bot, AlertTriangle, CheckCircle2, TrendingUp,
  Droplets, Bug, Users, Send, Activity, ChevronRight, Sprout,
  Shield, Cpu, Clock, BarChart3, Wind, Thermometer, CloudRain,
  ToggleLeft, ToggleRight, RefreshCw, Wheat, Play,
} from "lucide-react";
import {
  BEDS, HARVESTS, DISEASES, FARMERS, VALVES, VALVE_STATES,
  SOIL_READINGS, CAMERA_ALERTS, WEATHER_CURRENT, ATTENDANCE, TANK_LEVELS,
} from "@/lib/data";

const TODAY = "2026-05-20";

// ─── Gray Mold (Botrytis) risk score ────────────────────────────────────────
function calcMoldRisk() {
  const w = WEATHER_CURRENT;
  const soil = SOIL_READINGS();
  const dewGap = w.tempC - w.dewPointC;
  let score = 0;
  if (w.humidityPct > 85) score += 35;
  else if (w.humidityPct > 75) score += 20;
  else if (w.humidityPct > 65) score += 8;
  if (dewGap < 2) score += 40;
  else if (dewGap < 4) score += 25;
  else if (dewGap < 6) score += 10;
  if (w.rainfallMm24h > 10) score += 20;
  else if (w.rainfallMm24h > 5) score += 10;
  else if (w.rainfallMm24h > 2) score += 5;
  const avgMoisture = soil.reduce((s, r) => s + r.moisturePct, 0) / (soil.length || 1);
  if (avgMoisture > 85) score += 15;
  else if (avgMoisture > 75) score += 8;
  return {
    score: Math.min(100, Math.round(score)),
    avgMoisture: Math.round(avgMoisture),
    dewGap: Math.round(dewGap * 10) / 10,
    humidity: w.humidityPct,
    rainfall: w.rainfallMm24h,
    temp: w.tempC,
  };
}

// ─── Thirst forecast — when will each bed need water? ───────────────────────
function calcThirstForecast() {
  const w = WEATHER_CURRENT;
  const soil = SOIL_READINGS();
  const beds = BEDS();
  const vs = VALVE_STATES;
  const evapRate = Math.max(0.4, (w.tempC / 28) * (w.solarWm2 / 500) * 1.8);
  return soil.map(r => {
    const bed = beds.find(b => b.id === r.bedId);
    const valveState = vs.find(v => v.valveId === bed?.valveId);
    const isWatered = valveState?.isOpen ?? false;
    const drainPerHr = isWatered ? 0 : evapRate + 0.5;
    const hoursToThirsty = drainPerHr > 0 ? Math.max(0, (r.moisturePct - 60) / drainPerHr) : 999;
    const urgency: "urgent" | "soon" | "ok" = hoursToThirsty < 4 ? "urgent" : hoursToThirsty < 14 ? "soon" : "ok";
    return {
      bedId: r.bedId,
      valve: bed?.valveId ?? "",
      moisture: Math.round(r.moisturePct),
      hours: Math.round(hoursToThirsty),
      urgency,
      isWatered,
    };
  }).sort((a, b) => a.hours - b.hours);
}

// ─── Worker attendance vs harvest: "Something doesn't add up" ───────────────
function calcWorkerAnomaly() {
  const harvests = HARVESTS();
  const attendance = ATTENDANCE();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date("2026-05-17");
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split("T")[0];
  });
  const rows = days.map(date => {
    const kg = harvests.filter(h => h.date === date).reduce((s, h) => s + Number(h.kg), 0);
    const workers = attendance.filter(a => a.date === date && (a.status === "present" || a.status === "late")).length;
    const kgPerWorker = workers > 0 ? kg / workers : 0;
    const d = new Date(date);
    return {
      date,
      label: d.toLocaleDateString("en", { weekday: "short", month: "short", day: "numeric" }),
      kg: Math.round(kg * 10) / 10,
      workers,
      kgPerWorker: Math.round(kgPerWorker * 10) / 10,
      anomaly: false,
    };
  });
  const avg = rows.reduce((s, r) => s + r.kgPerWorker, 0) / (rows.length || 1);
  const std = Math.sqrt(rows.reduce((s, r) => s + Math.pow(r.kgPerWorker - avg, 2), 0) / (rows.length || 1));
  return rows.map(r => ({ ...r, anomaly: r.kgPerWorker < avg - std * 0.8 && r.workers > 2, avg: Math.round(avg * 10) / 10 }));
}

// ─── Smart Alerts ────────────────────────────────────────────────────────────
type AlertSev = "urgent" | "watch" | "good";
interface FarmAlert { id: string; sev: AlertSev; icon: string; title: string; detail: string; action: string; href: string }

function buildAlerts(): FarmAlert[] {
  const beds = BEDS();
  const diseases = DISEASES();
  const soil = SOIL_READINGS();
  const cameras = CAMERA_ALERTS;
  const tank = TANK_LEVELS[0];
  const tankPct = Math.round((tank.currentL / tank.capacityL) * 100);
  const alerts: FarmAlert[] = [];

  diseases.filter(d => d.status !== "resolved" && !d.treatmentApplied).forEach(d => {
    alerts.push({
      id: `d-${d.id}`, sev: d.severity > 50 ? "urgent" : "watch", icon: "🦠",
      title: `${d.bedId} has an untreated infection`,
      detail: `${d.type.replace(/_/g, " ")} was found there and is affecting ${d.severity}% of the bed. The longer we wait, the more it spreads to nearby beds.`,
      action: "Go treat it", href: "/diseases",
    });
  });

  beds.filter(b => b.stage === "harvest" || b.stage === "ripening").slice(0, 3).forEach(b => {
    alerts.push({
      id: `r-${b.id}`, sev: "good", icon: "🍓",
      title: `${b.id} berries are ready to pick`,
      detail: `${b.variety} in ${b.id} is at peak ripeness. Waiting too long means softer berries and lower selling price.`,
      action: "Schedule harvest team", href: "/harvest",
    });
  });

  cameras.filter(a => a.status === "new").slice(0, 2).forEach(a => {
    alerts.push({
      id: `c-${a.id}`, sev: "watch", icon: "📷",
      title: `Camera spotted something in ${a.bedId}`,
      detail: `The camera thinks it sees "${a.label}" — it's ${Math.round(a.confidence * 100)}% sure. A person should go take a look to confirm.`,
      action: "Go review", href: "/iot",
    });
  });

  soil.filter(s => s.status === "critical").slice(0, 2).forEach(s => {
    alerts.push({
      id: `s-${s.bedId}`, sev: "watch", icon: "💧",
      title: `Soil sensors in ${s.bedId} need attention`,
      detail: `Moisture reading is ${s.moisturePct.toFixed(0)}% — outside the normal range. Plants there may be struggling.`,
      action: "Check the bed", href: "/iot",
    });
  });

  if (tankPct < 30) {
    alerts.push({
      id: "tank-low", sev: tankPct < 15 ? "urgent" : "watch", icon: "🪣",
      title: `Water tank is running low — ${tankPct}% left`,
      detail: `At the current rate of watering, the tank has about ${Math.round(tank.currentL / 1500)} hours left. Plan a refill soon.`,
      action: "Check tank level", href: "/iot",
    });
  }

  return alerts.sort((a, b) => ({ urgent: 0, watch: 1, good: 2 }[a.sev] - { urgent: 0, watch: 1, good: 2 }[b.sev]));
}

// ─── 14-day harvest forecast ─────────────────────────────────────────────────
function buildForecast() {
  const beds = BEDS();
  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date(TODAY);
    d.setDate(d.getDate() + i);
    const label = d.toLocaleDateString("en", { month: "short", day: "numeric" });
    let kg = 0;
    beds.forEach(b => {
      if (!["fruiting", "ripening", "harvest"].includes(b.stage)) return;
      const sw = b.stage === "harvest" ? 1 : b.stage === "ripening" ? 0.85 : 0.4;
      const hw = b.health === "healthy" ? 1 : b.health === "warning" ? 0.7 : 0.3;
      const curve = i < 2 ? 0.6 : i < 6 ? 1 : i < 10 ? 0.75 : 0.5;
      if ((beds.indexOf(b) + i) % 2 === 0) kg += b.lengthM * 0.35 * sw * hw * curve;
    });
    return { day: i, label, kg: Math.round(kg * 10) / 10, conf: Math.max(55, 95 - i * 3) };
  });
}

// ─── Disease risk per bed ─────────────────────────────────────────────────────
function buildBedRisks() {
  const beds = BEDS();
  const diseases = DISEASES();
  return beds.map(b => {
    let score = 0;
    if (b.health === "infected") score += 70;
    else if (b.health === "warning") score += 35;
    const active = diseases.filter(d => d.bedId === b.id && d.status !== "resolved");
    active.forEach(d => { score += d.severity * 0.3; });
    const neighborInfected = beds.filter(o => o.valveId === b.valveId && o.health === "infected" && o.id !== b.id).length;
    score += neighborInfected * 8;
    return { bed: b, score: Math.min(100, Math.round(score)) };
  }).sort((a, b) => b.score - a.score).slice(0, 8);
}

// ─── Chat AI answers ─────────────────────────────────────────────────────────
function aiAnswer(q: string): string {
  const ql = q.toLowerCase();
  const beds = BEDS();
  const harvests = HARVESTS();
  const diseases = DISEASES();
  const totalKg = harvests.reduce((s, h) => s + Number(h.kg), 0);
  const infected = beds.filter(b => b.health === "infected");
  const ripe = beds.filter(b => b.stage === "harvest" || b.stage === "ripening");
  const forecast = buildForecast();
  const week1 = forecast.slice(0, 7).reduce((s, d) => s + d.kg, 0);

  if (ql.includes("harvest") || ql.includes("pick") || ql.includes("ready")) {
    if (ripe.length === 0) return "No beds are fully ripe yet. The ones in fruiting stage should be ready in about 7–12 days. I'll keep watching!";
    return `Right now, **${ripe.length} bed(s) are ready or near-ready**: ${ripe.map(b => b.id).join(", ")}. I'd start with ${ripe[0].id} first — it has the best yield estimate. Best time to pick is early morning when it's cool.`;
  }
  if (ql.includes("disease") || ql.includes("sick") || ql.includes("infection") || ql.includes("mold")) {
    const open = diseases.filter(d => d.status !== "resolved");
    if (open.length === 0) return "Great news — no active disease problems right now! All reported issues have been treated. Keep doing weekly checks just in case.";
    return `There are **${open.length} open disease report(s)**. The worst one is ${open[0].type.replace(/_/g, " ")} in ${open[0].bedId} — it's affected ${open[0].severity}% of that bed and hasn't been treated yet. I'd deal with that one first.`;
  }
  if (ql.includes("water") || ql.includes("thirst") || ql.includes("irrigat")) {
    const thirst = calcThirstForecast();
    const urgent = thirst.filter(t => t.urgency === "urgent");
    const vs = VALVE_STATES;
    const open = vs.filter(v => v.isOpen).length;
    if (urgent.length > 0) return `**${urgent.length} bed(s) are getting quite thirsty** — ${urgent.map(t => t.bedId).join(", ")} could run dry in under 4 hours. Right now ${open} valve(s) are open and running.`;
    return `Water looks fine across all beds. ${open} valve(s) are currently open. The driest beds are ${thirst[0]?.bedId} (${thirst[0]?.moisture}% moisture) but still safe for now.`;
  }
  if (ql.includes("forecast") || ql.includes("predict") || ql.includes("next week") || ql.includes("tomorrow")) {
    const peak = forecast.reduce((max, d) => d.kg > max.kg ? d : max);
    return `Over the next 7 days I'm expecting about **${week1.toFixed(0)} kg** of strawberries. The biggest harvest day should be around **${peak.label}** with roughly **${peak.kg} kg**. These numbers get less certain further out in time.`;
  }
  if (ql.includes("worker") || ql.includes("staff") || ql.includes("team") || ql.includes("attendance") || ql.includes("farmer")) {
    const anomaly = calcWorkerAnomaly();
    const flagged = anomaly.filter(d => d.anomaly);
    const farmers = FARMERS.filter(f => f.role === "farmer");
    if (flagged.length > 0) return `I noticed something odd: on **${flagged.map(d => d.label).join(" and ")}**, you had a full team but the harvest was much lower than normal (${flagged[0].kgPerWorker} kg/worker vs the usual ${flagged[0].avg} kg/worker). Worth investigating what happened those days.`;
    return `You have **${farmers.length} field workers** and the team has been performing consistently this week — about ${anomaly[anomaly.length - 1]?.avg ?? 0} kg per worker per day on average. No unusual drops spotted.`;
  }
  if (ql.includes("risk") || ql.includes("danger") || ql.includes("problem") || ql.includes("alert")) {
    const alerts = buildAlerts();
    const urgent = alerts.filter(a => a.sev === "urgent");
    if (urgent.length > 0) return `I see **${urgent.length} urgent issue(s)** right now. Most pressing: ${urgent[0].title}. ${urgent[0].detail}`;
    return `No urgent problems right now. There are ${alerts.filter(a => a.sev === "watch").length} things worth keeping an eye on, but nothing that needs immediate action. Farm is running well!`;
  }
  if (ql.includes("mold") || ql.includes("botrytis") || ql.includes("grey") || ql.includes("gray")) {
    const mold = calcMoldRisk();
    const level = mold.score > 60 ? "fairly high" : mold.score > 35 ? "moderate" : "low";
    return `Gray mold risk is **${level}** right now (score: ${mold.score}/100). Humidity is at ${mold.humidity}% and there's a ${mold.dewGap}°C gap between air temperature and dew point. ${mold.score > 50 ? "I'd keep an eye on it and avoid wetting the leaves if possible." : "Nothing to worry about today."}`;
  }
  if (ql.includes("recommend") || ql.includes("suggest") || ql.includes("what should") || ql.includes("advice") || ql.includes("today")) {
    const alerts = buildAlerts();
    const top = alerts.slice(0, 3);
    if (top.length === 0) return "Farm looks good today! If I had to suggest anything: harvest ripe beds early morning while it's cool, and do a quick visual check of any beds that had warnings recently.";
    return `My top suggestions for today:\n\n${top.map((a, i) => `**${i + 1}. ${a.title}** — ${a.action}`).join("\n")}`;
  }
  if (ql.includes("season") || ql.includes("total") || ql.includes("how much") || ql.includes("kg")) {
    const byBed: Record<string, number> = {};
    harvests.forEach(h => { byBed[h.bedId] = (byBed[h.bedId] ?? 0) + Number(h.kg); });
    const topBed = Object.entries(byBed).sort((a, b) => b[1] - a[1])[0];
    return `Season harvest so far: **${totalKg.toFixed(1)} kg** across all beds. Best performer is **${topBed?.[0]}** (${topBed?.[1]?.toFixed(1)} kg). In the next 14 days I'm expecting another ~${forecast.reduce((s, d) => s + d.kg, 0).toFixed(0)} kg.`;
  }
  return `I looked at all the farm data to answer that. Quick summary: **${beds.length} active beds**, **${totalKg.toFixed(0)} kg** harvested this season, **${infected.length}** infected bed(s) need attention, and **${ripe.length}** bed(s) are ripe now. Try asking me about harvest timing, disease risk, water levels, forecasts, or your team.`;
}

// ─── Agent definitions ───────────────────────────────────────────────────────
const AGENT_DEFS = [
  {
    id: "watering",
    emoji: "💧",
    name: "Watering Agent",
    color: "border-blue-500/30 bg-blue-500/6",
    tagColor: "bg-blue-500/15 text-blue-400",
    tagline: "Opens and closes water valves so your plants always have the right amount of water.",
    think(): string {
      const soil = SOIL_READINGS();
      const thirsty = soil.filter(r => r.moisturePct < 65);
      const soaked = soil.filter(r => r.moisturePct > 88);
      if (thirsty.length === 0 && soaked.length === 0)
        return "I just checked all 12 beds. Every one of them has a comfortable amount of water. I'll check again in about an hour.";
      const parts: string[] = [];
      if (thirsty.length > 0)
        parts.push(`${thirsty.length} bed(s) are getting dry — ${thirsty.slice(0, 3).map(r => r.bedId).join(", ")}. Their moisture is below 65%. I'd like to open their valves.`);
      if (soaked.length > 0)
        parts.push(`${soaked.length} bed(s) have a bit too much water — ${soaked.slice(0, 2).map(r => r.bedId).join(", ")}. I'd reduce their watering to avoid root problems.`);
      return parts.join(" Also: ");
    },
    act(): string {
      const soil = SOIL_READINGS();
      const thirsty = soil.filter(r => r.moisturePct < 65);
      if (thirsty.length === 0) return `All ${soil.length} beds checked — everyone's happy. No valve changes needed.`;
      return `Opened Valve ${BEDS().find(b => b.id === thirsty[0].bedId)?.valveId?.replace("valve-", "").toUpperCase() ?? "A"} for ${thirsty[0].bedId} (moisture was ${thirsty[0].moisturePct.toFixed(0)}%). Will check results in 30 minutes.`;
    },
  },
  {
    id: "disease-guard",
    emoji: "🛡️",
    name: "Disease Guard",
    color: "border-red-500/30 bg-red-500/6",
    tagColor: "bg-red-500/15 text-red-400",
    tagline: "Watches the cameras and sensors for early signs of plant sickness.",
    think(): string {
      const cameras = CAMERA_ALERTS.filter(a => a.status === "new");
      const diseases = DISEASES().filter(d => d.status !== "resolved");
      const mold = calcMoldRisk();
      const parts: string[] = [];
      if (cameras.length > 0)
        parts.push(`${cameras.length} camera alert(s) haven't been reviewed yet. The most urgent one is in ${cameras[0].bedId} — it looks like "${cameras[0].label}". Someone should go look.`);
      if (mold.score > 45)
        parts.push(`Today's weather worries me a bit — ${mold.humidity}% humidity and the temperature is only ${mold.dewGap}°C above the dew point. Gray mold could start if the nights stay damp.`);
      if (diseases.length > 0)
        parts.push(`There are still ${diseases.length} open disease report(s) that aren't fully treated yet.`);
      if (parts.length === 0)
        return "Everything looks clean to me right now. No new camera alerts, weather is decent, and all reported diseases are being handled. Keep it up!";
      return parts.join(" ");
    },
    act(): string {
      const cameras = CAMERA_ALERTS.filter(a => a.status === "new");
      if (cameras.length > 0)
        return `Flagged ${cameras[0].bedId} as high priority and sent an alert to the supervisor. Recommended: visual inspection within 2 hours.`;
      const diseases = DISEASES().filter(d => d.status !== "resolved" && !d.treatmentApplied);
      if (diseases.length > 0)
        return `Sent a treatment reminder for ${diseases[0].bedId} to the assigned farmer. This is day ${Math.floor(Math.random() * 3) + 1} without treatment.`;
      return "Sent daily clear report to manager. No threats detected in any of the 12 beds.";
    },
  },
  {
    id: "harvest-spotter",
    emoji: "🍓",
    name: "Harvest Spotter",
    color: "border-primary/30 bg-primary/6",
    tagColor: "bg-primary/15 text-primary",
    tagline: "Tracks berry ripeness and tells you exactly when and where to send the harvest team.",
    think(): string {
      const beds = BEDS();
      const ripeNow = beds.filter(b => b.stage === "harvest");
      const ripeSoon = beds.filter(b => b.stage === "ripening");
      const fruiting = beds.filter(b => b.stage === "fruiting");
      if (ripeNow.length === 0 && ripeSoon.length === 0)
        return `No beds are ripe yet. ${fruiting.length} bed(s) are still growing their fruits — I'll let you know the moment they're ready. Usually takes 7–12 more days at Entoto temperatures.`;
      const parts: string[] = [];
      if (ripeNow.length > 0)
        parts.push(`**${ripeNow.map(b => b.id).join(", ")}** should be picked TODAY — they're at peak ripeness.`);
      if (ripeSoon.length > 0)
        parts.push(`**${ripeSoon.map(b => b.id).join(", ")}** will be ready in 2–4 days.`);
      return parts.join(" ") + " I recommend picking in the early morning (before 10am) when berries are firm and it's cool.";
    },
    act(): string {
      const beds = BEDS();
      const ripe = beds.filter(b => b.stage === "harvest" || b.stage === "ripening");
      if (ripe.length === 0) return "No harvest ready today. Monitoring all beds and will notify as soon as berries are ripe.";
      const est = Math.round(ripe[0].lengthM * 0.4 * 10) / 10;
      return `Created harvest task for ${ripe[0].id}. Estimated yield: ~${est} kg. Best window: 06:00–10:00 AM. Notified supervisor.`;
    },
  },
];

type AgentLog = { ts: string; type: "thought" | "action"; text: string };
type AgentState = { enabled: boolean; busy: boolean; log: AgentLog[] };

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AIPage() {
  // Pre-compute data
  const alerts    = buildAlerts();
  const mold      = calcMoldRisk();
  const thirst    = calcThirstForecast();
  const anomaly   = calcWorkerAnomaly();
  const forecast  = buildForecast();
  const bedRisks  = buildBedRisks();
  const maxFcast  = Math.max(...forecast.map(d => d.kg), 1);
  const week1     = forecast.slice(0, 7).reduce((s, d) => s + d.kg, 0);

  const urgentCount  = alerts.filter(a => a.sev === "urgent").length;
  const watchCount   = alerts.filter(a => a.sev === "watch").length;
  const urgentThirst = thirst.filter(t => t.urgency === "urgent").length;
  const anomalyDays  = anomaly.filter(d => d.anomaly).length;

  // Agent state
  const [agents, setAgents] = useState<Record<string, AgentState>>(() =>
    Object.fromEntries(AGENT_DEFS.map(a => [a.id, { enabled: true, busy: false, log: [
      { ts: "2 min ago", type: "thought", text: a.think() },
    ]}]))
  );

  function toggleAgent(id: string) {
    setAgents(prev => ({ ...prev, [id]: { ...prev[id], enabled: !prev[id].enabled } }));
  }

  function runAgent(def: typeof AGENT_DEFS[0]) {
    setAgents(prev => ({ ...prev, [def.id]: { ...prev[def.id], busy: true } }));
    setTimeout(() => {
      const thought = def.think();
      const action  = def.act();
      const now = "Just now";
      setAgents(prev => ({
        ...prev,
        [def.id]: {
          ...prev[def.id],
          busy: false,
          log: [
            { ts: now, type: "thought", text: thought },
            { ts: now, type: "action",  text: action  },
            ...prev[def.id].log.slice(0, 4),
          ],
        },
      }));
    }, 900 + Math.random() * 600);
  }

  // Chat
  type Msg = { role: "user" | "ai"; text: string };
  const [messages, setMessages] = useState<Msg[]>([{
    role: "ai",
    text: `Hi! I'm your farm assistant. I've looked at all your beds, sensors, and camera data. Ask me anything — when to harvest, what's sick, how much rain is coming, or just "what should I do today?"`,
  }]);
  const [input, setInput]   = useState("");
  const [typing, setTyping] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => { chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" }); }, [messages]);

  function send(text?: string) {
    const q = (text ?? input).trim();
    if (!q) return;
    setMessages(prev => [...prev, { role: "user", text: q }]);
    setInput("");
    setTyping(true);
    setTimeout(() => {
      setMessages(prev => [...prev, { role: "ai", text: aiAnswer(q) }]);
      setTyping(false);
    }, 700 + Math.random() * 500);
  }

  const QUICK_Q = [
    "What should I do today?",
    "Which beds need harvesting?",
    "How's the disease situation?",
    "When will I have most berries?",
    "Any water problems?",
    "Is mold a risk today?",
  ];

  const moldLevel = mold.score > 60 ? "High Risk" : mold.score > 35 ? "Watch Out" : "All Good";
  const moldColor = mold.score > 60 ? "text-red-400 bg-red-500/10 border-red-500/25"
    : mold.score > 35 ? "text-amber-400 bg-amber-500/10 border-amber-500/25"
    : "text-primary bg-primary/10 border-primary/25";

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2.5">
            <span className="size-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 grid place-items-center shadow-lg shadow-amber-900/30">
              <Zap className="size-5 text-white" />
            </span>
            AI Alerts & Farm Intelligence
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Your farm's AI brain — watching sensors, spotting problems, and running smart agents 24/7
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {urgentCount > 0 && (
            <Badge className="bg-red-100 text-red-700 border border-red-200 gap-1.5">
              <span className="size-1.5 rounded-full bg-red-500 animate-pulse" />
              {urgentCount} urgent
            </Badge>
          )}
          {watchCount > 0 && (
            <Badge className="bg-amber-100 text-amber-700 border border-amber-200">{watchCount} watch</Badge>
          )}
          <Badge className="bg-primary/10 text-primary border border-primary/30 gap-1">
            <Activity className="size-3" /> Live
          </Badge>
        </div>
      </div>

      {/* ── 4 Quick Stats ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: "Active Alerts",
            value: alerts.length,
            sub: `${urgentCount} urgent · ${watchCount} watch`,
            icon: AlertTriangle, bg: "from-red-500/10 to-amber-500/5 border-red-500/20", v: "text-red-500",
          },
          {
            label: "Next 7 Days",
            value: `${week1.toFixed(0)} kg`,
            sub: "expected harvest",
            icon: TrendingUp, bg: "from-primary/15 to-primary/5 border-primary/20", v: "text-primary",
          },
          {
            label: "AI Agents",
            value: Object.values(agents).filter(a => a.enabled).length,
            sub: "running right now",
            icon: Cpu, bg: "from-violet-500/10 to-violet-500/5 border-violet-500/20", v: "text-violet-400",
          },
          {
            label: "Beds Needing Water",
            value: urgentThirst,
            sub: urgentThirst === 0 ? "all hydrated ✓" : "within 4 hours",
            icon: Droplets, bg: "from-blue-500/10 to-blue-500/5 border-blue-500/20", v: "text-blue-400",
          },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border bg-gradient-to-br ${s.bg} p-4`}>
            <div className="flex items-center gap-1.5 mb-1">
              <s.icon className={cn("size-3.5", s.v)} />
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{s.label}</span>
            </div>
            <div className={cn("text-3xl font-black tabular-nums leading-tight", s.v)}>{s.value}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Smart Alerts + Disease Risk ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

        <div className="xl:col-span-2 space-y-3">
          <div className="flex items-center gap-2">
            <Zap className="size-4 text-amber-500" />
            <h2 className="font-bold text-foreground text-base">What Needs Your Attention Today</h2>
          </div>
          {alerts.length === 0 ? (
            <Card className="p-8 text-center border-primary/30 bg-primary/5">
              <CheckCircle2 className="size-10 mx-auto text-primary mb-2" />
              <div className="font-semibold text-primary">All clear — nothing urgent today</div>
              <div className="text-sm text-muted-foreground mt-1">Farm is running smoothly. AI is still watching in the background.</div>
            </Card>
          ) : (
            alerts.map(alert => {
              const s = alert.sev === "urgent"
                ? { card: "border-red-500/25 bg-red-500/5", dot: "bg-red-500 animate-pulse", badge: "bg-red-100 text-red-700", link: "text-red-500 hover:text-red-700" }
                : alert.sev === "watch"
                ? { card: "border-amber-500/25 bg-amber-500/5", dot: "bg-amber-500", badge: "bg-amber-100 text-amber-700", link: "text-amber-600 hover:text-amber-800" }
                : { card: "border-primary/20 bg-primary/5", dot: "bg-primary", badge: "bg-primary/15 text-primary", link: "text-primary hover:text-primary/70" };
              return (
                <Card key={alert.id} className={`p-4 border ${s.card}`}>
                  <div className="flex items-start gap-3">
                    <span className="text-xl leading-none shrink-0 mt-0.5">{alert.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-semibold text-sm text-foreground">{alert.title}</span>
                        <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", s.badge)}>
                          {alert.sev === "urgent" ? "Act Now" : alert.sev === "watch" ? "Keep An Eye On" : "Good News"}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{alert.detail}</p>
                      <a href={alert.href} className={cn("inline-flex items-center gap-1 text-xs font-semibold mt-2 transition-colors", s.link)}>
                        {alert.action} <ChevronRight className="size-3" />
                      </a>
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>

        {/* Disease risk by bed */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Bug className="size-4 text-red-400" />
            <h2 className="font-bold text-foreground text-base">Which Beds Are Most At Risk</h2>
          </div>
          <Card className="p-4">
            <p className="text-[11px] text-muted-foreground mb-3">Each bar shows how worried the AI is about that bed getting sick. 0 = perfectly healthy, 100 = serious trouble.</p>
            <div className="space-y-2.5">
              {bedRisks.map(({ bed, score }) => {
                const color = score >= 60 ? "bg-red-500" : score >= 30 ? "bg-amber-500" : "bg-primary";
                const tc = score >= 60 ? "text-red-500" : score >= 30 ? "text-amber-500" : "text-primary";
                const label = score >= 60 ? "Treat now" : score >= 30 ? "Watch it" : "Healthy";
                return (
                  <div key={bed.id} className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-foreground/70 w-16 shrink-0">{bed.id}</span>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div className={cn("h-full rounded-full transition-all duration-700", color)} style={{ width: `${score}%` }} />
                    </div>
                    <span className={cn("text-[10px] font-semibold w-16 text-right shrink-0", tc)}>{label}</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 pt-3 border-t border-border flex gap-3 flex-wrap text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-red-500 inline-block" /> Treat now</span>
              <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-amber-500 inline-block" /> Watch it</span>
              <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-primary inline-block" /> Healthy</span>
            </div>
          </Card>
        </div>
      </div>

      {/* ── AI Health Watchers ──────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Shield className="size-4 text-violet-400" />
          <h2 className="font-bold text-foreground text-base">What the AI Is Watching Right Now</h2>
          <span className="text-xs text-muted-foreground ml-1">Two things the AI watches automatically, every hour</span>
        </div>
        <div className="grid md:grid-cols-2 gap-4">

          {/* Mold Warning */}
          <Card className="p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="font-bold text-foreground flex items-center gap-2">
                  <span className="text-lg">🍄</span> Gray Mold Warning
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Like a weather app but for mold. When humidity + temperature + soil moisture all line up badly, your berries are in danger.
                </p>
              </div>
              <Badge className={cn("text-xs font-bold border shrink-0 ml-2", moldColor)}>{moldLevel}</Badge>
            </div>

            {/* Big score gauge */}
            <div className="flex items-center gap-5 mb-4">
              <div className="relative size-24 shrink-0">
                <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                  <circle cx="60" cy="60" r="48" fill="none" stroke="currentColor" strokeWidth="12" className="text-muted/40" />
                  <circle cx="60" cy="60" r="48" fill="none"
                    stroke={mold.score > 60 ? "#ef4444" : mold.score > 35 ? "#f59e0b" : "#c8dc38"}
                    strokeWidth="12"
                    strokeDasharray={`${(mold.score / 100) * 301.6} 301.6`}
                    strokeLinecap="round"
                    style={{ transition: "stroke-dasharray 1s ease" }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-black text-foreground">{mold.score}</span>
                  <span className="text-[9px] text-muted-foreground">/ 100</span>
                </div>
              </div>
              <div className="space-y-2 text-sm flex-1">
                {[
                  { icon: "💧", label: "Humidity", val: `${mold.humidity}%`, bad: mold.humidity > 75 },
                  { icon: "🌡️", label: "Temp vs Dew Point", val: `${mold.dewGap}°C gap`, bad: mold.dewGap < 4 },
                  { icon: "🌧️", label: "Rain last 24h", val: `${mold.rainfall} mm`, bad: mold.rainfall > 5 },
                  { icon: "🌱", label: "Avg soil moisture", val: `${mold.avgMoisture}%`, bad: mold.avgMoisture > 82 },
                ].map(row => (
                  <div key={row.label} className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground flex items-center gap-1.5"><span>{row.icon}</span>{row.label}</span>
                    <span className={cn("font-semibold", row.bad ? "text-amber-400" : "text-foreground")}>{row.val}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className={cn("rounded-lg px-3 py-2.5 text-xs", mold.score > 60 ? "bg-red-500/10 text-red-400" : mold.score > 35 ? "bg-amber-500/10 text-amber-400" : "bg-primary/10 text-primary")}>
              {mold.score > 60
                ? "⚠️ Conditions are risky right now. Try not to wet the leaves when watering, and increase airflow if possible."
                : mold.score > 35
                ? "👀 Worth keeping an eye on. If humidity stays above 80% tonight, mold could start forming."
                : "✅ Today's conditions are fine for your strawberries. No mold risk right now."}
            </div>
          </Card>

          {/* Thirst Forecast */}
          <Card className="p-5">
            <div className="mb-4">
              <div className="font-bold text-foreground flex items-center gap-2">
                <span className="text-lg">🌵</span> When Will Each Bed Get Thirsty?
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Based on current soil moisture, weather, and how fast water evaporates today — this shows when each bed will need watering.
              </p>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {thirst.slice(0, 12).map(t => {
                const urgColor = t.urgency === "urgent" ? "text-red-400" : t.urgency === "soon" ? "text-amber-400" : "text-primary";
                const barColor = t.urgency === "urgent" ? "bg-red-500" : t.urgency === "soon" ? "bg-amber-500" : "bg-primary";
                const hoursText = t.isWatered ? "Being watered now" : t.hours >= 999 ? "Fine all day" : t.hours === 0 ? "Needs water NOW" : `Thirsty in ~${t.hours}h`;
                return (
                  <div key={t.bedId} className="flex items-center gap-2.5">
                    <span className="font-mono text-xs font-bold text-foreground/70 w-16 shrink-0">{t.bedId}</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className={cn("text-[10px] font-semibold", t.isWatered ? "text-blue-400" : urgColor)}>{hoursText}</span>
                        <span className="text-[10px] text-muted-foreground">{t.moisture}%</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className={cn("h-full rounded-full transition-all", t.isWatered ? "bg-blue-400 animate-pulse" : barColor)}
                          style={{ width: `${Math.min(100, t.moisture)}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {urgentThirst > 0 && (
              <div className="mt-3 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-400">
                ⚠️ {urgentThirst} bed(s) will run out of water in under 4 hours — check valves now.
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* ── Patterns AI Noticed ──────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="size-4 text-indigo-400" />
          <h2 className="font-bold text-foreground text-base">Patterns the AI Noticed</h2>
        </div>
        <div className="grid md:grid-cols-2 gap-4">

          {/* Worker anomaly */}
          <Card className="p-5">
            <div className="font-bold text-foreground flex items-center gap-2 mb-1">
              <span className="text-lg">🕵️</span> Something Doesn't Add Up
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              We compare how many people were working each day vs how many kilos were harvested. When the numbers don't match, the AI flags it — so you can investigate.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-1.5 text-muted-foreground font-semibold text-[10px] uppercase tracking-wide">Day</th>
                    <th className="text-right py-1.5 text-muted-foreground font-semibold text-[10px] uppercase tracking-wide">Workers</th>
                    <th className="text-right py-1.5 text-muted-foreground font-semibold text-[10px] uppercase tracking-wide">Harvested</th>
                    <th className="text-right py-1.5 text-muted-foreground font-semibold text-[10px] uppercase tracking-wide">Per Worker</th>
                    <th className="text-right py-1.5 text-muted-foreground font-semibold text-[10px] uppercase tracking-wide pr-1"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {anomaly.map(row => (
                    <tr key={row.date} className={cn("transition-colors", row.anomaly ? "bg-amber-500/8" : "")}>
                      <td className="py-2 text-foreground/80 font-medium">{row.label}</td>
                      <td className="py-2 text-right text-muted-foreground">{row.workers}</td>
                      <td className="py-2 text-right text-muted-foreground">{row.kg} kg</td>
                      <td className={cn("py-2 text-right font-bold tabular-nums", row.anomaly ? "text-amber-400" : "text-foreground/70")}>
                        {row.kgPerWorker} kg
                      </td>
                      <td className="py-2 pl-2 text-right">
                        {row.anomaly ? <span title="Something seems off">⚠️</span> : <span className="text-muted-foreground/30">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 text-[10px] text-muted-foreground">
              Average: <span className="font-semibold text-foreground">{anomaly[0]?.avg ?? 0} kg/worker/day</span>
              {anomalyDays > 0 && <span className="text-amber-400 ml-2">· ⚠️ {anomalyDays} day(s) below normal</span>}
            </div>
          </Card>

          {/* Harvest forecast chart */}
          <Card className="p-5">
            <div className="font-bold text-foreground flex items-center gap-2 mb-1">
              <span className="text-lg">📈</span> When Will Your Berries Be Ready?
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Based on which beds are growing, how healthy they are, and how fast Entoto strawberries usually ripen. Bars get lighter when we're less sure.
            </p>
            <div className="flex items-end gap-1 h-28">
              {forecast.map((day, i) => {
                const h = Math.max(4, (day.kg / maxFcast) * 100);
                const color = day.conf >= 85 ? "bg-primary" : day.conf >= 70 ? "bg-primary/65" : "bg-primary/35";
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-0.5 group relative">
                    <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 bg-foreground text-background text-[9px] rounded px-1.5 py-0.5 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                      {day.label}: {day.kg} kg
                    </div>
                    <div className="w-full flex-1 flex items-end">
                      <div className={cn("w-full rounded-t-sm", color)} style={{ height: `${h}%` }} />
                    </div>
                    {i % 3 === 0 && (
                      <span className="text-[8px] text-muted-foreground/60 leading-tight text-center truncate w-full">{day.label.split(" ")[1]}</span>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
              <div className="flex gap-3">
                <span className="flex items-center gap-1"><span className="size-2.5 rounded-sm bg-primary inline-block" /> Sure</span>
                <span className="flex items-center gap-1"><span className="size-2.5 rounded-sm bg-primary/65 inline-block" /> Fairly sure</span>
                <span className="flex items-center gap-1"><span className="size-2.5 rounded-sm bg-primary/35 inline-block" /> Guessing</span>
              </div>
              <span className="font-semibold text-foreground/80">~{forecast.reduce((s, d) => s + d.kg, 0).toFixed(0)} kg / 14 days</span>
            </div>
          </Card>
        </div>
      </div>

      {/* ── AI Agents ───────────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Cpu className="size-4 text-violet-400" />
          <h2 className="font-bold text-foreground text-base">AI Agents Running Your Farm</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          These three little AI workers run in the background — watching, deciding, and acting on your behalf. You can turn each one on or off, and ask them what they're thinking at any time.
        </p>
        <div className="grid md:grid-cols-3 gap-4">
          {AGENT_DEFS.map(def => {
            const state = agents[def.id];
            return (
              <Card key={def.id} className={cn("border-2 overflow-hidden transition-all", def.color, !state.enabled && "opacity-60")}>
                {/* Header */}
                <div className="p-4 pb-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2.5">
                      <span className="text-2xl">{def.emoji}</span>
                      <div>
                        <div className="font-bold text-foreground text-sm">{def.name}</div>
                        <Badge className={cn("text-[9px] mt-0.5", def.tagColor, "border-0")}>
                          {state.enabled ? (state.busy ? "Thinking…" : "Active") : "Paused"}
                        </Badge>
                      </div>
                    </div>
                    {/* Toggle */}
                    <button onClick={() => toggleAgent(def.id)} className="shrink-0 mt-0.5">
                      {state.enabled
                        ? <ToggleRight className="size-6 text-primary" />
                        : <ToggleLeft className="size-6 text-muted-foreground/40" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug">{def.tagline}</p>
                </div>

                {/* Latest thought/action */}
                <div className="px-4 pb-3 space-y-2">
                  {state.log.slice(0, 2).map((entry, i) => (
                    <div key={i} className="rounded-lg bg-background/50 border border-border/50 px-3 py-2">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide">
                          {entry.type === "thought" ? "💭 Thinking" : "✅ Did"}
                        </span>
                        <span className="text-[9px] text-muted-foreground/50 ml-auto">{entry.ts}</span>
                      </div>
                      <p className="text-[11px] text-foreground/80 leading-snug">{entry.text}</p>
                    </div>
                  ))}
                </div>

                {/* Action buttons */}
                <div className="px-4 pb-4 flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!state.enabled || state.busy}
                    onClick={() => runAgent(def)}
                    className="flex-1 h-8 text-[11px] border-border hover:bg-accent gap-1.5"
                  >
                    {state.busy
                      ? <><RefreshCw className="size-3 animate-spin" /> Working…</>
                      : <><Play className="size-3" /> Run Now</>}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* ── Farm AI Chat ─────────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Bot className="size-4 text-amber-500" />
          <h2 className="font-bold text-foreground text-base">Ask Your Farm AI Anything</h2>
          <span className="text-xs text-muted-foreground ml-1">Type a question in plain English</span>
        </div>
        <Card className="overflow-hidden">
          {/* Quick questions */}
          <div className="px-4 pt-3 pb-2.5 border-b border-border bg-muted/40 flex gap-1.5 flex-wrap">
            {QUICK_Q.map(q => (
              <button key={q} onClick={() => send(q)}
                className="text-[11px] px-2.5 py-1 rounded-full border border-amber-300/50 bg-amber-50/70 text-amber-700 hover:bg-amber-100 transition-colors font-medium dark:border-amber-500/25 dark:bg-amber-500/8 dark:text-amber-400 dark:hover:bg-amber-500/15">
                {q}
              </button>
            ))}
          </div>

          {/* Messages */}
          <div ref={chatRef} className="h-72 overflow-y-auto p-4 space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={cn("flex gap-3", msg.role === "user" && "flex-row-reverse")}>
                <div className={cn("size-8 rounded-full grid place-items-center shrink-0",
                  msg.role === "ai" ? "bg-gradient-to-br from-amber-500 to-orange-600" : "bg-muted")}>
                  {msg.role === "ai"
                    ? <Sparkles className="size-4 text-white" />
                    : <Users className="size-4 text-muted-foreground" />}
                </div>
                <div className={cn("max-w-[82%] flex flex-col gap-1", msg.role === "user" && "items-end")}>
                  <div className={cn("rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                    msg.role === "ai"
                      ? "bg-card border border-border text-foreground rounded-tl-sm"
                      : "bg-amber-600 text-white rounded-tr-sm")}>
                    {msg.text.split("\n").map((line, li) => {
                      const parts = line.split(/\*\*(.*?)\*\*/g);
                      return (
                        <span key={li} className="block">
                          {parts.map((p, pi) => pi % 2 === 1 ? <strong key={pi}>{p}</strong> : <span key={pi}>{p}</span>)}
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
                <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-3.5 py-2.5 flex items-center gap-1.5">
                  {[0, 150, 300].map(d => (
                    <span key={d} className="size-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: `${d}ms` }} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="p-3 border-t border-border flex gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
              placeholder="Ask about harvest, disease, water, workers, forecasts…"
              className="flex-1 text-sm border border-border rounded-xl px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400/50 bg-input text-foreground placeholder:text-muted-foreground/50"
            />
            <Button onClick={() => send()} disabled={!input.trim() || typing}
              className="bg-amber-600 hover:bg-amber-700 size-9 p-0 shrink-0 rounded-xl">
              <Send className="size-4" />
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
