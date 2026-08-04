import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireCapability } from "@/lib/guard";
import { Prisma } from "@prisma/client";
import { sendTelegram } from "@/lib/notifications";
import { notifyFieldNote } from "@/lib/field-note";
import { todayAddis } from "@/lib/dates";
import { getFarmConfig } from "@/lib/config-server";

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
  const gate = await requireCapability("harvest");
  if (!gate.ok) return gate.response;
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  // single object or an array (bulk logging: several beds in one submission)
  const items: Array<Record<string, unknown>> = Array.isArray(body) ? body : [body];
  if (items.length === 0 || items.length > 100) {
    return NextResponse.json({ error: "Nothing to log" }, { status: 400 });
  }
  for (const it of items) {
    if (!it.bedId || !it.kg || !it.farmerId) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }
  }

  const created = [];
  for (const it of items) {
    created.push(await prisma.harvestRecord.create({
      data: {
        bedId: String(it.bedId),
        kg: new Prisma.Decimal(it.kg as number),
        farmerId: String(it.farmerId),
        qualityGrade: (it.qualityGrade as string) ?? "A",
        date: (it.date as string) ?? todayAddis(),
        note: typeof it.note === "string" && it.note.trim() ? it.note.trim() : null,
      },
    }));
  }

  // field note → straight to the manager (once per submission, listing the beds)
  const noteText = items.map(it => it.note).find(n => typeof n === "string" && (n as string).trim()) as string | undefined;
  if (noteText) {
    const batchKg = items.reduce((s, it) => s + Number(it.kg), 0);
    await notifyFieldNote({
      area: "Harvest",
      refText: `${items.map(it => it.bedId).join(", ")} · ${batchKg.toFixed(1)} kg (grade ${(items[0].qualityGrade as string) ?? "A"})`,
      note: noteText,
      byId: gate.userId,
    });
  }

  // daily-target milestone — best effort
  try {
    const cfg = await getFarmConfig();
    const target = cfg.harvestDailyTargetKg;
    const date = created[0].date;
    const batchKg = items.filter(it => ((it.date as string) ?? todayAddis()) === date)
      .reduce((s, it) => s + Number(it.kg), 0);
    const agg = await prisma.harvestRecord.aggregate({ where: { date }, _sum: { kg: true } });
    const totalAfter = Number(agg._sum.kg ?? 0);
    const totalBefore = totalAfter - batchKg;
    if (target > 0 && totalBefore < target && totalAfter >= target) {
      await prisma.notification.create({
        data: {
          type: "harvest",
          channel: "in_app",
          message: `🎉 Daily harvest target reached — ${totalAfter.toFixed(1)} kg collected on ${date} (target ${target} kg)`,
          link: "/harvest",
        },
      });
      if (cfg.notifyHarvest) {
        await sendTelegram(
          `🎉 <b>Harvest target reached — Entoto Farm</b>\n\n<b>${totalAfter.toFixed(1)} kg</b> collected today (target ${target} kg). Great work!`
        );
      }
    }
  } catch (e) {
    console.error("harvest milestone notification failed", e);
  }

  return NextResponse.json(
    Array.isArray(body) ? { ids: created.map(r => r.id), count: created.length, ok: true } : { id: created[0].id, ok: true },
  );
}
