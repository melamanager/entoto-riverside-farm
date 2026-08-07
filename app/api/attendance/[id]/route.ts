import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { calcHoursWorked } from "@/lib/attendance";

const NON_WORKING = new Set(["absent", "leave"]);

const TIME_FIELDS = [
  "checkInTime",
  "morningCheckOutTime",
  "afternoonCheckInTime",
  "checkOutTime",
] as const;

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const existing = await prisma.attendanceRecord.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: Record<string, unknown> = { ...body };

  // Merge patched times over the stored ones, then re-derive hoursWorked so it
  // can never drift out of sync with the recorded times.
  const status = (data.status as string) ?? existing.status;
  if (NON_WORKING.has(status)) {
    for (const f of TIME_FIELDS) data[f] = null;
    data.hoursWorked = 0;
  } else {
    const pick = (f: (typeof TIME_FIELDS)[number]): string | null =>
      (f in data ? (data[f] as string | null) : existing[f]) || null;

    const merged = {
      checkInTime: pick("checkInTime"),
      morningCheckOutTime: pick("morningCheckOutTime"),
      afternoonCheckInTime: pick("afternoonCheckInTime"),
      checkOutTime: pick("checkOutTime"),
    };
    for (const f of TIME_FIELDS) if (f in data) data[f] = merged[f];
    data.hoursWorked = calcHoursWorked(merged);
  }

  const record = await prisma.attendanceRecord.update({ where: { id }, data });
  return NextResponse.json(record);
}
