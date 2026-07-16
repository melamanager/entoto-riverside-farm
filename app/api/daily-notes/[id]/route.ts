import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

function sessionRole(session: { user?: unknown }) {
  return session.user as { id: string; role: string };
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: userId, role } = sessionRole(session);
  if (role !== "manager" && role !== "supervisor") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();

  const note = await prisma.dailyNote.findUnique({ where: { id } });
  if (!note) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // mark-as-read: any manager/supervisor may add themselves to readBy
  if (body.read === true) {
    const readBy = Array.isArray(note.readBy) ? (note.readBy as string[]) : [];
    if (!readBy.includes(userId)) {
      const updated = await prisma.dailyNote.update({ where: { id }, data: { readBy: [...readBy, userId] } });
      return NextResponse.json(updated);
    }
    return NextResponse.json(note);
  }

  // pin/unpin: manager only
  if (typeof body.pinned === "boolean") {
    if (role !== "manager") return NextResponse.json({ error: "Only the manager can pin notes" }, { status: 403 });
    const updated = await prisma.dailyNote.update({ where: { id }, data: { pinned: body.pinned } });
    return NextResponse.json(updated);
  }

  // edit body: author only
  if (typeof body.body === "string") {
    if (note.authorId !== userId) return NextResponse.json({ error: "Only the author can edit" }, { status: 403 });
    const text = body.body.trim();
    if (!text) return NextResponse.json({ error: "Note body is required" }, { status: 400 });
    const updated = await prisma.dailyNote.update({ where: { id }, data: { body: text } });
    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: userId, role } = sessionRole(session);

  const { id } = await params;
  const note = await prisma.dailyNote.findUnique({ where: { id } });
  if (!note) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (note.authorId !== userId && role !== "manager") {
    return NextResponse.json({ error: "Only the author or manager can delete" }, { status: 403 });
  }

  await prisma.dailyNote.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
