import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// How many records use each option value, so the Lists editor can warn before a
// delete ("used by 12 beds") and show what's safe to remove.
export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "manager") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [bedVarieties, plantVarieties, seedSources, jobTitles, bedCrops] = await Promise.all([
    prisma.bed.groupBy({ by: ["variety"], _count: { _all: true } }),
    prisma.plantingRecord.groupBy({ by: ["variety"], _count: { _all: true } }),
    prisma.plantingRecord.groupBy({ by: ["seedSource"], _count: { _all: true } }),
    prisma.farmer.groupBy({ by: ["jobTitle"], _count: { _all: true } }),
    prisma.bed.groupBy({ by: ["crop"], _count: { _all: true } }),
  ]);

  const tally = (rows: Array<Record<string, unknown> & { _count: { _all: number } }>, field: string) => {
    const out: Record<string, number> = {};
    for (const r of rows) {
      const k = r[field];
      if (typeof k === "string" && k) out[k] = (out[k] ?? 0) + r._count._all;
    }
    return out;
  };

  // a variety is "in use" by beds AND plantings combined
  const varieties = tally(bedVarieties as never, "variety");
  for (const [k, v] of Object.entries(tally(plantVarieties as never, "variety"))) {
    varieties[k] = (varieties[k] ?? 0) + v;
  }

  return NextResponse.json({
    varieties,
    seedSources: tally(seedSources as never, "seedSource"),
    jobTitles: tally(jobTitles as never, "jobTitle"),
    crops: tally(bedCrops as never, "crop"),
  });
}
