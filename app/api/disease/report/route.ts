import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { DISEASE_TREATMENT_STEPS, DISEASE_TREATMENTS } from "@/lib/types";
import type { DiseaseType } from "@/lib/types";

export async function POST(req: Request) {
  const body = await req.json();
  if (!body.bedId || !body.type) {
    return NextResponse.json({ error: "Missing bedId or type" }, { status: 400 });
  }

  const session = await auth();
  const type = body.type as DiseaseType;

  const report = await prisma.diseaseReport.create({
    data: {
      bedId: body.bedId,
      type,
      severity: Number(body.severity ?? 30),
      reportedAt: new Date(),
      reportedBy: body.reportedBy ?? session?.user?.id ?? "f-006",
      status: "open",
      suggestedTreatment: body.suggestedTreatment ?? DISEASE_TREATMENTS[type] ?? "Awaiting expert review.",
      treatmentSteps: DISEASE_TREATMENT_STEPS[type] ?? [],
      treatmentApplied: false,
      managerNotified: true,
      notifiedAt: new Date(),
      notificationChannels: ["telegram", "sms"],
      aiConfidence: body.aiConfidence ?? null,
      infectedLengthM: body.infectedLengthM ? Number(body.infectedLengthM) : null,
    },
  });

  await prisma.bed.update({ where: { id: body.bedId }, data: { health: "infected" } });

  await prisma.notification.create({
    data: {
      type: "disease",
      channel: "telegram",
      message: `🚨 ALERT: ${body.bedId} — ${type.replace(/_/g, " ")} detected (severity ${body.severity ?? 30}%). Manager notified via Telegram & SMS.`,
      link: "/diseases",
    },
  });

  console.log(`[NOTIFY] Telegram + SMS dispatched → manager re: disease at ${body.bedId}`);
  return NextResponse.json({ id: report.id, ok: true, notified: ["telegram", "sms"] });
}
