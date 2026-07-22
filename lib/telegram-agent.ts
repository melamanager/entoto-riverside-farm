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

export type LangPref = "auto" | "am" | "en";
export type ChatTurn = { role: "user" | "model"; text: string };

export type OrderProposal = {
  customerName: string;
  quantityKg: number;
  pricePerKg: number;
  advancePaid?: number;
  customerType?: string;
  variety?: string;
  phone?: string;
  deliveryDate?: string;
  notes?: string;
};

export type TaskProposal = {
  title: string;
  assigneeName: string;
  dueDate?: string;
  priority?: "low" | "medium" | "high";
  category?: string;
  notes?: string;
};

export type JobProposal = { title: string; prompt: string; timeHHMM: string; daysOfWeek: number[] };

export type AgentTurn =
  | { kind: "reply"; transcript: string; lang: "am" | "en"; text: string }
  | { kind: "order"; transcript: string; lang: "am" | "en"; speak: string; order: OrderProposal }
  | { kind: "task"; transcript: string; lang: "am" | "en"; speak: string; task: TaskProposal }
  | { kind: "treatment"; transcript: string; lang: "am" | "en"; speak: string; bedId: string; disease?: string; steps: string[]; note?: string }
  | { kind: "schedule"; transcript: string; lang: "am" | "en"; speak: string; job: JobProposal }
  | { kind: "listJobs"; transcript: string; lang: "am" | "en" }
  | { kind: "cancelJob"; transcript: string; lang: "am" | "en"; speak: string; jobRef: string };

// ── Telegram transport ────────────────────────────────────────────────────────

