import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTelegramToken } from "@/lib/notifications";
import { buildFarmContext } from "@/lib/farm-context";
import { todayAddis } from "@/lib/dates";
import { normalizeOrderMoney } from "@/app/api/orders/route";
import {
  tg, tgSendVoice, tgDownloadFile, geminiAgentTurn, speak,
  type LangPref, type ChatTurn, type OrderProposal,
} from "@/lib/telegram-agent";

export const runtime = "nodejs";

// Telegram pushes updates here (setWebhook via /api/telegram/setup). The agent
// answers voice/text questions from the live farm snapshot AND takes customer
// orders conversationally: Gemini slot-fills the order via forced tool calls,
// the user confirms with a button, and only then is the order written through
// the same normalization the web order form uses. Linking ("/start <code>")
// and the /language + /mode preference menus also live here.

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

// ── per-chat session: short conversation memory + pending order draft ────────
// In-memory is fine: single standalone Node process; drafts are minutes-old.
type Session = {
  history: ChatTurn[];
  draft?: { order: OrderProposal; farmerId: string; voice: boolean; at: number };
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

const HELP =
  `🎙 <b>Entoto Farm assistant</b>\n\n` +
  `Send me a <b>voice message</b> in Amharic or English — I answer from today's live farm data (beds, harvest, tasks, attendance…). Typed questions work too.\n\n` +
  `🧾 Managers and supervisors can also <b>record customer orders</b> by just telling me — e.g. <i>"ለአልማዝ 12 ኪሎ በ150 ብር ነገ"</i> or <i>"Order for Hilton: 20 kg at 180 birr, deliver Friday"</i>. I'll confirm before saving.\n\n` +
  `በአማርኛ ወይም በእንግሊዝኛ <b>የድምፅ መልእክት</b> ይላኩ — ከእርሻው የቀጥታ መረጃ እመልሳለሁ፤ የደንበኛ ትዕዛዝም መመዝገብ እችላለሁ።\n\n` +
  `/language — reply language · የመልስ ቋንቋ\n` +
  `/mode — voice or text replies · የመልስ አይነት\n` +
  `/help — this message`;

const NOT_LINKED =
  `This Telegram account isn't linked yet.\n\n` +
  `Open the farm app → <b>Connect Telegram</b> page, then tap the link it shows (or send /start with your code).\n\n` +
  `መለያዎ ገና አልተገናኘም። በእርሻው መተግበሪያ ውስጥ <b>Connect Telegram</b> ገጽ ላይ ያለውን ማስፈንጠሪያ ይጫኑ።`;

const CUSTOMER_TYPES = new Set(["hotel", "supermarket", "restaurant", "direct", "export"]);

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

async function createOrderFromDraft(draft: { order: OrderProposal; farmerId: string }) {
  const o = draft.order;
  const money = normalizeOrderMoney({ quantityKg: o.quantityKg, pricePerKg: o.pricePerKg, advancePaid: o.advancePaid ?? 0 });
  if (Number(money.quantityKg) <= 0 || Number(money.pricePerKg) <= 0 || !o.customerName.trim()) {
    return null;
  }
  const seller = await prisma.farmer.findUnique({ where: { id: draft.farmerId }, select: { name: true } });
  const order = await prisma.customerOrder.create({
    data: {
      customerName: o.customerName.trim(),
      customerType: (CUSTOMER_TYPES.has(o.customerType ?? "") ? o.customerType : "direct") as never,
      orderDate: todayAddis(),
      deliveryDate: o.deliveryDate ?? todayAddis(),
      variety: o.variety ?? null,
      phone: o.phone ?? null,
      notes: [o.notes, `via Telegram (${seller?.name ?? draft.farmerId})`].filter(Boolean).join(" — "),
      ...money,
    },
  });
  // same accountability notification the web order form produces
  try {
    await prisma.notification.create({
      data: {
        type: "message",
        channel: "in_app",
        message: `🧾 Sale recorded: ${order.customerName} — ${Number(order.quantityKg)}kg for ${Number(order.totalAmount).toLocaleString()} ETB (by ${seller?.name ?? draft.farmerId} via Telegram)`,
        link: "/orders",
        recipientRole: "manager",
      },
    });
  } catch (e) { console.error("tg order notification failed", e); }
  return order;
}

async function handleUpdate(update: TgUpdate) {
  const token = await getTelegramToken();
  if (!token) return;

  // ── button taps: prefs + order confirm/cancel ───────────────────────────
  const cb = update.callback_query;
  if (cb) {
    const chatId = cb.message?.chat.id;
    const [kind, value] = (cb.data ?? "").split(":");
    if (chatId == null) return;
    const farmer = await prisma.farmer.findFirst({ where: { telegramChatId: String(chatId) } });
    if (!farmer) {
      return void (await tg(token, "answerCallbackQuery", { callback_query_id: cb.id, text: "Not linked" }));
    }

    if (kind === "order") {
      const s = session(chatId);
      const draft = s.draft;
      const edit = (text: string) =>
        tg(token, "editMessageText", { chat_id: chatId, message_id: cb.message!.message_id, text, parse_mode: "HTML" });

      if (value === "cancel") {
        s.draft = undefined;
        await tg(token, "answerCallbackQuery", { callback_query_id: cb.id, text: "Cancelled" });
        await edit("❌ Order cancelled · ትዕዛዙ ተሰርዟል");
        remember(s, "model", "[order cancelled]");
        return;
      }
      if (value === "confirm") {
        if (!draft || Date.now() - draft.at > DRAFT_TTL || draft.farmerId !== farmer.id) {
          await tg(token, "answerCallbackQuery", { callback_query_id: cb.id, text: "Expired — please repeat the order" });
          await edit("⌛ This order draft expired — please tell me the order again.\nይህ ረቂቅ ጊዜው አልፎታል — ትዕዛዙን እንደገና ይንገሩኝ።");
          return;
        }
        if (farmer.role !== "manager" && farmer.role !== "supervisor") {
          return void (await tg(token, "answerCallbackQuery", { callback_query_id: cb.id, text: "Not allowed" }));
        }
        const order = await createOrderFromDraft(draft);
        s.draft = undefined;
        if (!order) {
          await tg(token, "answerCallbackQuery", { callback_query_id: cb.id, text: "Invalid order" });
          await edit("⚠️ Couldn't save the order — the details were incomplete. Please repeat it.");
          return;
        }
        await tg(token, "answerCallbackQuery", { callback_query_id: cb.id, text: "Saved ✓" });
        await edit(
          `✅ <b>Order saved · ትዕዛዙ ተመዝግቧል</b>\n\n${order.customerName} — ${Number(order.quantityKg)} kg, <b>${Number(order.totalAmount).toLocaleString()} ETB</b> (${order.paymentStatus})\n🚚 ${order.deliveryDate}\n\nSee it on the Orders page.`,
        );
        remember(s, "model", `[order saved: ${order.customerName}, ${Number(order.quantityKg)}kg, ${Number(order.totalAmount)} ETB]`);
        return;
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
  const context = await buildFarmContext(farmer.role as "manager" | "supervisor" | "farmer");
  const langPref = (farmer.telegramLang ?? "auto") as LangPref;
  const canTakeOrders = farmer.role === "manager" || farmer.role === "supervisor";

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
    role: farmer.role,
    langPref,
    context,
    today: todayAddis(),
    canTakeOrders,
    history: s.history,
  });
  if (!turn) {
    return void (await send("⚠️ I couldn't process that — please try again. · ይቅርታ፣ አልተሳካም እባክዎ እንደገና ይሞክሩ።"));
  }

  remember(s, "user", turn.transcript || text || "[voice message]");

  // ── order proposal: draft + confirm buttons; nothing saved yet ──────────
  if (turn.kind === "order") {
    s.draft = { order: turn.order, farmerId: farmer.id, voice: !!media, at: Date.now() };
    remember(s, "model",
      `[proposed order: ${turn.order.customerName}, ${turn.order.quantityKg}kg @ ${turn.order.pricePerKg} ETB` +
      `${turn.order.deliveryDate ? ", deliver " + turn.order.deliveryDate : ""} — awaiting confirmation]`);
    await tg(token, "sendMessage", {
      chat_id: chatId,
      text: orderPreview(turn.order),
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: [[
        { text: "✅ Confirm · አረጋግጥ", callback_data: "order:confirm" },
        { text: "❌ Cancel · ሰርዝ", callback_data: "order:cancel" },
      ]] },
    });
    // voice interactions also get the confirmation question spoken
    const mode = farmer.telegramMode ?? "auto";
    if (mode === "voice" || (mode === "auto" && media)) {
      await tg(token, "sendChatAction", { chat_id: chatId, action: "record_voice" });
      const ogg = await speak(key, turn.speak);
      if (ogg) await tgSendVoice(token, chatId, ogg);
    }
    return;
  }

  // ── plain answer ────────────────────────────────────────────────────────
  remember(s, "model", turn.text);
  const mode = farmer.telegramMode ?? "auto";
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
