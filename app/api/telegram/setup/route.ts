import { NextResponse } from "next/server";
import { getTelegramToken } from "@/lib/notifications";
import { tg } from "@/lib/telegram-agent";

export const runtime = "nodejs";

// One-shot bot configuration, CRON_SECRET-gated (public route like /api/cron).
// GET  /api/telegram/setup?key=<CRON_SECRET>            → setWebhook + commands
//      &action=status                                    → getWebhookInfo only
//      &action=delete                                    → back to polling mode
// The bot token lives encrypted in AppSetting, so this must run inside the app.

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const url = new URL(req.url);
  return url.searchParams.get("key") === secret || req.headers.get("x-cron-key") === secret;
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const token = await getTelegramToken();
  if (!token) return NextResponse.json({ error: "Telegram not configured" }, { status: 400 });

  const action = new URL(req.url).searchParams.get("action") ?? "set";

  if (action === "status") {
    return NextResponse.json(await tg(token, "getWebhookInfo"));
  }

  if (action === "delete") {
    const res = await tg(token, "deleteWebhook", { drop_pending_updates: false });
    return NextResponse.json({ deleted: res });
  }

  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!webhookSecret) return NextResponse.json({ error: "TELEGRAM_WEBHOOK_SECRET not set" }, { status: 400 });
  const base = process.env.APP_PUBLIC_URL || "https://entoto.melaverse.net";

  const webhook = await tg(token, "setWebhook", {
    url: `${base}/api/telegram/webhook`,
    secret_token: webhookSecret,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true,
  });

  const commands = await tg(token, "setMyCommands", {
    commands: [
      { command: "language", description: "Reply language · የመልስ ቋንቋ" },
      { command: "mode", description: "Voice or text replies · የመልስ አይነት" },
      { command: "help", description: "How to use · አጠቃቀም" },
    ],
  });

  return NextResponse.json({ webhook, commands, info: await tg(token, "getWebhookInfo") });
}
