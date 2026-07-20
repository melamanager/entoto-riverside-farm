import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getTelegramToken, sendTelegramTo } from "@/lib/notifications";
import { randomBytes } from "node:crypto";

export const runtime = "nodejs";

async function botUsername(token: string): Promise<string | null> {
  // cache the username so we don't hit getMe every time
  const cached = await prisma.appSetting.findUnique({ where: { key: "telegram_bot_username" } });
  if (cached?.value) return cached.value;
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/getMe`).then(x => x.json());
    const u = r?.result?.username as string | undefined;
    if (u) await prisma.appSetting.upsert({ where: { key: "telegram_bot_username" }, update: { value: u }, create: { key: "telegram_bot_username", value: u } });
    return u ?? null;
  } catch { return null; }
}

// GET → current link status + a fresh code + deep link to start the bot
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as { id: string }).id;
  const token = await getTelegramToken();
  if (!token) return NextResponse.json({ configured: false });

  const me = await prisma.farmer.findUnique({ where: { id: userId }, select: { telegramChatId: true, telegramLinkCode: true } });
  const username = await botUsername(token);

  // reuse an existing code or make one
  let code = me?.telegramLinkCode ?? "";
  if (!me?.telegramChatId && !code) {
    code = randomBytes(3).toString("hex").toUpperCase(); // 6 hex chars
    await prisma.farmer.update({ where: { id: userId }, data: { telegramLinkCode: code } });
  }

  return NextResponse.json({
    configured: true,
    linked: !!me?.telegramChatId,
    botUsername: username,
    code,
    deepLink: username ? `https://t.me/${username}?start=${code}` : null,
  });
}

// POST {action:"check"} → scan getUpdates for the code and link the chat
//      {action:"disconnect"} → unlink
export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as { id: string }).id;
  const body = await req.json().catch(() => ({}));
  const token = await getTelegramToken();
  if (!token) return NextResponse.json({ error: "Telegram not configured" }, { status: 400 });

  if (body.action === "disconnect") {
    await prisma.farmer.update({ where: { id: userId }, data: { telegramChatId: null, telegramLinkCode: null } });
    return NextResponse.json({ linked: false });
  }

  // check: read recent bot messages, match any pending code to its chat
  const pending = await prisma.farmer.findMany({
    where: { telegramLinkCode: { not: null }, telegramChatId: null },
    select: { id: true, name: true, telegramLinkCode: true },
  });
  const byCode = new Map(pending.map(f => [f.telegramLinkCode!.toUpperCase(), f]));

  let updates: Array<{ message?: { text?: string; chat?: { id: number } } }> = [];
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/getUpdates`).then(x => x.json());
    updates = Array.isArray(r?.result) ? r.result : [];
  } catch { /* ignore */ }

  let linkedMe = false;
  for (const u of updates) {
    const text = (u.message?.text ?? "").toUpperCase();
    const chatId = u.message?.chat?.id;
    if (!text || chatId == null) continue;
    for (const [code, farmer] of byCode) {
      if (text.includes(code)) {
        await prisma.farmer.update({ where: { id: farmer.id }, data: { telegramChatId: String(chatId), telegramLinkCode: null } });
        byCode.delete(code);
        await sendTelegramTo(String(chatId), `✅ <b>Telegram connected</b>\n\nHi ${farmer.name}, you'll now get your task assignments, daily-routine reminders and follow-ups here.`);
        if (farmer.id === userId) linkedMe = true;
        break;
      }
    }
  }

  const me = await prisma.farmer.findUnique({ where: { id: userId }, select: { telegramChatId: true } });
  return NextResponse.json({ linked: !!me?.telegramChatId, justLinked: linkedMe });
}
