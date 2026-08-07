import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireCapability } from "@/lib/guard";

/** One image's bytes — fetched only when it is actually displayed. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; photoId: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, photoId } = await params;
  const photo = await prisma.diseasePhoto.findFirst({
    where: { id: photoId, reportId: id },
  });
  if (!photo) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(photo, {
    // immutable once written, so it is safe to keep in the browser cache
    headers: { "Cache-Control": "private, max-age=86400" },
  });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; photoId: string }> },
) {
  const gate = await requireCapability("disease_report");
  if (!gate.ok) return gate.response;

  const { id, photoId } = await params;
  const photo = await prisma.diseasePhoto.findFirst({
    where: { id: photoId, reportId: id },
    select: { id: true, kind: true },
  });
  if (!photo) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.diseasePhoto.delete({ where: { id: photoId } });

  // Re-point the original single-image column at whatever is now first, or
  // clear it when the last angle of that kind is gone.
  const next = await prisma.diseasePhoto.findFirst({
    where: { reportId: id, kind: photo.kind },
    orderBy: { createdAt: "asc" },
    select: { data: true },
  });
  await prisma.diseaseReport.update({
    where: { id },
    data: photo.kind === "proof"
      ? { proofImageUrl: next?.data ?? null }
      : { photo: next?.data ?? null },
  });

  return NextResponse.json({ ok: true });
}
