import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { sendSmsEthiopia, sendTelegram } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await auth();
  if (session?.user?.role !== "manager") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { channel, phone } = await req.json();

  if (channel === "sms") {
    if (!phone) return NextResponse.json({ error: "Phone required" }, { status: 400 });
    const result = await sendSmsEthiopia(phone, "ENTOTO Farm: SMS test message. Your SMS Ethiopia integration is working correctly.");
    return NextResponse.json(result);
  }

  if (channel === "telegram") {
    const result = await sendTelegram("✅ <b>ENTOTO Farm</b> — Telegram integration is working correctly.");
    return NextResponse.json(result);
  }

  if (channel === "get_updates") {
    const tokenRow = await prisma.appSetting.findUnique({ where: { key: "telegram_token" } });
    const token = tokenRow?.value;
    if (!token) return NextResponse.json({ error: "Telegram token not configured" }, { status: 400 });
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates`);
      const data = await res.json();
      return NextResponse.json(data);
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Unknown channel" }, { status: 400 });
}
