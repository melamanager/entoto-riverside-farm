import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const month = searchParams.get("month"); // "YYYY-MM"

  const expenses = await prisma.expense.findMany({
    where: {
      ...(category ? { category: category as "fuel" | "chemicals" | "seeds" | "labour" | "equipment" | "packaging" | "repairs" | "other" } : {}),
      ...(month ? { date: { startsWith: month } } : {}),
    },
    include: { paidByUser: true },
    orderBy: { date: "desc" },
  });

  return NextResponse.json(expenses);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const expense = await prisma.expense.create({ data: body });
  return NextResponse.json(expense, { status: 201 });
}
