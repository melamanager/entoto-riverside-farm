import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const valveId = searchParams.get("valveId");

  const beds = await prisma.bed.findMany({
    where: valveId ? { valveId } : undefined,
    orderBy: [{ valveId: "asc" }, { id: "asc" }],
  });

  return NextResponse.json(beds);
}
