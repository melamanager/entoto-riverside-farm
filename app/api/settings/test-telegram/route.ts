import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { sendTelegram } from "@/lib/notifications";

// Manager sends a test Telegram message to confirm the integration works.
export async function POST() {
  const session = await auth();
  if (session?.user?.role !== "manager") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const res = await sendTelegram(
    "✅ <b>Test alert — Entoto Riverside Farm</b>\n\nYour Telegram integration is working. Disease, stock, task and harvest alerts will arrive here.",
  );
  if (res.ok) return NextResponse.json({ ok: true });
  return NextResponse.json({ ok: false, error: res.error ?? "Telegram not configured or send failed" }, { status: 400 });
}
