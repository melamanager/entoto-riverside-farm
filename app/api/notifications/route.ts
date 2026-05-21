import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const unreadOnly = searchParams.get("read") === "false";

  const notifications = await prisma.notification.findMany({
    where: unreadOnly ? { read: false } : undefined,
    orderBy: { timestamp: "desc" },
    take: 50,
  });

  return NextResponse.json(notifications);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const notification = await prisma.notification.create({ data: body });
  return NextResponse.json(notification, { status: 201 });
}
