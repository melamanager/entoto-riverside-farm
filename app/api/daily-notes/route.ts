import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { todayAddis } from "@/lib/dates";

const NOTE_TYPES = ["instruction", "report", "issue", "note"] as const;

function sessionRole(session: { user?: unknown }) {
  return session.user as { id: string; role: string };
}

// Day Log: manager <-> supervisor daily communication thread
export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { role } = sessionRole(session);
  if (role !== "manager" && role !== "supervisor") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") ?? todayAddis();

  const notes = await prisma.dailyNote.findMany({
    where: { date },
    include: { author: { select: { id: true, name: true, avatar: true, role: true } }, valve: { select: { name: true } } },
    orderBy: [{ pinned: "desc" }, { createdAt: "asc" }],
  });

  return NextResponse.json(notes);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: userId, role } = sessionRole(session);
  if (role !== "manager" && role !== "supervisor") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const text: string = (body.body ?? "").trim();
  if (!text) return NextResponse.json({ error: "Note body is required" }, { status: 400 });
  if (text.length > 2000) return NextResponse.json({ error: "Note too long (max 2000 chars)" }, { status: 400 });
  const type = NOTE_TYPES.includes(body.type) ? body.type : "note";
  const date: string = body.date ?? todayAddis();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  const note = await prisma.dailyNote.create({
    data: {
      date,
      authorId: userId,
      type,
      body: text,
      valveId: body.valveId || undefined,
      readBy: [userId],
    },
    include: { author: { select: { id: true, name: true, avatar: true, role: true } }, valve: { select: { name: true } } },
  });

  // notify the other side in-app (best effort — a failed notification must not lose the note)
  try {
    const icon = type === "issue" ? "⚠️" : type === "instruction" ? "📋" : "📝";
    // notify the other side of the conversation
    const otherRole = note.author.role === "manager" ? "supervisor" : "manager";
    await prisma.notification.create({
      data: {
        type: "message",
        channel: "in_app",
        message: `${icon} ${note.author.name} (${note.author.role}) posted a ${type} in the Day Log for ${date}`,
        link: "/routines",
        recipientRole: otherRole,
      },
    });
  } catch (e) {
    console.error("daily-note notification failed", e);
  }

  return NextResponse.json(note, { status: 201 });
}
