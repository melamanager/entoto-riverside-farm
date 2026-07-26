import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

// Give a staff member a login (or reset / revoke it). Manager-only. The login
// username is the staff member's id (e.g. f-009); auth compares the bcrypt hash.
function isManager(session: unknown) {
  return (session as { user?: { role?: string } })?.user?.role === "manager";
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isManager(session)) return NextResponse.json({ error: "Only a manager can create logins" }, { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const password = String(body.password ?? "");
  if (password.length < 6) return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });

  const farmer = await prisma.farmer.findUnique({ where: { id } });
  if (!farmer) return NextResponse.json({ error: "Staff member not found" }, { status: 404 });

  const existing = await prisma.user.findUnique({ where: { farmerId: id } });
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.upsert({
    where: { farmerId: id },
    update: { passwordHash },
    create: { farmerId: id, email: `${id}@entoto.farm`, passwordHash },
  });
  return NextResponse.json({ ok: true, username: id, created: !existing });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isManager(session)) return NextResponse.json({ error: "Only a manager can revoke logins" }, { status: 403 });

  const { id } = await params;
  await prisma.user.deleteMany({ where: { farmerId: id } });
  return NextResponse.json({ ok: true });
}
