import { NextResponse } from "next/server";
import { getWeather, calcDiseaseRisks } from "@/lib/weather";

export const revalidate = 900; // 15 minutes

export async function GET() {
  const weather = await getWeather();
  const risks   = calcDiseaseRisks(weather);
  return NextResponse.json({ weather, risks });
}
