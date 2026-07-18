import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const before = await prisma.followUp.findUnique({ where: { id }, select: { status: true } });
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const record = await prisma.followUp.update({
    where: { id },
    data: body,
    include: { assignee: { select: { name: true } } },
  });

  // completing a follow-up notifies the team (creator sees who closed it) — best effort
  try {
    if (body.status === "done" && before.status !== "done") {
      await prisma.notification.create({
        data: {
          type: "task",
          channel: "in_app",
          message: `✔️ Follow-up "${record.title}" completed by ${record.assignee.name}${record.completionNote ? ` — ${String(record.completionNote).slice(0, 80)}` : ""}`,
          link: "/tasks?tab=followups",
          recipientRole: "manager",
        },
      });
    }
  } catch (e) {
    console.error("follow-up completion notification failed", e);
  }

  return NextResponse.json(record);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await prisma.followUp.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
