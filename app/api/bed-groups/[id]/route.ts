import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { todayAddis } from "@/lib/dates";

async function requireManager() {
  const session = await auth();
  if (!session) return { ok: false as const, res: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if ((session.user as { role: string }).role !== "manager") {
    return { ok: false as const, res: NextResponse.json({ error: "Only a manager can change bed groups." }, { status: 403 }) };
  }
  return { ok: true as const, userId: (session.user as { id: string }).id };
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const group = await prisma.bedGroup.findUnique({
    where: { id },
    include: {
      valve: { select: { id: true, name: true, color: true } },
      beds: { orderBy: { id: "asc" } },
      // full ownership history, newest first
      assignments: {
        include: { farmer: { select: { id: true, name: true } } },
        orderBy: { fromDate: "desc" },
      },
    },
  });
  if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(group);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireManager();
  if (!gate.ok) return gate.res;

  const { id } = await params;
  const body = await req.json();

  const group = await prisma.bedGroup.findUnique({ where: { id }, select: { id: true, valveId: true } });
  if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (typeof body.name === "string") data.name = body.name.trim();
  if ("nameAm" in body) data.nameAm = body.nameAm?.trim() || null;
  if ("note" in body) data.note = body.note?.trim() || null;
  if (typeof body.active === "boolean") data.active = body.active;

  if (typeof body.code === "string" && body.code.trim()) {
    const clash = await prisma.bedGroup.findUnique({ where: { code: body.code.trim() } });
    if (clash && clash.id !== id) {
      return NextResponse.json({ error: `Stake code "${body.code.trim()}" is already used.` }, { status: 409 });
    }
    data.code = body.code.trim();
  }

  // Replacing the bed membership wholesale — validated the same way as create.
  if (Array.isArray(body.bedIds)) {
    const bedIds: string[] = body.bedIds;
    if (bedIds.length > 0) {
      const beds = await prisma.bed.findMany({
        where: { id: { in: bedIds } },
        select: { id: true, valveId: true, groupId: true },
      });
      if (beds.length !== bedIds.length) {
        return NextResponse.json({ error: "Unknown bed in selection" }, { status: 400 });
      }
      const wrongValve = beds.find(b => b.valveId !== group.valveId);
      if (wrongValve) {
        return NextResponse.json({ error: `${wrongValve.id} belongs to a different valve.` }, { status: 400 });
      }
      const taken = beds.find(b => b.groupId && b.groupId !== id);
      if (taken) {
        return NextResponse.json(
          { error: `${taken.id} is already in another group.` },
          { status: 409 },
        );
      }
    }
    // detach everything currently in the group, then attach the new set
    await prisma.bed.updateMany({ where: { groupId: id }, data: { groupId: null } });
    if (bedIds.length > 0) {
      await prisma.bed.updateMany({ where: { id: { in: bedIds } }, data: { groupId: id } });
    }
  }

  /**
   * Handing the group to someone else closes the previous assignment rather
   * than overwriting it — who was accountable last month has to stay answerable
   * even after the group changes hands.
   */
  if ("ownerId" in body) {
    const today = todayAddis();
    const open = await prisma.groupAssignment.findFirst({ where: { groupId: id, toDate: null } });

    if (open && open.farmerId !== body.ownerId) {
      await prisma.groupAssignment.update({ where: { id: open.id }, data: { toDate: today } });
    }
    if (body.ownerId && (!open || open.farmerId !== body.ownerId)) {
      await prisma.groupAssignment.create({
        data: { groupId: id, farmerId: body.ownerId, fromDate: today, assignedBy: gate.userId },
      });
    }
    // ownerId explicitly null → leave the group unassigned (previous one closed)
  }

  const updated = await prisma.bedGroup.update({
    where: { id },
    data,
    include: {
      beds: { select: { id: true }, orderBy: { id: "asc" } },
      assignments: { where: { toDate: null }, include: { farmer: { select: { name: true } } } },
    },
  });

  const { beds, assignments, ...rest } = updated;
  const open = assignments.find(a => !a.toDate);
  return NextResponse.json({
    ...rest,
    bedIds: beds.map(b => b.id),
    owner: open ? { id: open.farmerId, name: open.farmer.name } : null,
    ownerSince: open?.fromDate ?? null,
  });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireManager();
  if (!gate.ok) return gate.res;

  const { id } = await params;
  const group = await prisma.bedGroup.findUnique({ where: { id }, select: { id: true } });
  if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Beds are released, never deleted; the group's ownership history goes with it.
  await prisma.bed.updateMany({ where: { groupId: id }, data: { groupId: null } });
  await prisma.bedGroup.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
