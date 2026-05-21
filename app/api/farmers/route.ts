import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const role = searchParams.get("role");

  const farmers = await prisma.farmer.findMany({
    where: role ? { role: role as "farmer" | "supervisor" | "manager" } : undefined,
    orderBy: { name: "asc" },
  });

  return NextResponse.json(farmers);
}
