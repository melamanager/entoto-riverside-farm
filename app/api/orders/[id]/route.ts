import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { normalizeOrderMoney } from "../route";

// Managers and supervisors can update a sale (delivery/payment/details).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as { role: string }).role;
  if (role !== "manager" && role !== "supervisor") {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json() as Record<string, unknown>;

  // if any money field is present, recompute total + payment status together
  const touchesMoney = ["quantityKg", "pricePerKg", "advancePaid"].some(k => k in body);
  const data: Record<string, unknown> = { ...body };
  delete data.totalAmount;
  delete data.paymentStatus;
  if (touchesMoney) {
    const existing = await prisma.customerOrder.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    Object.assign(data, normalizeOrderMoney({
      quantityKg: body.quantityKg ?? Number(existing.quantityKg),
      pricePerKg: body.pricePerKg ?? Number(existing.pricePerKg),
      advancePaid: body.advancePaid ?? Number(existing.advancePaid),
    }));
  }

  const order = await prisma.customerOrder.update({ where: { id }, data });
  return NextResponse.json(order);
}

// Deleting an order is manager-only.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as { role: string }).role;
  if (role !== "manager") return NextResponse.json({ error: "Manager access required" }, { status: 403 });

  const { id } = await params;
  await prisma.customerOrder.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