export async function tg(token: string, method: string, payload?: Record<string, unknown>) {
  const res = await fetch(`${TG}/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload ?? {}),
    signal: AbortSignal.timeout(30_000),
  });
  const j = await res.json().catch(() => null);
  if (j && j.ok === false) console.error(`[tg] ${method} failed:`, j.description);
  return j;
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

// ── Gemini agent turn: forced tool call — reply OR propose_order ─────────────
// Every model turn must come back through exactly one declared function
// (tool_config mode ANY), which gives us structured output without JSON-parse
// fragility AND lets the model take actions. Add future tools here.

const REPLY_DECL = {
  name: "reply",
  description: "Answer the user with short speakable text. Also used to ask for missing order details.",
  parameters: {
    type: "OBJECT",
    properties: {
      transcript: { type: "STRING", description: "Verbatim transcript of the user's message, in its original language" },
      lang: { type: "STRING", enum: ["am", "en"], description: "Language of your reply" },
      text: { type: "STRING", description: "The answer. Plain speakable text: 1-4 short sentences, no markdown/emojis/lists" },
    },
    required: ["transcript", "lang", "text"],
  },
};

const ORDER_DECL = {
  name: "propose_order",
  description:
    "Propose a customer strawberry order. The user then confirms via buttons before it is saved. " +
    "Call ONLY when customerName, quantityKg and pricePerKg are ALL explicitly stated by the user " +
    "(in this or earlier turns). If anything required is missing or ambiguous, call reply and ask for it. " +
    "If the user corrects a pending order, call propose_order again with the corrected values.",
  parameters: {
    type: "OBJECT",
    properties: {
      transcript: { type: "STRING", description: "Verbatim transcript of the user's message, in its original language" },
      lang: { type: "STRING", enum: ["am", "en"] },
      speak: { type: "STRING", description: "Short spoken confirmation question in the user's language summarising the order and asking to confirm" },
      customerName: { type: "STRING" },
      quantityKg: { type: "NUMBER" },
      pricePerKg: { type: "NUMBER", description: "ETB per kg" },
      advancePaid: { type: "NUMBER", description: "ETB already paid, omit if none" },
      customerType: { type: "STRING", enum: ["hotel", "supermarket", "restaurant", "direct", "export"], description: "Omit if not stated; defaults to direct" },
      variety: { type: "STRING", description: "Strawberry variety, only if stated" },
      phone: { type: "STRING", description: "Customer phone, only if stated" },
      deliveryDate: { type: "STRING", description: "YYYY-MM-DD; convert relative dates (tomorrow/ነገ) using today's date" },
      notes: { type: "STRING" },
    },
    required: ["transcript", "lang", "speak", "customerName", "quantityKg", "pricePerKg"],
  },
};

const TASK_DECL = {
  name: "create_task",
  description:
    "Propose a farm task assignment; the user confirms via buttons before it is saved. Call ONLY when the task " +
    "title and the assignee are clear. assigneeName must be one of the STAFF names. If the assignee or the work " +
    "is unclear, call reply and ask.",
  parameters: {
    type: "OBJECT",
    properties: {
      transcript: { type: "STRING" },
      lang: { type: "STRING", enum: ["am", "en"] },
      speak: { type: "STRING", description: "Short spoken confirmation question in the user's language summarising the task" },
      title: { type: "STRING", description: "Short imperative task title" },
      assigneeName: { type: "STRING", description: "Name of the staff member from the STAFF list" },
      dueDate: { type: "STRING", description: "YYYY-MM-DD; convert relative dates using today's date; omit for today" },
      priority: { type: "STRING", enum: ["low", "medium", "high"] },
      category: { type: "STRING", enum: ["disease", "harvest", "irrigation", "inspection", "maintenance", "general"] },
      notes: { type: "STRING", description: "Longer description/details, if given" },
    },
    required: ["transcript", "lang", "speak", "title", "assigneeName"],
  },
};

const RECOMMEND_DECL = {
  name: "recommend_treatment",
  description:
    "MANAGER ONLY. Issue a treatment recommendation for an ACTIVE disease report (see ACTIVE DISEASE REPORTS). " +
    "After the manager confirms, the responsible supervisor automatically gets a high-priority treatment task and " +
    "a Telegram alert. bedId must be a bed with an active report. steps: 3-6 short imperative protocol steps, " +
    "natural/organic-first (milk or baking-soda spray for mildew, drainage for root rot, neem for leaf spot); " +
    "chemicals only as last resort. If the user asked generally about disease, answer with reply instead.",
  parameters: {
    type: "OBJECT",
    properties: {
      transcript: { type: "STRING" },
      lang: { type: "STRING", enum: ["am", "en"] },
      speak: { type: "STRING", description: "Short spoken confirmation question summarising bed, disease and protocol" },
      bedId: { type: "STRING", description: "Bed id of the active disease report, e.g. X-BED-01" },
      disease: { type: "STRING", description: "Disease name, to disambiguate if the bed has several reports" },
      steps: { type: "ARRAY", items: { type: "STRING" }, description: "Ordered protocol steps" },
      note: { type: "STRING", description: "One-line summary recommendation shown above the steps" },
    },
    required: ["transcript", "lang", "speak", "bedId", "steps"],
  },
};

const SCHEDULE_DECL = {
  name: "schedule_job",
  description:
    "Propose a recurring personal AI job (confirmed via buttons): at the given time the assistant runs the prompt " +
    "against the live farm data and sends the result to this user on Telegram. Examples: daily harvest summary at " +
    "17:00, Monday-morning attendance check. Times are Africa/Addis_Ababa, 24h.",
  parameters: {
    type: "OBJECT",
    properties: {
      transcript: { type: "STRING" },
      lang: { type: "STRING", enum: ["am", "en"] },
      speak: { type: "STRING", description: "Short spoken confirmation question in the user's language" },
      title: { type: "STRING", description: "Short label, e.g. 'Daily harvest summary'" },
      prompt: { type: "STRING", description: "What the assistant should report each time, phrased as a question/instruction" },
      time: { type: "STRING", description: "HH:MM 24-hour, Africa/Addis_Ababa" },
      daysOfWeek: { type: "ARRAY", items: { type: "NUMBER" }, description: "Days 0-6 (0=Sunday); omit for every day" },
    },
    required: ["transcript", "lang", "speak", "title", "prompt", "time"],
  },
};

const LIST_JOBS_DECL = {
  name: "list_jobs",
  description: "List the user's scheduled AI jobs. Call when they ask what schedules/reminders they have.",
  parameters: {
    type: "OBJECT",
    properties: {
      transcript: { type: "STRING" },
      lang: { type: "STRING", enum: ["am", "en"] },
    },
    required: ["transcript", "lang"],
  },
};

const CANCEL_JOB_DECL = {
  name: "cancel_job",
  description: "Propose cancelling one of the user's scheduled AI jobs (confirmed via buttons). jobRef is the job title or a distinctive part of it (see MY SCHEDULED JOBS).",
  parameters: {
    type: "OBJECT",
    properties: {
      transcript: { type: "STRING" },
      lang: { type: "STRING", enum: ["am", "en"] },
      speak: { type: "STRING", description: "Short spoken confirmation question" },
      jobRef: { type: "STRING" },
    },
    required: ["transcript", "lang", "speak", "jobRef"],
  },
};

export type AgentMeta = {
  userName: string; role: string; langPref: LangPref; context: string;
  today: string; canTakeOrders: boolean; isManager: boolean; history: ChatTurn[];
  roster?: string;       // "id — name (role)" lines, for assignee resolution
  diseasesBrief?: string; // active disease reports, for recommend_treatment
  jobsBrief?: string;     // the user's scheduled jobs, for list/cancel
};

function agentSystem(opts: AgentMeta) {
  const langRule =
    opts.langPref === "am" ? "Always reply in Amharic, whatever language the user used." :
    opts.langPref === "en" ? "Always reply in English, whatever language the user used." :
    "Reply in the SAME language the user used (Amharic → Amharic, English → English).";

  const powers: string[] = [];
  if (opts.canTakeOrders) {
    powers.push(
      `- RECORD CUSTOMER ORDERS (propose_order). Required: customer name, quantity kg, price per kg in ETB.`,
      `- ASSIGN TASKS (create_task) to staff from the STAFF list.`,
      `- SCHEDULE recurring AI reports/reminders for this user (schedule_job); list them (list_jobs); cancel one (cancel_job).`,
    );
  }
  if (opts.isManager) {
    powers.push(`- ISSUE DISEASE TREATMENT RECOMMENDATIONS (recommend_treatment) for active reports — this alerts and tasks the responsible supervisor.`);
  }
  const actionRule = powers.length
    ? `ACTIONS you can take for this user (every action is only PROPOSED — the user confirms with a button before anything is saved):\n${powers.join("\n")}\nAsk for missing required details one short question at a time (reply). Today is ${opts.today} in Africa/Addis_Ababa — convert relative dates like "tomorrow"/"ነገ" to YYYY-MM-DD.`
    : `You cannot take actions (orders, tasks, schedules) for this user's role — politely say only managers and supervisors can, then answer their question if you can.`;

  const extras = [
    opts.roster ? `STAFF:\n${opts.roster}` : "",
    opts.diseasesBrief ? `ACTIVE DISEASE REPORTS:\n${opts.diseasesBrief}` : "",
    opts.jobsBrief ? `MY SCHEDULED JOBS:\n${opts.jobsBrief}` : "",
  ].filter(Boolean).join("\n\n");

  return `You are the assistant of Entoto Riverside Farm, a strawberry farm above Addis Ababa. You are talking to ${opts.userName} (role: ${opts.role}) on Telegram, often by voice message.

Ground every factual answer ONLY in the CONTEXT block (live farm snapshot). Cite real bed IDs, kg and names from it. If the needed data is not there, say so briefly and name the app page for it. Never invent figures.

${actionRule}

${extras}

${langRule}
Amharic farm terminology: a growing bed is "መደብ" (plural "መደቦች") — never "አልጋ", which means a sleeping bed.

Replies are READ ALOUD: 1–4 short conversational sentences, no markdown, no emojis, no lists.

You MUST respond by calling exactly one of the provided functions.`;
}

export async function geminiAgentTurn(
  key: string,
  input: { audio?: { mime: string; dataB64: string }; text?: string },
  meta: AgentMeta,
): Promise<AgentTurn | null> {
  const parts: Array<Record<string, unknown>> = [];
  if (input.audio) parts.push({ inline_data: { mime_type: input.audio.mime, data: input.audio.dataB64 } });
  parts.push({
    text: `${input.audio ? "The user sent the attached voice message." : `The user wrote: ${input.text}`}\n\nCONTEXT (live farm snapshot):\n${meta.context}`,
  });

  // prior turns, text-only; Gemini requires the history to start with "user"
  const history = meta.history.map((t) => ({ role: t.role, parts: [{ text: t.text }] }));
  while (history.length && history[0].role !== "user") history.shift();

  const decls: Array<{ name: string }> = [REPLY_DECL];
  if (meta.canTakeOrders) decls.push(ORDER_DECL, TASK_DECL, SCHEDULE_DECL, LIST_JOBS_DECL, CANCEL_JOB_DECL);
  if (meta.isManager) decls.push(RECOMMEND_DECL);

  const res = await fetch(`${GEMINI}/${ANSWER_MODEL}:generateContent?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: agentSystem(meta) }] },
      contents: [...history, { role: "user", parts }],
      tools: [{ function_declarations: decls }],
      tool_config: { function_calling_config: { mode: "ANY", allowed_function_names: decls.map((d) => d.name) } },
      generationConfig: { temperature: 0.4 },
    }),
    signal: AbortSignal.timeout(60_000),
  });
  const j = await res.json().catch(() => null);
  const respParts: Array<{ functionCall?: { name: string; args: Record<string, unknown> }; text?: string }> =
    j?.candidates?.[0]?.content?.parts ?? [];
  const call = respParts.find((p) => p.functionCall)?.functionCall;

  if (!call) {
    // model slipped out of tool mode — salvage any text as a plain reply
    const text = respParts.find((p) => p.text)?.text?.trim();
    if (text) return { kind: "reply", transcript: "", lang: "en", text };
    console.error("[tg-agent] turn failed:", JSON.stringify(j)?.slice(0, 400));
    return null;
  }

  const a = call.args ?? {};
  const transcript = typeof a.transcript === "string" ? a.transcript : "";
  const lang = a.lang === "am" ? "am" as const : "en" as const;
  const speak = typeof a.speak === "string" ? a.speak.trim() : "";
  const clarify = (am: string, en: string): AgentTurn => ({ kind: "reply", transcript, lang, text: lang === "am" ? am : en });

  switch (call.name) {
    case "propose_order": {
      const order: OrderProposal = {
        customerName: String(a.customerName ?? "").trim(),
        quantityKg: Number(a.quantityKg) || 0,
        pricePerKg: Number(a.pricePerKg) || 0,
        advancePaid: a.advancePaid != null ? Math.max(0, Number(a.advancePaid) || 0) : undefined,
        customerType: typeof a.customerType === "string" ? a.customerType : undefined,
        variety: typeof a.variety === "string" && a.variety ? a.variety : undefined,
        phone: typeof a.phone === "string" && a.phone ? a.phone : undefined,
        deliveryDate: typeof a.deliveryDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(a.deliveryDate) ? a.deliveryDate : undefined,
        notes: typeof a.notes === "string" && a.notes ? a.notes : undefined,
      };
      if (order.customerName && order.quantityKg > 0 && order.pricePerKg > 0 && speak) {
        return { kind: "order", transcript, lang, speak, order };
      }
      return clarify(
        "ትዕዛዙን ለመመዝገብ የደንበኛ ስም፣ መጠን በኪሎ እና ዋጋ በኪሎ ያስፈልጉኛል።",
        "To record the order I need the customer name, quantity in kg and price per kg.",
      );
    }
    case "create_task": {
      const task: TaskProposal = {
        title: String(a.title ?? "").trim(),
        assigneeName: String(a.assigneeName ?? "").trim(),
        dueDate: typeof a.dueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(a.dueDate) ? a.dueDate : undefined,
        priority: a.priority === "low" || a.priority === "high" ? a.priority : "medium",
        category: typeof a.category === "string" ? a.category : undefined,
        notes: typeof a.notes === "string" && a.notes ? a.notes : undefined,
      };
      if (task.title && task.assigneeName && speak) return { kind: "task", transcript, lang, speak, task };
      return clarify(
        "ተግባሩን ለመመደብ የስራው ርዕስ እና ተመዳቢው ማን እንደሆነ ያስፈልጉኛል።",
        "To assign the task I need the task title and who it is for.",
      );
    }
    case "recommend_treatment": {
      const steps = Array.isArray(a.steps) ? a.steps.map((s) => String(s).trim()).filter(Boolean) : [];
      const bedId = String(a.bedId ?? "").trim();
      if (bedId && steps.length && speak) {
        return {
          kind: "treatment", transcript, lang, speak, bedId, steps,
          disease: typeof a.disease === "string" && a.disease ? a.disease : undefined,
          note: typeof a.note === "string" && a.note ? a.note : undefined,
        };
      }
      return clarify(
        "ምክሩን ለመላክ የመደቡን መለያ እና የሕክምና ደረጃዎችን ያስፈልጉኛል።",
        "To issue the recommendation I need the bed id and the treatment steps.",
      );
    }
    case "schedule_job": {
      const time = String(a.time ?? "").trim();
      const days = Array.isArray(a.daysOfWeek)
        ? a.daysOfWeek.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
        : [];
      const job: JobProposal = {
        title: String(a.title ?? "").trim(),
        prompt: String(a.prompt ?? "").trim(),
        timeHHMM: /^([01]\d|2[0-3]):[0-5]\d$/.test(time) ? time : "",
        daysOfWeek: days.length ? Array.from(new Set(days)).sort() : [0, 1, 2, 3, 4, 5, 6],
      };
      if (job.title && job.prompt && job.timeHHMM && speak) return { kind: "schedule", transcript, lang, speak, job };
      return clarify(
        "መርሐግብሩን ለማስያዝ ርዕስ፣ ምን እንደምልክ እና ሰዓት (HH:MM) ያስፈልጉኛል።",
        "To schedule that I need a title, what to send, and a time (HH:MM).",
      );
    }
    case "list_jobs":
      return { kind: "listJobs", transcript, lang };
    case "cancel_job": {
      const jobRef = String(a.jobRef ?? "").trim();
      if (jobRef && speak) return { kind: "cancelJob", transcript, lang, speak, jobRef };
      return clarify("የትኛውን መርሐግብር እንደምሰርዝ ይንገሩኝ።", "Tell me which schedule to cancel.");
    }
    default: {
      const text = typeof a.text === "string" ? a.text.trim() : "";
      if (!text) return null;
      return { kind: "reply", transcript, lang, text };
    }
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
