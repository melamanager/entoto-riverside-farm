import { DISEASE_LABELS, DISEASE_TREATMENTS, type DiseaseType } from "./types";

export interface AIDetectionResult {
  mode: "demo" | "live";
  provider?: "gemini" | "openai";
  bedId?: string;
  disease: DiseaseType | "none";
  diseaseLabel: string;
  confidence: number;
  severity: number;
  fruitCount?: number;
  ripeFruitCount?: number;
  estimatedYieldKg?: number;
  estimatedHarvestDate?: string;
  suggestedTreatment: string;
  rawNotes: string;
}

const DEMO_RESPONSES: AIDetectionResult[] = [
  {
    mode: "demo",
    disease: "powdery_mildew",
    diseaseLabel: DISEASE_LABELS.powdery_mildew,
    confidence: 87,
    severity: 32,
    fruitCount: 42,
    ripeFruitCount: 14,
    estimatedYieldKg: 12.5,
    estimatedHarvestDate: "2026-05-22",
    suggestedTreatment: DISEASE_TREATMENTS.powdery_mildew,
    rawNotes: "White powdery patches detected on multiple leaves. Plant vigor moderate. Recommend immediate fungicide application.",
  },
  {
    mode: "demo",
    disease: "gray_mold",
    diseaseLabel: DISEASE_LABELS.gray_mold,
    confidence: 79,
    severity: 48,
    fruitCount: 38,
    ripeFruitCount: 22,
    estimatedYieldKg: 9.8,
    estimatedHarvestDate: "2026-05-20",
    suggestedTreatment: DISEASE_TREATMENTS.gray_mold,
    rawNotes: "Botrytis-like lesions visible on ripe fruit. Recommend removing infected berries and applying fungicide.",
  },
  {
    mode: "demo",
    disease: "none",
    diseaseLabel: "No disease detected",
    confidence: 94,
    severity: 0,
    fruitCount: 56,
    ripeFruitCount: 31,
    estimatedYieldKg: 18.2,
    estimatedHarvestDate: "2026-05-19",
    suggestedTreatment: "Continue standard care. Crop looks healthy with strong fruit set.",
    rawNotes: "No disease signatures detected. Foliage is dark green. Good fruit-to-leaf ratio.",
  },
  {
    mode: "demo",
    disease: "nitrogen_deficiency",
    diseaseLabel: DISEASE_LABELS.nitrogen_deficiency,
    confidence: 82,
    severity: 28,
    fruitCount: 31,
    ripeFruitCount: 12,
    estimatedYieldKg: 7.1,
    estimatedHarvestDate: "2026-05-24",
    suggestedTreatment: DISEASE_TREATMENTS.nitrogen_deficiency,
    rawNotes: "Older leaves showing chlorosis. Yield reduced ~30% from potential. Fertigation recommended.",
  },
  {
    mode: "demo",
    disease: "leaf_spot",
    diseaseLabel: DISEASE_LABELS.leaf_spot,
    confidence: 75,
    severity: 22,
    fruitCount: 47,
    ripeFruitCount: 18,
    estimatedYieldKg: 11.0,
    estimatedHarvestDate: "2026-05-21",
    suggestedTreatment: DISEASE_TREATMENTS.leaf_spot,
    rawNotes: "Small circular spots on lower leaves. Early-stage infection — treat now to prevent spread.",
  },
];

export async function detectFromImage(opts: {
  imageBase64?: string;
  imageUrl?: string;
  bedId?: string;
  mode: "demo" | "live";
}): Promise<AIDetectionResult> {
  if (opts.mode === "demo") {
    // Pseudo-random pick stable per bed
    const seed = (opts.bedId ?? "x").split("").reduce((s, c) => s + c.charCodeAt(0), 0);
    const pick = DEMO_RESPONSES[seed % DEMO_RESPONSES.length];
    await new Promise((r) => setTimeout(r, 1100));
    return { ...pick, bedId: opts.bedId };
  }

  // LIVE mode — try Gemini first, then OpenAI
  // Support both key names; prefer Gemini
  const geminiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? process.env.GEMINI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!opts.imageBase64) throw new Error("Live mode requires image data");

  if (geminiKey) {
    return await detectWithGemini(opts.imageBase64, geminiKey, opts.bedId);
  }
  if (openaiKey) {
    return await detectWithOpenAI(opts.imageBase64, openaiKey, opts.bedId);
  }
  throw new Error("No AI API key configured. Set GOOGLE_GENERATIVE_AI_API_KEY or OPENAI_API_KEY in .env.local");
}

