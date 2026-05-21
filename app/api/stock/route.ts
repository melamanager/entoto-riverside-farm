import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const belowReorder = searchParams.get("belowReorder") === "true";

  const items = await prisma.stockItem.findMany({
    where: {
      ...(category ? { category: category as "fertilizer" | "pesticide" | "packaging" | "tool" | "seed" | "other" } : {}),
    },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  const filtered = belowReorder
    ? items.filter(i => parseFloat(i.currentQty.toString()) <= parseFloat(i.reorderLevel.toString()))
    : items;

  return NextResponse.json(filtered);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const item = await prisma.stockItem.create({ data: body });
  return NextResponse.json(item, { status: 201 });
}
