"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  MessageSquare, Send, Cloud, Bot, Settings, CheckCircle2,
  XCircle, Loader2, Eye, EyeOff, TestTube2, Info,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";

interface SettingsState {
  sms_token:         string;
  sms_base_url:      string;
  sms_enabled:       string;
  telegram_token:    string;
  telegram_chat_id:  string;
  telegram_enabled:  string;
  weather_api_key:   string;
}

const DEFAULTS: SettingsState = {
  sms_token:        "",
  sms_base_url:     "https://api.smsethiopia.com/api/sms/send",
  sms_enabled:      "true",
  telegram_token:   "",
  telegram_chat_id: "",
  telegram_enabled: "true",
  weather_api_key:  "",
};

function TokenField({
  label, value, onChange, placeholder, hint,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; hint?: string;
}) {
  const [show, setShow] = useState(false);
  const masked = value.startsWith("••••");
  return (
    <div>
      <label className="text-xs font-semibold text-slate-700 block mb-1">{label}</label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type={show || masked ? "text" : "password"}
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-400/40 bg-white"
          />
          {!masked && (
            <button
              type="button"
              onClick={() => setShow(s => !s)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {show ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            </button>
          )}
        </div>
      </div>
      {hint && <p className="text-[11px] text-slate-400 mt-1">{hint}</p>}
      {masked && (
        <button
          type="button"
          className="text-[11px] text-emerald-600 font-semibold mt-1 hover:underline"
          onClick={() => onChange("")}
        >
          Click to replace token
        </button>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const { isManager } = useAuth();
  const router = useRouter();
  const [settings, setSettings] = useState<SettingsState>(DEFAULTS);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [testing, setTesting]   = useState<string | null>(null);
  const [chatUpdates, setChatUpdates] = useState<{ id: number; type?: string }[]>([]);

  useEffect(() => {
    if (!isManager) { router.replace("/"); return; }
    fetch("/api/settings").then(r => r.json()).then(data => {
      setSettings(s => ({ ...s, ...data }));
      setLoading(false);
    });
  }, [isManager, router]);

  function set(key: keyof SettingsState, value: string) {
    setSettings(s => ({ ...s, [key]: value }));
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (res.ok) toast.success("Settings saved");
      else toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  async function testChannel(channel: string) {
    setTesting(channel);
    try {
      const body: Record<string, string> = { channel };
      if (channel === "sms") body.phone = testPhone;
      const res = await fetch("/api/settings/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success(`${channel === "sms" ? "SMS" : "Telegram"} test sent successfully`);
      } else {
        toast.error(`Test failed: ${data.error ?? data.body ?? JSON.stringify(data)}`);
      }
    } finally {
      setTesting(null);
    }
  }

  async function getChatId() {
    setTesting("get_updates");
    try {
      const res = await fetch("/api/settings/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: "get_updates" }),
      });
      const data = await res.json();
      if (data.result) {
        const chats = data.result
          .map((u: { message?: { chat?: { id: number; type?: string } } }) => u.message?.chat)
          .filter(Boolean)
          .filter((c: { id: number }, i: number, a: { id: number }[]) => a.findIndex(x => x.id === c.id) === i);
        setChatUpdates(chats);
        if (chats.length === 0) toast.info("No messages received yet. Send a message to your bot first.");
      } else {
        toast.error(`Failed: ${data.description ?? JSON.stringify(data)}`);
      }
    } finally {
      setTesting(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <Loader2 className="size-5 animate-spin mr-2" /> Loading settings…
      </div>
    );
  }

  const smsConfigured      = settings.sms_token && !settings.sms_token.startsWith("••••");
  const smsMasked          = settings.sms_token?.startsWith("••••");
  const tgTokenConfigured  = settings.telegram_token && !settings.telegram_token.startsWith("••••");
  const tgTokenMasked      = settings.telegram_token?.startsWith("••••");
  const tgChatConfigured   = !!settings.telegram_chat_id;
  const weatherConfigured  = settings.weather_api_key && !settings.weather_api_key.startsWith("••••");
  const weatherMasked      = settings.weather_api_key?.startsWith("••••");

  return (
    <div className="p-6 md:p-8 max-w-[860px] mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-slate-900 grid place-items-center">
            <Settings className="size-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">System Settings</h1>
            <p className="text-sm text-slate-500">Notifications, integrations &amp; API keys</p>
          </div>
        </div>
        <Button onClick={save} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 gap-2">
          {saving ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
          Save all settings
        </Button>
      </div>

      {/* ── SMS Ethiopia ──────────────────────────────────────────────────────── */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-green-100 grid place-items-center">
              <MessageSquare className="size-4 text-green-700" />
            </div>
            <div>
              <div className="font-bold text-slate-900">SMS Ethiopia</div>
              <div className="text-xs text-slate-500">Disease alerts sent to supervisor phones</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={smsMasked || smsConfigured ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-500 border-slate-200"}>
              {smsMasked || smsConfigured ? "Configured" : "Not set"}
            </Badge>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.sms_enabled === "true"}
                onChange={e => set("sms_enabled", e.target.checked ? "true" : "false")}
                className="accent-emerald-600"
              />
              <span className="text-xs font-semibold text-slate-600">Enabled</span>
            </label>
          </div>
        </div>

        <TokenField
          label="API Token (format: API_KEY:SENDER_ID)"
          value={settings.sms_token}
          onChange={v => set("sms_token", v)}
          placeholder="ZE6V155XK40ZZHHBM3NWD73MM5C8RVQT:759"
          hint="Your SMS Ethiopia API key and sender ID separated by a colon"
        />

        <div>
          <label className="text-xs font-semibold text-slate-700 block mb-1">Base URL</label>
          <input
            type="text"
            value={settings.sms_base_url}
            onChange={e => set("sms_base_url", e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
          />
          <p className="text-[11px] text-slate-400 mt-1">Adjust if SMS Ethiopia changes their API endpoint</p>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <input
            type="tel"
            value={testPhone}
            onChange={e => setTestPhone(e.target.value)}
            placeholder="+251911234567"
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm w-44 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
          />
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={testing === "sms" || !testPhone}
            onClick={() => testChannel("sms")}
          >
            {testing === "sms" ? <Loader2 className="size-3.5 animate-spin" /> : <TestTube2 className="size-3.5" />}
            Send test SMS
          </Button>
        </div>
      </Card>

      {/* ── Telegram ──────────────────────────────────────────────────────────── */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-blue-100 grid place-items-center">
              <Bot className="size-4 text-blue-700" />
            </div>
            <div>
              <div className="font-bold text-slate-900">Telegram Bot</div>
              <div className="text-xs text-slate-500">Disease alerts sent to your Telegram chat</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={(tgTokenMasked || tgTokenConfigured) && tgChatConfigured ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-amber-100 text-amber-700 border-amber-200"}>
              {(tgTokenMasked || tgTokenConfigured) && tgChatConfigured ? "Ready" : "Needs chat ID"}
            </Badge>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.telegram_enabled === "true"}
                onChange={e => set("telegram_enabled", e.target.checked ? "true" : "false")}
                className="accent-blue-600"
              />
              <span className="text-xs font-semibold text-slate-600">Enabled</span>
            </label>
          </div>
        </div>

        <TokenField
          label="Bot Token"
          value={settings.telegram_token}
          onChange={v => set("telegram_token", v)}
          placeholder="1234567890:AAExxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
          hint="From @BotFather on Telegram"
        />

        <div>
          <label className="text-xs font-semibold text-slate-700 block mb-1">Chat ID</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={settings.telegram_chat_id}
              onChange={e => set("telegram_chat_id", e.target.value)}
              placeholder="-1001234567890 or 987654321"
              className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400/40"
            />
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 shrink-0"
              disabled={testing === "get_updates"}
              onClick={getChatId}
            >
              {testing === "get_updates" ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
              Get ID
            </Button>
          </div>
          <div className="flex items-start gap-1.5 mt-1.5 p-2.5 rounded-lg bg-blue-50 border border-blue-100">
            <Info className="size-3.5 text-blue-500 mt-0.5 shrink-0" />
            <p className="text-[11px] text-blue-700">
              Send any message to your bot on Telegram, then click <strong>Get ID</strong> to detect the chat ID automatically.
              For group alerts, add the bot to the group first.
            </p>
          </div>
        </div>

        {chatUpdates.length > 0 && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
            <div className="text-xs font-semibold text-blue-800 mb-2">Detected chats — click to use:</div>
            <div className="space-y-1">
              {chatUpdates.map(c => (
                <button
                  key={c.id}
                  onClick={() => { set("telegram_chat_id", String(c.id)); setChatUpdates([]); }}
                  className="flex items-center gap-2 w-full px-3 py-2 rounded-lg bg-white border border-blue-200 hover:border-blue-400 text-xs text-left transition-colors"
                >
                  <span className="font-mono text-blue-800 font-bold">{c.id}</span>
                  {c.type && <Badge className="text-[10px] bg-blue-100 text-blue-700 border-blue-200">{c.type}</Badge>}
                  <span className="ml-auto text-blue-500">Use this →</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={testing === "telegram" || (!tgTokenConfigured && !tgTokenMasked) || !tgChatConfigured}
          onClick={() => testChannel("telegram")}
        >
          {testing === "telegram" ? <Loader2 className="size-3.5 animate-spin" /> : <TestTube2 className="size-3.5" />}
          Send test Telegram message
        </Button>
      </Card>

      {/* ── Weather ───────────────────────────────────────────────────────────── */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-sky-100 grid place-items-center">
              <Cloud className="size-4 text-sky-700" />
            </div>
            <div>
              <div className="font-bold text-slate-900">Tomorrow.io Weather</div>
              <div className="text-xs text-slate-500">Live weather &amp; irrigation intelligence</div>
            </div>
          </div>
          <Badge className={weatherMasked || weatherConfigured ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-500 border-slate-200"}>
            {weatherMasked || weatherConfigured ? "Configured" : "Not set"}
          </Badge>
        </div>

        <TokenField
          label="API Key"
          value={settings.weather_api_key}
          onChange={v => set("weather_api_key", v)}
          placeholder="aa1bCmz9jxDoAT4lazNKw5PRNZwsmvLH"
          hint="From tomorrow.io dashboard — free tier supports up to 500 calls/day"
        />
      </Card>

      {/* ── Status summary ────────────────────────────────────────────────────── */}
      <Card className="p-5">
        <div className="text-xs font-bold text-slate-700 uppercase tracking-widest mb-3">Integration Status</div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "SMS Ethiopia",    ok: smsMasked || !!smsConfigured,    detail: smsMasked || smsConfigured ? "Token set" : "Not configured" },
            { label: "Telegram",        ok: (tgTokenMasked || !!tgTokenConfigured) && tgChatConfigured, detail: !tgChatConfigured ? "Chat ID missing" : "Ready" },
            { label: "Tomorrow.io",     ok: weatherMasked || !!weatherConfigured, detail: weatherMasked || weatherConfigured ? "API key set" : "Using fallback" },
          ].map(s => (
            <div key={s.label} className={`flex items-center gap-2.5 p-3 rounded-xl border ${s.ok ? "bg-emerald-50 border-emerald-200" : "bg-slate-50 border-slate-200"}`}>
              {s.ok
                ? <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                : <XCircle className="size-4 text-slate-400 shrink-0" />
              }
              <div>
                <div className={`text-xs font-bold ${s.ok ? "text-emerald-800" : "text-slate-600"}`}>{s.label}</div>
                <div className="text-[10px] text-slate-500">{s.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="flex justify-end pt-2">
        <Button onClick={save} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 gap-2">
          {saving ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
          Save all settings
        </Button>
      </div>
    </div>
  );
}
