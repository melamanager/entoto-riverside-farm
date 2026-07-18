import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function markAllRead() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: userId, role } = session.user as { id: string; role: string };

  // only mark the caller's own visible notifications — never someone else's
  await prisma.notification.updateMany({
    where: {
      read: false,
      OR: [
        { recipientId: null, recipientRole: null },
        { recipientId: userId },
        { recipientRole: role },
      ],
    },
    data: { read: true },
  });
  return NextResponse.json({ success: true });
}

export const POST = markAllRead;
export const PATCH = markAllRead;
