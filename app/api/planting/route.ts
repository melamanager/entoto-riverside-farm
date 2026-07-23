import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { liveAgeDays } from "@/lib/planting";
import { syncBedFromPlanting } from "@/lib/planting-sync";
import { todayAddis } from "@/lib/dates";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const bedId = searchParams.get("bedId");
  const valveId = searchParams.get("valveId");

  const records = await prisma.plantingRecord.findMany({
    where: {
      ...(bedId ? { bedId } : {}),
      ...(valveId ? { valveId } : {}),
    },
    include: { bed: true, valve: true, creator: true },
    orderBy: { plannedDate: "desc" },
  });

  return NextResponse.json(records);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  // defensive validity guard (the client validates too, but this route is directly callable)
  if (!body.bedId) return NextResponse.json({ error: "Bed is required" }, { status: 400 });
  if (!body.expectedHarvestDate) return NextResponse.json({ error: "Expected harvest date is required" }, { status: 400 });
  const plantDate = body.actualDate || body.plannedDate;
  if (plantDate && body.expectedHarvestDate <= plantDate)
    return NextResponse.json({ error: "Expected harvest date must be after the planting date" }, { status: 400 });

  const record = await prisma.plantingRecord.create({
    data: {
      ...body,
      createdBy: (session.user as { id: string }).id, // accountability: the real user, not a client value
      ageInDays: liveAgeDays(body, todayAddis()),       // age is derived, never trusted from the client
    },
  });
  await syncBedFromPlanting(record.id); // close the Bed loop
  return NextResponse.json(record, { status: 201 });
}
