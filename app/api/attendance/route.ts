import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

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
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  if (Array.isArray(body)) {
    const results = [];
    for (const rec of body) {
      const result = await prisma.attendanceRecord.upsert({
        where: { farmerId_date: { farmerId: rec.farmerId, date: rec.date } },
        update: rec,
        create: rec,
      });
      results.push(result);
    }
    return NextResponse.json(results, { status: 201 });
  }

  const record = await prisma.attendanceRecord.create({ data: body });
  return NextResponse.json(record, { status: 201 });
}
