import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto";

async function getSetting(key: string): Promise<string | null> {
  const s = await prisma.appSetting.findUnique({ where: { key } });
  if (!s?.value) return null;
  // secrets are stored encrypted at rest — decrypt for use
  return key.endsWith("_token") || key.endsWith("_key") ? decryptSecret(s.value) : s.value;
}

export async function sendSmsEthiopia(to: string, message: string) {
  const token   = await getSetting("sms_token");
  const baseUrl = await getSetting("sms_base_url") ?? "https://api.smsethiopia.com/api/sms/send";
  if (!token) return { ok: false, error: "SMS not configured" };

  const [apiKey, senderId] = token.split(":");
  // Normalise to 251XXXXXXXXX
  const phone = to.replace(/\s/g, "").replace(/^\+/, "").replace(/^0/, "251");

  try {
    const res = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ to: phone, message, sender: senderId }),
    });
    const body = await res.text();
    return { ok: res.ok, status: res.status, body };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function getTelegramToken() {
  return getSetting("telegram_token");
}

// Send to a specific chat id.
export async function sendTelegramTo(chatId: string, html: string) {
  const botToken = await getSetting("telegram_token");
  if (!botToken || !chatId) return { ok: false, error: "Telegram not configured" };
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: html, parse_mode: "HTML" }),
    });
    const data = await res.json();
    return { ok: res.ok, data };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// Send to the farm's default chat (the manager / team group).
export async function sendTelegram(html: string) {
  const chatId = await getSetting("telegram_chat_id");
  if (!chatId) return { ok: false, error: "Telegram not configured" };
  return sendTelegramTo(chatId, html);
}

// Send to a specific farmer's personal Telegram, if they've linked one.
export async function sendTelegramToFarmer(farmerId: string, html: string) {
  const farmer = await prisma.farmer.findUnique({ where: { id: farmerId }, select: { telegramChatId: true } });
  if (!farmer?.telegramChatId) return { ok: false, error: "Farmer has no Telegram linked" };
  return sendTelegramTo(farmer.telegramChatId, html);
}

export async function notifyDisease(params: {
  bedId: string;
  type: string;
  severity: number;
  supervisorPhone?: string | null;
}) {
  const label = params.type.replace(/_/g, " ");
  const smsMsg = `ENTOTO Farm Alert: ${label} detected at bed ${params.bedId} (severity ${params.severity}%). Please check the ERP system immediately.`;
  const tgMsg  = `🚨 <b>Disease Alert — Entoto Farm</b>\n\n<b>Bed:</b> <code>${params.bedId}</code>\n<b>Disease:</b> ${label}\n<b>Severity:</b> ${params.severity}%\n\nImmediate treatment required. Open the ERP: /diseases`;

  const [smsResult, tgResult] = await Promise.all([
    params.supervisorPhone ? sendSmsEthiopia(params.supervisorPhone, smsMsg) : Promise.resolve({ ok: false, error: "No phone" }),
    sendTelegram(tgMsg),
  ]);

  return { sms: smsResult, telegram: tgResult };
}
