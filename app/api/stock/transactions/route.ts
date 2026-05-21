import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  const transaction = await prisma.$transaction(async (tx) => {
    const created = await tx.stockTransaction.create({ data: body });

    const delta = body.type === "stock_in"
      ? new Prisma.Decimal(body.quantity)
      : new Prisma.Decimal(body.quantity).negated();

    await tx.stockItem.update({
      where: { id: body.itemId },
      data: { currentQty: { increment: delta } },
    });

    return created;
  });

  return NextResponse.json(transaction, { status: 201 });
}
