import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { buildGroupScores } from "@/lib/group-scores";
import { todayAddis } from "@/lib/dates";

/**
 * Sub-group performance over a date range.
 *
 * Defaults to the last 30 days, which is long enough to say something about a
 * stretch of beds without being so long that a change of owner is buried.
 */
export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const to = searchParams.get("to") || todayAddis();
  const from = searchParams.get("from") || (() => {
    const d = new Date(`${to}T00:00:00`);
    d.setDate(d.getDate() - 29);
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Addis_Ababa" }).format(d);
  })();

  const data = await buildGroupScores(from, to);
  return NextResponse.json(data, {
    headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=300" },
  });
}
