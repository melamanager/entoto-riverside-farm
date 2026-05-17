import { NextResponse } from "next/server";
import { addHarvest } from "@/lib/data";

export async function POST(req: Request) {
  const body = await req.json();
  if (!body.bedId || !body.kg || !body.farmerId) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  const id = addHarvest({
    bedId: body.bedId,
    kg: Number(body.kg),
    farmerId: body.farmerId,
    qualityGrade: body.qualityGrade ?? "A",
    date: body.date ?? new Date().toISOString().split("T")[0],
  });
  return NextResponse.json({ id, ok: true });
}
