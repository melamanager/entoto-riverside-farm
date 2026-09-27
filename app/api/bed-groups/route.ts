import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { todayAddis } from "@/lib/dates";

/**
 * Bed sub-groups — "Valve A · Beds 1-4".
 *
 * Defining the farm's structure is a manager's job; everyone can read it,
 * because the register, harvest and scan pages all need to show group names.
 */

/** Current owner = the open assignment (no toDate). */
function currentOwner(assignments: { farmerId: string; fromDate: string; toDate: string | null; farmer: { name: string } }[]) {
  const open = assignments.find(a => !a.toDate);
  return open ? { owner: { id: open.farmerId, name: open.farmer.name }, ownerSince: open.fromDate } : { owner: null, ownerSince: null };
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const valveId = searchParams.get("valveId");
  const includeInactive = searchParams.get("all") === "1";

  const groups = await prisma.bedGroup.findMany({
    where: {
      ...(valveId ? { valveId } : {}),
      ...(includeInactive ? {} : { active: true }),
    },
    include: {
      beds: { select: { id: true }, orderBy: { id: "asc" } },
      assignments: {
        where: { toDate: null },
        include: { farmer: { select: { name: true } } },
      },
    },
    orderBy: [{ valveId: "asc" }, { code: "asc" }],
  });

  return NextResponse.json(
    groups.map(g => {
      const { beds, assignments, ...rest } = g;
      return { ...rest, bedIds: beds.map(b => b.id), ...currentOwner(assignments) };
    }),
  );
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as { role: string }).role !== "manager") {
    return NextResponse.json({ error: "Only a manager can define bed groups." }, { status: 403 });
  }

  const body = await req.json();
  const { valveId, name, nameAm, code, note } = body;
  const bedIds: string[] = Array.isArray(body.bedIds) ? body.bedIds : [];
  const ownerId: string | null = body.ownerId || null;

  if (!valveId || !name?.trim() || !code?.trim()) {
    return NextResponse.json({ error: "Valve, name and stake code are required" }, { status: 400 });
  }

  const valve = await prisma.valve.findUnique({ where: { id: valveId }, select: { id: true } });
  if (!valve) return NextResponse.json({ error: "Unknown valve" }, { status: 400 });

  // A group only makes sense over beds on its own valve — the stake sits in
  // that zone, and irrigation/fertigation follow the valve.
  if (bedIds.length > 0) {
    const beds = await prisma.bed.findMany({
      where: { id: { in: bedIds } },
      select: { id: true, valveId: true, groupId: true },
    });
    if (beds.length !== bedIds.length) {
      return NextResponse.json({ error: "Unknown bed in selection" }, { status: 400 });
    }
    const wrongValve = beds.find(b => b.valveId !== valveId);
    if (wrongValve) {
      return NextResponse.json(
        { error: `${wrongValve.id} belongs to a different valve.` },
        { status: 400 },
      );
    }
    const taken = beds.find(b => b.groupId);
    if (taken) {
      return NextResponse.json(
        { error: `${taken.id} is already in another group.`, detail: "A bed can only belong to one sub-group." },
        { status: 409 },
      );
    }
  }

  const existingCode = await prisma.bedGroup.findUnique({ where: { code: code.trim() } });
  if (existingCode) {
    return NextResponse.json(
      { error: `Stake code "${code.trim()}" is already used.`, detail: "Codes are unique farm-wide so a stake is never ambiguous." },
      { status: 409 },
    );
  }

  const group = await prisma.bedGroup.create({
    data: {
      valveId,
      name: name.trim(),
      nameAm: nameAm?.trim() || null,
      code: code.trim(),
      note: note?.trim() || null,
      ...(bedIds.length > 0 ? { beds: { connect: bedIds.map(id => ({ id })) } } : {}),
      ...(ownerId
        ? {
            assignments: {
              create: {
                farmerId: ownerId,
                fromDate: todayAddis(),
                assignedBy: (session.user as { id: string }).id,
              },
            },
          }
        : {}),
    },
    include: {
      beds: { select: { id: true }, orderBy: { id: "asc" } },
      assignments: { where: { toDate: null }, include: { farmer: { select: { name: true } } } },
    },
  });

  const { beds, assignments, ...rest } = group;
  return NextResponse.json(
    { ...rest, bedIds: beds.map(b => b.id), ...currentOwner(assignments) },
    { status: 201 },
  );
}
