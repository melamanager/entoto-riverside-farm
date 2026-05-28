import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

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
  const task = await prisma.task.create({ data: body });
  return NextResponse.json(task, { status: 201 });
}
