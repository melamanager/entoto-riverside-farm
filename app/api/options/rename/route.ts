import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// Renaming an option must also rename it on the records that reference it —
// otherwise a rename silently orphans every bed/planting/staff member still
// holding the old string, and they'd vanish from grouped reports.
//
// POST { key: "varieties" | "seedSources" | "jobTitles", from, to }

const HANDLERS: Record<string, (from: string, to: string) => Promise<number>> = {
  varieties: async (from, to) => {
    const [beds, plantings] = await Promise.all([
      prisma.bed.updateMany({ where: { variety: from }, data: { variety: to } }),
      prisma.plantingRecord.updateMany({ where: { variety: from }, data: { variety: to } }),
    ]);
    return beds.count + plantings.count;
  },
  seedSources: async (from, to) =>
    (await prisma.plantingRecord.updateMany({ where: { seedSource: from }, data: { seedSource: to } })).count,
  jobTitles: async (from, to) =>
    (await prisma.farmer.updateMany({ where: { jobTitle: from }, data: { jobTitle: to } })).count,
};

export async function POST(req: Request) {
  const session = await auth();
  if (session?.user?.role !== "manager") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { key, from, to } = await req.json().catch(() => ({}));
  const handler = HANDLERS[String(key)];
  if (!handler) return NextResponse.json({ error: "That list can't be renamed" }, { status: 400 });
  if (!from || !to || from === to) return NextResponse.json({ error: "Nothing to rename" }, { status: 400 });

  const updated = await handler(String(from), String(to));
  return NextResponse.json({ ok: true, updated });
}
