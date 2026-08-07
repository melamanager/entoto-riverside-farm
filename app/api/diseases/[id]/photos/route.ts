import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireCapability } from "@/lib/guard";

const MAX_PHOTOS_PER_KIND = 8;

/**
 * The angles on one report.
 *
 * By default this returns metadata only — id, kind, angle, size — never the
 * base64 bytes, so a gallery can render its strip without pulling megabytes.
 * Ask for one image at a time from ./photos/[photoId].
 * `?data=1` returns the bytes too, for the rare case that wants them all.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const kind = searchParams.get("kind");
  const withData = searchParams.get("data") === "1";

  const photos = await prisma.diseasePhoto.findMany({
    where: {
      reportId: id,
      ...(kind === "symptom" || kind === "proof" ? { kind } : {}),
    },
    orderBy: { createdAt: "asc" },
    ...(withData
      ? {}
      : { select: { id: true, kind: true, angle: true, createdBy: true, createdAt: true } }),
  });

  return NextResponse.json(photos);
}

/** Add one or more angles to an existing report. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireCapability("disease_report");
  if (!gate.ok) return gate.response;

  const { id } = await params;
  const body = await req.json();

  const report = await prisma.diseaseReport.findUnique({ where: { id }, select: { id: true } });
  if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const kind = body.kind === "proof" ? "proof" : "symptom";
  const incoming: { data: string; angle?: string | null }[] = Array.isArray(body.photos)
    ? body.photos
    : body.data
      ? [{ data: body.data, angle: body.angle }]
      : [];

  const valid = incoming.filter(p => typeof p?.data === "string" && p.data.startsWith("data:image/"));
  if (valid.length === 0) {
    return NextResponse.json({ error: "No image data" }, { status: 400 });
  }

  // `replace` is for a dialog that owns the whole set (the supervisor's proof
  // upload): without it, re-saving would append the same angles again.
  if (body.replace === true) {
    await prisma.diseasePhoto.deleteMany({ where: { reportId: id, kind } });
  }

  const existing = await prisma.diseasePhoto.count({ where: { reportId: id, kind } });
  const room = Math.max(0, MAX_PHOTOS_PER_KIND - existing);
  if (room === 0) {
    return NextResponse.json(
      { error: `A report can hold at most ${MAX_PHOTOS_PER_KIND} ${kind} photos.` },
      { status: 409 },
    );
  }

  await prisma.diseasePhoto.createMany({
    data: valid.slice(0, room).map((p, i) => ({
      reportId: id,
      kind,
      data: p.data,
      angle: p.angle ?? null,
      createdBy: gate.userId,
      createdAt: new Date(Date.now() + i),
    })),
  });

  // Keep the original single-image columns pointing at the first photo, so
  // anything still reading them (older clients, exports) stays correct.
  const first = await prisma.diseasePhoto.findFirst({
    where: { reportId: id, kind },
    orderBy: { createdAt: "asc" },
    select: { data: true },
  });
  if (first) {
    await prisma.diseaseReport.update({
      where: { id },
      data: kind === "proof" ? { proofImageUrl: first.data } : { photo: first.data },
    });
  }

  const photos = await prisma.diseasePhoto.findMany({
    where: { reportId: id, kind },
    orderBy: { createdAt: "asc" },
    select: { id: true, kind: true, angle: true, createdAt: true },
  });
  return NextResponse.json(photos, { status: 201 });
}
