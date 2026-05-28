import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role: string }).role;
  if (role !== "manager") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const farmerId = (session.user as { id: string }).id;
  const body = await req.json() as {
    title: string;
    description: string;
    assignedTo: string;
    dueDate: string;
    priority: string;
    category: string;
  };

  const parent = await prisma.task.findUnique({ where: { id } });
  if (!parent) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Ensure assignee is a supervisor or manager
  const assignee = await prisma.farmer.findUnique({ where: { id: body.assignedTo } });
  if (!assignee || assignee.role === "farmer") {
    return NextResponse.json({ error: "Follow-up tasks must be assigned to a supervisor or manager" }, { status: 400 });
  }

  const followUp = await prisma.task.create({
    data: {
      title: body.title,
      description: body.description,
      assignedTo: body.assignedTo,
      createdBy: farmerId,
      dueDate: body.dueDate,
      priority: body.priority as "low" | "medium" | "high",
      category: body.category as "disease" | "harvest" | "irrigation" | "inspection" | "general",
      status: "pending",
      parentTaskId: id,
    },
    include: { assignee: true, creator: true },
  });
  return NextResponse.json(followUp, { status: 201 });
}
