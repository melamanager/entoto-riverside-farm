import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const role = searchParams.get("role");

  const rows = await prisma.farmer.findMany({
    where: role ? { role: role as "farmer" | "supervisor" | "manager" } : undefined,
    orderBy: { name: "asc" },
    include: { user: { select: { id: true } } }, // to flag who can log in
  });
  // expose a hasLogin flag without leaking the user row
  const farmers = rows.map(({ user, ...f }) => ({ ...f, hasLogin: !!user }));

  return NextResponse.json(farmers, {
    headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=120" },
  });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  // sequential id (f-009, f-010…) so the login username stays human-friendly
  let id: string = body.id;
  if (!id) {
    const existing = await prisma.farmer.findMany({ select: { id: true } });
    const nums = existing.map((f) => /^f-(\d+)$/.exec(f.id)).filter(Boolean).map((m) => parseInt(m![1], 10));
    id = `f-${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(3, "0")}`;
  }
  const farmer = await prisma.farmer.create({ data: { ...body, id } });
  return NextResponse.json(farmer, { status: 201 });
}
