import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const bedId = searchParams.get("bedId");

  const reports = await prisma.diseaseReport.findMany({
    where: {
      ...(status ? { status: status as "open" | "notified" | "treating" | "resolved" } : {}),
      ...(bedId ? { bedId } : {}),
    },
    include: { bed: true, reporter: true },
    orderBy: { reportedAt: "desc" },
  });

  return NextResponse.json(reports);
}
