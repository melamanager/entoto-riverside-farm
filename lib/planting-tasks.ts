import { prisma } from "@/lib/prisma";
import { todayAddis } from "@/lib/dates";
import { getFarmConfig } from "@/lib/config-server";
import { sendTelegramToFarmer } from "@/lib/notifications";

// Turn due plantings into actual work: for every planting still "planned" whose
// planned date has arrived, create one task for the bed's responsible
// supervisor (idempotent via PlantingRecord.taskId, mirroring the disease
// flow). The task then rides the normal task + morning-reminder pipeline.
export async function syncPlantingTasks(): Promise<{ created: number }> {
  const today = todayAddis();
  const due = await prisma.plantingRecord.findMany({
    where: { status: "planned", plannedDate: { lte: today } },
    include: { bed: { include: { valve: true } } },
  });

  let created = 0;
  for (const p of due) {
    if (p.taskId) {
      const existing = await prisma.task.findUnique({ where: { id: p.taskId } });
      if (existing && existing.status !== "done") continue; // already tasked, still open
    }

    const assigneeId = p.bed?.valve?.supervisorId ?? p.createdBy;
    const overdue = p.plannedDate < today;
    const task = await prisma.task.create({
      data: {
        title: `Plant ${p.bedId}: ${p.variety}`,
        description:
          `Plant ${p.variety} on bed ${p.bedId} — ${p.seedsPerMeter}/m, seed source ${p.seedSource}. ` +
          `Planned for ${p.plannedDate}. When done, mark the planting "planted" in the Planting page.`,
        assignedTo: assigneeId,
        createdBy: p.createdBy, // the planner owns the resulting task
        bedId: p.bedId,
        valveId: p.valveId,
        category: "general",
        priority: overdue ? "high" : "medium",
        status: "pending",
        dueDate: overdue ? today : p.plannedDate,
      },
    });
    await prisma.plantingRecord.update({ where: { id: p.id }, data: { taskId: task.id } });

    try {
      await prisma.notification.create({
        data: {
          type: "task", channel: "in_app", link: "/tasks", recipientId: assigneeId,
          message: `🌱 ${overdue ? "OVERDUE — " : ""}Planting due: ${p.bedId} — ${p.variety} (planned ${p.plannedDate})`,
        },
      });
      if ((await getFarmConfig()).notifyTasks) {
        await sendTelegramToFarmer(
          assigneeId,
          `🌱 <b>${overdue ? "OVERDUE planting" : "Planting due"} — Entoto Farm</b>\n\n` +
          `<b>${p.bedId}</b>: ${p.variety}\nSeed: ${p.seedSource} (${p.seedsPerMeter}/m)\nPlanned: ${p.plannedDate}\n\n` +
          `Open the app → Daily Tasks.`,
        );
      }
    } catch (e) {
      console.error("planting task notification failed", e);
    }
    created++;
  }
  return { created };
}
