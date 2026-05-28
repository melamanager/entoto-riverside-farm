import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const farmerId = (session.user as { id: string }).id;
  const { completionNote, proofImageUrl } = await req.json() as { completionNote?: string; proofImageUrl?: string };

  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (task.assignedTo !== farmerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (task.requiresImageProof && !proofImageUrl) return NextResponse.json({ error: "Proof photo required" }, { status: 400 });

  const updated = await prisma.task.update({
    where: { id },
    data: {
      status: "done",
      completedAt: new Date(),
      ...(completionNote ? { completionNote: completionNote.trim() } : {}),
      ...(proofImageUrl ? { proofImageUrl } : {}),
    },
    include: { assignee: true, creator: true, children: { include: { assignee: true, creator: true } } },
  });
  return NextResponse.json(updated);
}
