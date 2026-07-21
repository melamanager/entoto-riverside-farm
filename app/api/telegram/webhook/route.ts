import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTelegramToken } from "@/lib/notifications";
import { buildFarmContext } from "@/lib/farm-context";
import {
  tg, tgSendVoice, tgDownloadFile, geminiAgentAnswer, speak, type LangPref,
} from "@/lib/telegram-agent";

export const runtime = "nodejs";

// Telegram pushes updates here (setWebhook via /api/telegram/setup). Voice or
// text in → Gemini transcribes + answers from the live farm snapshot → replies
// as a voice note and/or text per the farmer's /language + /mode preferences.
// Linking also happens here: "/start <code>" claims the code issued on /connect.

type TgUpdate = {
  update_id?: number;
  message?: {
    message_id: number;
    chat: { id: number; type: string };
    from?: { first_name?: string };
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

// webhook retries deliver the same update_id — keep a small in-memory guard
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
  `በአማርኛ ወይም በእንግሊዝኛ <b>የድምፅ መልእክት</b> ይላኩ — ከእርሻው የቀጥታ መረጃ እመልሳለሁ።\n\n` +
  `/language — reply language · የመልስ ቋንቋ\n` +
  `/mode — voice or text replies · የመልስ አይነት\n` +
  `/help — this message`;

const NOT_LINKED =
  `This Telegram account isn't linked yet.\n\n` +
  `Open the farm app → <b>Connect Telegram</b> page, then tap the link it shows (or send /start with your code).\n\n` +
  `መለያዎ ገና አልተገናኘም። በእርሻው መተግበሪያ ውስጥ <b>Connect Telegram</b> ገጽ ላይ ያለውን ማስፈንጠሪያ ይጫኑ።`;

async function handleUpdate(update: TgUpdate) {
  const token = await getTelegramToken();
  if (!token) return;

  // ── menu button taps ────────────────────────────────────────────────────
  const cb = update.callback_query;
  if (cb) {
    const chatId = cb.message?.chat.id;
    const [kind, value] = (cb.data ?? "").split(":");
    if (chatId != null && (kind === "lang" || kind === "mode")) {
      const farmer = await prisma.farmer.findFirst({ where: { telegramChatId: String(chatId) } });
      if (!farmer) {
        await tg(token, "answerCallbackQuery", { callback_query_id: cb.id, text: "Not linked" });
        return;
      }
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

  // transcribe (if voice) + answer, grounded in the live role-aware snapshot
  const context = await buildFarmContext(farmer.role as "manager" | "supervisor" | "farmer");
  const langPref = (farmer.telegramLang ?? "auto") as LangPref;

  let input: { audio?: { mime: string; dataB64: string }; text?: string };
  if (media) {
    const file = await tgDownloadFile(token, media.file_id);
    if (!file) return void (await send("⚠️ Couldn't download that voice message — please try again."));
    input = { audio: { mime: file.mime, dataB64: file.buf.toString("base64") } };
  } else {
    input = { text };
  }

  const answer = await geminiAgentAnswer(key, input, {
    userName: farmer.name,
    role: farmer.role,
    langPref,
    context,
  });
  if (!answer) {
    return void (await send("⚠️ I couldn't process that — please try again. · ይቅርታ፣ አልተሳካም እባክዎ እንደገና ይሞክሩ።"));
  }

  // mode auto mirrors the input: voice question → voice answer, text → text
  const mode = farmer.telegramMode ?? "auto";
  const wantVoice = mode === "voice" || (mode === "auto" && !!media);

  if (wantVoice) {
    await tg(token, "sendChatAction", { chat_id: chatId, action: "record_voice" });
    const ogg = await speak(key, answer.reply);
    if (ogg) {
      const sent = await tgSendVoice(token, chatId, ogg, answer.reply);
      if (sent?.ok) return;
      console.error("[tg-webhook] sendVoice failed:", JSON.stringify(sent)?.slice(0, 300));
    }
    // TTS or upload failed — always fall back to text rather than silence
  }

  const echo = media && answer.transcript ? `🗣 <i>${answer.transcript}</i>\n\n` : "";
  await send(`${echo}${answer.reply}`);
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
