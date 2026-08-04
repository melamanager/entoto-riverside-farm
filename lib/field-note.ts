import { prisma } from "@/lib/prisma";
import { sendTelegramToFarmer } from "@/lib/notifications";

// A free-text note written at logging time (harvest, packaging…) is a message
// from the field to the manager — "3 kg spoiled", "birds got into A-04".
// Surface it immediately: in-app notification for managers, plus Telegram for
// every manager who has linked their chat. Best-effort, never fails the log.
export async function notifyFieldNote(opts: {
  area: "Harvest" | "Packaging";
  refText: string; // what the note is about, e.g. "A-BED-04 · 12 kg (grade B)"
  note: string;
  byId: string;    // farmerId of the writer
}) {
  const note = opts.note.trim();
  if (!note) return;
  try {
    const by = await prisma.farmer.findUnique({ where: { id: opts.byId }, select: { name: true } });
    const who = by?.name ?? opts.byId;
    await prisma.notification.create({
      data: {
        type: "message",
        channel: "in_app",
        message: `📝 ${opts.area} note from ${who} — ${opts.refText}: “${note.slice(0, 300)}”`,
        link: opts.area === "Packaging" ? "/packaging" : "/harvest",
        recipientRole: "manager",
      },
    });
    const managers = await prisma.farmer.findMany({
      where: { role: "manager", telegramChatId: { not: null } },
      select: { id: true },
    });
    for (const m of managers) {
      await sendTelegramToFarmer(
        m.id,
        `📝 <b>${opts.area} field note — Entoto Farm</b>\n${opts.refText}\n\n${note.slice(0, 500)}\n\n— ${who}`,
      );
    }
  } catch (e) {
    console.error("field note notify failed", e);
  }
}
