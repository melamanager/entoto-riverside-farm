import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { todayAddis } from "@/lib/dates";

// Declare (or undo) a "nothing to report today" for a routine area.
// POST   { date?, area, note? } → upsert, declaredBy = the signed-in user
// DELETE { date?, area }        → remove the declaration

const AREAS = new Set(["fertigation", "harvest", "sales", "maintenance", "store"]);

function guard(session: unknown) {
  const role = (session as { user?: { role?: string } })?.user?.role;
  return role === "manager" || role === "supervisor";
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!guard(session)) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const area = String(body.area ?? "");
  if (!AREAS.has(area)) return NextResponse.json({ error: "Unknown area" }, { status: 400 });
  const date = /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : todayAddis();
  const declaredBy = (session.user as { id: string }).id;
  const note = typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, 200) : null;

  const rec = await prisma.routineNilReport.upsert({
    where: { date_area: { date, area } },
    update: { declaredBy, note },
    create: { date, area, declaredBy, note },
  });
  return NextResponse.json(rec, { status: 201 });
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!guard(session)) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const area = String(body.area ?? "");
  if (!AREAS.has(area)) return NextResponse.json({ error: "Unknown area" }, { status: 400 });
  const date = /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : todayAddis();

  await prisma.routineNilReport.deleteMany({ where: { date, area } });
  return NextResponse.json({ ok: true });
}
