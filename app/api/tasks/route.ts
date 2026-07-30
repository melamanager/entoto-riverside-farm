import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireCapability } from "@/lib/guard";
import { sendTelegramToFarmer } from "@/lib/notifications";
import { getFarmConfig } from "@/lib/config-server";

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
  const gate = await requireCapability("tasks_assign");
  if (!gate.ok) return gate.response;
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  if (!body.title || !String(body.title).trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }
  if (!body.assignedTo) {
    return NextResponse.json({ error: "An assignee is required" }, { status: 400 });
  }
  // validate the FK up front so a bad id is a clean 400, not a 500
  const assignee = await prisma.farmer.findUnique({ where: { id: body.assignedTo } });
  if (!assignee) return NextResponse.json({ error: "Assignee not found" }, { status: 400 });

  const task = await prisma.task.create({
    data: {
      title: String(body.title).trim(),
      description: body.description ?? "",
      assignedTo: body.assignedTo,
      // accountability: the creator is always the signed-in user, never client-supplied
      createdBy: (session.user as { id: string }).id,
      bedId: body.bedId ?? undefined,
      valveId: body.valveId ?? undefined,
      priority: body.priority ?? "medium",
      category: body.category ?? "general",
      status: "pending",
      dueDate: body.dueDate ?? new Date().toISOString().split("T")[0],
      requiresImageProof: body.requiresImageProof ?? undefined,
      requiresFollowUp: body.requiresFollowUp ?? undefined,
      followUpDueDate: body.followUpDueDate ?? undefined,
    },
    include: { assignee: true },
  });

  // notify assignment — best effort
  try {
    await prisma.notification.create({
      data: {
        type: "task",
        channel: "in_app",
        message: `📋 New ${task.priority}-priority task assigned to you: "${task.title}" (due ${task.dueDate})`,
        link: "/tasks",
        recipientId: task.assignedTo, // the assignee (usually a supervisor) sees it
      },
    });
    if ((await getFarmConfig()).notifyTasks) {
      // deliver to the assignee's own Telegram (no-op if they haven't linked)
      const pri = task.priority === "high" ? "🔴 PRIORITY task" : "📋 New task";
      await sendTelegramToFarmer(
        task.assignedTo,
        `${pri} — Entoto Farm\n\n<b>${task.title}</b>\n${task.description ? task.description.slice(0, 200) + "\n" : ""}Due: ${task.dueDate}\n\nOpen the app → Daily Tasks.`
      );
    }
  } catch (e) {
    console.error("task-assignment notification failed", e);
  }

  return NextResponse.json(task, { status: 201 });
}
