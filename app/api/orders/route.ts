import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

// Derive the money fields server-side so total and payment status are always
// consistent no matter what the client sends.
export function normalizeOrderMoney(body: Record<string, unknown>) {
  const qty = Math.max(0, Number(body.quantityKg) || 0);
  const price = Math.max(0, Number(body.pricePerKg) || 0);
  const total = Math.round(qty * price * 100) / 100;
  let advance = Math.max(0, Number(body.advancePaid) || 0);
  if (advance > total) advance = total;
  const paymentStatus = advance <= 0 ? "pending" : advance >= total ? "paid" : "partial";
  return {
    quantityKg: new Prisma.Decimal(qty),
    pricePerKg: new Prisma.Decimal(price),
    totalAmount: new Prisma.Decimal(total),
    advancePaid: new Prisma.Decimal(advance),
    paymentStatus,
  };
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const paymentStatus = searchParams.get("paymentStatus");
  const deliveryStatus = searchParams.get("deliveryStatus");

  const orders = await prisma.customerOrder.findMany({
    where: {
      ...(paymentStatus ? { paymentStatus: paymentStatus as "pending" | "partial" | "paid" | "overdue" } : {}),
      ...(deliveryStatus ? { deliveryStatus: deliveryStatus as "pending" | "in_transit" | "delivered" | "cancelled" } : {}),
    },
    include: { packagingRecords: true },
    orderBy: { orderDate: "desc" },
  });

  return NextResponse.json(orders);
}

// Managers and supervisors (sales) can record a customer sale.
export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: userId, role } = session.user as { id: string; role: string };
  if (role !== "manager" && role !== "supervisor") {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  const body = await req.json();
  if (!body.customerName || !String(body.customerName).trim()) {
    return NextResponse.json({ error: "Customer name is required" }, { status: 400 });
  }
  const money = normalizeOrderMoney(body);
  if (Number(money.quantityKg) <= 0 || Number(money.pricePerKg) <= 0) {
    return NextResponse.json({ error: "Quantity and price must be greater than 0" }, { status: 400 });
  }

  const order = await prisma.customerOrder.create({
    data: {
      customerName: String(body.customerName).trim(),
      customerType: body.customerType ?? "direct",
      orderDate: body.orderDate,
      deliveryDate: body.deliveryDate,
      deliveryStatus: body.deliveryStatus ?? "pending",
      variety: body.variety || null,
      phone: body.phone || null,
      notes: body.notes || null,
      ...money,
    },
  });

  // accountability: who recorded the sale
  try {
    const seller = await prisma.farmer.findUnique({ where: { id: userId }, select: { name: true } });
    await prisma.notification.create({
      data: {
        type: "message",
        channel: "in_app",
        message: `🧾 Sale recorded: ${order.customerName} — ${Number(order.quantityKg)}kg for ${Number(order.totalAmount).toLocaleString()} ETB (by ${seller?.name ?? userId})`,
        link: "/orders",
      },
    });
  } catch (e) {
    console.error("sale notification failed", e);
  }

  return NextResponse.json(order, { status: 201 });
}
