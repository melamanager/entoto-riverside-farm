import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { todayAddis } from "@/lib/dates";
import { sendTelegramToFarmer } from "@/lib/notifications";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const assignedTo = searchParams.get("assignedTo");
  const entityType = searchParams.get("entityType");

  // lazy overdue sweep: pending follow-ups past their due date become overdue
  const today = todayAddis();
  await prisma.followUp.updateMany({
    where: { status: "pending", dueDate: { lt: today } },
    data: { status: "overdue" },
  });

  const records = await prisma.followUp.findMany({
    where: {
      ...(status ? { status: status as "pending" | "done" | "overdue" } : {}),
      ...(assignedTo ? { assignedTo } : {}),
      ...(entityType ? { entityType: entityType as "disease" | "planting" | "fertigation" | "task" | "general" } : {}),
    },
    include: { assignee: true, creator: true, bed: true, valve: true },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }],
  });

  return NextResponse.json(records);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  // accountability: creator is always the signed-in user, never client-supplied
  body.createdBy = (session.user as { id: string }).id;
  const record = await prisma.followUp.create({ data: body });

  // notify the assignee (in-app + their Telegram)
  try {
    if (record.assignedTo && record.assignedTo !== body.createdBy) {
      await prisma.notification.create({
        data: {
          type: "task",
          channel: "in_app",
          message: `🔔 Follow-up for you: "${record.title}" (due ${record.dueDate})`,
          link: "/tasks?tab=followups",
          recipientId: record.assignedTo,
        },
      });
      await sendTelegramToFarmer(
        record.assignedTo,
        `🔔 <b>Follow-up assigned — Entoto Farm</b>\n\n<b>${record.title}</b>\nDue: ${record.dueDate}\n\nOpen the app → Tasks → Follow-ups.`
      );
    }
  } catch (e) {
    console.error("follow-up assignment notification failed", e);
  }

  return NextResponse.json(record, { status: 201 });
}
