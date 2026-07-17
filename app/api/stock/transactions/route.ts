import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { sendTelegram } from "@/lib/notifications";

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  const item = await prisma.stockItem.findUnique({ where: { id: body.itemId } });
  if (!item) return NextResponse.json({ error: "Stock item not found" }, { status: 404 });

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

  // low-stock alert on threshold crossing — best effort
  try {
    const before = Number(item.currentQty);
    const delta = body.type === "stock_in" ? Number(body.quantity) : -Number(body.quantity);
    const after = before + delta;
    const reorder = Number(item.reorderLevel);

    if (delta < 0 && before > reorder && after <= reorder) {
      const critical = after <= reorder * 0.5;
      await prisma.notification.create({
        data: {
          type: "stock",
          channel: "in_app",
          message: `${critical ? "🚨" : "📦"} ${critical ? "CRITICAL" : "Low"} stock: ${item.name} at ${after} ${item.unit} (reorder level ${reorder})`,
          link: "/stock",
        },
      });
      if (critical) {
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
