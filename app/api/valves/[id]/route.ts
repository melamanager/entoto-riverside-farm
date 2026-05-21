import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const valve = await prisma.valve.findUnique({
    where: { id },
    include: {
      beds: {
        include: {
          harvestRecords: { orderBy: { date: "desc" }, take: 30 },
          diseaseReports: { orderBy: { reportedAt: "desc" }, take: 5 },
        },
      },
    },
  });
  if (!valve) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(valve);
}
