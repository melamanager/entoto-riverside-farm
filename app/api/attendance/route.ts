import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getFarmConfig } from "@/lib/config-server";
import { requireCapability } from "@/lib/guard";

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

  // overtime is derived authoritatively from the configured workday, so it's
  // correct regardless of what the client sent (and honours the Settings value)
  const wd = (await getFarmConfig()).workdayHours || 8;
  const withOt = (rec: Record<string, unknown>) =>
    typeof rec.hoursWorked === "number"
      ? { ...rec, overtimeHours: Math.max(0, Math.round((rec.hoursWorked - wd) * 10) / 10) }
      : rec;

  if (Array.isArray(body)) {
    const results = [];
    for (const raw of body) {
      const rec = withOt(raw);
      const result = await prisma.attendanceRecord.upsert({
        where: { farmerId_date: { farmerId: rec.farmerId as string, date: rec.date as string } },
        update: rec as never,
        create: rec as never,
      });
      results.push(result);
    }
    return NextResponse.json(results, { status: 201 });
  }

  const record = await prisma.attendanceRecord.create({ data: withOt(body) as never });
  return NextResponse.json(record, { status: 201 });
}
