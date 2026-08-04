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
