import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

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
  const record = await prisma.plantingRecord.create({ data: body });
  return NextResponse.json(record, { status: 201 });
}
