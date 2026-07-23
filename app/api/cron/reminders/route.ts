import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendTelegramToFarmer } from "@/lib/notifications";
import { complianceForRange } from "@/lib/compliance";
import { syncPlantingTasks } from "@/lib/planting-tasks";
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

  // due plantings become tasks first, so the nag below can include them
  const planting = await syncPlantingTasks();

  // supervisors who have linked Telegram
  const supers = await prisma.farmer.findMany({
    where: { role: "supervisor", telegramChatId: { not: null } },
    select: { id: true, name: true, supervisedValves: { select: { id: true } } },
  });
  if (supers.length === 0) return { sent: 0, plantingTasks: planting.created, note: "no linked supervisors" };

  // who has recorded routines today (attendance / watering / day-log)
  const compliance = await complianceForRange(today, today);
  const recorded = new Set(compliance.filter(c => c.recorded).map(c => c.supervisorId));

  const valveIds = supers.flatMap(s => s.supervisedValves.map(v => v.id));

  // open tasks + follow-ups due today or overdue + planting nudges, per assignee
  const [tasks, followUps, plantings] = await Promise.all([
    prisma.task.findMany({
      where: { status: { not: "done" }, dueDate: { lte: today }, assignedTo: { in: supers.map(s => s.id) } },
      select: { title: true, assignedTo: true, dueDate: true, priority: true },
    }),
    prisma.followUp.findMany({
      where: { status: { in: ["pending", "overdue"] }, dueDate: { lte: today }, assignedTo: { in: supers.map(s => s.id) } },
      select: { title: true, assignedTo: true, dueDate: true },
    }),
    prisma.plantingRecord.findMany({
      where: { valveId: { in: valveIds }, status: { in: ["planned", "planted", "growing"] } },
      select: { bedId: true, valveId: true, variety: true, status: true, plannedDate: true, expectedHarvestDate: true },
    }),
  ]);

  const valveToSuper = new Map(supers.flatMap(s => s.supervisedValves.map(v => [v.id, s.id] as const)));

  let sent = 0;
  for (const s of supers) {
    const myTasks = tasks.filter(t => t.assignedTo === s.id);
    const myFollow = followUps.filter(f => f.assignedTo === s.id);
    const myPlant = plantings.filter(p => valveToSuper.get(p.valveId) === s.id);
    const toPlant = myPlant.filter(p => p.status === "planned" && p.plannedDate <= today);
    const toHarvest = myPlant.filter(p => p.status !== "planned" && p.expectedHarvestDate <= today);
    const needsRoutines = !recorded.has(s.id);
    if (!needsRoutines && myTasks.length === 0 && myFollow.length === 0 && toPlant.length === 0 && toHarvest.length === 0) continue;

    const lines: string[] = [`☀️ <b>Good morning, ${s.name}</b>`, ""];
    if (needsRoutines) {
      lines.push("📋 Please record today's routines (attendance, watering) — otherwise the day won't count as worked.");
      lines.push("");
    }
    if (toPlant.length) {
      lines.push(`🌱 <b>To plant (${toPlant.length}):</b>`);
      toPlant.slice(0, 6).forEach(p => lines.push(`• ${p.bedId} — ${p.variety}${p.plannedDate < today ? " (overdue)" : ""}`));
      lines.push("");
    }
    if (toHarvest.length) {
      lines.push(`🍓 <b>Ready to harvest (${toHarvest.length}):</b>`);
      toHarvest.slice(0, 6).forEach(p => lines.push(`• ${p.bedId} — ${p.variety} (due ${p.expectedHarvestDate})`));
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
  return { sent, supervisors: supers.length, plantingTasks: planting.created, date: today };
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json(await run());
}
export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json(await run());
}
