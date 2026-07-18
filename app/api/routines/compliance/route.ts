import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { complianceForRange } from "@/lib/compliance";
import { todayAddis } from "@/lib/dates";

function shiftDate(ds: string, days: number) {
  const d = new Date(`${ds}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split("T")[0];
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { role } = session.user as { role: string };
  if (role !== "manager" && role !== "supervisor") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const to = searchParams.get("to") ?? todayAddis();
  const from = searchParams.get("from") ?? shiftDate(to, -6);

  const rows = await complianceForRange(from, to);
  return NextResponse.json({ from, to, today: todayAddis(), rows });
}

// Manager acknowledges a supervisor's record-less day as worked
export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: userId, role } = session.user as { id: string; role: string };
  if (role !== "manager") {
    return NextResponse.json({ error: "Only the manager can acknowledge a day" }, { status: 403 });
  }

  const body = await req.json();
  const { date, supervisorId } = body as { date?: string; supervisorId?: string };
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !supervisorId) {
    return NextResponse.json({ error: "date (YYYY-MM-DD) and supervisorId are required" }, { status: 400 });
  }
  if (date > todayAddis()) {
    return NextResponse.json({ error: "Cannot acknowledge a future date" }, { status: 400 });
  }
  const supervisor = await prisma.farmer.findUnique({ where: { id: supervisorId } });
  if (!supervisor || supervisor.role !== "supervisor") {
    return NextResponse.json({ error: "Not a supervisor" }, { status: 400 });
  }

  const note = typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, 300) : null;
  const ack = await prisma.routineAck.upsert({
    where: { date_supervisorId: { date, supervisorId } },
    update: { ackBy: userId, note },
    create: { date, supervisorId, ackBy: userId, note },
  });

  try {
    await prisma.notification.create({
      data: {
        type: "message",
        channel: "in_app",
        message: `✔️ Manager acknowledged your ${date} — it now counts as a worked day${note ? ` (${note})` : ""}`,
        link: "/routines",
        recipientId: supervisorId,
      },
    });
  } catch (e) {
    console.error("routine-ack notification failed", e);
  }

  return NextResponse.json(ack, { status: 201 });
}

// Manager can withdraw an acknowledgment
export async function DELETE(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { role } = session.user as { role: string };
  if (role !== "manager") return NextResponse.json({ error: "Manager access required" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  const supervisorId = searchParams.get("supervisorId");
  if (!date || !supervisorId) return NextResponse.json({ error: "date and supervisorId required" }, { status: 400 });

  await prisma.routineAck.deleteMany({ where: { date, supervisorId } });
  return NextResponse.json({ ok: true });
}
