import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { sendTelegram } from "@/lib/notifications";
import { getFarmConfig } from "@/lib/config";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");

  const records = await prisma.stockTransaction.findMany({
    where: from ? { date: { gte: from } } : {},
    include: { item: { select: { name: true, unit: true } }, performer: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return NextResponse.json(records);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const qty = Number(body.quantity);
  if (!Number.isFinite(qty) || qty === 0) {
    return NextResponse.json({ error: "Quantity must be a non-zero number" }, { status: 400 });
  }
  // adjustment is a signed correction (+ increases, − decreases); all other
  // non-stock_in types only ever remove stock
  const deltaNum = body.type === "stock_in" ? Math.abs(qty)
    : body.type === "adjustment" ? qty
    : -Math.abs(qty);

  const item = await prisma.stockItem.findUnique({ where: { id: body.itemId } });
  if (!item) return NextResponse.json({ error: "Stock item not found" }, { status: 404 });

  const before = Number(item.currentQty);
  const after = before + deltaNum;
  if (after < 0) {
    return NextResponse.json(
      { error: `Insufficient stock: only ${before} ${item.unit} available` },
      { status: 400 },
    );
  }

  const transaction = await prisma.$transaction(async (tx) => {
    // adjustments keep their sign in history so the direction of the correction is auditable
    const created = await tx.stockTransaction.create({
      data: { ...body, quantity: new Prisma.Decimal(body.type === "adjustment" ? qty : Math.abs(qty)) },
    });
    await tx.stockItem.update({
      where: { id: body.itemId },
      data: { currentQty: { increment: new Prisma.Decimal(deltaNum) } },
    });
    return created;
  });

  // low-stock alert on threshold crossing — best effort
  try {
    const reorder = Number(item.reorderLevel);
    if (deltaNum < 0 && before > reorder && after <= reorder) {
      const critical = after <= reorder * 0.5;
      await prisma.notification.create({
        data: {
          type: "stock",
          channel: "in_app",
          message: `${critical ? "🚨" : "📦"} ${critical ? "CRITICAL" : "Low"} stock: ${item.name} at ${after} ${item.unit} (reorder level ${reorder})`,
          link: "/stock",
        },
      });
      if (critical && (await getFarmConfig()).notifyLowStock) {
        await sendTelegram(
          `🚨 <b>Critical stock — Entoto Farm</b>\n\n<b>${item.name}</b> is down to <b>${after} ${item.unit}</b> (reorder level ${reorder}).\nRestock needed.`
        );
      }
    }
  } catch (e) {
    console.error("low-stock notification failed", e);
  }

  return NextResponse.json(transaction, { status: 201 });
}
