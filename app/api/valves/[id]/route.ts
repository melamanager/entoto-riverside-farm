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

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const valve = await prisma.valve.update({ where: { id }, data: body });
  return NextResponse.json(valve);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const bedCount = await prisma.bed.count({ where: { valveId: id } });
  if (bedCount > 0) {
    return NextResponse.json(
      { error: "Cannot delete a valve with active beds." },
      { status: 409 }
    );
  }

  await prisma.valve.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
