import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sendTelegram } from "@/lib/notifications";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const before = await prisma.diseaseReport.findUnique({ where: { id }, select: { status: true } });
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let report = await prisma.diseaseReport.update({ where: { id }, data: body });

  // Communication side-effects on status transitions — best effort, never fail the update.
  try {
    const label = report.type.replace(/_/g, " ");

    if (body.status === "notified" && before.status !== "notified") {
      // manager sent a recommendation → alert the supervisor
      const tg = await sendTelegram(
        `📋 <b>Treatment Recommendation — Entoto Farm</b>\n\n<b>Bed:</b> <code>${report.bedId}</code>\n<b>Disease:</b> ${label}\n\n${report.managerRecommendation ?? ""}\n\nOpen the ERP → Diseases to confirm treatment.`
      );
      const channels = tg.ok ? ["telegram"] : [];
      report = await prisma.diseaseReport.update({ where: { id }, data: { notificationChannels: channels } });
      await prisma.notification.create({
        data: {
          type: "disease",
          channel: tg.ok ? "telegram" : "in_app",
          message: `📋 Manager recommendation ready for ${report.bedId} (${label}) — supervisor action required`,
          link: "/diseases",
        },
      });
    }

    if (body.status === "treating" && before.status !== "treating") {
      // supervisor confirmed treatment → alert the manager
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
    console.error("disease status notification failed", e);
  }

  return NextResponse.json(report);
}
