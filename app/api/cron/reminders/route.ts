import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendTelegramToFarmer } from "@/lib/notifications";
import { complianceForRange } from "@/lib/compliance";
import { todayAddis } from "@/lib/dates";

export const runtime = "nodejs";

// Protected by a shared secret so only the server cron can trigger it.
// Call: GET /api/cron/reminders?key=<CRON_SECRET>
function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const url = new URL(req.url);
  return url.searchParams.get("key") === secret || req.headers.get("x-cron-key") === secret;
}

async function run() {
  const today = todayAddis();

  // supervisors who have linked Telegram
  const supers = await prisma.farmer.findMany({
    where: { role: "supervisor", telegramChatId: { not: null } },
    select: { id: true, name: true },
  });
  if (supers.length === 0) return { sent: 0, note: "no linked supervisors" };

  // who has recorded routines today (attendance / watering / day-log)
  const compliance = await complianceForRange(today, today);
  const recorded = new Set(compliance.filter(c => c.recorded).map(c => c.supervisorId));

  // open tasks + follow-ups due today or overdue, grouped by assignee
  const [tasks, followUps] = await Promise.all([
    prisma.task.findMany({
      where: { status: { not: "done" }, dueDate: { lte: today }, assignedTo: { in: supers.map(s => s.id) } },
      select: { title: true, assignedTo: true, dueDate: true, priority: true },
    }),
    prisma.followUp.findMany({
      where: { status: { in: ["pending", "overdue"] }, dueDate: { lte: today }, assignedTo: { in: supers.map(s => s.id) } },
      select: { title: true, assignedTo: true, dueDate: true },
    }),
  ]);

  let sent = 0;
  for (const s of supers) {
    const myTasks = tasks.filter(t => t.assignedTo === s.id);
    const myFollow = followUps.filter(f => f.assignedTo === s.id);
    const needsRoutines = !recorded.has(s.id);
    if (!needsRoutines && myTasks.length === 0 && myFollow.length === 0) continue; // nothing to nag about

    const lines: string[] = [`☀️ <b>Good morning, ${s.name}</b>`, ""];
    if (needsRoutines) {
      lines.push("📋 Please record today's routines (attendance, watering) — otherwise the day won't count as worked.");
      lines.push("");
    }
    if (myTasks.length) {
      lines.push(`✅ <b>Tasks to do (${myTasks.length}):</b>`);
      myTasks.slice(0, 6).forEach(t => lines.push(`• ${t.priority === "high" ? "🔴 " : ""}${t.title}${t.dueDate < today ? " (overdue)" : ""}`));
      lines.push("");
    }
    if (myFollow.length) {
      lines.push(`🔔 <b>Follow-ups (${myFollow.length}):</b>`);
      myFollow.slice(0, 6).forEach(f => lines.push(`• ${f.title}${f.dueDate < today ? " (overdue)" : ""}`));
    }
    const r = await sendTelegramToFarmer(s.id, lines.join("\n").trim());
    if (r.ok) sent++;
  }
  return { sent, supervisors: supers.length, date: today };
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json(await run());
}
export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json(await run());
}
