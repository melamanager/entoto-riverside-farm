import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getFarmConfig } from "@/lib/config";

// Non-secret operational config for client pages (payroll, harvest targets…).
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const cfg = await getFarmConfig();
  return NextResponse.json(cfg, {
    headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=300" },
  });
}
