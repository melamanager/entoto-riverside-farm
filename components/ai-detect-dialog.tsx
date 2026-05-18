"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Camera, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import type { AIDetectionResult } from "@/lib/ai";
import { useAuth } from "@/lib/auth";

interface Props {
  bedId?: string;
  trigger?: React.ReactNode;
}

export function AIDetectDialog({ bedId, trigger }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"demo" | "live">("demo");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AIDetectionResult | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  async function runDetection(imageBase64?: string) {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/ai/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, bedId, imageBase64 }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setResult(data);
      if (data.disease !== "none") {
        toast.warning(`Detected: ${data.diseaseLabel}`, { description: `Severity ${data.severity}% · Confidence ${data.confidence}%` });
      } else {
        toast.success("No disease detected", { description: `Confidence ${data.confidence}%` });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      toast.error("Detection failed", { description: msg });
    } finally {
      setLoading(false);
    }
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const b64 = reader.result as string;
      setImagePreview(b64);
      if (mode === "live") runDetection(b64);
    };
    reader.readAsDataURL(file);
  }

  async function reportAsDisease() {
    if (!result || !bedId || result.disease === "none") return;
    const res = await fetch("/api/disease/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bedId,
        type: result.disease,
        severity: result.severity,
        suggestedTreatment: result.suggestedTreatment,
        aiConfidence: result.confidence,
        reportedBy: user?.id ?? "f-006",
      }),
    });
    if (res.ok) {
      toast.success("Disease report filed", { description: "Manager notified via Telegram/SMS · Task assigned to supervisor" });
      setOpen(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={(props) =>
          trigger ? (
            <span {...props}>{trigger}</span>
          ) : (
            <Button size="sm" variant="outline" className="gap-2" {...props}>
              <Sparkles className="size-4 text-amber-600" /> AI Detect
            </Button>
          )
        }
      />
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-amber-600" />
            AI Crop Analysis
            {bedId && <Badge variant="outline" className="ml-2 font-mono text-xs">{bedId}</Badge>}
          </DialogTitle>
        </DialogHeader>

        {/* Mode toggle */}
        <div className="flex items-center gap-2 p-1 bg-stone-100 rounded-lg">
          <button
            onClick={() => setMode("demo")}
            className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition ${mode==="demo" ? "bg-white shadow-sm" : "text-stone-500"}`}
          >🎭 Demo (instant)</button>
          <button
            onClick={() => setMode("live")}
            className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition ${mode==="live" ? "bg-white shadow-sm" : "text-stone-500"}`}
          >⚡ Live (Gemini/OpenAI)</button>
        </div>

        {mode === "live" && (
          <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2">
            Live mode requires <code>GEMINI_API_KEY</code> or <code>OPENAI_API_KEY</code> in <code>.env.local</code>.
          </div>
        )}

        {/* Image upload */}
        <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-lg p-6 cursor-pointer hover:bg-stone-50 transition">
          {imagePreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imagePreview} alt="preview" className="max-h-48 rounded-md" />
          ) : (
            <>
              <Camera className="size-8 text-stone-400" />
              <div className="text-sm font-medium">Upload a strawberry bed photo</div>
              <div className="text-[11px] text-stone-500">{mode === "demo" ? "Any image works in demo mode" : "Close-up of leaves/fruit for best results"}</div>
            </>
          )}
          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
        </label>

        {mode === "demo" && (
          <Button onClick={() => runDetection()} disabled={loading} className="w-full">
            {loading ? <><Loader2 className="size-4 animate-spin mr-2" /> Analyzing…</> : <><Sparkles className="size-4 mr-2" /> Run demo analysis</>}
          </Button>
        )}

        {loading && mode === "live" && (
          <div className="flex items-center justify-center py-4 text-sm text-stone-500">
            <Loader2 className="size-4 animate-spin mr-2" /> Calling AI vision model…
          </div>
        )}

        {result && (
          <div className="space-y-3 border-t pt-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {result.disease === "none" ? (
                  <CheckCircle2 className="size-5 text-emerald-600" />
                ) : (
                  <AlertTriangle className="size-5 text-rose-600" />
                )}
                <div>
                  <div className="font-bold">{result.diseaseLabel}</div>
                  <div className="text-[11px] text-stone-500">
                    {result.mode === "live" ? `Live · ${result.provider}` : "Demo"} · confidence {result.confidence}%
                  </div>
                </div>
              </div>
              {result.severity > 0 && (
                <Badge variant="destructive" className="text-xs">Severity {result.severity}%</Badge>
              )}
            </div>

            {(result.fruitCount !== undefined || result.estimatedYieldKg !== undefined) && (
              <div className="grid grid-cols-3 gap-2 text-center">
                {result.fruitCount !== undefined && (
                  <div className="bg-stone-50 rounded p-2"><div className="text-lg font-bold">{result.fruitCount}</div><div className="text-[10px] text-stone-500">fruits</div></div>
                )}
                {result.ripeFruitCount !== undefined && (
                  <div className="bg-stone-50 rounded p-2"><div className="text-lg font-bold text-rose-600">{result.ripeFruitCount}</div><div className="text-[10px] text-stone-500">ripe</div></div>
                )}
                {result.estimatedYieldKg !== undefined && (
                  <div className="bg-stone-50 rounded p-2"><div className="text-lg font-bold">{result.estimatedYieldKg}kg</div><div className="text-[10px] text-stone-500">est. yield</div></div>
                )}
              </div>
            )}

            <div className="text-xs text-stone-600 bg-stone-50 rounded p-3 italic">"{result.rawNotes}"</div>

            {result.disease !== "none" && (
              <div className="bg-amber-50 border border-amber-200 rounded p-3 text-xs">
                <div className="font-semibold text-amber-900 mb-1">💊 Suggested treatment</div>
                <div className="text-amber-800">{result.suggestedTreatment}</div>
              </div>
            )}

            {result.disease !== "none" && bedId && (
              <Button onClick={reportAsDisease} className="w-full bg-rose-600 hover:bg-rose-700">
                File disease report & notify manager
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
