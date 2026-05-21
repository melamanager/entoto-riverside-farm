import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  const farmerId = searchParams.get("farmerId");

  const records = await prisma.payrollRecord.findMany({
    where: {
      ...(month ? { month } : {}),
      ...(farmerId ? { farmerId } : {}),
    },
    include: { farmer: true },
    orderBy: [{ month: "desc" }, { farmerId: "asc" }],
  });

  return NextResponse.json(records);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const record = await prisma.payrollRecord.create({ data: body });
  return NextResponse.json(record, { status: 201 });
}
