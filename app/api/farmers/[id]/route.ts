import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const farmer = await prisma.farmer.findUnique({ where: { id } });
  if (!farmer) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(farmer);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const farmer = await prisma.farmer.update({ where: { id }, data: body });
  return NextResponse.json(farmer);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const farmer = await prisma.farmer.findUnique({
    where: { id },
    select: {
      _count: {
        select: {
          beds: true,
          harvestRecords: true,
          diseaseReports: true,
          treatmentApplied: true,
          tasks: true,
          createdTasks: true,
          attendanceRecords: true,
          recordedAttendance: true,
          expenses: true,
          plantingRecords: true,
          workerAssignments: true,
          supervisedAssignments: true,
          fertigationRecords: true,
          packagingRecords: true,
          payrollRecords: true,
          followUpsAssigned: true,
          followUpsCreated: true,
          stockTransactions: true,
        },
      },
    },
  });

  if (!farmer) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (Object.values(farmer._count).some(count => count > 0)) {
    return NextResponse.json(
      { error: "Cannot delete staff with related farm records." },
      { status: 409 }
    );
  }

  await prisma.user.deleteMany({ where: { farmerId: id } });
  await prisma.farmer.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
