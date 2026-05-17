import { NextResponse } from "next/server";
import { detectFromImage } from "@/lib/ai";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = await detectFromImage({
      mode: body.mode === "live" ? "live" : "demo",
      bedId: body.bedId,
      imageBase64: body.imageBase64,
    });
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Detection failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
