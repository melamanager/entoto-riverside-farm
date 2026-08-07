import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { recommendationSideEffects } from "@/lib/disease-recommend";

/**
 * One report, including the base64 photo blobs the list deliberately omits.
 * Fetched only when someone actually opens a photo.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const report = await prisma.diseaseReport.findUnique({
    where: { id },
    include: { bed: true, reporter: { omit: { photo: true } } },
  });
  if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(report);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const actorId = (session.user as { id: string }).id;

  // closing out a disease is the manager's call — supervisors confirm treatment only
  if (body.status === "resolved" && (session.user as { role: string }).role !== "manager") {
    return NextResponse.json({ error: "Only the manager can resolve a report" }, { status: 403 });
  }

  const before = await prisma.diseaseReport.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let report = await prisma.diseaseReport.update({ where: { id }, data: body });

  // Communication + task side-effects on status transitions — best effort, never fail the update.
  try {
    const label = report.type.replace(/_/g, " ");

    if (body.status === "notified" && before.status !== "notified") {
      // shared with the Telegram agent's recommend flow
      report = await recommendationSideEffects(report, actorId);
    }

    if (body.status === "treating" && before.status !== "treating") {
      // supervisor confirmed treatment → close the linked task + alert the manager
      if (report.taskId) {
        const task = await prisma.task.findUnique({ where: { id: report.taskId } });
        if (task && task.status !== "done") {
          await prisma.task.update({
            where: { id: report.taskId },
            data: {
              status: "done",
              completedAt: new Date(),
              completionNote: report.treatmentNote ?? "Treatment applied.",
              proofImageUrl: report.proofImageUrl ?? undefined,
            },
          });
        }
      }
      await prisma.notification.create({
        data: {
          type: "disease",
          channel: "in_app",
          message: `💊 Treatment applied on ${report.bedId} (${label}) — awaiting manager verification`,
          link: "/diseases",
          recipientRole: "manager",
        },
      });
    }

    if (body.status === "resolved" && before.status !== "resolved") {
      await prisma.notification.create({
        data: {
          type: "disease",
          channel: "in_app",
          message: `✅ ${report.bedId} (${label}) resolved by manager — good work`,
          link: "/diseases",
          recipientId: report.treatmentAppliedBy ?? undefined, // the supervisor who treated it
        },
      });
      // restore bed health when no active reports remain on it
      const stillActive = await prisma.diseaseReport.count({
        where: { bedId: report.bedId, status: { in: ["open", "notified", "treating"] } },
      });
      if (stillActive === 0) {
        await prisma.bed.update({ where: { id: report.bedId }, data: { health: "healthy" } });
      }
    }
  } catch (e) {
    console.error("disease status side-effect failed", e);
  }

  return NextResponse.json(report);
}
