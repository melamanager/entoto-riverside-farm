import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { todayAddis } from "@/lib/dates";

export const runtime = "nodejs";

// Batched dashboard payload: one authenticated round trip instead of the 8-9
// separate API calls the dashboards used to fire (each paying its own network
// RTT — the "shows 0, data appears seconds later" effect). Every query below
// replicates its standalone route's no-param GET exactly (same include/orderBy)
// so the payload shapes stay drop-in identical:
//   farmers → /api/farmers, valves → /api/valves, beds → /api/beds,
//   harvests → /api/harvest[?from], tasks → /api/tasks,
//   attendance → /api/attendance, followUps → /api/follow-ups (incl. the lazy
//   overdue sweep), diseases → /api/diseases, packagingRecords → /api/packaging.
// ?harvestFrom=YYYY-MM-DD windows the harvest list (manager dashboard).

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const harvestFrom = searchParams.get("harvestFrom");

  // lazy overdue sweep (must run before the followUp read, as /api/follow-ups does)
  await prisma.followUp.updateMany({
    where: { status: "pending", dueDate: { lt: todayAddis() } },
    data: { status: "overdue" },
  });

  const [farmers, valves, beds, harvests, tasks, attendance, followUps, diseases, packagingRecords] =
    await Promise.all([
      // omit the base64 portrait — dashboards use initials, never the photo
      prisma.farmer.findMany({ omit: { photo: true }, orderBy: { name: "asc" } }),
      prisma.valve.findMany({ orderBy: { name: "asc" } }),
      prisma.bed.findMany({ orderBy: [{ valveId: "asc" }, { id: "asc" }] }),
      prisma.harvestRecord.findMany({
        where: harvestFrom ? { date: { gte: harvestFrom } } : undefined,
        include: { bed: true, farmer: true },
        orderBy: { date: "desc" },
      }),
      prisma.task.findMany({
        omit: { proofImageUrl: true }, // base64 photos — dashboards never render them
        include: {
          assignee: true,
          creator: true,
          bed: true,
          children: { omit: { proofImageUrl: true }, include: { assignee: true, creator: true }, orderBy: { createdAt: "asc" } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.attendanceRecord.findMany({
        include: { farmer: true },
        orderBy: [{ date: "desc" }, { farmerId: "asc" }],
      }),
      prisma.followUp.findMany({
        include: { assignee: true, creator: true, bed: true, valve: true },
        orderBy: [{ status: "asc" }, { dueDate: "asc" }],
      }),
      prisma.diseaseReport.findMany({
        // photo + proofImageUrl are multi-MB base64 blobs (20+ MB across the
        // table) and made the payload undownloadable on farm connections;
        // the dashboards never render them
        omit: { photo: true, proofImageUrl: true },
        include: { bed: true, reporter: true },
        orderBy: { reportedAt: "desc" },
      }),
      prisma.packagingRecord.findMany({
        include: { valve: true, packer: true, order: true },
        orderBy: { packedDate: "desc" },
      }),
    ]);

  return NextResponse.json(
    { farmers, valves, beds, harvests, tasks, attendance, followUps, diseases, packagingRecords },
    { headers: { "Cache-Control": "private, max-age=15, stale-while-revalidate=60" } },
  );
}
