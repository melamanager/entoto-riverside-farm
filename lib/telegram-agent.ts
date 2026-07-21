import { spawn } from "node:child_process";

// Voice/AI layer for the farm Telegram bot. Telegram transport helpers plus the
// Gemini pipeline: audio (or text) in → grounded JSON answer → spoken OGG out.
// Uses raw REST for Gemini so audio parts and AUDIO response modality work the
// same regardless of SDK version.

const TG = "https://api.telegram.org";
const GEMINI = "https://generativelanguage.googleapis.com/v1beta/models";
const ANSWER_MODEL = "gemini-2.5-flash";
const TTS_MODEL = "gemini-2.5-flash-preview-tts";
const TTS_VOICE = "Sulafat"; // handles Amharic + English well

export type AgentAnswer = { transcript: string; lang: "am" | "en"; reply: string };
export type LangPref = "auto" | "am" | "en";

// ── Telegram transport ────────────────────────────────────────────────────────

export async function tg(token: string, method: string, payload?: Record<string, unknown>) {
  const res = await fetch(`${TG}/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload ?? {}),
    signal: AbortSignal.timeout(30_000),
  });
  return res.json().catch(() => null);
}

export async function tgSendVoice(token: string, chatId: string | number, ogg: Buffer, caption?: string) {
  const form = new FormData();
  form.append("chat_id", String(chatId));
  form.append("voice", new Blob([new Uint8Array(ogg)], { type: "audio/ogg" }), "reply.ogg");
  if (caption) {
    form.append("caption", caption.slice(0, 1000));
    form.append("parse_mode", "HTML");
  }
  const res = await fetch(`${TG}/bot${token}/sendVoice`, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(60_000),
  });
  return res.json().catch(() => null);
}

export async function tgDownloadFile(token: string, fileId: string): Promise<{ buf: Buffer; mime: string } | null> {
  const info = await tg(token, "getFile", { file_id: fileId });
  const path: string | undefined = info?.result?.file_path;
  if (!path) return null;
  const res = await fetch(`${TG}/file/bot${token}/${path}`, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  const mime =
    path.endsWith(".mp3") ? "audio/mp3" :
    path.endsWith(".m4a") ? "audio/aac" :
    path.endsWith(".wav") ? "audio/wav" :
    "audio/ogg"; // Telegram voice notes are .oga (OGG/Opus)
  return { buf, mime };
}

// ── Gemini: transcribe + answer in one grounded call ─────────────────────────

function agentSystem(userName: string, role: string, langPref: LangPref) {
  const langRule =
    langPref === "am" ? "Always reply in Amharic, whatever language the user used." :
    langPref === "en" ? "Always reply in English, whatever language the user used." :
    "Reply in the SAME language the user used (Amharic question → Amharic answer, English → English).";
  return `You are the voice assistant of Entoto Riverside Farm, a strawberry farm above Addis Ababa. You are talking to ${userName} (role: ${role}) on Telegram.

Ground every answer ONLY in the CONTEXT block (live farm snapshot). Cite real bed IDs, kg and names from it. If the needed data is not in the context, say so briefly and name the app page to check or record it on. Never invent figures.

${langRule}

Your reply will be READ ALOUD: 1–4 short conversational sentences. No markdown, no emojis, no lists, no headings. Numbers in plain words where natural (ETB, kg).

Return STRICT JSON only: {"transcript": "<what the user said, in its original language>", "lang": "am" | "en", "reply": "<your answer>"}. "lang" is the language OF YOUR REPLY.`;
}

export async function geminiAgentAnswer(
  key: string,
  input: { audio?: { mime: string; dataB64: string }; text?: string },
  meta: { userName: string; role: string; langPref: LangPref; context: string },
): Promise<AgentAnswer | null> {
  const parts: Array<Record<string, unknown>> = [];
  if (input.audio) parts.push({ inline_data: { mime_type: input.audio.mime, data: input.audio.dataB64 } });
  parts.push({
    text: `${input.audio ? "The user sent the attached voice message." : `The user wrote: ${input.text}`}\n\nCONTEXT (live farm snapshot):\n${meta.context}`,
  });

  const res = await fetch(`${GEMINI}/${ANSWER_MODEL}:generateContent?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: agentSystem(meta.userName, meta.role, meta.langPref) }] },
      contents: [{ role: "user", parts }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.4 },
    }),
    signal: AbortSignal.timeout(60_000),
  });
  const j = await res.json().catch(() => null);
  const raw: string | undefined = j?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) {
    console.error("[tg-agent] answer failed:", JSON.stringify(j)?.slice(0, 400));
    return null;
  }
  try {
    const parsed = JSON.parse(raw.replace(/^```(?:json)?/m, "").replace(/```$/m, "").trim());
    if (typeof parsed?.reply !== "string" || !parsed.reply) return null;
    return {
      transcript: typeof parsed.transcript === "string" ? parsed.transcript : "",
      lang: parsed.lang === "am" ? "am" : "en",
      reply: parsed.reply,
    };
  } catch {
    // model ignored JSON instruction — salvage as a plain reply
    return { transcript: "", lang: "en", reply: raw.trim() };
  }
}

// ── Gemini TTS → PCM → OGG/Opus (Telegram voice format) ──────────────────────

export async function geminiTts(key: string, text: string): Promise<Buffer | null> {
  const res = await fetch(`${GEMINI}/${TTS_MODEL}:generateContent?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: TTS_VOICE } } },
      },
    }),
    signal: AbortSignal.timeout(60_000),
  });
  const j = await res.json().catch(() => null);
  const b64: string | undefined = j?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!b64) {
    console.error("[tg-agent] tts failed:", JSON.stringify(j)?.slice(0, 400));
    return null;
  }
  return Buffer.from(b64, "base64"); // raw PCM s16le mono 24 kHz
}

export function pcmToOgg(pcm: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const ff = spawn("ffmpeg", [
      "-hide_banner", "-loglevel", "error",
      "-f", "s16le", "-ar", "24000", "-ac", "1", "-i", "pipe:0",
      "-c:a", "libopus", "-b:a", "32k", "-f", "ogg", "pipe:1",
    ]);
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    ff.stdout.on("data", (d) => out.push(d));
    ff.stderr.on("data", (d) => err.push(d));
    ff.on("close", (code) =>
      code === 0 ? resolve(Buffer.concat(out)) : reject(new Error(`ffmpeg exit ${code}: ${Buffer.concat(err).toString()}`)),
    );
    ff.on("error", reject);
    ff.stdin.write(pcm);
    ff.stdin.end();
  });
}

export async function speak(key: string, text: string): Promise<Buffer | null> {
  const pcm = await geminiTts(key, text);
  if (!pcm || pcm.length < 100) return null;
  try {
    return await pcmToOgg(pcm);
  } catch (e) {
    console.error("[tg-agent] pcm→ogg failed:", e);
    return null;
  }
}
