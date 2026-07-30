import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const role = searchParams.get("role");

  // Attendance rate and performance are DERIVED from real records, never from
  // the stored columns (which were demo values that never updated). Both are
  // null when the person has no records yet, so the UI can say "no data" rather
  // than invent a score.
  const [rows, attTotal, attPresent, taskTotal, taskDone] = await Promise.all([
    prisma.farmer.findMany({
      where: role ? { role: role as "farmer" | "supervisor" | "manager" } : undefined,
      orderBy: { name: "asc" },
      include: { user: { select: { id: true } } }, // to flag who can log in
    }),
    prisma.attendanceRecord.groupBy({ by: ["farmerId"], _count: { _all: true } }),
    prisma.attendanceRecord.groupBy({ by: ["farmerId"], where: { status: { in: ["present", "late"] } }, _count: { _all: true } }),
    prisma.task.groupBy({ by: ["assignedTo"], _count: { _all: true } }),
    prisma.task.groupBy({ by: ["assignedTo"], where: { status: "done" }, _count: { _all: true } }),
  ]);

  const n = (g: { _count: { _all: number } }[], key: string, field: "farmerId" | "assignedTo") =>
    (g as unknown as Array<Record<string, unknown> & { _count: { _all: number } }>)
      .find((x) => x[field] === key)?._count._all ?? 0;
  const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : null);

  const farmers = rows.map(({ user, ...f }) => {
    const attDays = n(attTotal, f.id, "farmerId");
    const taskCount = n(taskTotal, f.id, "assignedTo");
    return {
      ...f,
      hasLogin: !!user,
      // computed — override the legacy stored columns
      attendanceRate: pct(n(attPresent, f.id, "farmerId"), attDays),
      performanceScore: pct(n(taskDone, f.id, "assignedTo"), taskCount),
      attendanceDays: attDays,
      tasksAssigned: taskCount,
    };
  });

  return NextResponse.json(farmers, {
    headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=120" },
  });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // registering staff (and granting them permissions) is a manager's job
  if ((session.user as { role: string }).role !== "manager") {
    return NextResponse.json({ error: "Only a manager can register staff" }, { status: 403 });
  }

  const body = await req.json();
  // sequential id (f-009, f-010…) so the login username stays human-friendly
  let id: string = body.id;
  if (!id) {
    const existing = await prisma.farmer.findMany({ select: { id: true } });
    const nums = existing.map((f) => /^f-(\d+)$/.exec(f.id)).filter(Boolean).map((m) => parseInt(m![1], 10));
    id = `f-${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(3, "0")}`;
  }
  const farmer = await prisma.farmer.create({ data: { ...body, id } });
  return NextResponse.json(farmer, { status: 201 });
}
