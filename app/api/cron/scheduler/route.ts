import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTelegramToken } from "@/lib/notifications";
import { buildFarmContext } from "@/lib/farm-context";
import { todayAddis } from "@/lib/dates";
import { tg, tgSendVoice, geminiAgentTurn, speak, type LangPref } from "@/lib/telegram-agent";

export const runtime = "nodejs";

// Fires the personal ScheduledJobs created from the Telegram agent. The server
// crontab hits this every 5 minutes: GET /api/cron/scheduler?key=<CRON_SECRET>.
// A job runs once per day, at-or-after its time (catch-up semantics: a missed
// tick fires late rather than never); lastRunDate is the idempotency claim.

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const url = new URL(req.url);
  return url.searchParams.get("key") === secret || req.headers.get("x-cron-key") === secret;
}

function addisNow(): { hhmm: string; dow: number } {
  // en-GB + hour12:false for a real 24h clock — hourCycle alone was ignored on
  // this Node/ICU and silently produced 12-hour times ("22:12" became "10:12",
  // so evening jobs never fired). "24" guard: hour12:false midnight quirk.
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Addis_Ababa",
    hour: "2-digit", minute: "2-digit", hour12: false, weekday: "short",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const dow = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[get("weekday")] ?? 0;
  const hh = get("hour") === "24" ? "00" : get("hour");
  return { hhmm: `${hh}:${get("minute")}`, dow };
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const token = await getTelegramToken();
  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? process.env.GEMINI_API_KEY;
  if (!token || !key) return NextResponse.json({ ran: 0, note: "telegram or AI not configured" });

  const today = todayAddis();
  const { hhmm, dow } = addisNow();

  const candidates = await prisma.scheduledJob.findMany({
    where: { active: true, OR: [{ lastRunDate: null }, { lastRunDate: { not: today } }] },
    include: { farmer: true },
  });
  const due = candidates
    .filter((j) => (j.daysOfWeek as number[]).includes(dow) && j.timeHHMM <= hhmm)
    .slice(0, 10);

  let ran = 0;
  const results: Array<{ job: string; status: string }> = [];
  for (const job of due) {
    // claim first so a slow Gemini call can't double-fire on the next tick
    await prisma.scheduledJob.update({ where: { id: job.id }, data: { lastRunDate: today } });

    if (!job.farmer.telegramChatId) {
      results.push({ job: job.title, status: "skipped: owner not linked" });
      continue;
    }
    try {
      const role = job.farmer.role as "manager" | "supervisor" | "farmer";
      const turn = await geminiAgentTurn(key, { text: job.prompt }, {
        userName: job.farmer.name,
        role,
        langPref: (job.farmer.telegramLang ?? "auto") as LangPref,
        context: await buildFarmContext(role),
        today,
        canTakeOrders: false, // scheduled runs only report — they never propose actions
        isManager: false,
        history: [],
      });
      if (!turn || turn.kind !== "reply") throw new Error("no reply from model");

      const chatId = job.farmer.telegramChatId;
      let delivered = false;
      if (job.farmer.telegramMode === "voice") {
        const ogg = await speak(key, turn.text);
        if (ogg) delivered = !!(await tgSendVoice(token, chatId, ogg, `⏰ ${job.title}\n\n${turn.text}`))?.ok;
      }
      if (!delivered) {
        await tg(token, "sendMessage", {
          chat_id: chatId,
          text: `⏰ <b>${job.title}</b>\n\n${turn.text}`,
          parse_mode: "HTML",
        });
      }
      ran++;
      results.push({ job: job.title, status: "sent" });
    } catch (e) {
      console.error(`[scheduler] job "${job.title}" failed:`, e);
      results.push({ job: job.title, status: "error" });
    }
  }

  return NextResponse.json({ date: today, time: hhmm, due: due.length, ran, results });
}
