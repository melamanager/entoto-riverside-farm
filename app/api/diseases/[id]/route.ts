import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sendTelegram } from "@/lib/notifications";
import { todayAddis } from "@/lib/dates";
import { getFarmConfig } from "@/lib/config";

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
      // 1) alert the supervisor
      const tg = (await getFarmConfig()).notifyDisease
        ? await sendTelegram(
            `📋 <b>Treatment Recommendation — Entoto Farm</b>\n\n<b>Bed:</b> <code>${report.bedId}</code>\n<b>Disease:</b> ${label}\n\n${report.managerRecommendation ?? ""}\n\nOpen the ERP → Diseases to confirm treatment.`
          )
        : { ok: false };
      const channels = tg.ok ? ["telegram"] : [];

      // 2) turn the recommendation into a PRIORITY daily task for the responsible
      //    supervisor (bed → valve → supervisor), falling back to the reporter.
      const bed = await prisma.bed.findUnique({ where: { id: report.bedId }, include: { valve: true } });
      const assigneeId = bed?.valve?.supervisorId ?? report.reportedBy;
      const steps = Array.isArray(report.treatmentSteps) ? (report.treatmentSteps as string[]) : [];
      const desc = `${report.managerRecommendation ?? report.suggestedTreatment}` +
        (steps.length ? `\n\nProtocol:\n${steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}` : "");

      let taskId = report.taskId;
      if (taskId) {
        // re-send: refresh the existing task instead of duplicating
        const existing = await prisma.task.findUnique({ where: { id: taskId } });
        if (existing && existing.status !== "done") {
          await prisma.task.update({
            where: { id: taskId },
            data: { description: desc, priority: "high", dueDate: todayAddis(), requiresImageProof: report.requiresImageProof ?? false },
          });
        } else {
          taskId = null; // previous task gone/done → make a fresh one
        }
      }
      if (!taskId) {
        const task = await prisma.task.create({
          data: {
            title: `Treat ${report.bedId}: ${label}`,
            description: desc,
            assignedTo: assigneeId,
            createdBy: actorId,
            bedId: report.bedId,
            valveId: bed?.valveId,
            category: "disease",
            priority: "high",
            status: "pending",
            dueDate: todayAddis(),
            requiresImageProof: report.requiresImageProof ?? false,
          },
        });
        taskId = task.id;
      }

      report = await prisma.diseaseReport.update({
        where: { id },
        data: { notificationChannels: channels, notifiedAt: new Date(), taskId },
      });

      await prisma.notification.create({
        data: {
          type: "disease",
          channel: tg.ok ? "telegram" : "in_app",
          message: `📋 PRIORITY: treat ${report.bedId} (${label}) — task assigned, action required today`,
          link: "/tasks",
        },
      });
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
        },
      });
    }

    if (body.status === "resolved" && before.status !== "resolved") {
      await prisma.notification.create({
        data: {
          type: "disease",
          channel: "in_app",
          message: `✅ ${report.bedId} (${label}) marked resolved by manager`,
          link: "/diseases",
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
