import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const bedId = searchParams.get("bedId");
  const date = searchParams.get("date");
  const farmerId = searchParams.get("farmerId");

  const records = await prisma.harvestRecord.findMany({
    where: {
      ...(bedId ? { bedId } : {}),
      ...(date ? { date } : {}),
      ...(farmerId ? { farmerId } : {}),
    },
    include: { bed: true, farmer: true },
    orderBy: { date: "desc" },
  });

  return NextResponse.json(records);
}

export async function POST(req: Request) {
  const body = await req.json();
  if (!body.bedId || !body.kg || !body.farmerId) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const record = await prisma.harvestRecord.create({
    data: {
      bedId: body.bedId,
      kg: new Prisma.Decimal(body.kg),
      farmerId: body.farmerId,
      qualityGrade: body.qualityGrade ?? "A",
      date: body.date ?? new Date().toISOString().split("T")[0],
    },
  });

  return NextResponse.json({ id: record.id, ok: true });
}
