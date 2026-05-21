import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

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

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const order = await prisma.customerOrder.create({ data: body });
  return NextResponse.json(order, { status: 201 });
}
