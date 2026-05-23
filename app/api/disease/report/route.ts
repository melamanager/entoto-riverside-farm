import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { DISEASE_TREATMENT_STEPS, DISEASE_TREATMENTS } from "@/lib/types";
import type { DiseaseType } from "@/lib/types";
import { notifyDisease } from "@/lib/notifications";

export async function POST(req: Request) {
  const body = await req.json();
  if (!body.bedId || !body.type) {
    return NextResponse.json({ error: "Missing bedId or type" }, { status: 400 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const type = body.type as DiseaseType;

  // Get bed → valve → supervisor phone
  const bed   = await prisma.bed.findUnique({ where: { id: body.bedId } });
  const valve = bed ? await prisma.valve.findUnique({ where: { id: bed.valveId } }) : null;
  const supervisorPhone = valve?.supervisorId
    ? (await prisma.farmer.findUnique({ where: { id: valve.supervisorId } }))?.phone
    : null;

  const report = await prisma.diseaseReport.create({
    data: {
      bedId:                body.bedId,
      type,
      severity:             Number(body.severity ?? 30),
      reportedAt:           new Date(),
      reportedBy:           session.user.id,
      status:               "open",
      suggestedTreatment:   body.suggestedTreatment ?? DISEASE_TREATMENTS[type] ?? "Awaiting expert review.",
      treatmentSteps:       DISEASE_TREATMENT_STEPS[type] ?? [],
      treatmentApplied:     false,
      managerNotified:      false,
      notificationChannels: [],
      aiConfidence:         body.aiConfidence ?? null,
      infectedLengthM:      body.infectedLengthM ? Number(body.infectedLengthM) : null,
    },
  });

  await prisma.bed.update({ where: { id: body.bedId }, data: { health: "infected" } });

  // Fire real notifications
  const notifResult = await notifyDisease({
    bedId:           body.bedId,
    type:            type as string,
    severity:        Number(body.severity ?? 30),
    supervisorPhone: supervisorPhone ?? null,
  });

  const channels: string[] = [];
  if (notifResult.sms.ok)      channels.push("sms");
  if (notifResult.telegram.ok) channels.push("telegram");

  await prisma.diseaseReport.update({
    where: { id: report.id },
    data:  { managerNotified: channels.length > 0, notificationChannels: channels },
  });

  await prisma.notification.create({
    data: {
      type:    "disease",
      channel: channels.includes("telegram") ? "telegram" : channels.includes("sms") ? "sms" : "in_app",
      message: `🚨 ${body.bedId} — ${type.replace(/_/g, " ")} detected (severity ${body.severity ?? 30}%). ${channels.length ? `Notified via ${channels.join(" & ")}.` : "Notification pending — check settings."}`,
      link:    "/diseases",
    },
  });

  return NextResponse.json({
    id:       report.id,
    ok:       true,
    notified: channels,
    details:  notifResult,
  });
}
