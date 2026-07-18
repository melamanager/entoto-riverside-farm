import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json() as Record<string, unknown>;

  const { role, id: userId } = session.user as { role: string; id: string };

  const existing = await prisma.task.findUnique({ where: { id }, select: { createdBy: true, assignedTo: true } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // non-managers may only edit tasks they created or are assigned to
  if (role !== "manager" && existing.createdBy !== userId && existing.assignedTo !== userId) {
    return NextResponse.json({ error: "You can only edit your own tasks" }, { status: 403 });
  }
  if (role !== "manager") {
    delete body.reviewedBy;
    delete body.reviewedAt;
  }
  // authorship is immutable
  delete body.createdBy;

  const task = await prisma.task.update({ where: { id }, data: body });
  return NextResponse.json(task);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { role, id: userId } = session.user as { role: string; id: string };

  const existing = await prisma.task.findUnique({ where: { id }, select: { createdBy: true } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (role !== "manager" && existing.createdBy !== userId) {
    return NextResponse.json({ error: "Only the creator or a manager can delete a task" }, { status: 403 });
  }

  await prisma.task.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
