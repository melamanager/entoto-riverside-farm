import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getFarmConfig } from "@/lib/config-server";
import { requireCapability } from "@/lib/guard";
import { calcHoursWorked } from "@/lib/attendance";
import type { AttendanceStatus } from "@/lib/types";

const VALID_STATUS = new Set<AttendanceStatus>(["present", "absent", "late", "leave"]);
/** Statuses where the person did not work, so all times are cleared. */
const NON_WORKING = new Set<AttendanceStatus>(["absent", "leave"]);

type AttendanceInput = {
  farmerId: string;
  date: string;
  status: AttendanceStatus;
  checkInTime?: string | null;
  morningCheckOutTime?: string | null;
  afternoonCheckInTime?: string | null;
  checkOutTime?: string | null;
  recordedBy: string;
  note?: string | null;
  bedId?: string | null;
};

/**
 * Whitelist incoming fields and derive hoursWorked server-side from the two
 * sessions of the day, so a client cannot write an arbitrary column or an
 * hours total that disagrees with the recorded times.
 */
function normalize(raw: AttendanceInput) {
  const nonWorking = NON_WORKING.has(raw.status);

  const times = nonWorking
    ? {
        checkInTime: null,
        morningCheckOutTime: null,
        afternoonCheckInTime: null,
        checkOutTime: null,
      }
    : {
        checkInTime: raw.checkInTime || null,
        morningCheckOutTime: raw.morningCheckOutTime || null,
        afternoonCheckInTime: raw.afternoonCheckInTime || null,
        checkOutTime: raw.checkOutTime || null,
      };

  return {
    farmerId: raw.farmerId,
    date: raw.date,
    status: raw.status,
    ...times,
    hoursWorked: nonWorking ? 0 : calcHoursWorked(times),
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

  const records = await prisma.attendanceRecord.findMany({
    where: {
      ...(date ? { date } : {}),
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

  // Reject unknown statuses up front rather than letting Prisma fail mid-batch.
  const incoming: AttendanceInput[] = Array.isArray(body) ? body : [body];
  const bad = incoming.find(r => !VALID_STATUS.has(r.status));
  if (bad) {
    return NextResponse.json({ error: `Invalid status: ${String(bad.status)}` }, { status: 400 });
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
      const rec = withOt(normalize(raw));
      const result = await prisma.attendanceRecord.upsert({
        where: { farmerId_date: { farmerId: rec.farmerId, date: rec.date } },
        update: rec as never,
        create: rec as never,
      });
      results.push(result);
    }
    return NextResponse.json(results, { status: 201 });
  }

  const record = await prisma.attendanceRecord.create({
    data: withOt(normalize(body as AttendanceInput)) as never,
  });
  return NextResponse.json(record, { status: 201 });
}
