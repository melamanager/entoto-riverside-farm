"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Settings, Bell, Cpu, Zap, Clock, Droplets, Camera, Radio, Save, Wifi, WifiOff, Sliders, CalendarClock, Bot } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { VALVES, VALVE_STATES, SOIL_READINGS, CAMERA_ALERTS, BEDS } from "@/lib/data";

type TabKey = "notifications" | "irrigation" | "iot" | "ai" | "farm";

interface IrrigationConfig { valveId: string; morningTime: string; eveningTime: string; durationMin: number; autoEnabled: boolean; }
interface AIConfig { diseaseConfidenceThreshold: number; soilMoistureAlertPct: number; workerAnomalySensitivity: "low" | "medium" | "high"; autoRunMorning: boolean; autoRunEvening: boolean; moldRiskAlertScore: number; }

const INITIAL_IRRIGATION: IrrigationConfig[] = VALVES.map(v => ({ valveId: v.id, morningTime: v.id === "valve-a" ? "06:00" : v.id === "valve-b" ? "06:30" : "07:00", eveningTime: v.id === "valve-a" ? "17:00" : v.id === "valve-b" ? "17:30" : "18:00", durationMin: v.id === "valve-c" ? 30 : 25, autoEnabled: true }));
const INITIAL_AI: AIConfig = { diseaseConfidenceThreshold: 70, soilMoistureAlertPct: 45, workerAnomalySensitivity: "medium", autoRunMorning: true, autoRunEvening: false, moldRiskAlertScore: 60 };
const CAMERA_CONFIG = CAMERA_ALERTS.map(ca => ({ id: ca.cameraId, bedId: ca.bedId, enabled: true, lastSeen: ca.detectedAt }));
const SENSOR_CONFIG = SOIL_READINGS().slice(0, 6).map((sr, i) => ({ id: `sensor-${i + 1}`, bedId: sr.bedId, type: "soil" as const, online: sr.status !== "critical", lastReading: sr.recordedAt }));

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${checked ? "bg-primary" : "bg-muted-foreground/30"}`}>
      <span className={`inline-block size-3.5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4" : "translate-x-0.5"}`} />
    </button>
  );
}

