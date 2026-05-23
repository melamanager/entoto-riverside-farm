import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const ALLOWED_KEYS = [
  "sms_token", "sms_base_url", "sms_enabled",
  "telegram_token", "telegram_chat_id", "telegram_enabled",
  "weather_api_key",
];

function maskToken(value: string): string {
  if (!value || value.length <= 8) return "••••••••";
  return "••••" + value.slice(-4);
}

export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "manager") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const rows = await prisma.appSetting.findMany();
  const out: Record<string, string> = {};
  for (const r of rows) {
    out[r.key] = r.key.endsWith("_token") ? maskToken(r.value) : r.value;
  }
  return NextResponse.json(out);
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (session?.user?.role !== "manager") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json() as Record<string, string>;
  for (const [key, value] of Object.entries(body)) {
    if (!ALLOWED_KEYS.includes(key)) continue;
    if (typeof value !== "string") continue;
    if (value.startsWith("••••")) continue; // unchanged masked value
    await prisma.appSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }
  return NextResponse.json({ ok: true });
}
