"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Settings, Bell, Save, Sliders, Send, DollarSign, Wheat, Clock, MessageSquare, KeyRound, CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { CONFIG_DEFAULTS } from "@/lib/config";

type TabKey = "operations" | "integrations" | "notifications";

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${checked ? "bg-primary" : "bg-muted-foreground/30"}`}>
      <span className={`inline-block size-3.5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4" : "translate-x-0.5"}`} />
    </button>
  );
}

const num = (v: string, d: number) => { const n = parseFloat(v); return Number.isFinite(n) ? n : d; };

export default function SettingsPage() {
  const { isManager } = useAuth();
  const [tab, setTab] = useState<TabKey>("operations");
  const [saving, setSaving] = useState(false);

  // operational config
  const [farmName, setFarmName] = useState(CONFIG_DEFAULTS.farmName);
  const [harvestTarget, setHarvestTarget] = useState(CONFIG_DEFAULTS.harvestDailyTargetKg);
  const [dailyWage, setDailyWage] = useState(CONFIG_DEFAULTS.defaultDailyWage);
  const [workdayHours, setWorkdayHours] = useState(CONFIG_DEFAULTS.workdayHours);
  const [otMultiplier, setOtMultiplier] = useState(CONFIG_DEFAULTS.overtimeMultiplier);
  const [kgPerM, setKgPerM] = useState(CONFIG_DEFAULTS.targetKgPerM);

  // notifications
  const [notify, setNotify] = useState({ disease: true, lowstock: true, tasks: true, harvest: true });
  const [telegramEnabled, setTelegramEnabled] = useState(true);
  const [smsEnabled, setSmsEnabled] = useState(false);

  // integrations (secrets are write-only; we only learn whether they're configured)
  const [telegramToken, setTelegramToken] = useState("");
  const [telegramChatId, setTelegramChatId] = useState("");
  const [smsToken, setSmsToken] = useState("");
  const [smsBaseUrl, setSmsBaseUrl] = useState("");
  const [configured, setConfigured] = useState<Record<string, boolean>>({});
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (!isManager) return;
    fetch("/api/settings").then(r => r.ok ? r.json() : {}).then((s: Record<string, string | boolean>) => {
      if (s.farm_name) setFarmName(String(s.farm_name));
      if (s.harvest_daily_target_kg) setHarvestTarget(num(String(s.harvest_daily_target_kg), harvestTarget));
      if (s.default_daily_wage) setDailyWage(num(String(s.default_daily_wage), dailyWage));
      if (s.workday_hours) setWorkdayHours(num(String(s.workday_hours), workdayHours));
      if (s.overtime_multiplier) setOtMultiplier(num(String(s.overtime_multiplier), otMultiplier));
      if (s.target_kg_per_m) setKgPerM(num(String(s.target_kg_per_m), kgPerM));
      setNotify({
        disease: s.notify_disease !== "false",
        lowstock: s.notify_lowstock !== "false",
        tasks: s.notify_tasks !== "false",
        harvest: s.notify_harvest !== "false",
      });
      if (s.telegram_enabled !== undefined) setTelegramEnabled(s.telegram_enabled !== "false");
      if (s.sms_enabled !== undefined) setSmsEnabled(s.sms_enabled === "true");
      if (s.telegram_chat_id) setTelegramChatId(String(s.telegram_chat_id));
      if (s.sms_base_url) setSmsBaseUrl(String(s.sms_base_url));
      setConfigured({
        telegram_token: !!s.telegram_token_configured,
        sms_token: !!s.sms_token_configured,
        weather_api_key: !!s.weather_api_key_configured,
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isManager]);

  async function save() {
    setSaving(true);
    const body: Record<string, string> = {
      farm_name: farmName,
      harvest_daily_target_kg: String(harvestTarget),
      default_daily_wage: String(dailyWage),
      workday_hours: String(workdayHours),
      overtime_multiplier: String(otMultiplier),
      target_kg_per_m: String(kgPerM),
      notify_disease: String(notify.disease),
      notify_lowstock: String(notify.lowstock),
      notify_tasks: String(notify.tasks),
      notify_harvest: String(notify.harvest),
      telegram_enabled: String(telegramEnabled),
      sms_enabled: String(smsEnabled),
      telegram_chat_id: telegramChatId,
      sms_base_url: smsBaseUrl,
    };
    // only send secrets that were actually typed (empty = leave unchanged)
    if (telegramToken.trim()) body.telegram_token = telegramToken.trim();
    if (smsToken.trim()) body.sms_token = smsToken.trim();

    const res = await fetch("/api/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setSaving(false);
    if (!res.ok) { toast.error("Failed to save settings"); return; }
    toast.success("Settings saved", { description: "Applied across the farm. Payroll, targets and alerts now use these values." });
    setTelegramToken(""); setSmsToken("");
    if (body.telegram_token) setConfigured(c => ({ ...c, telegram_token: true }));
    if (body.sms_token) setConfigured(c => ({ ...c, sms_token: true }));
  }

  async function testTelegram() {
    setTesting(true);
    const res = await fetch("/api/settings/test-telegram", { method: "POST" });
    setTesting(false);
    const d = await res.json().catch(() => ({}));
    if (res.ok) toast.success("Test message sent — check Telegram");
    else toast.error("Telegram test failed", { description: d.error ?? "Set the bot token + chat id, save, then retry." });
  }

  if (!isManager) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <Settings className="size-12 mx-auto mb-3 opacity-20" />
        <p>Settings are only available to managers.</p>
      </div>
    );
  }

  const TABS = [
    { key: "operations" as TabKey, label: "Farm Operations", icon: Sliders },
    { key: "integrations" as TabKey, label: "Integrations", icon: KeyRound },
    { key: "notifications" as TabKey, label: "Notifications", icon: Bell },
  ];
  const inputCls = "w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="p-6 md:p-8 max-w-[1000px] mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Settings className="size-5 text-primary" />
            <h1 className="text-2xl font-bold">Settings & Configuration</h1>
          </div>
          <p className="text-sm text-muted-foreground">Operational parameters, integrations and alert preferences — applied live across the farm.</p>
        </div>
        <Button onClick={save} disabled={saving} className="gap-2"><Save className="size-4" /> {saving ? "Saving…" : "Save Changes"}</Button>
      </div>

      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {TABS.map(tb => (
          <button key={tb.key} onClick={() => setTab(tb.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${tab === tb.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            <tb.icon className="size-3.5" /> {tb.label}
          </button>
        ))}
      </div>

      {tab === "operations" && (
        <div className="space-y-4">
          <Card className="p-5">
            <h3 className="font-semibold text-sm mb-4">Farm</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Farm Name</label>
                <input value={farmName} onChange={e => setFarmName(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5 flex items-center gap-1"><Wheat className="size-3" /> Daily Harvest Target (kg)</label>
                <input type="number" min={0} value={harvestTarget} onFocus={e => e.target.select()} onChange={e => setHarvestTarget(num(e.target.value, harvestTarget))} className={inputCls} />
                <p className="text-[11px] text-muted-foreground mt-1">Milestone alert fires when the day's harvest crosses this.</p>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="font-semibold text-sm mb-4 flex items-center gap-2"><DollarSign className="size-4 text-primary" /> Payroll & Hours</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Default Daily Wage (ETB)</label>
                <input type="number" min={0} value={dailyWage} onFocus={e => e.target.select()} onChange={e => setDailyWage(num(e.target.value, dailyWage))} className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5 flex items-center gap-1"><Clock className="size-3" /> Workday Hours</label>
                <input type="number" min={1} max={24} value={workdayHours} onFocus={e => e.target.select()} onChange={e => setWorkdayHours(num(e.target.value, workdayHours))} className={inputCls} />
                <p className="text-[11px] text-muted-foreground mt-1">Overtime accrues beyond this.</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Overtime Multiplier</label>
                <input type="number" min={1} step={0.1} value={otMultiplier} onFocus={e => e.target.select()} onChange={e => setOtMultiplier(num(e.target.value, otMultiplier))} className={inputCls} />
                <p className="text-[11px] text-muted-foreground mt-1">e.g. 1.5× hourly for OT.</p>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="font-semibold text-sm mb-4">Yield</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Target Yield (kg per metre)</label>
                <input type="number" min={0} step={0.01} value={kgPerM} onFocus={e => e.target.select()} onChange={e => setKgPerM(num(e.target.value, kgPerM))} className={inputCls} />
                <p className="text-[11px] text-muted-foreground mt-1">Baseline for per-bed efficiency scoring.</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {tab === "integrations" && (
        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm flex items-center gap-2"><MessageSquare className="size-4 text-sky-500" /> Telegram</h3>
              {configured.telegram_token
                ? <Badge className="bg-primary/15 text-primary border-primary/30 gap-1"><CheckCircle2 className="size-3" /> Configured</Badge>
                : <Badge variant="outline">Not set</Badge>}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Bot Token</label>
                <input type="password" placeholder={configured.telegram_token ? "•••• saved — leave blank to keep" : "123456:ABC-..."} value={telegramToken} onChange={e => setTelegramToken(e.target.value)} className={inputCls} autoComplete="off" />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Chat ID</label>
                <input placeholder="e.g. 336715653" value={telegramChatId} onChange={e => setTelegramChatId(e.target.value)} className={inputCls} />
              </div>
            </div>
            <div className="flex items-center gap-3 mt-3">
              <Button variant="outline" size="sm" className="gap-2" onClick={testTelegram} disabled={testing}><Send className="size-3.5" /> {testing ? "Sending…" : "Send test message"}</Button>
              <span className="text-[11px] text-muted-foreground">Message @your_bot first so it can reply, then Save.</span>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm flex items-center gap-2">📱 SMS (Ethiopia)</h3>
              {configured.sms_token
                ? <Badge className="bg-primary/15 text-primary border-primary/30 gap-1"><CheckCircle2 className="size-3" /> Configured</Badge>
                : <Badge variant="outline">Not set</Badge>}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">API Token</label>
                <input type="password" placeholder={configured.sms_token ? "•••• saved — leave blank to keep" : "apikey:senderId"} value={smsToken} onChange={e => setSmsToken(e.target.value)} className={inputCls} autoComplete="off" />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Base URL</label>
                <input placeholder="https://api.smsethiopia.com/..." value={smsBaseUrl} onChange={e => setSmsBaseUrl(e.target.value)} className={inputCls} />
              </div>
            </div>
          </Card>

          <Card className="p-4 bg-muted/40">
            <div className="text-xs text-muted-foreground flex items-center gap-2">
              <KeyRound className="size-3.5" />
              Weather (Tomorrow.io) and the Gemini AI key are set as server environment variables. Secrets entered here are <b>encrypted at rest</b> and never shown back.
            </div>
          </Card>
        </div>
      )}

      {tab === "notifications" && (
        <div className="space-y-4">
          <Card className="p-5">
            <h3 className="font-semibold text-sm mb-4">Channels</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                <div><div className="text-sm font-medium">Telegram alerts</div><div className="text-[11px] text-muted-foreground">Push critical events to Telegram</div></div>
                <Toggle checked={telegramEnabled} onChange={setTelegramEnabled} />
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                <div><div className="text-sm font-medium">SMS alerts</div><div className="text-[11px] text-muted-foreground">Requires SMS integration configured</div></div>
                <Toggle checked={smsEnabled} onChange={setSmsEnabled} />
              </div>
            </div>
          </Card>
          <Card className="p-5">
            <h3 className="font-semibold text-sm mb-4">Which events send a Telegram alert</h3>
            <div className="space-y-3">
              {[
                { k: "disease" as const, label: "Disease treatment recommendations", sub: "When a manager sends a recommendation to a supervisor" },
                { k: "tasks" as const, label: "High-priority task assignments", sub: "When a high-priority task is created" },
                { k: "lowstock" as const, label: "Critical low-stock warnings", sub: "When an item crosses half its reorder level" },
                { k: "harvest" as const, label: "Daily harvest target reached", sub: "When the day's harvest hits the target" },
              ].map(item => (
                <div key={item.k} className="flex items-center justify-between">
                  <div><div className="text-sm font-medium">{item.label}</div><div className="text-[11px] text-muted-foreground">{item.sub}</div></div>
                  <Toggle checked={notify[item.k]} onChange={v => setNotify(p => ({ ...p, [item.k]: v }))} />
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground mt-4">In-app bell notifications are always on; these toggles control only the Telegram push.</p>
          </Card>
        </div>
      )}

      <div className="flex justify-end pt-2">
        <Button onClick={save} disabled={saving} className="gap-2 min-w-[160px]"><Save className="size-4" /> {saving ? "Saving…" : "Save Changes"}</Button>
      </div>
    </div>
  );
}
