import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getFarmConfig } from "@/lib/config-server";
import { requireCapability } from "@/lib/guard";
import { calcHoursWorked, deriveDayStatus, isWorking } from "@/lib/attendance";
import type { AttendanceStatus } from "@/lib/types";

const VALID_STATUS = new Set<AttendanceStatus>(["present", "absent", "late", "leave"]);

type AttendanceInput = {
  farmerId: string;
  date: string;
  /** Optional — derived from the two sessions when omitted */
  status?: AttendanceStatus;
  morningStatus?: AttendanceStatus;
  afternoonStatus?: AttendanceStatus;
  checkInTime?: string | null;
  morningCheckOutTime?: string | null;
  afternoonCheckInTime?: string | null;
  checkOutTime?: string | null;
  recordedBy: string;
  note?: string | null;
  bedId?: string | null;
};

/** Each record must carry a usable status for both sessions. */
function sessionsOf(raw: AttendanceInput): { morning: AttendanceStatus; afternoon: AttendanceStatus } | null {
  // Fall back to the whole-day status when a client only sends that (older
  // clients, Telegram bot, bulk imports).
  const morning = raw.morningStatus ?? raw.status;
  const afternoon = raw.afternoonStatus ?? raw.status;
  if (!morning || !afternoon) return null;
  if (!VALID_STATUS.has(morning) || !VALID_STATUS.has(afternoon)) return null;
  return { morning, afternoon };
}

/**
 * Whitelist incoming fields and derive status + hoursWorked server-side from
 * the two sessions, so a client cannot write an arbitrary column or an hours
 * total that disagrees with the recorded times and session statuses.
 */
function normalize(raw: AttendanceInput, morning: AttendanceStatus, afternoon: AttendanceStatus) {
  const morningWorked = isWorking(morning);
  const afternoonWorked = isWorking(afternoon);

  // Only keep the times for sessions that were actually worked.
  const times = {
    checkInTime: morningWorked ? raw.checkInTime || null : null,
    morningCheckOutTime: morningWorked ? raw.morningCheckOutTime || null : null,
    afternoonCheckInTime: afternoonWorked ? raw.afternoonCheckInTime || null : null,
    checkOutTime: afternoonWorked ? raw.checkOutTime || null : null,
  };

  return {
    farmerId: raw.farmerId,
    date: raw.date,
    status: deriveDayStatus(morning, afternoon),
    morningStatus: morning,
    afternoonStatus: afternoon,
    ...times,
    hoursWorked: calcHoursWorked(times, { morningWorked, afternoonWorked }) ?? 0,
    recordedBy: raw.recordedBy,
    ...(raw.note !== undefined ? { note: raw.note || null } : {}),
    ...(raw.bedId !== undefined ? { bedId: raw.bedId || null } : {}),
  };
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  const farmerId = searchParams.get("farmerId");
  // Inclusive YYYY-MM-DD range, for the report views. Dates sort lexically in
  // this format, so a string comparison is a correct date comparison.
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const records = await prisma.attendanceRecord.findMany({
    where: {
      ...(date ? { date } : {}),
      ...(!date && (from || to)
        ? { date: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
        : {}),
      ...(farmerId ? { farmerId } : {}),
    },
    include: { farmer: true },
    orderBy: [{ date: "desc" }, { farmerId: "asc" }],
  });

  return NextResponse.json(records);
}

export async function POST(req: Request) {
  // manager/supervisor by role, or anyone a manager granted "attendance"
  const gate = await requireCapability("attendance");
  if (!gate.ok) return gate.response;

  const body = await req.json();

  // Reject unusable statuses up front rather than letting Prisma fail mid-batch.
  const incoming: AttendanceInput[] = Array.isArray(body) ? body : [body];
  for (const r of incoming) {
    if (!sessionsOf(r)) {
      return NextResponse.json(
        { error: `Invalid or missing attendance status for ${r.farmerId ?? "record"}` },
        { status: 400 },
      );
    }
  }

  // overtime is derived authoritatively from the configured workday, so it's
  // correct regardless of what the client sent (and honours the Settings value)
  const wd = (await getFarmConfig()).workdayHours || 8;
  const withOt = <T extends { hoursWorked: number | null }>(rec: T) => ({
    ...rec,
    overtimeHours:
      typeof rec.hoursWorked === "number"
        ? Math.max(0, Math.round((rec.hoursWorked - wd) * 10) / 10)
        : 0,
  });

  if (Array.isArray(body)) {
    const results = [];
    for (const raw of body as AttendanceInput[]) {
      const s = sessionsOf(raw)!;
      const rec = withOt(normalize(raw, s.morning, s.afternoon));
      const result = await prisma.attendanceRecord.upsert({
        where: { farmerId_date: { farmerId: rec.farmerId, date: rec.date } },
        update: rec as never,
        create: rec as never,
      });
      results.push(result);
    }
    return NextResponse.json(results, { status: 201 });
  }

  const single = body as AttendanceInput;
  const s = sessionsOf(single)!;
  const record = await prisma.attendanceRecord.create({
    data: withOt(normalize(single, s.morning, s.afternoon)) as never,
  });
  return NextResponse.json(record, { status: 201 });
}
