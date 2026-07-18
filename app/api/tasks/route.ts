import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sendTelegram } from "@/lib/notifications";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const assignedTo = searchParams.get("assignedTo");
  const status = searchParams.get("status");

  const tasks = await prisma.task.findMany({
    where: {
      ...(assignedTo ? { assignedTo } : {}),
      ...(status ? { status: status as "pending" | "in_progress" | "done" } : {}),
    },
    include: {
      assignee: true,
      creator: true,
      bed: true,
      children: { include: { assignee: true, creator: true }, orderBy: { createdAt: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(tasks);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  // accountability: the creator is always the signed-in user, never client-supplied
  body.createdBy = (session.user as { id: string }).id;
  const task = await prisma.task.create({ data: body, include: { assignee: true } });

  // notify assignment — best effort
  try {
    await prisma.notification.create({
      data: {
        type: "task",
        channel: "in_app",
        message: `📋 New ${task.priority}-priority task "${task.title}" assigned to ${task.assignee.name} (due ${task.dueDate})`,
        link: "/tasks",
      },
    });
    if (task.priority === "high") {
      await sendTelegram(
        `📋 <b>High-priority task — Entoto Farm</b>\n\n<b>${task.title}</b>\nAssigned to: ${task.assignee.name}\nDue: ${task.dueDate}`
      );
    }
  } catch (e) {
    console.error("task-assignment notification failed", e);
  }

  return NextResponse.json(task, { status: 201 });
}
