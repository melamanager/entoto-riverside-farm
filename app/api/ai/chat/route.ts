import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { buildFarmContext } from "@/lib/farm-context";

type ChatMsg = { role: "user" | "ai"; text: string };

const SYSTEM = `You are the operations assistant for Entoto Riverside Farm, a strawberry farm in the highlands above Addis Ababa, Ethiopia. You help the manager and supervisors run day-to-day operations.

You are given a live snapshot of the farm's current state (the CONTEXT block). Ground every answer in that data — cite specific bed IDs, kg, names, and numbers from it. If the context does not contain what is needed, say so plainly and suggest where in the app to find or record it (e.g. "log it on the Daily Routines page"). Never invent figures, confidence percentages, or events that are not in the context.

Style: concise and practical for a busy farm manager. Lead with the answer, then 1–3 short supporting points or next actions. Use plain language; amounts in ETB or kg as given. You may use short **bold** for key numbers. Do not use headers or long essays. If asked about money and the context says figures are manager-only, explain that politely.`;

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = ((session.user as { role?: string }).role ?? "farmer") as "manager" | "supervisor" | "farmer";

  const body = await req.json().catch(() => ({}));
  const messages: ChatMsg[] = Array.isArray(body.messages) ? body.messages : [];
  const question = (messages.filter((m) => m.role === "user").slice(-1)[0]?.text ?? "").trim();
  if (!question) return NextResponse.json({ error: "Empty question" }, { status: 400 });

  const context = await buildFarmContext(role);

  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? process.env.GEMINI_API_KEY;
  if (!key) {
    return NextResponse.json({ mode: "limited", reason: "no_key", context });
  }

  try {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const ai = new GoogleGenerativeAI(key);
    const model = ai.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: SYSTEM,
    });

    // last few turns for continuity (exclude the newest user msg; it goes in the final turn)
    const history = messages.slice(-9, -1).map((m) => ({
      role: m.role === "ai" ? "model" as const : "user" as const,
      parts: [{ text: m.text }],
    }));
    // Gemini requires history to start with a user turn
    while (history.length && history[0].role !== "user") history.shift();

    const chat = model.startChat({ history });
    const result = await chat.sendMessage(
      `CONTEXT (live farm snapshot):\n${context}\n\nQUESTION: ${question}`,
    );
    const reply = result.response.text().trim();
    return NextResponse.json({ mode: "live", provider: "gemini", reply });
  } catch (e) {
    console.error("AI chat failed:", e);
    // fall back to limited mode so the assistant still answers from local logic
    return NextResponse.json({ mode: "limited", reason: "error", context });
  }
}
