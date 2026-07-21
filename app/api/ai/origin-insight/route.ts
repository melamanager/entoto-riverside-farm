import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { computedInsight, type OriginInsightStats } from "@/lib/origin-insight";

export const runtime = "nodejs";

// Generates the dashboard ማጠቃለያ card text from the REAL computed origin stats
// (previously hardcoded prose that could contradict the data). Live mode uses
// Gemini; without a key or on any failure it falls back to the deterministic
// template in lib/origin-insight.ts. The Gemini result is cached in AppSetting
// keyed by the stats snapshot, so it regenerates only when the numbers change.

const CACHE_KEY = "origin_insight_cache";

const SYSTEM = `You write the short "ማጠቃለያ (Summary)" insight for the seed-origin performance card on the dashboard of Entoto Riverside Farm (a strawberry farm above Addis Ababa).

Write in Amharic. Keep the English terms "(efficiency)" and "(volume)" in parentheses after the matching Amharic phrase, in the established style of the app.

Ground EVERYTHING in the DATA json only — never invent origins or numbers.

Return STRICT JSON: {"paragraph": string, "question": string}
- paragraph: 2–3 sentences. Compare the efficiency leader (kg per metre) with the volume leader (total kg). If sameLeader is true, say plainly that one origin leads both and use leaderSharePct; you may contrast with runnerUp or weakest. If false, contrast the two leaders.
- question: ONE short actionable Amharic question for the farm manager, starting with "ጥያቄ፦", referencing a real origin from the data (e.g. improving the weakest origin's efficiency or expanding the leader).`;

function validStats(s: unknown): s is OriginInsightStats {
  const x = s as OriginInsightStats;
  return !!x && typeof x.regions === "number" &&
    !!x.effLeader?.origin && typeof x.effLeader.kgPerM === "number" &&
    !!x.volLeader?.origin && typeof x.volLeader.kg === "number" &&
    typeof x.sameLeader === "boolean" && !!x.weakest?.origin &&
    typeof x.totalKg === "number" && typeof x.leaderSharePct === "number";
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const stats = body?.stats;
  if (!validStats(stats)) return NextResponse.json({ error: "Bad stats" }, { status: 400 });
  const statsKey = JSON.stringify(stats);

  // same data → same insight; skip the model call
  const cached = await prisma.appSetting.findUnique({ where: { key: CACHE_KEY } });
  if (cached?.value) {
    try {
      const c = JSON.parse(cached.value);
      if (c.statsKey === statsKey && c.paragraph && c.question) {
        return NextResponse.json({ mode: "live", paragraph: c.paragraph, question: c.question });
      }
    } catch { /* stale/corrupt cache — regenerate */ }
  }

  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? process.env.GEMINI_API_KEY;
  if (!key) return NextResponse.json({ mode: "computed", ...computedInsight(stats) });

  try {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const ai = new GoogleGenerativeAI(key);
    const model = ai.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: SYSTEM,
      generationConfig: { responseMimeType: "application/json", temperature: 0.5 },
    });
    const result = await model.generateContent(`DATA:\n${statsKey}`);
    const parsed = JSON.parse(result.response.text());
    if (typeof parsed?.paragraph !== "string" || typeof parsed?.question !== "string" || !parsed.paragraph) {
      throw new Error("bad shape");
    }
    await prisma.appSetting.upsert({
      where: { key: CACHE_KEY },
      update: { value: JSON.stringify({ statsKey, paragraph: parsed.paragraph, question: parsed.question }) },
      create: { key: CACHE_KEY, value: JSON.stringify({ statsKey, paragraph: parsed.paragraph, question: parsed.question }) },
    });
    return NextResponse.json({ mode: "live", paragraph: parsed.paragraph, question: parsed.question });
  } catch (e) {
    console.error("origin-insight generation failed:", e);
    return NextResponse.json({ mode: "computed", ...computedInsight(stats) });
  }
}
