import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { sendTelegram } from "@/lib/notifications";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const bedId = searchParams.get("bedId");
  const date = searchParams.get("date");
  const from = searchParams.get("from");
  const farmerId = searchParams.get("farmerId");

  const records = await prisma.harvestRecord.findMany({
    where: {
      ...(bedId ? { bedId } : {}),
      ...(date ? { date } : {}),
      ...(from ? { date: { gte: from } } : {}),
      ...(farmerId ? { farmerId } : {}),
    },
    include: { bed: true, farmer: true },
    orderBy: { date: "desc" },
  });

  return NextResponse.json(records);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  if (!body.bedId || !body.kg || !body.farmerId) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const record = await prisma.harvestRecord.create({
    data: {
      bedId: body.bedId,
      kg: new Prisma.Decimal(body.kg),
      farmerId: body.farmerId,
      qualityGrade: body.qualityGrade ?? "A",
      date: body.date ?? new Date().toISOString().split("T")[0],
    },
  });

  // daily-target milestone — best effort
  try {
    const targetSetting = await prisma.appSetting.findUnique({ where: { key: "harvest_daily_target_kg" } });
    const target = Number(targetSetting?.value ?? 50);
    const agg = await prisma.harvestRecord.aggregate({ where: { date: record.date }, _sum: { kg: true } });
    const totalAfter = Number(agg._sum.kg ?? 0);
    const totalBefore = totalAfter - Number(body.kg);
    if (target > 0 && totalBefore < target && totalAfter >= target) {
      await prisma.notification.create({
        data: {
          type: "harvest",
          channel: "in_app",
          message: `🎉 Daily harvest target reached — ${totalAfter.toFixed(1)} kg collected on ${record.date} (target ${target} kg)`,
          link: "/harvest",
        },
      });
      await sendTelegram(
        `🎉 <b>Harvest target reached — Entoto Farm</b>\n\n<b>${totalAfter.toFixed(1)} kg</b> collected today (target ${target} kg). Great work!`
      );
    }
  } catch (e) {
    console.error("harvest milestone notification failed", e);
  }

  return NextResponse.json({ id: record.id, ok: true });
}
