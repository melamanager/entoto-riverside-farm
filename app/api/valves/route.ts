import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const valves = await prisma.valve.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(valves);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const valve = await prisma.valve.create({ data: body });
  return NextResponse.json(valve, { status: 201 });
}
