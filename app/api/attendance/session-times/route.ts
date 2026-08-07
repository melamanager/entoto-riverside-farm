import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCapability } from "@/lib/guard";
import { getFarmConfig } from "@/lib/config-server";
import { STR_KEYS, TIME_RE } from "@/lib/config";
import { toMinutes } from "@/lib/attendance";

/**
 * The working-session boundaries (morning/afternoon start & end).
 *
 * Deliberately NOT behind the manager-only /api/settings gate: whoever records
 * attendance — supervisors included — needs to adjust these when the farm
 * changes its hours.
 */

const FIELD_BY_KEY = STR_KEYS; // morning_start → morningStart, …

export async function GET() {
  const gate = await requireCapability("attendance");
  if (!gate.ok) return gate.response;

  const cfg = await getFarmConfig();
  return NextResponse.json({
    morningStart: cfg.morningStart,
    morningEnd: cfg.morningEnd,
    afternoonStart: cfg.afternoonStart,
    afternoonEnd: cfg.afternoonEnd,
  });
}

export async function PATCH(req: Request) {
  const gate = await requireCapability("attendance");
  if (!gate.ok) return gate.response;

  const body = (await req.json()) as Record<string, unknown>;
  const cfg = await getFarmConfig();

  // Start from the stored values so a partial update stays consistent.
  const next: Record<string, string> = {
    morningStart: cfg.morningStart,
    morningEnd: cfg.morningEnd,
    afternoonStart: cfg.afternoonStart,
    afternoonEnd: cfg.afternoonEnd,
  };

  for (const field of Object.values(FIELD_BY_KEY)) {
    const v = body[field];
    if (v === undefined) continue;
    if (typeof v !== "string" || !TIME_RE.test(v)) {
      return NextResponse.json({ error: `${field} must be a time in HH:MM` }, { status: 400 });
    }
    next[field] = v;
  }

  // Each session must run forwards, and the afternoon must start after lunch.
  const ms = toMinutes(next.morningStart)!;
  const me = toMinutes(next.morningEnd)!;
  const as = toMinutes(next.afternoonStart)!;
  const ae = toMinutes(next.afternoonEnd)!;
  if (me <= ms) {
    return NextResponse.json({ error: "Morning must end after it starts" }, { status: 400 });
  }
  if (ae <= as) {
    return NextResponse.json({ error: "Afternoon must end after it starts" }, { status: 400 });
  }
  if (as < me) {
    return NextResponse.json({ error: "Afternoon cannot start before the morning ends" }, { status: 400 });
  }

  for (const [key, field] of Object.entries(FIELD_BY_KEY)) {
    const value = next[field];
    await prisma.appSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }

  return NextResponse.json(next);
}
