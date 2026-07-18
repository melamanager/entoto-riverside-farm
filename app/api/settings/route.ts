import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { encryptSecret } from "@/lib/crypto";
import { CONFIG_KEYS } from "@/lib/config";

// Integration credentials (secret — encrypted at rest, never returned raw)
const SECRET_KEYS = ["sms_token", "telegram_token", "weather_api_key"];
// Non-secret integration + operational config
const PLAIN_KEYS = [
  "sms_base_url", "sms_enabled",
  "telegram_chat_id", "telegram_enabled",
  ...CONFIG_KEYS,
];
const ALLOWED_KEYS = [...SECRET_KEYS, ...PLAIN_KEYS];

function isSecret(key: string) {
  return key.endsWith("_token") || key.endsWith("_key");
}
function mask(value: string): string {
  if (!value) return "";
  return value.length <= 8 ? "••••••••" : "••••" + value.slice(-4);
}

export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "manager") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const rows = await prisma.appSetting.findMany({ where: { key: { in: ALLOWED_KEYS } } });
  const out: Record<string, string | boolean> = {};
  for (const r of rows) {
    // secrets are only ever exposed as a masked hint + a configured flag
    if (isSecret(r.key)) {
      out[r.key] = r.value ? mask("set") : "";
      out[`${r.key}_configured`] = !!r.value;
    } else {
      out[r.key] = r.value;
    }
  }
  return NextResponse.json(out);
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (session?.user?.role !== "manager") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json() as Record<string, string | boolean>;
  let updated = 0;
  for (const [key, raw] of Object.entries(body)) {
    if (!ALLOWED_KEYS.includes(key)) continue;
    const value = typeof raw === "boolean" ? String(raw) : String(raw ?? "");
    if (isSecret(key)) {
      // an empty or masked value means "leave unchanged"
      if (!value || value.startsWith("••••")) continue;
      await prisma.appSetting.upsert({
        where: { key },
        update: { value: encryptSecret(value) },
        create: { key, value: encryptSecret(value) },
      });
    } else {
      await prisma.appSetting.upsert({ where: { key }, update: { value }, create: { key, value } });
    }
    updated++;
  }
  return NextResponse.json({ ok: true, updated });
}
