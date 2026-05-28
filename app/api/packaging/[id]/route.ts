import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { normalizePackageSize } from "../package-size";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = normalizePackageSize(await req.json());

  const record = await prisma.packagingRecord.update({ where: { id }, data: body });
  return NextResponse.json(record);
}
