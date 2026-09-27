import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireCapability } from "@/lib/guard";
import { notifyFieldNote } from "@/lib/field-note";
import { normalizePackageSize } from "./package-size";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const valveId = searchParams.get("valveId");
  const status = searchParams.get("status");

  const records = await prisma.packagingRecord.findMany({
    where: {
      ...(valveId ? { valveId } : {}),
      ...(status ? { status: status as "in_progress" | "packed" | "dispatched" } : {}),
    },
    include: { valve: true, packer: true, order: true },
    orderBy: { packedDate: "desc" },
  });

  return NextResponse.json(records);
}

export async function POST(req: Request) {
  const gate = await requireCapability("packaging");
  if (!gate.ok) return gate.response;
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = normalizePackageSize(await req.json());

  // A batch belongs to one sub-group, which is what makes "sold" traceable.
  // Check the group is real and on the same valve, so a typo cannot silently
  // attribute someone else's fruit — and snapshot it, like the harvest record.
  if (body.groupId) {
    const group = await prisma.bedGroup.findUnique({
      where: { id: String(body.groupId) },
      select: { id: true, valveId: true },
    });
    if (!group) {
      return NextResponse.json({ error: "Unknown bed group" }, { status: 400 });
    }
    if (body.valveId && group.valveId !== body.valveId) {
      return NextResponse.json(
        { error: "That sub-group is not on this valve." },
        { status: 400 },
      );
    }
    // the valve follows from the group, so a mismatch is impossible later
    body.valveId = group.valveId;
  } else {
    body.groupId = null;
  }

  // disease-affected fruit is part of what was rejected, never more than it
  const diseased = Number(body.diseasedKg ?? 0);
  body.diseasedKg = Number.isFinite(diseased) && diseased > 0 ? diseased : 0;
  if (body.diseasedKg > Number(body.rejectedKg ?? 0)) {
    return NextResponse.json(
      {
        error: "Disease-affected fruit cannot exceed the rejected total.",
        detail: "Disease is one reason for rejecting fruit, so it is counted within the rejected kg.",
      },
      { status: 400 },
    );
  }

  const record = await prisma.packagingRecord.create({ data: body });

  // field note → straight to the manager
  if (typeof body.notes === "string" && body.notes.trim()) {
    await notifyFieldNote({
      area: "Packaging",
      refText: `${record.batchNumber} · ${record.variety} · packed ${Number(record.packedKg)} kg`,
      note: body.notes,
      byId: gate.userId,
    });
  }
  return NextResponse.json(record, { status: 201 });
}
