import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const assignedTo = searchParams.get("assignedTo");
  const entityType = searchParams.get("entityType");

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
  const record = await prisma.followUp.create({ data: body });
  return NextResponse.json(record, { status: 201 });
}
