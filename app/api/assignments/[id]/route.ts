import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function guardOwn(id: string, session: { user?: unknown }) {
  const { id: userId, role } = session.user as { id: string; role: string };
  if (role === "manager") return null;
  const existing = await prisma.workerAssignment.findUnique({ where: { id }, select: { supervisorId: true } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.supervisorId !== userId) {
    return NextResponse.json({ error: "You can only change your own assignments" }, { status: 403 });
  }
  return null;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const denied = await guardOwn(id, session);
  if (denied) return denied;
  const body = await req.json();
  delete body.supervisorId; // ownership is immutable

  const record = await prisma.workerAssignment.update({ where: { id }, data: body });
  return NextResponse.json(record);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const denied = await guardOwn(id, session);
  if (denied) return denied;
  await prisma.workerAssignment.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
