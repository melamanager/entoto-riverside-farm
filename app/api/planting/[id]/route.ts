import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { liveAgeDays } from "@/lib/planting";
import { syncBedFromPlanting } from "@/lib/planting-sync";
import { todayAddis } from "@/lib/dates";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  // PATCH bodies may be partial, so merge onto the current row before deriving
  // the age column (keeps it honest without trusting a client-sent number).
  const current = await prisma.plantingRecord.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const merged = { ...current, ...body };

  const record = await prisma.plantingRecord.update({
    where: { id },
    data: { ...body, ageInDays: liveAgeDays(merged, todayAddis()) },
  });
  await syncBedFromPlanting(record.id); // planting status → Bed stage/variety/date
  return NextResponse.json(record);
}
