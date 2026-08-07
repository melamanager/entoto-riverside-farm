import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { DISEASE_TREATMENT_STEPS, DISEASE_TREATMENTS } from "@/lib/types";
import type { DiseaseType } from "@/lib/types";
import { notifyDisease } from "@/lib/notifications";
import { requireCapability } from "@/lib/guard";

/** Hard cap so one report cannot be used to push unbounded data into a row. */
const MAX_PHOTOS = 8;

type IncomingPhoto = { data: string; angle?: string | null };

/**
 * Accepts either the new `photos: [{data, angle}]` array or the original
 * single `photo`, and returns a deduplicated, capped list.
 */
function collectPhotos(body: { photos?: unknown; photo?: unknown }): IncomingPhoto[] {
  const out: IncomingPhoto[] = [];

  if (Array.isArray(body.photos)) {
    for (const p of body.photos) {
      if (typeof p === "string") out.push({ data: p });
      else if (p && typeof (p as IncomingPhoto).data === "string") {
        out.push({ data: (p as IncomingPhoto).data, angle: (p as IncomingPhoto).angle ?? null });
      }
    }
  }
  if (typeof body.photo === "string" && !out.some(p => p.data === body.photo)) {
    out.unshift({ data: body.photo });
  }
  return out.filter(p => p.data.startsWith("data:image/")).slice(0, MAX_PHOTOS);
}

export async function POST(req: Request) {
  const body = await req.json();
  if (!body.bedId || !body.type) {
    return NextResponse.json({ error: "Missing bedId or type" }, { status: 400 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // manager/supervisor by role, or anyone a manager granted "disease_report"
  const gate = await requireCapability("disease_report");
  if (!gate.ok) return gate.response;

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
      photo:                body.photo ?? null,
      reporterNote:         body.reporterNote ?? null,
      // Every captured angle. The first is also kept in `photo` above so
      // anything still reading that column keeps working.
      photos: {
        create: collectPhotos(body).map((p, i) => ({
          kind: "symptom" as const,
          data: p.data,
          angle: p.angle ?? null,
          createdBy: session.user.id,
          createdAt: new Date(Date.now() + i), // keep capture order stable
        })),
      },
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
      message: `🚨 New disease report: ${body.bedId} — ${type.replace(/_/g, " ")} (severity ${body.severity ?? 30}%). Review and send a treatment recommendation.`,
      link:    "/diseases",
      recipientRole: "manager",
    },
  });

  return NextResponse.json({
    id:       report.id,
    ok:       true,
    notified: channels,
    details:  notifResult,
  });
}
