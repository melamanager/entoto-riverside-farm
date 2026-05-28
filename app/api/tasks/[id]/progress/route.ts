import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const farmerId = (session.user as { id: string }).id;
  const { note } = await req.json() as { note: string };
  if (!note?.trim()) return NextResponse.json({ error: "Note required" }, { status: 400 });

  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (task.assignedTo !== farmerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const existing = Array.isArray(task.progressNotes) ? task.progressNotes as object[] : [];
  const newNote = { by: farmerId, note: note.trim(), at: new Date().toISOString() };
  const updated = await prisma.task.update({
    where: { id },
    data: { progressNotes: [...existing, newNote] },
    include: { assignee: true, creator: true, children: { include: { assignee: true, creator: true } } },
  });
  return NextResponse.json(updated);
}
