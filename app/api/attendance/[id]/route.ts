import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCapability } from "@/lib/guard";
import { getFarmConfig } from "@/lib/config-server";
import { calcHoursWorked, deriveDayStatus, isWorking } from "@/lib/attendance";
import type { AttendanceStatus } from "@/lib/types";
import { todayAddis } from "@/lib/dates";

const VALID_STATUS = new Set<AttendanceStatus>(["present", "absent", "late", "leave", "holiday"]);

const TIME_FIELDS = [
  "checkInTime",
  "morningCheckOutTime",
  "afternoonCheckInTime",
  "checkOutTime",
] as const;

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireCapability("attendance");
  if (!gate.ok) return gate.response;

  const { id } = await params;
  const body = await req.json();

  const existing = await prisma.attendanceRecord.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Correcting an already-recorded day changes what someone is paid for work
  // already done — a manager's call, not a supervisor's.
  const today = todayAddis();
  if (existing.date < today && gate.role !== "manager") {
    return NextResponse.json(
      {
        error: "Only a manager can change attendance for a past date.",
        detail: `${existing.date} has already been recorded — ask a manager to correct it.`,
      },
      { status: 403 },
    );
  }

  const data: Record<string, unknown> = { ...body };

  // Merge patched session statuses over the stored ones. Fall back to the
  // whole-day status for legacy rows that predate the per-session columns.
  const morning = (data.morningStatus as AttendanceStatus)
    ?? existing.morningStatus
    ?? (data.status as AttendanceStatus)
    ?? existing.status;
  const afternoon = (data.afternoonStatus as AttendanceStatus)
    ?? existing.afternoonStatus
    ?? (data.status as AttendanceStatus)
    ?? existing.status;

  if (!VALID_STATUS.has(morning) || !VALID_STATUS.has(afternoon)) {
    return NextResponse.json({ error: "Invalid attendance status" }, { status: 400 });
  }

  const morningWorked = isWorking(morning);
  const afternoonWorked = isWorking(afternoon);

  // Merge patched times over the stored ones, dropping any session that was not
  // worked, then re-derive status and hoursWorked so they can never drift.
  const pick = (f: (typeof TIME_FIELDS)[number]): string | null =>
    (f in data ? (data[f] as string | null) : existing[f]) || null;

  const merged = {
    checkInTime: morningWorked ? pick("checkInTime") : null,
    morningCheckOutTime: morningWorked ? pick("morningCheckOutTime") : null,
    afternoonCheckInTime: afternoonWorked ? pick("afternoonCheckInTime") : null,
    checkOutTime: afternoonWorked ? pick("checkOutTime") : null,
  };
  for (const f of TIME_FIELDS) data[f] = merged[f];

  data.morningStatus = morning;
  data.afternoonStatus = afternoon;
  data.status = deriveDayStatus(morning, afternoon);

  const hours = calcHoursWorked(merged, { morningWorked, afternoonWorked }) ?? 0;
  data.hoursWorked = hours;

  // overtime follows the configured workday, never the client
  const wd = (await getFarmConfig()).workdayHours || 8;
  data.overtimeHours = Math.max(0, Math.round((hours - wd) * 10) / 10);

  if (existing.date < today) {
    data.editedBy = gate.userId;
    data.editedAt = new Date();
  }

  const record = await prisma.attendanceRecord.update({ where: { id }, data });
  return NextResponse.json(record);
}
