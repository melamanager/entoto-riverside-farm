import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const start = Date.now();
  let db: "ok" | "error" = "error";
  let dbMs = 0;

  try {
    await prisma.$queryRaw`SELECT 1`;
    db = "ok";
    dbMs = Date.now() - start;
  } catch {
    dbMs = Date.now() - start;
  }

  const status = db === "ok" ? 200 : 503;

  return NextResponse.json(
    {
      status: db === "ok" ? "ok" : "degraded",
      db,
      dbMs,
      uptime: Math.floor(process.uptime()),
      node: process.version,
      ts: new Date().toISOString(),
    },
    { status }
  );
}