async function detectWithGemini(imageBase64: string, key: string, bedId?: string): Promise<AIDetectionResult> {
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const ai = new GoogleGenerativeAI(key);
  const model = ai.getGenerativeModel({ model: "gemini-2.0-flash" });

  const prompt = `You are a strawberry-crop pathologist. Analyze this photo of a strawberry bed and return STRICT JSON with this exact shape:
{
  "disease": "powdery_mildew" | "root_rot" | "gray_mold" | "leaf_spot" | "nitrogen_deficiency" | "none",
  "confidence": <integer 0-100>,
  "severity": <integer 0-100>,
  "fruitCount": <integer or null>,
  "ripeFruitCount": <integer or null>,
  "estimatedYieldKg": <number or null>,
  "notes": "<short 1-2 sentence observation>"
}
Return ONLY the JSON, no markdown or extra text.`;

  const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");
  const result = await model.generateContent([
    prompt,
    { inlineData: { mimeType: "image/jpeg", data: cleanBase64 } },
  ]);

  const text = result.response.text().trim().replace(/```json\n?|\n?```/g, "");
  const parsed = JSON.parse(text);
  const disease = parsed.disease as DiseaseType | "none";

  return {
    mode: "live",
    provider: "gemini",
    bedId,
    disease,
    diseaseLabel: disease === "none" ? "No disease detected" : DISEASE_LABELS[disease],
    confidence: parsed.confidence ?? 0,
    severity: parsed.severity ?? 0,
    fruitCount: parsed.fruitCount ?? undefined,
    ripeFruitCount: parsed.ripeFruitCount ?? undefined,
    estimatedYieldKg: parsed.estimatedYieldKg ?? undefined,
    suggestedTreatment: disease === "none" ? "Continue standard care." : DISEASE_TREATMENTS[disease],
    rawNotes: parsed.notes ?? "",
  };
}

async function detectWithOpenAI(imageBase64: string, key: string, bedId?: string): Promise<AIDetectionResult> {
  const cleanBase64 = imageBase64.startsWith("data:")
    ? imageBase64
    : `data:image/jpeg;base64,${imageBase64}`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `You are a strawberry-crop pathologist. Analyze the photo and respond with strict JSON: {"disease":"powdery_mildew"|"root_rot"|"gray_mold"|"leaf_spot"|"nitrogen_deficiency"|"none","confidence":0-100,"severity":0-100,"fruitCount":int|null,"ripeFruitCount":int|null,"estimatedYieldKg":number|null,"notes":"1-2 sentence observation"}`,
            },
            { type: "image_url", image_url: { url: cleanBase64 } },
          ],
        },
      ],
    }),
  });

  if (!res.ok) throw new Error(`OpenAI API error: ${res.status} ${await res.text()}`);
  const json = await res.json();
  const parsed = JSON.parse(json.choices[0].message.content);
  const disease = parsed.disease as DiseaseType | "none";

  return {
    mode: "live",
    provider: "openai",
    bedId,
    disease,
    diseaseLabel: disease === "none" ? "No disease detected" : DISEASE_LABELS[disease],
    confidence: parsed.confidence ?? 0,
    severity: parsed.severity ?? 0,
    fruitCount: parsed.fruitCount ?? undefined,
    ripeFruitCount: parsed.ripeFruitCount ?? undefined,
    estimatedYieldKg: parsed.estimatedYieldKg ?? undefined,
    suggestedTreatment: disease === "none" ? "Continue standard care." : DISEASE_TREATMENTS[disease],
    rawNotes: parsed.notes ?? "",
  };
}
