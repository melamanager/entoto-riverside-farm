import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTelegramToken, sendTelegramToFarmer } from "@/lib/notifications";
import { buildFarmContext } from "@/lib/farm-context";
import { todayAddis } from "@/lib/dates";
import { getFarmConfig } from "@/lib/config-server";
import { normalizeOrderMoney } from "@/app/api/orders/route";
import { recommendationSideEffects } from "@/lib/disease-recommend";
import {
  tg, tgSendVoice, tgDownloadFile, geminiAgentTurn, speak,
  type LangPref, type ChatTurn, type OrderProposal, type TaskProposal, type JobProposal,
} from "@/lib/telegram-agent";

export const runtime = "nodejs";

// Telegram pushes updates here (setWebhook via /api/telegram/setup). The agent
// answers voice/text questions from the live farm snapshot and takes ACTIONS —
// customer orders, task assignment, disease treatment recommendations, and
// personal scheduled AI jobs — every one proposed as a draft and executed only
// after the user taps Confirm. Linking ("/start <code>") and the /language +
// /mode menus also live here.

type TgUpdate = {
  update_id?: number;
  message?: {
    message_id: number;
    chat: { id: number; type: string };
    text?: string;
    voice?: { file_id: string; duration: number; file_size?: number };
    audio?: { file_id: string; duration: number; file_size?: number };
  };
  callback_query?: {
    id: string;
    data?: string;
    message?: { chat: { id: number }; message_id: number };
  };
};

// ── per-chat session: short conversation memory + one pending action draft ───
// In-memory is fine: single standalone Node process; drafts are minutes-old.
type Draft =
  | { kind: "order"; order: OrderProposal }
  | { kind: "task"; task: TaskProposal & { assigneeId: string } }
  | { kind: "treatment"; reportId: string; bedId: string; disease: string; steps: string[]; note?: string }
  | { kind: "schedule"; job: JobProposal }
  | { kind: "cancelJob"; jobId: string; title: string };

type Session = {
  history: ChatTurn[];
  draft?: { d: Draft; farmerId: string; voice: boolean; at: number };
  at: number;
};
const sessions = new Map<number, Session>();
const SESSION_TTL = 30 * 60_000;
const DRAFT_TTL = 10 * 60_000;

function session(chatId: number): Session {
  const now = Date.now();
  for (const [k, s] of sessions) if (now - s.at > SESSION_TTL) sessions.delete(k);
  let s = sessions.get(chatId);
  if (!s) { s = { history: [], at: now }; sessions.set(chatId, s); }
  s.at = now;
  return s;
}
function remember(s: Session, role: ChatTurn["role"], text: string) {
  s.history.push({ role, text: text.slice(0, 1500) });
  if (s.history.length > 10) s.history.splice(0, s.history.length - 10);
}

