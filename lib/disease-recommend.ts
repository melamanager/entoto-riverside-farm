import type { DiseaseReport } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendTelegramToFarmer } from "@/lib/notifications";
import { todayAddis } from "@/lib/dates";
import { getFarmConfig } from "@/lib/config-server";

// Side-effects of a manager issuing a treatment recommendation (report already
// updated to status "notified" with managerRecommendation/treatmentSteps set):
// alert the responsible supervisor on Telegram, create-or-refresh the linked
// high-priority disease task, record channels/notifiedAt/taskId, and drop the
// in-app notification. Extracted verbatim from app/api/diseases/[id]/route.ts
// so the Telegram agent's recommend flow and the web dialog share one path.
export async function recommendationSideEffects(report: DiseaseReport, actorId: string): Promise<DiseaseReport> {
  const label = report.type.replace(/_/g, " ");

  // the responsible supervisor (bed → valve → supervisor), falling back to the reporter.
  const bed = await prisma.bed.findUnique({ where: { id: report.bedId }, include: { valve: true } });
  const assigneeId = bed?.valve?.supervisorId ?? report.reportedBy;

  // 1) alert THAT supervisor on their own Telegram
  const tg = (await getFarmConfig()).notifyDisease
    ? await sendTelegramToFarmer(
        assigneeId,
        `🩺 <b>Treatment needed — Entoto Farm</b>\n\n<b>Bed:</b> <code>${report.bedId}</code>\n<b>Disease:</b> ${label}\n\n${report.managerRecommendation ?? ""}\n\nOpen the app → Daily Tasks to confirm treatment.`
      )
    : { ok: false };
  const channels = tg.ok ? ["telegram"] : [];

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

  const updated = await prisma.diseaseReport.update({
    where: { id: report.id },
    data: { notificationChannels: channels, notifiedAt: new Date(), taskId },
  });

  await prisma.notification.create({
    data: {
      type: "disease",
      channel: tg.ok ? "telegram" : "in_app",
      message: `📋 PRIORITY: treat ${report.bedId} (${label}) — task assigned, action required today`,
      link: "/tasks",
      recipientId: assigneeId, // the responsible supervisor
    },
  });

  return updated;
}
