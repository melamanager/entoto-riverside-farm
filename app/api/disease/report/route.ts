import { NextResponse } from "next/server";
import { addDiseaseReport } from "@/lib/data";
import { DISEASE_TREATMENT_STEPS } from "@/lib/types";
import type { DiseaseType } from "@/lib/types";

export async function POST(req: Request) {
  const body = await req.json();
  if (!body.bedId || !body.type) {
    return NextResponse.json({ error: "Missing bedId or type" }, { status: 400 });
  }
  const type = body.type as DiseaseType;
  const id = addDiseaseReport({
    bedId: body.bedId,
    type,
    severity: Number(body.severity ?? 30),
    reportedAt: new Date().toISOString(),
    reportedBy: body.reportedBy ?? "f-006",
    status: "open",
    suggestedTreatment: body.suggestedTreatment ?? "Awaiting expert review.",
    treatmentSteps: DISEASE_TREATMENT_STEPS[type] ?? [],
    treatmentApplied: false,
    managerNotified: true,
    notifiedAt: new Date().toISOString(),
    notificationChannels: ["telegram", "sms"],
    aiConfidence: body.aiConfidence,
  });
  console.log(`[NOTIFY] Telegram + SMS dispatched → manager (Meron Tadesse) re: disease at ${body.bedId}`);
  return NextResponse.json({ id, ok: true, notified: ["telegram", "sms"] });
}
