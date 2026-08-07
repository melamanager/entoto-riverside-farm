import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const bedId = searchParams.get("bedId");

  const where = {
    ...(status ? { status: status as "open" | "notified" | "treating" | "resolved" } : {}),
    ...(bedId ? { bedId } : {}),
  };

  const [reports, withProof] = await Promise.all([
    prisma.diseaseReport.findMany({
      where,
    // photo and proofImageUrl are multi-MB base64 blobs. The list never renders
    // them — the reporter photo is not shown at all, and the proof photo is
    // fetched from GET /api/diseases/[id] only when someone opens it. Sending
    // them here made this list several MB per report.
      omit: { photo: true, proofImageUrl: true },
      include: {
        bed: true,
        reporter: { omit: { photo: true } }, // base64 portrait — list shows initials
      },
      orderBy: { reportedAt: "desc" },
    }),
    // The UI still needs to know a proof photo EXISTS (to show "View proof"),
    // just not its bytes — so ask for the ids only.
    prisma.diseaseReport.findMany({
      where: { ...where, NOT: { proofImageUrl: null } },
      select: { id: true },
    }),
  ]);

  const proofIds = new Set(withProof.map(r => r.id));
  return NextResponse.json(
    reports.map(r => ({ ...r, hasProofImage: proofIds.has(r.id) })),
  );
}
