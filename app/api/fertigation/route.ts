import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const valveId = searchParams.get("valveId");
  const status = searchParams.get("status");

  const records = await prisma.fertigationRecord.findMany({
    where: {
      ...(valveId ? { valveId } : {}),
      ...(status ? { status: status as "scheduled" | "applied" | "skipped" } : {}),
    },
    include: { valve: true, bed: true, worker: true },
    orderBy: { applicationDate: "desc" },
  });

  return NextResponse.json(records);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const record = await prisma.fertigationRecord.create({ data: body });
  return NextResponse.json(record, { status: 201 });
}
