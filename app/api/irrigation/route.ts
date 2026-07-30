import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireCapability } from "@/lib/guard";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const valveId = searchParams.get("valveId");

  const records = await prisma.irrigationLog.findMany({
    where: {
      ...(date ? { date } : {}),
      ...(from && to ? { date: { gte: from, lte: to } } : {}),
      ...(valveId ? { valveId } : {}),
    },
    include: { valve: true, recorder: true },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });

  return NextResponse.json(records);
}

export async function POST(req: Request) {
  const gate = await requireCapability("watering");
  if (!gate.ok) return gate.response;
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  if (!body.valveId || !body.date) {
    return NextResponse.json({ error: "valveId and date are required" }, { status: 400 });
  }

  const record = await prisma.irrigationLog.create({
    data: { ...body, recordedBy: body.recordedBy ?? (session.user as { id: string }).id },
  });
  return NextResponse.json(record, { status: 201 });
}