const seen = new Set<number>();
function isDuplicate(id?: number): boolean {
  if (id == null) return false;
  if (seen.has(id)) return true;
  seen.add(id);
  if (seen.size > 500) seen.delete(seen.values().next().value as number);
  return false;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const daysLabel = (days: number[]) =>
  days.length >= 7 ? "daily" : days.map((d) => DAY_NAMES[d] ?? d).join(", ");

const HELP =
  `🎙 <b>Entoto Farm assistant</b>\n\n` +
  `Send me a <b>voice message</b> in Amharic or English — I answer from today's live farm data. Typed questions work too.\n\n` +
  `Managers and supervisors can also tell me to:\n` +
  `🧾 <b>Record an order</b> — "Order for Hilton: 20 kg at 180 birr"\n` +
  `📋 <b>Assign a task</b> — "ለጫልቱ ነገ የቫልቭ 3 መስመር እንድትጠግን መድብላት"\n` +
  `⏰ <b>Schedule reports</b> — "Every day at 5pm send me the harvest summary"\n` +
  `🩺 <b>Recommend treatment</b> (manager) — "For the mildew on X-BED-01, recommend the milk spray protocol"\n\n` +
  `Everything is confirmed with a button before it's saved. · ሁሉም ከመመዝገቡ በፊት በአዝራር ይረጋገጣል።\n\n` +
  `/language — reply language · የመልስ ቋንቋ\n` +
  `/mode — voice or text replies · የመልስ አይነት\n` +
  `/help — this message`;

const NOT_LINKED =
  `This Telegram account isn't linked yet.\n\n` +
  `Open the farm app → <b>Connect Telegram</b> page, then tap the link it shows (or send /start with your code).\n\n` +
  `መለያዎ ገና አልተገናኘም። በእርሻው መተግበሪያ ውስጥ <b>Connect Telegram</b> ገጽ ላይ ያለውን ማስፈንጠሪያ ይጫኑ።`;

const CUSTOMER_TYPES = new Set(["hotel", "supermarket", "restaurant", "direct", "export"]);
const TASK_CATEGORIES = new Set(["disease", "harvest", "irrigation", "inspection", "maintenance", "general"]);
const CONFIRM_KEYBOARD = { inline_keyboard: [[
  { text: "✅ Confirm · አረጋግጥ", callback_data: "act:confirm" },
  { text: "❌ Cancel · ሰርዝ", callback_data: "act:cancel" },
]] };

// ── draft previews ────────────────────────────────────────────────────────────

function orderPreview(o: OrderProposal): string {
  const qty = Math.max(0, o.quantityKg);
  const price = Math.max(0, o.pricePerKg);
  const total = Math.round(qty * price * 100) / 100;
  const advance = Math.min(Math.max(0, o.advancePaid ?? 0), total);
  const status = advance <= 0 ? "pending" : advance >= total ? "paid" : "partial";
  const lines = [
    `🧾 <b>New order — confirm? · ትዕዛዙን ያረጋግጡ</b>`,
    ``,
    `👤 ${o.customerName}${o.phone ? ` · ${o.phone}` : ""}`,
    `⚖️ ${qty} kg × ${price.toLocaleString()} ETB = <b>${total.toLocaleString()} ETB</b>`,
    `💵 Advance: ${advance.toLocaleString()} ETB (${status})`,
  ];
  if (o.variety) lines.push(`🍓 ${o.variety}`);
  if (o.customerType && o.customerType !== "direct") lines.push(`🏷 ${o.customerType}`);
  lines.push(`🚚 Delivery: ${o.deliveryDate ?? todayAddis()}`);
  if (o.notes) lines.push(`📝 ${o.notes}`);
  return lines.join("\n");
}

function taskPreview(t: TaskProposal & { assigneeId: string }): string {
  const lines = [
    `📋 <b>New task — confirm? · ተግባሩን ያረጋግጡ</b>`,
    ``,
    `<b>${t.title}</b>`,
    `👤 ${t.assigneeName}`,
    `⚑ ${t.priority ?? "medium"} · ${t.category ?? "general"}`,
    `📅 Due: ${t.dueDate ?? todayAddis()}`,
  ];
  if (t.notes) lines.push(`📝 ${t.notes}`);
  return lines.join("\n");
}

function treatmentPreview(d: { bedId: string; disease: string; steps: string[]; note?: string }): string {
  return [
    `🩺 <b>Treatment recommendation — confirm? · ምክሩን ያረጋግጡ</b>`,
    ``,
    `🌱 Bed <code>${d.bedId}</code> — ${d.disease}`,
    d.note ? `💡 ${d.note}` : "",
    ``,
    `<b>Protocol:</b>`,
    ...d.steps.map((s, i) => `${i + 1}. ${s}`),
    ``,
    `→ The responsible supervisor gets a 🔴 high-priority task + Telegram alert.`,
  ].filter((l) => l !== "").join("\n");
}

function schedulePreview(j: JobProposal): string {
  return [
    `⏰ <b>New schedule — confirm? · መርሐግብሩን ያረጋግጡ</b>`,
    ``,
    `<b>${j.title}</b>`,
    `🕐 ${j.timeHHMM} Addis · ${daysLabel(j.daysOfWeek)}`,
    `🤖 "${j.prompt}"`,
    ``,
    `I'll run this against the live farm data and message you the result.`,
  ].join("\n");
}

// ── confirmed-draft executors ─────────────────────────────────────────────────

async function execOrder(o: OrderProposal, farmerId: string) {
  const money = normalizeOrderMoney({ quantityKg: o.quantityKg, pricePerKg: o.pricePerKg, advancePaid: o.advancePaid ?? 0 });
  if (Number(money.quantityKg) <= 0 || Number(money.pricePerKg) <= 0 || !o.customerName.trim()) return null;
  const seller = await prisma.farmer.findUnique({ where: { id: farmerId }, select: { name: true } });
  const order = await prisma.customerOrder.create({
    data: {
      customerName: o.customerName.trim(),
      customerType: (CUSTOMER_TYPES.has(o.customerType ?? "") ? o.customerType : "direct") as never,
      orderDate: todayAddis(),
      deliveryDate: o.deliveryDate ?? todayAddis(),
      variety: o.variety ?? null,
      phone: o.phone ?? null,
      notes: [o.notes, `via Telegram (${seller?.name ?? farmerId})`].filter(Boolean).join(" — "),
      ...money,
    },
  });
  try {
    await prisma.notification.create({
      data: {
        type: "message", channel: "in_app", link: "/orders", recipientRole: "manager",
        message: `🧾 Sale recorded: ${order.customerName} — ${Number(order.quantityKg)}kg for ${Number(order.totalAmount).toLocaleString()} ETB (by ${seller?.name ?? farmerId} via Telegram)`,
      },
    });
  } catch (e) { console.error("tg order notification failed", e); }
  return order;
}

async function execTask(t: TaskProposal & { assigneeId: string }, farmerId: string) {
  const assignee = await prisma.farmer.findUnique({ where: { id: t.assigneeId } });
  if (!assignee) return null;
  const task = await prisma.task.create({
    data: {
      title: t.title.trim(),
      description: t.notes ?? "",
      assignedTo: t.assigneeId,
      createdBy: farmerId, // accountability: the commanding user, same as the web form
      priority: (t.priority ?? "medium") as never,
      category: (TASK_CATEGORIES.has(t.category ?? "") ? t.category : "general") as never,
      status: "pending",
      dueDate: t.dueDate ?? todayAddis(),
    },
  });
  // same notification pair the web task form produces
  try {
    await prisma.notification.create({
      data: {
        type: "task", channel: "in_app", link: "/tasks", recipientId: task.assignedTo,
        message: `📋 New ${task.priority}-priority task assigned to you: "${task.title}" (due ${task.dueDate})`,
      },
    });
    if ((await getFarmConfig()).notifyTasks) {
      const pri = task.priority === "high" ? "🔴 PRIORITY task" : "📋 New task";
      await sendTelegramToFarmer(
        task.assignedTo,
        `${pri} — Entoto Farm\n\n<b>${task.title}</b>\n${task.description ? task.description.slice(0, 200) + "\n" : ""}Due: ${task.dueDate}\n\nOpen the app → Daily Tasks.`,
      );
    }
  } catch (e) { console.error("tg task notification failed", e); }
  return task;
}

async function execTreatment(d: { reportId: string; steps: string[]; note?: string; disease: string }, farmerId: string) {
  const report = await prisma.diseaseReport.update({
    where: { id: d.reportId },
    data: {
      status: "notified",
      managerRecommendation: d.note ?? `Treatment protocol for ${d.disease}`,
      treatmentSteps: d.steps,
      treatmentProgress: [], // fresh protocol → progress restarts
    },
  });
  return recommendationSideEffects(report, farmerId);
}

// ── main handler ─────────────────────────────────────────────────────────────

async function handleUpdate(update: TgUpdate) {
  const token = await getTelegramToken();
  if (!token) return;

  // ── button taps: prefs + draft confirm/cancel ───────────────────────────
  const cb = update.callback_query;
  if (cb) {
    const chatId = cb.message?.chat.id;
    const [kind, value] = (cb.data ?? "").split(":");
    if (chatId == null) return;
    const farmer = await prisma.farmer.findFirst({ where: { telegramChatId: String(chatId) } });
    if (!farmer) {
      return void (await tg(token, "answerCallbackQuery", { callback_query_id: cb.id, text: "Not linked" }));
    }

    if (kind === "act") {
      const s = session(chatId);
      const pending = s.draft;
      const edit = (text: string) =>
        tg(token, "editMessageText", { chat_id: chatId, message_id: cb.message!.message_id, text, parse_mode: "HTML" });

      if (value === "cancel") {
        s.draft = undefined;
        await tg(token, "answerCallbackQuery", { callback_query_id: cb.id, text: "Cancelled" });
        await edit("❌ Cancelled · ተሰርዟል");
        remember(s, "model", "[action cancelled]");
        return;
      }
      if (value !== "confirm") return;

      if (!pending || Date.now() - pending.at > DRAFT_TTL || pending.farmerId !== farmer.id) {
        await tg(token, "answerCallbackQuery", { callback_query_id: cb.id, text: "Expired — please repeat" });
        await edit("⌛ This draft expired — please tell me again.\nይህ ረቂቅ ጊዜው አልፎታል — እባክዎ እንደገና ይንገሩኝ።");
        return;
      }
      if (farmer.role !== "manager" && farmer.role !== "supervisor") {
        return void (await tg(token, "answerCallbackQuery", { callback_query_id: cb.id, text: "Not allowed" }));
      }
      const d = pending.d;
      if (d.kind === "treatment" && farmer.role !== "manager") {
        return void (await tg(token, "answerCallbackQuery", { callback_query_id: cb.id, text: "Manager only" }));
      }
      s.draft = undefined;

      try {
        if (d.kind === "order") {
          const order = await execOrder(d.order, farmer.id);
          if (!order) throw new Error("invalid order");
          await tg(token, "answerCallbackQuery", { callback_query_id: cb.id, text: "Saved ✓" });
          await edit(
            `✅ <b>Order saved · ትዕዛዙ ተመዝግቧል</b>\n\n${order.customerName} — ${Number(order.quantityKg)} kg, <b>${Number(order.totalAmount).toLocaleString()} ETB</b> (${order.paymentStatus})\n🚚 ${order.deliveryDate}\n\nSee it on the Orders page.`,
          );
          remember(s, "model", `[order saved: ${order.customerName}, ${Number(order.quantityKg)}kg, ${Number(order.totalAmount)} ETB]`);
        } else if (d.kind === "task") {
          const task = await execTask(d.task, farmer.id);
          if (!task) throw new Error("assignee vanished");
          await tg(token, "answerCallbackQuery", { callback_query_id: cb.id, text: "Assigned ✓" });
          await edit(
            `✅ <b>Task assigned · ተግባሩ ተመድቧል</b>\n\n<b>${task.title}</b>\n👤 ${d.task.assigneeName} · due ${task.dueDate}\n\nThey've been notified${task.priority === "high" ? " (priority)" : ""}.`,
          );
          remember(s, "model", `[task assigned: "${task.title}" to ${d.task.assigneeName}, due ${task.dueDate}]`);
        } else if (d.kind === "treatment") {
          const report = await execTreatment(d, farmer.id);
          await tg(token, "answerCallbackQuery", { callback_query_id: cb.id, text: "Sent ✓" });
          await edit(
            `✅ <b>Recommendation issued · ምክሩ ተልኳል</b>\n\n🌱 <code>${d.bedId}</code> — ${d.disease}\n${d.steps.length} protocol steps saved.\nThe responsible supervisor has been tasked and alerted${report.notificationChannels ? "" : ""}.`,
          );
          remember(s, "model", `[treatment recommendation issued for ${d.bedId} (${d.disease}), supervisor tasked]`);
        } else if (d.kind === "schedule") {
          const job = await prisma.scheduledJob.create({
            data: {
              farmerId: farmer.id,
              title: d.job.title,
              prompt: d.job.prompt,
              timeHHMM: d.job.timeHHMM,
              daysOfWeek: d.job.daysOfWeek,
            },
          });
          await tg(token, "answerCallbackQuery", { callback_query_id: cb.id, text: "Scheduled ✓" });
          await edit(
            `✅ <b>Scheduled · መርሐግብሩ ተይዟል</b>\n\n<b>${job.title}</b>\n🕐 ${job.timeHHMM} Addis · ${daysLabel(d.job.daysOfWeek)}\n\nSay "show my schedules" to list, or ask me to cancel it any time.`,
          );
          remember(s, "model", `[scheduled: "${job.title}" at ${job.timeHHMM} ${daysLabel(d.job.daysOfWeek)}]`);
        } else if (d.kind === "cancelJob") {
          await prisma.scheduledJob.update({ where: { id: d.jobId }, data: { active: false } });
          await tg(token, "answerCallbackQuery", { callback_query_id: cb.id, text: "Cancelled ✓" });
          await edit(`✅ Schedule "<b>${d.title}</b>" cancelled · መርሐግብሩ ተሰርዟል`);
          remember(s, "model", `[schedule cancelled: "${d.title}"]`);
        }
      } catch (e) {
        console.error("[tg-webhook] confirm failed:", e);
        await tg(token, "answerCallbackQuery", { callback_query_id: cb.id, text: "Failed" });
        await edit("⚠️ Couldn't complete that — please try again. · አልተሳካም፣ እባክዎ እንደገና ይሞክሩ።");
      }
      return;
    }

    if (kind === "lang" || kind === "mode") {
      await prisma.farmer.update({
        where: { id: farmer.id },
        data: kind === "lang" ? { telegramLang: value } : { telegramMode: value },
      });
      const label =
        kind === "lang"
          ? { auto: "🌐 Match the question", am: "🇪🇹 አማርኛ", en: "🇬🇧 English" }[value] ?? value
          : { auto: "🔁 Match my message", voice: "🎙 Always voice", text: "💬 Always text" }[value] ?? value;
      await tg(token, "answerCallbackQuery", { callback_query_id: cb.id, text: `Saved: ${label}` });
      await tg(token, "editMessageText", {
        chat_id: chatId,
        message_id: cb.message!.message_id,
        text: kind === "lang" ? `✅ Reply language: <b>${label}</b>` : `✅ Reply mode: <b>${label}</b>`,
        parse_mode: "HTML",
      });
    }
    return;
  }

  // ── messages ────────────────────────────────────────────────────────────
  const msg = update.message;
  if (!msg || msg.chat.type !== "private") return;
  const chatId = msg.chat.id;
  const send = (html: string) =>
    tg(token, "sendMessage", { chat_id: chatId, text: html, parse_mode: "HTML" });

  const text = (msg.text ?? "").trim();
  const farmer = await prisma.farmer.findFirst({ where: { telegramChatId: String(chatId) } });

  // /start [code] — greeting or account linking (was getUpdates polling pre-webhook)
  if (text.startsWith("/start")) {
    if (farmer) return void (await send(`✅ Linked as <b>${farmer.name}</b>.\n\n${HELP}`));
    const code = text.split(/\s+/)[1]?.toUpperCase();
    if (code) {
      const pending = await prisma.farmer.findFirst({
        where: { telegramLinkCode: code, telegramChatId: null },
      });
      if (pending) {
        await prisma.farmer.update({
          where: { id: pending.id },
          data: { telegramChatId: String(chatId), telegramLinkCode: null },
        });
        return void (await send(
          `✅ <b>Telegram connected</b>\n\nHi ${pending.name}! You'll get your task assignments, reminders and follow-ups here.\n\n${HELP}`,
        ));
      }
    }
    return void (await send(NOT_LINKED));
  }

  if (text === "/help") return void (await send(HELP));

  if (text === "/language") {
    return void (await tg(token, "sendMessage", {
      chat_id: chatId,
      text: "Reply language · የመልስ ቋንቋ:",
      reply_markup: { inline_keyboard: [
        [{ text: "🌐 Match the question (default)", callback_data: "lang:auto" }],
        [{ text: "🇪🇹 አማርኛ", callback_data: "lang:am" }, { text: "🇬🇧 English", callback_data: "lang:en" }],
      ] },
    }));
  }

  if (text === "/mode") {
    return void (await tg(token, "sendMessage", {
      chat_id: chatId,
      text: "Reply mode · የመልስ አይነት:",
      reply_markup: { inline_keyboard: [
        [{ text: "🔁 Match my message (default)", callback_data: "mode:auto" }],
        [{ text: "🎙 Always voice", callback_data: "mode:voice" }, { text: "💬 Always text", callback_data: "mode:text" }],
      ] },
    }));
  }

  if (!farmer) return void (await send(NOT_LINKED));

  const media = msg.voice ?? msg.audio;
  if (!media && !text) return; // stickers, photos, etc.

  if (media && media.duration > 120) {
    return void (await send("⏱ Please keep voice messages under 2 minutes. · እባክዎ የድምፅ መልእክቱ ከ2 ደቂቃ በታች ይሁን።"));
  }

  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? process.env.GEMINI_API_KEY;
  if (!key) return void (await send("⚠️ AI is not configured on the server (missing Gemini key)."));

  await tg(token, "sendChatAction", { chat_id: chatId, action: "typing" });

  const s = session(chatId);
  const role = farmer.role as "manager" | "supervisor" | "farmer";
  const canAct = role === "manager" || role === "supervisor";
  const isManager = role === "manager";

  // grounding for the action tools
  const [context, staff, myJobs, activeReports] = await Promise.all([
    buildFarmContext(role),
    canAct ? prisma.farmer.findMany({ select: { id: true, name: true, role: true } }) : Promise.resolve([]),
    canAct ? prisma.scheduledJob.findMany({ where: { farmerId: farmer.id, active: true } }) : Promise.resolve([]),
    isManager
      ? prisma.diseaseReport.findMany({ where: { status: { in: ["open", "notified"] } }, select: { id: true, bedId: true, type: true, status: true, reportedAt: true } })
      : Promise.resolve([]),
  ]);

  let input: { audio?: { mime: string; dataB64: string }; text?: string };
  if (media) {
    const file = await tgDownloadFile(token, media.file_id);
    if (!file) return void (await send("⚠️ Couldn't download that voice message — please try again."));
    input = { audio: { mime: file.mime, dataB64: file.buf.toString("base64") } };
  } else {
    input = { text };
  }

  const turn = await geminiAgentTurn(key, input, {
    userName: farmer.name,
    role,
    langPref: (farmer.telegramLang ?? "auto") as LangPref,
    context,
    today: todayAddis(),
    canTakeOrders: canAct,
    isManager,
    history: s.history,
    roster: staff.length ? staff.map((f) => `${f.name} (${f.role})`).join("\n") : undefined,
    diseasesBrief: isManager
      ? (activeReports.length
          ? activeReports.map((r) => `${r.bedId}: ${r.type.replace(/_/g, " ")} (${r.status})`).join("\n")
          : "(none right now)")
      : undefined,
    jobsBrief: canAct
      ? (myJobs.length ? myJobs.map((j) => `${j.title} — ${j.timeHHMM} ${daysLabel(j.daysOfWeek as number[])}`).join("\n") : "(none)")
      : undefined,
  });
  if (!turn) {
    return void (await send("⚠️ I couldn't process that — please try again. · ይቅርታ፣ አልተሳካም እባክዎ እንደገና ይሞክሩ።"));
  }

  remember(s, "user", turn.transcript || text || "[voice message]");
  const mode = farmer.telegramMode ?? "auto";
  const speakBack = async (t: string) => {
    if (mode === "voice" || (mode === "auto" && media)) {
      await tg(token, "sendChatAction", { chat_id: chatId, action: "record_voice" });
      const ogg = await speak(key, t);
      if (ogg) await tgSendVoice(token, chatId, ogg);
    }
  };
  const proposeDraft = async (d: Draft, preview: string, memory: string, speakText: string) => {
    s.draft = { d, farmerId: farmer.id, voice: !!media, at: Date.now() };
    remember(s, "model", memory);
    await tg(token, "sendMessage", { chat_id: chatId, text: preview, parse_mode: "HTML", reply_markup: CONFIRM_KEYBOARD });
    await speakBack(speakText);
  };

  switch (turn.kind) {
    case "order":
      return void (await proposeDraft(
        { kind: "order", order: turn.order },
        orderPreview(turn.order),
        `[proposed order: ${turn.order.customerName}, ${turn.order.quantityKg}kg @ ${turn.order.pricePerKg} ETB — awaiting confirmation]`,
        turn.speak,
      ));

    case "task": {
      // resolve the assignee by name, server-side — never trust a model-picked id
      const needle = turn.task.assigneeName.toLowerCase();
      const matches = staff.filter((f) => f.name.toLowerCase().includes(needle) || needle.includes(f.name.toLowerCase()));
      if (matches.length !== 1) {
        const msg2 = matches.length === 0
          ? `I couldn't find "${turn.task.assigneeName}" among the staff. Options:\n${staff.map((f) => `• ${f.name} (${f.role})`).join("\n")}`
          : `Several people match "${turn.task.assigneeName}": ${matches.map((f) => f.name).join(", ")} — who did you mean?`;
        remember(s, "model", msg2);
        return void (await send(msg2));
      }
      const task = { ...turn.task, assigneeName: matches[0].name, assigneeId: matches[0].id };
      return void (await proposeDraft(
        { kind: "task", task },
        taskPreview(task),
        `[proposed task: "${task.title}" → ${task.assigneeName}, due ${task.dueDate ?? todayAddis()} — awaiting confirmation]`,
        turn.speak,
      ));
    }

    case "treatment": {
      if (!isManager) return; // tool not declared for non-managers; belt and braces
      const bedId = turn.bedId.toUpperCase();
      let candidates = activeReports.filter((r) => r.bedId.toUpperCase() === bedId);
      if (turn.disease && candidates.length > 1) {
        const dn = turn.disease.toLowerCase().replace(/\s+/g, "_");
        candidates = candidates.filter((r) => r.type.toLowerCase().includes(dn) || dn.includes(r.type.toLowerCase()));
      }
      if (candidates.length === 0) {
        const msg2 = activeReports.length
          ? `No active disease report on <code>${bedId}</code>. Active reports:\n${activeReports.map((r) => `• ${r.bedId}: ${r.type.replace(/_/g, " ")} (${r.status})`).join("\n")}`
          : `There are no active disease reports right now.`;
        remember(s, "model", msg2);
        return void (await send(msg2));
      }
      // newest report wins if still ambiguous
      const report = candidates.sort((x, y) => +new Date(y.reportedAt) - +new Date(x.reportedAt))[0];
      const disease = report.type.replace(/_/g, " ");
      return void (await proposeDraft(
        { kind: "treatment", reportId: report.id, bedId: report.bedId, disease, steps: turn.steps, note: turn.note },
        treatmentPreview({ bedId: report.bedId, disease, steps: turn.steps, note: turn.note }),
        `[proposed treatment recommendation for ${report.bedId} (${disease}), ${turn.steps.length} steps — awaiting confirmation]`,
        turn.speak,
      ));
    }

    case "schedule":
      return void (await proposeDraft(
        { kind: "schedule", job: turn.job },
        schedulePreview(turn.job),
        `[proposed schedule: "${turn.job.title}" ${turn.job.timeHHMM} ${daysLabel(turn.job.daysOfWeek)} — awaiting confirmation]`,
        turn.speak,
      ));

    case "listJobs": {
      const list = myJobs.length
        ? `⏰ <b>Your schedules · መርሐግብሮችዎ</b>\n\n` +
          myJobs.map((j, i) => `${i + 1}. <b>${j.title}</b> — ${j.timeHHMM} Addis · ${daysLabel(j.daysOfWeek as number[])}`).join("\n") +
          `\n\nAsk me to cancel any of them by name.`
        : `You have no scheduled jobs yet. Try: "Every day at 5pm send me the harvest summary". · ምንም መርሐግብር የለዎትም።`;
      remember(s, "model", list.replace(/<[^>]+>/g, ""));
      return void (await send(list));
    }

    case "cancelJob": {
      const needle = turn.jobRef.toLowerCase();
      const matches = myJobs.filter((j) => j.title.toLowerCase().includes(needle) || needle.includes(j.title.toLowerCase()));
      if (matches.length !== 1) {
        const msg2 = matches.length === 0
          ? (myJobs.length
              ? `I couldn't match "${turn.jobRef}". Your schedules:\n${myJobs.map((j) => `• ${j.title} (${j.timeHHMM})`).join("\n")}`
              : `You have no active schedules to cancel.`)
          : `Several schedules match: ${matches.map((j) => j.title).join(", ")} — which one?`;
        remember(s, "model", msg2);
        return void (await send(msg2));
      }
      return void (await proposeDraft(
        { kind: "cancelJob", jobId: matches[0].id, title: matches[0].title },
        `🗑 <b>Cancel schedule? · መርሐግብሩ ይሰረዝ?</b>\n\n<b>${matches[0].title}</b> — ${matches[0].timeHHMM} Addis`,
        `[proposed cancelling schedule "${matches[0].title}" — awaiting confirmation]`,
        turn.speak,
      ));
    }

    default: {
      // plain answer
      remember(s, "model", turn.text);
      const wantVoice = mode === "voice" || (mode === "auto" && !!media);
      if (wantVoice) {
        await tg(token, "sendChatAction", { chat_id: chatId, action: "record_voice" });
        const ogg = await speak(key, turn.text);
        if (ogg) {
          const sent = await tgSendVoice(token, chatId, ogg, turn.text);
          if (sent?.ok) return;
        }
        // TTS or upload failed — always fall back to text rather than silence
      }
      const echo = media && turn.transcript ? `🗣 <i>${turn.transcript}</i>\n\n` : "";
      await send(`${echo}${turn.text}`);
    }
  }
}

export async function POST(req: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret || req.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const update = (await req.json().catch(() => null)) as TgUpdate | null;
  if (!update || isDuplicate(update.update_id)) return NextResponse.json({ ok: true });

  // ack Telegram immediately; the pipeline (STT→answer→TTS) continues async —
  // the standalone Node server keeps detached promises running
  void handleUpdate(update).catch((e) => console.error("[tg-webhook]", e));
  return NextResponse.json({ ok: true });
}
