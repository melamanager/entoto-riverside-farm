import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const bed = await prisma.bed.findUnique({
    where: { id },
    include: {
      valve: true,
      farmer: true,
      harvestRecords: { orderBy: { date: "desc" } },
      diseaseReports: { orderBy: { reportedAt: "desc" } },
      plantingRecords: { orderBy: { createdAt: "desc" } },
      fertigationRecords: { orderBy: { applicationDate: "desc" } },
    },
  });
  if (!bed) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(bed);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const bed = await prisma.bed.update({ where: { id }, data: body });
  return NextResponse.json(bed);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const related = await prisma.bed.findUnique({
    where: { id },
    select: {
      _count: {
        select: {
          harvestRecords: true,
          diseaseReports: true,
          tasks: true,
          attendanceRecords: true,
          plantingRecords: true,
          fertigationRecords: true,
          workerAssignments: true,
          followUps: true,
        },
      },
    },
  });

  if (!related) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (Object.values(related._count).some(count => count > 0)) {
    return NextResponse.json(
      { error: "Cannot delete a bed with related records." },
      { status: 409 }
    );
  }

  await prisma.bed.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
