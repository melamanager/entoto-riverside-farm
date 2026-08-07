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

  // only managers may change role, granted permissions, wage, or valve assignments
  const role = (session.user as { role: string }).role;
  if (role !== "manager") {
    delete body.role;
    delete body.permissions; // privilege escalation guard
    delete body.dailyWage;
    delete body.payFrequency; // pay-affecting: weekly→daily would multiply basePay
    delete body.performanceScore;
    delete body.attendanceRate;
    delete body.assignedValves;
    delete body.archivedAt; // taking someone off the roster is a manager action
  }
  // accept an ISO string or null from the client, store a real timestamp
  if ("archivedAt" in body) {
    body.archivedAt = body.archivedAt ? new Date(body.archivedAt as string) : null;
  }
  // these two are DERIVED from real records by /api/farmers — never stored
  delete body.performanceScore;
  delete body.attendanceRate;
  delete body.hasLogin;
  delete body.attendanceDays;
  delete body.tasksAssigned;

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

  // Someone who has worked has records that must survive them — attendance and
  // payroll for days they were actually paid. Say what is holding the delete
  // and point at archiving, which is what the farm actually wants here.
  const LABELS: Record<string, string> = {
    beds: "bed", harvestRecords: "harvest record", diseaseReports: "disease report",
    treatmentApplied: "treatment", tasks: "task", createdTasks: "created task",
    attendanceRecords: "attendance record", recordedAttendance: "recorded attendance",
    expenses: "expense", plantingRecords: "planting record",
    workerAssignments: "work assignment", supervisedAssignments: "supervised assignment",
    fertigationRecords: "fertigation record", packagingRecords: "packaging record",
    payrollRecords: "payroll record", followUpsAssigned: "follow-up",
    followUpsCreated: "created follow-up", stockTransactions: "stock transaction",
  };
  const blocking = Object.entries(farmer._count)
    .filter(([, count]) => count > 0)
    .map(([key, count]) => `${count} ${LABELS[key] ?? key}${count === 1 ? "" : "s"}`);

  if (blocking.length > 0) {
    return NextResponse.json(
      {
        error: "This person has farm records that must be kept.",
        detail: `Still attached to ${blocking.join(", ")}. Archive them instead — they come off the roster and the register, and every record is kept.`,
        blocking,
        canArchive: true,
      },
      { status: 409 }
    );
  }

  await prisma.user.deleteMany({ where: { farmerId: id } });
  await prisma.farmer.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
