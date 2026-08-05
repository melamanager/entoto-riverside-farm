import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { notifyFieldNote } from "@/lib/field-note";
import { normalizePackageSize } from "../package-size";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = normalizePackageSize(await req.json());

  const before = await prisma.packagingRecord.findUnique({ where: { id }, select: { notes: true } });
  const record = await prisma.packagingRecord.update({ where: { id }, data: body });

  // the edit dialog promises "(sent to the manager)" — honour it here too, but
  // only when the note actually changed, so routine status edits stay silent
  const newNote = typeof body.notes === "string" ? body.notes.trim() : "";
  if (newNote && newNote !== (before?.notes ?? "").trim()) {
    await notifyFieldNote({
      area: "Packaging",
      refText: `${record.batchNumber} · ${record.variety} · packed ${Number(record.packedKg)} kg`,
      note: newNote,
      byId: (session.user as { id: string }).id,
    });
  }

  return NextResponse.json(record);
}
