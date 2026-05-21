import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const transactions = await prisma.stockTransaction.findMany({
    where: { itemId: id },
    include: { performer: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(transactions);
}