export default function SettingsPage() {
  const { isManager } = useAuth();
  const [tab, setTab] = useState<TabKey>("irrigation");
  const [smsEnabled, setSmsEnabled] = useState(true);
  const [telegramEnabled, setTelegramEnabled] = useState(true);
  const [notifyDisease, setNotifyDisease] = useState(true);
  const [notifyHarvest, setNotifyHarvest] = useState(true);
  const [notifyIrrigation, setNotifyIrrigation] = useState(false);
  const [notifyTasks, setNotifyTasks] = useState(true);
  const [irrigation, setIrrigation] = useState<IrrigationConfig[]>(INITIAL_IRRIGATION);
  const [aiConfig, setAiConfig] = useState<AIConfig>(INITIAL_AI);
  const [cameraEnabled, setCameraEnabled] = useState<Record<string, boolean>>(Object.fromEntries(CAMERA_CONFIG.map(c => [c.id, c.enabled])));
  const [sensorEnabled, setSensorEnabled] = useState<Record<string, boolean>>(Object.fromEntries(SENSOR_CONFIG.map(s => [s.id, s.online])));
  const [farmName, setFarmName] = useState("ENTOTO Riverside Farm");
  const [altitudeM, setAltitudeM] = useState(2800);
  const [targetKgPerM, setTargetKgPerM] = useState(0.38);
  const [workStartTime, setWorkStartTime] = useState("06:00");
  const [workEndTime, setWorkEndTime] = useState("17:00");

  function saveAll() { toast.success("Settings saved", { description: "All configuration changes applied successfully." }); }

  const TABS = [
    { key: "irrigation" as TabKey, label: "Irrigation Scheduler", icon: Droplets },
    { key: "iot" as TabKey, label: "IoT Devices", icon: Cpu },
    { key: "ai" as TabKey, label: "AI Settings", icon: Bot },
    { key: "notifications" as TabKey, label: "Notifications", icon: Bell },
    { key: "farm" as TabKey, label: "Farm Config", icon: Settings },
  ];

  if (!isManager) return (<div className="p-8 text-center text-muted-foreground"><Settings className="size-12 mx-auto mb-3 opacity-20" /><p>Settings are only available to managers.</p></div>);

  return (
    <div className="p-6 md:p-8 max-w-[1200px] mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div><div className="flex items-center gap-2 mb-1"><Settings className="size-5 text-primary" /><h1 className="text-2xl font-bold">Settings & Configuration</h1></div><p className="text-sm text-muted-foreground">Manage irrigation schedules, IoT devices, AI agents, and farm settings</p></div>
        <Button onClick={saveAll} className="gap-2"><Save className="size-4" /> Save All Changes</Button>
      </div>
      <div className="flex gap-1 border-b border-border overflow-x-auto pb-0">
        {TABS.map(t => (<button key={t.key} onClick={() => setTab(t.key)} className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${tab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}><t.icon className="size-3.5" />{t.label}</button>))}
      </div>

      {tab === "irrigation" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2"><CalendarClock className="size-4 text-primary" /><h2 className="font-semibold text-foreground">Irrigation Schedule — All Zones</h2></div>
          {irrigation.map((cfg, i) => {
            const valve = VALVES.find(v => v.id === cfg.valveId)!;
            const state = VALVE_STATES.find(vs => vs.valveId === cfg.valveId);
            return (
              <Card key={cfg.valveId} className="p-5">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                  <div className="flex items-center gap-3"><div className="size-8 rounded-lg grid place-items-center text-white text-sm font-bold shadow" style={{ background: valve.color }}>{valve.name.split(" ")[1]}</div><div><div className="font-semibold">{valve.name}</div><div className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><span className={`size-1.5 rounded-full ${state?.isOpen ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground"}`} />{state?.isOpen ? "Currently open" : "Currently closed"} · {state?.mode} mode</div></div></div>
                  <div className="flex items-center gap-2"><span className="text-sm text-muted-foreground">Auto irrigation</span><Toggle checked={cfg.autoEnabled} onChange={v => setIrrigation(prev => prev.map((c, j) => j === i ? { ...c, autoEnabled: v } : c))} /></div>
                </div>
                <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 ${!cfg.autoEnabled ? "opacity-50 pointer-events-none" : ""}`}>
                  <div><label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Morning Start</label><input type="time" value={cfg.morningTime} onChange={e => setIrrigation(prev => prev.map((c, j) => j === i ? { ...c, morningTime: e.target.value } : c))} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-ring" /></div>
                  <div><label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Evening Start</label><input type="time" value={cfg.eveningTime} onChange={e => setIrrigation(prev => prev.map((c, j) => j === i ? { ...c, eveningTime: e.target.value } : c))} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-ring" /></div>
                  <div><label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Duration (min)</label><div className="flex items-center gap-2"><input type="number" min={5} max={120} value={cfg.durationMin} onChange={e => setIrrigation(prev => prev.map((c, j) => j === i ? { ...c, durationMin: Number(e.target.value) } : c))} className="w-24 border border-border rounded-lg px-3 py-2 text-sm bg-card text-center tabular-nums focus:outline-none focus:ring-2 focus:ring-ring" /><span className="text-sm text-muted-foreground">minutes</span></div></div>
                </div>
                <div className="mt-3 pt-3 border-t border-border flex items-center gap-4 text-[11px] text-muted-foreground"><span className="flex items-center gap-1"><Clock className="size-3" /> Next: {state?.nextScheduledEvent}</span><span>Today used: {state?.totalLitersToday?.toLocaleString()} L</span><span>{state?.pressureBar} bar · {BEDS().filter(b => b.valveId === valve.id).length} beds</span></div>
              </Card>
            );
          })}
        </div>
      )}

      {tab === "iot" && (
        <div className="space-y-5">
          <div><div className="flex items-center gap-2 mb-3"><Camera className="size-4 text-primary" /><h2 className="font-semibold">Cameras</h2><Badge variant="outline" className="text-[10px]">{Object.values(cameraEnabled).filter(Boolean).length} / {CAMERA_CONFIG.length} online</Badge></div><div className="grid grid-cols-1 md:grid-cols-2 gap-3">{CAMERA_CONFIG.map(cam => (<Card key={cam.id} className="p-4"><div className="flex items-start justify-between"><div className="flex items-center gap-3"><div className={`size-8 rounded-lg grid place-items-center ${cameraEnabled[cam.id] ? "bg-emerald-100 dark:bg-emerald-950/40" : "bg-muted"}`}><Camera className={`size-4 ${cameraEnabled[cam.id] ? "text-emerald-600" : "text-muted-foreground"}`} /></div><div><div className="text-sm font-semibold">{cam.id}</div><div className="text-[11px] text-muted-foreground">Bed <Link href={`/beds/${cam.bedId}`} className="hover:text-primary font-mono">{cam.bedId}</Link></div></div></div><Toggle checked={cameraEnabled[cam.id]} onChange={v => setCameraEnabled(p => ({ ...p, [cam.id]: v }))} /></div><div className="mt-2 text-[10px] text-muted-foreground flex items-center gap-1.5">{cameraEnabled[cam.id] ? <Wifi className="size-3 text-emerald-500" /> : <WifiOff className="size-3" />}Last active: {new Date(cam.lastSeen).toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" })}</div></Card>))}</div></div>
          <div><div className="flex items-center gap-2 mb-3"><Radio className="size-4 text-primary" /><h2 className="font-semibold">Soil Sensors</h2><Badge variant="outline" className="text-[10px]">{Object.values(sensorEnabled).filter(Boolean).length} / {SENSOR_CONFIG.length} online</Badge></div><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">{SENSOR_CONFIG.map(sensor => { const reading = SOIL_READINGS().find(sr => sr.bedId === sensor.bedId); return (<Card key={sensor.id} className="p-4"><div className="flex items-start justify-between mb-2"><div><div className="text-sm font-semibold">{sensor.id}</div><div className="text-[11px] text-muted-foreground font-mono">{sensor.bedId}</div></div><Toggle checked={sensorEnabled[sensor.id]} onChange={v => setSensorEnabled(p => ({ ...p, [sensor.id]: v }))} /></div>{reading && sensorEnabled[sensor.id] && (<div className="grid grid-cols-2 gap-1.5 text-[10px]"><div className="bg-muted/40 rounded p-1.5"><span className="text-muted-foreground">Moisture</span><div className={`font-bold ${reading.moisturePct < 50 ? "text-amber-600" : "text-emerald-600"}`}>{reading.moisturePct}%</div></div><div className="bg-muted/40 rounded p-1.5"><span className="text-muted-foreground">Temp</span><div className="font-bold">{reading.tempC}°C</div></div><div className="bg-muted/40 rounded p-1.5"><span className="text-muted-foreground">EC</span><div className={`font-bold ${reading.ecMsCm > 2.5 ? "text-amber-600" : ""}`}>{reading.ecMsCm} mS</div></div><div className="bg-muted/40 rounded p-1.5"><span className="text-muted-foreground">pH</span><div className={`font-bold ${reading.ph < 5.8 ? "text-amber-600" : ""}`}>{reading.ph}</div></div></div>)}<div className={`mt-2 inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full ${reading?.status === "optimal" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" : reading?.status === "warning" ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400" : "bg-muted text-muted-foreground"}`}><span className="size-1.5 rounded-full bg-current" />{sensorEnabled[sensor.id] ? (reading?.status ?? "unknown") : "offline"}</div></Card>); })}</div></div>
          <div><div className="flex items-center gap-2 mb-3"><Droplets className="size-4 text-primary" /><h2 className="font-semibold">Valve Controllers</h2></div><div className="grid grid-cols-1 md:grid-cols-3 gap-3">{VALVE_STATES.map(vs => { const valve = VALVES.find(v => v.id === vs.valveId)!; return (<Card key={vs.valveId} className="p-4"><div className="flex items-center gap-2 mb-2"><div className="size-7 rounded-lg grid place-items-center text-white text-xs font-bold" style={{ background: valve.color }}>{valve.name.split(" ")[1]}</div><div><div className="text-sm font-semibold">{valve.name}</div><div className={`text-[10px] font-medium ${vs.isOpen ? "text-emerald-600" : "text-muted-foreground"}`}>{vs.isOpen ? "● Open" : "○ Closed"} · {vs.mode}</div></div></div><div className="text-[10px] text-muted-foreground space-y-0.5"><div>{vs.flowRateLph.toLocaleString()} L/h · {vs.pressureBar} bar</div><div>{vs.totalLitersToday?.toLocaleString()} L used today</div><div className="text-foreground/70">{vs.nextScheduledEvent}</div></div></Card>); })}</div></div>
        </div>
      )}

      {tab === "ai" && (
        <div className="space-y-5">
          <div className="flex items-center gap-2 mb-2"><Bot className="size-4 text-primary" /><h2 className="font-semibold">AI Agent Configuration</h2></div>
          <Card className="p-5"><h3 className="font-semibold text-sm mb-4 flex items-center gap-2"><Zap className="size-4 text-amber-500" /> Auto-Run Schedule</h3><div className="space-y-3"><div className="flex items-center justify-between"><div><div className="text-sm font-medium">Morning analysis (06:00)</div><div className="text-[11px] text-muted-foreground">Run all AI agents at the start of each workday</div></div><Toggle checked={aiConfig.autoRunMorning} onChange={v => setAiConfig(p => ({ ...p, autoRunMorning: v }))} /></div><div className="flex items-center justify-between"><div><div className="text-sm font-medium">Evening analysis (17:00)</div><div className="text-[11px] text-muted-foreground">Run end-of-day forecasting and anomaly checks</div></div><Toggle checked={aiConfig.autoRunEvening} onChange={v => setAiConfig(p => ({ ...p, autoRunEvening: v }))} /></div></div></Card>
          <Card className="p-5"><h3 className="font-semibold text-sm mb-4 flex items-center gap-2"><Sliders className="size-4 text-blue-500" /> Alert Thresholds</h3><div className="space-y-5"><div><div className="flex items-center justify-between mb-2"><div><div className="text-sm font-medium">Disease Detection Confidence</div><div className="text-[11px] text-muted-foreground">Only alert when AI confidence exceeds this level</div></div><span className="text-sm font-bold text-primary tabular-nums">{aiConfig.diseaseConfidenceThreshold}%</span></div><input type="range" min={50} max={95} step={5} value={aiConfig.diseaseConfidenceThreshold} onChange={e => setAiConfig(p => ({ ...p, diseaseConfidenceThreshold: Number(e.target.value) }))} className="w-full accent-primary" /><div className="flex justify-between text-[10px] text-muted-foreground mt-0.5"><span>More alerts (50%)</span><span>Fewer, certain alerts (95%)</span></div></div><div><div className="flex items-center justify-between mb-2"><div><div className="text-sm font-medium">Soil Moisture Alert Level</div><div className="text-[11px] text-muted-foreground">Alert when soil moisture drops below this percentage</div></div><span className="text-sm font-bold text-amber-600 tabular-nums">{aiConfig.soilMoistureAlertPct}%</span></div><input type="range" min={30} max={70} step={5} value={aiConfig.soilMoistureAlertPct} onChange={e => setAiConfig(p => ({ ...p, soilMoistureAlertPct: Number(e.target.value) }))} className="w-full accent-amber-500" /><div className="flex justify-between text-[10px] text-muted-foreground mt-0.5"><span>Alert at very dry (30%)</span><span>Alert early (70%)</span></div></div><div><div className="flex items-center justify-between mb-2"><div><div className="text-sm font-medium">Mold Risk Alert Score</div><div className="text-[11px] text-muted-foreground">Alert when gray mold risk score exceeds this level</div></div><span className="text-sm font-bold text-red-600 tabular-nums">{aiConfig.moldRiskAlertScore}</span></div><input type="range" min={30} max={90} step={5} value={aiConfig.moldRiskAlertScore} onChange={e => setAiConfig(p => ({ ...p, moldRiskAlertScore: Number(e.target.value) }))} className="w-full accent-red-500" /><div className="flex justify-between text-[10px] text-muted-foreground mt-0.5"><span>Alert often (30)</span><span>Alert only critical (90)</span></div></div><div><div className="text-sm font-medium mb-2">Worker Anomaly Sensitivity</div><div className="text-[11px] text-muted-foreground mb-2">How sensitive the AI is to unusual productivity patterns</div><div className="flex gap-2">{(["low", "medium", "high"] as const).map(level => (<button key={level} type="button" onClick={() => setAiConfig(p => ({ ...p, workerAnomalySensitivity: level }))} className={`flex-1 py-2 rounded-lg border-2 text-sm font-medium transition-all capitalize ${aiConfig.workerAnomalySensitivity === level ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-muted-foreground"}`}>{level}</button>))}</div></div></div></Card>
        </div>
      )}

      {tab === "notifications" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2"><Bell className="size-4 text-primary" /><h2 className="font-semibold">Notification Channels</h2></div>
          <Card className="p-5"><h3 className="font-semibold text-sm mb-4">Channel Settings</h3><div className="space-y-4"><div className="flex items-center justify-between p-3 rounded-lg border border-border"><div className="flex items-center gap-3"><div className="size-8 rounded-lg bg-blue-100 dark:bg-blue-950/40 grid place-items-center"><span className="text-sm">📱</span></div><div><div className="text-sm font-medium">SMS Notifications</div><div className="text-[11px] text-muted-foreground">Abebe Ethiopia SMS Gateway</div></div></div><Toggle checked={smsEnabled} onChange={setSmsEnabled} /></div><div className="flex items-center justify-between p-3 rounded-lg border border-border"><div className="flex items-center gap-3"><div className="size-8 rounded-lg bg-sky-100 dark:bg-sky-950/40 grid place-items-center"><span className="text-sm">✈️</span></div><div><div className="text-sm font-medium">Telegram Alerts</div><div className="text-[11px] text-muted-foreground">@EntotoFarmBot</div></div></div><Toggle checked={telegramEnabled} onChange={setTelegramEnabled} /></div></div></Card>
          <Card className="p-5"><h3 className="font-semibold text-sm mb-4">Alert Types</h3><div className="space-y-3">{[{ label: "Disease alerts", sub: "When a new disease is detected or severity increases", val: notifyDisease, set: setNotifyDisease }, { label: "Harvest ready", sub: "When AI detects ripe fruit or beds reach harvest stage", val: notifyHarvest, set: setNotifyHarvest }, { label: "Irrigation events", sub: "Valve open/close, schedule changes, overrides", val: notifyIrrigation, set: setNotifyIrrigation }, { label: "Task reminders", sub: "Pending tasks and overdue assignments", val: notifyTasks, set: setNotifyTasks }].map(item => (<div key={item.label} className="flex items-center justify-between"><div><div className="text-sm font-medium">{item.label}</div><div className="text-[11px] text-muted-foreground">{item.sub}</div></div><Toggle checked={item.val} onChange={item.set} /></div>))}</div></Card>
        </div>
      )}

      {tab === "farm" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2"><Settings className="size-4 text-primary" /><h2 className="font-semibold">Farm Configuration</h2></div>
          <Card className="p-5"><h3 className="font-semibold text-sm mb-4">General Info</h3><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Farm Name</label><input type="text" value={farmName} onChange={e => setFarmName(e.target.value)} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-ring" /></div><div><label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Altitude (m)</label><input type="number" value={altitudeM} onChange={e => setAltitudeM(Number(e.target.value))} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-ring" /></div><div><label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Target Yield (kg/m)</label><input type="number" step={0.01} value={targetKgPerM} onChange={e => setTargetKgPerM(Number(e.target.value))} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-ring" /><p className="text-[11px] text-muted-foreground mt-1">Used for efficiency calculations across all beds</p></div></div></Card>
          <Card className="p-5"><h3 className="font-semibold text-sm mb-4">Work Hours</h3><div className="grid grid-cols-2 gap-4"><div><label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Shift Start</label><input type="time" value={workStartTime} onChange={e => setWorkStartTime(e.target.value)} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-ring" /></div><div><label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Shift End</label><input type="time" value={workEndTime} onChange={e => setWorkEndTime(e.target.value)} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-ring" /></div></div></Card>
          <Card className="p-5"><h3 className="font-semibold text-sm mb-3">System Info</h3><div className="space-y-2 text-sm">{[["Location", "Entoto Mountain, Addis Ababa, Ethiopia 🇪🇹"], ["Total Area", "4.2 ha"], ["Established", "September 2025"], ["Owner", "Entoto Agro PLC"], ["ERP Version", "v2.0 — Live Demo"], ["Data Mode", "Static / In-memory (demo branch)"]].map(([k, v]) => (<div key={k} className="flex items-center justify-between py-1 border-b border-border/50 last:border-0"><span className="text-muted-foreground">{k}</span><span className="font-medium text-foreground">{v}</span></div>))}</div></Card>
        </div>
      )}

      <div className="flex justify-end pt-2"><Button onClick={saveAll} className="gap-2 min-w-[180px]"><Save className="size-4" /> Save Changes</Button></div>
    </div>
  );
}
