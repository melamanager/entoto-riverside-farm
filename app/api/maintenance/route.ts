import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireCapability } from "@/lib/guard";

/** What a maintenance round can consist of. Free-text notes cover the rest. */
export const MAINTENANCE_ACTIVITIES = [
  "weeding",
  "bed_maintenance",
  "mulching",
  "pruning",
  "drip_check",
  "trellis_support",
  "cleaning",
  "other",
] as const;

const VALID = new Set<string>(MAINTENANCE_ACTIVITIES);

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const logs = await prisma.maintenanceLog.findMany({
    where: {
      ...(date ? { date } : {}),
      ...(!date && (from || to)
        ? { date: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
        : {}),
    },
    include: { recorder: { select: { id: true, name: true, role: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(logs);
}

/**
 * Record upkeep that was done. Gated on the "maintenance" capability, which
 * supervisors hold by default — the whole point is that this does not need a
 * manager standing on the farm.
 */
export async function POST(req: Request) {
  const gate = await requireCapability("maintenance");
  if (!gate.ok) return gate.response;

  const body = await req.json();

  const activities: string[] = Array.isArray(body.activities)
    ? body.activities.filter((a: unknown): a is string => typeof a === "string" && VALID.has(a))
    : [];
  const valveIds: string[] = Array.isArray(body.valveIds)
    ? body.valveIds.filter((v: unknown): v is string => typeof v === "string")
    : [];

  if (activities.length === 0) {
    return NextResponse.json({ error: "Choose at least one kind of work" }, { status: 400 });
  }
  if (valveIds.length === 0) {
    return NextResponse.json({ error: "Choose at least one valve zone" }, { status: 400 });
  }

  // Sanity-check the zones actually exist, so a typo cannot create a phantom log
  const known = await prisma.valve.findMany({
    where: { id: { in: valveIds } },
    select: { id: true },
  });
  if (known.length !== valveIds.length) {
    return NextResponse.json({ error: "Unknown valve in selection" }, { status: 400 });
  }

  const bedsCount =
    body.bedsCount === undefined || body.bedsCount === null || body.bedsCount === ""
      ? null
      : Math.max(0, Math.round(Number(body.bedsCount)));
  if (bedsCount !== null && !Number.isFinite(bedsCount)) {
    return NextResponse.json({ error: "Beds must be a number" }, { status: 400 });
  }

  const log = await prisma.maintenanceLog.create({
    data: {
      date: typeof body.date === "string" && body.date ? body.date : new Date().toLocaleDateString("en-CA"),
      activities,
      valveIds,
      bedsCount,
      note: body.note || null,
      recordedBy: gate.userId,
    },
    include: { recorder: { select: { id: true, name: true, role: true } } },
  });

  return NextResponse.json(log, { status: 201 });
}
