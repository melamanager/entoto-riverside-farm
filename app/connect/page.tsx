"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, CheckCircle2, RefreshCw, ExternalLink, Send } from "lucide-react";
import { toast } from "sonner";

type Status = { configured: boolean; linked?: boolean; botUsername?: string | null; code?: string; deepLink?: string | null };

export default function ConnectTelegramPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [checking, setChecking] = useState(false);

  const load = useCallback(() => {
    fetch("/api/telegram/link").then(r => r.json()).then(setStatus).catch(() => setStatus({ configured: false }));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function check() {
    setChecking(true);
    const res = await fetch("/api/telegram/link", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "check" }) });
    setChecking(false);
    const d = await res.json().catch(() => ({}));
    if (d.linked) { toast.success("Telegram connected! 🎉", { description: "You'll now get alerts here." }); load(); }
    else toast.error("Not connected yet", { description: "Make sure you pressed Start (or sent the code) in the bot chat, then check again." });
  }

  async function disconnect() {
    await fetch("/api/telegram/link", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "disconnect" }) });
    toast.success("Telegram disconnected");
    load();
  }

  return (
    <div className="p-6 md:p-8 max-w-[700px] mx-auto space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <MessageSquare className="size-5 text-sky-500" />
          <h1 className="text-2xl font-bold">Connect Telegram</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          Link your Telegram to get your task assignments, daily-routine reminders and follow-ups on your phone.
        </p>
      </div>

      {status === null && <Card className="p-6 text-sm text-muted-foreground">Loading…</Card>}

      {status && !status.configured && (
        <Card className="p-6 text-sm text-amber-700 bg-amber-50 border-amber-200">
          Telegram isn&apos;t set up on the farm yet. Ask your manager to add the bot token in Settings first.
        </Card>
      )}

      {status?.configured && status.linked && (
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="size-8 text-primary" />
            <div>
              <div className="font-bold text-foreground">Telegram is connected ✓</div>
              <div className="text-sm text-muted-foreground">Alerts are being delivered to your Telegram.</div>
            </div>
            <Button variant="outline" size="sm" className="ml-auto" onClick={disconnect}>Disconnect</Button>
          </div>
        </Card>
      )}

      {status?.configured && !status.linked && (
        <Card className="p-6 space-y-5">
          <div className="text-sm font-semibold text-foreground">Two steps to connect:</div>

          {/* Step 1 */}
          <div className="flex gap-3">
            <div className="size-7 rounded-full bg-primary text-primary-foreground grid place-items-center text-sm font-bold shrink-0">1</div>
            <div className="flex-1">
              <div className="text-sm font-semibold">Open the farm bot in Telegram and press Start</div>
              <div className="text-xs text-muted-foreground mt-0.5 mb-2">
                This opens a chat with <b>@{status.botUsername ?? "the farm bot"}</b> and sends your code automatically.
              </div>
              {status.deepLink ? (
                <a href={status.deepLink} target="_blank" rel="noreferrer">
                  <Button className="gap-2 bg-sky-500 hover:bg-sky-600"><ExternalLink className="size-4" /> Open in Telegram</Button>
                </a>
              ) : (
                <div className="text-xs text-muted-foreground">
                  Can&apos;t open automatically. In Telegram search <b>@{status.botUsername}</b>, press Start, then send this code:
                </div>
              )}
              <div className="mt-2 inline-flex items-center gap-2 rounded-md bg-muted border border-border px-3 py-1.5">
                <span className="text-[11px] text-muted-foreground">Your code:</span>
                <span className="font-mono font-bold tracking-widest text-foreground">{status.code}</span>
              </div>
              <div className="text-[11px] text-muted-foreground mt-1">
                If pressing Start doesn&apos;t work, just type this code as a message to the bot.
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex gap-3">
            <div className="size-7 rounded-full bg-primary text-primary-foreground grid place-items-center text-sm font-bold shrink-0">2</div>
            <div className="flex-1">
              <div className="text-sm font-semibold">Come back and confirm</div>
              <div className="text-xs text-muted-foreground mt-0.5 mb-2">After pressing Start / sending the code, tap below.</div>
              <Button onClick={check} disabled={checking} className="gap-2">
                {checking ? <><RefreshCw className="size-4 animate-spin" /> Checking…</> : <><Send className="size-4" /> I&apos;ve done it — check connection</>}
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-4 bg-muted/40">
        <div className="text-xs text-muted-foreground">
          <Badge variant="outline" className="mr-2">Tip</Badge>
          You only do this once. In-app bell notifications keep working regardless — Telegram just puts the urgent ones on your phone.
        </div>
      </Card>
    </div>
  );
}
