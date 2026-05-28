import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role: string }).role;
  if (role !== "manager") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const farmerId = (session.user as { id: string }).id;

  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (task.status !== "done") return NextResponse.json({ error: "Task is not done" }, { status: 400 });

  const updated = await prisma.task.update({
    where: { id },
    data: { reviewedBy: farmerId, reviewedAt: new Date() },
    include: { assignee: true, creator: true, children: { include: { assignee: true, creator: true } } },
  });
  return NextResponse.json(updated);
}
