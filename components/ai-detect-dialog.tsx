"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Camera, Loader2, CheckCircle2, AlertTriangle, ImageUp, Languages } from "lucide-react";
import { toast } from "sonner";
import type { AIDetectionResult } from "@/lib/ai";
import { useAuth } from "@/lib/auth";
import { getBed, getValve, addTask } from "@/lib/data";

interface Props {
  bedId?: string;
  trigger?: React.ReactNode;
}

// ─── Amharic disease names and treatment advice ───────────────────────────────
const AM_DISEASE_NAMES: Record<string, string> = {
  powdery_mildew:      "ዱቄታማ ፈንጋይ",
  root_rot:            "ሥር መበስበስ",
  gray_mold:           "ግራጫ ፈንጋይ (ቦትሪቲስ)",
  leaf_spot:           "የቅጠል ምልክት",
  nitrogen_deficiency: "የናይትሮጅን ጉድለት",
  none:                "በሽታ አልተገኘም",
};

const AM_TREATMENTS: Record<string, string> = {
  powdery_mildew:
    "ኩሙሉስ DF (ሰልፈር) 2g ለ1 ሊትር ውሃ ቀላቅለህ ቅጠሎቹ ሁሉ ላይ ረጭ። " +
    "በ7 ቀን አንዴ ለ3 ሳምንት ድገም። የተጎዱ ቅጠሎቹን ቆርጦ አስወግድ።",
  root_rot:
    "ውሃ ማጠጣቱን ወዲያው ቀንስ። ትሪኮደርማ ሃርዚያኑም ለሥሩ ሰጥ። " +
    "ከ60% በላይ የተጠቁ ዕጾችን ነቅሎ ያቃጥሏቸው።",
  gray_mold:
    "የተጎዱ ፍሬዎችን ሰብስቦ ይጣሏቸው። ስዊች 62.5 WG ለ1 ሊትር ውሃ 0.8g ቀላቅሎ ረጭ። " +
    "አየር እንዲዘዋወር ሞቅ ያሉ ቅጠሎችን አስወግድ። እርጥበቱ ከ85% በታች እንዲሆን ያድርጉ።",
  leaf_spot:
    "ነጠብጣብ ያሉ ቅጠሎችን ሁሉ አስወግድ። ኮሲዴ 3000 ወይም ኮፐር ሃይድሮክሳይድ ረጭ። " +
    "ቅጠሎቹ ሳይረጡ ውሃ ስጥ (drip ብቻ ተጠቀም)።",
  nitrogen_deficiency:
    "ዩሪያ (46-0-0) ለ1000 ሊትር ውሃ 5 ኪሎ ቀላቅለህ ለ30 ደቂቃ ስጥ። " +
    "ከ5–7 ቀን ውስጥ ቅጠሎቹ ቀለም ይቀያይራሉ።",
  none: "ቤቱ ጤናማ ይመስላል። ቀጥሎ መከታተሉ ይቀጠሉ።",
};

const AM_RAW_NOTES: Record<string, string> = {
  powdery_mildew:      "ቅጠሎቹ ላይ ነጭ ወይም ግራጫ ዱቄታማ ነጠብጣብ ታይቷል። ወዲያው ህክምና ያስፈልጋል።",
  root_rot:            "ሥሮቹ ቡናማ ወይም ጥቁር ሆነው ይታያሉ። ዕፅዋቱ ይጠወልጋሉ — ሥር መበስበስ ምልክት ነው።",
  gray_mold:           "ፍሬ ወይም ቅጠሎች ላይ ግራጫ ወይም ቡናማ ፈንጋይ ተስፋፍቷል።",
  leaf_spot:           "ቅጠሎቹ ላይ ቡናማ ወይም ሐምራዊ ቀለም ያላቸው ነጠብጣቦች ታይተዋል።",
  nitrogen_deficiency: "ቅጠሎቹ ወደ ቢጫ ቀለም እየተቀየሩ ናቸው — ናይትሮጅን አልቆ ሊሆን ይችላል።",
  none:                "ምንም ግልፅ የበሽታ ምልክት አልታየም።",
};

export function AIDetectDialog({ bedId, trigger }: Props) {
  const { user } = useAuth();
  const [open, setOpen]               = useState(false);
  const [mode, setMode]               = useState<"demo" | "live">("demo");
  const [lang, setLang]               = useState<"en" | "am">("en");
  const [loading, setLoading]         = useState(false);
  const [result, setResult]           = useState<AIDetectionResult | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [infectedLengthM, setInfectedLengthM] = useState<number>(0);

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
        toast.warning(`Detected: ${data.diseaseLabel}`, {
          description: `Severity ${data.severity}% · Confidence ${data.confidence}%`,
        });
      } else {
        toast.success("No disease detected", { description: `Confidence ${data.confidence}%` });
      }
    } catch (e) {
      toast.error("Detection failed", { description: e instanceof Error ? e.message : "Unknown error" });
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
    const bed = getBed(bedId);
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
        infectedLengthM: infectedLengthM > 0 ? infectedLengthM : (bed ? Math.round(bed.lengthM * (result.severity / 100) * 10) / 10 : undefined),
      }),
    });
    if (res.ok) {
      // Flow 9: auto-create a supervisor task alongside the disease report
      const bed   = getBed(bedId);
      const valve = bed ? getValve(bed.valveId) : null;
      if (valve?.supervisorId) {
        addTask({
          title: `AI Alert: ${result.diseaseLabel} detected — ${bedId}`,
          description: `AI confidence ${result.confidence}%. ${result.suggestedTreatment}`,
          assignedTo: valve.supervisorId,
          createdBy: user?.id ?? "f-008",
          bedId,
          status: "pending",
          priority: result.severity > 60 ? "high" : "medium",
          category: "disease",
          createdAt: new Date().toISOString(),
          dueDate: new Date(Date.now() + 86400000).toISOString().split("T")[0],
        });
      }
      toast.success("Disease report filed", {
        description: "Manager notified · Supervisor task auto-created",
      });
      setOpen(false);
    }
  }

  const diseaseKey  = result?.disease ?? "none";
  const amDisease   = AM_DISEASE_NAMES[diseaseKey] ?? diseaseKey;
  const amTreatment = AM_TREATMENTS[diseaseKey];
  const amNote      = AM_RAW_NOTES[diseaseKey];
  const isAm        = lang === "am";

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
            {isAm ? "AI የቦታ ምርምር" : "AI Crop Analysis"}
            {bedId && <Badge variant="outline" className="ml-2 font-mono text-xs">{bedId}</Badge>}
          </DialogTitle>
        </DialogHeader>

        {/* Mode + language toggle */}
        <div className="flex gap-2">
          <div className="flex items-center gap-1 flex-1 p-1 bg-stone-100 rounded-lg">
            <button
              onClick={() => setMode("demo")}
              className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition ${mode === "demo" ? "bg-white shadow-sm" : "text-stone-500"}`}
            >🎭 {isAm ? "ዴሞ" : "Demo"}</button>
            <button
              onClick={() => setMode("live")}
              className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition ${mode === "live" ? "bg-white shadow-sm" : "text-stone-500"}`}
            >⚡ {isAm ? "ቀጥታ" : "Live"}</button>
          </div>
          {/* Language toggle */}
          <button
            onClick={() => setLang(l => l === "en" ? "am" : "en")}
            title={isAm ? "Switch to English" : "አማርኛ ቀይር"}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-stone-100 hover:bg-stone-200 rounded-lg transition"
          >
            <Languages className="size-3.5" />
            {isAm ? "EN" : "አማ"}
          </button>
        </div>

        {/* Image upload */}
        <div className="border-2 border-dashed rounded-lg overflow-hidden">
          {imagePreview ? (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imagePreview} alt="preview" className="w-full max-h-48 object-cover" />
              <div className="absolute bottom-0 inset-x-0 flex gap-2 p-2 bg-black/50">
                <label className="flex-1 flex items-center justify-center gap-1.5 text-[11px] text-white bg-white/20 hover:bg-white/30 rounded py-1 cursor-pointer transition">
                  <Camera className="size-3.5" /> {isAm ? "ደጋ አንሳ" : "Retake"}
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
                </label>
                <label className="flex-1 flex items-center justify-center gap-1.5 text-[11px] text-white bg-white/20 hover:bg-white/30 rounded py-1 cursor-pointer transition">
                  <ImageUp className="size-3.5" /> {isAm ? "ቀይር" : "Change"}
                  <input type="file" accept="image/*" className="hidden" onChange={onFile} />
                </label>
              </div>
            </div>
          ) : (
            <div className="p-4 space-y-3">
              <div className="text-center text-sm font-medium text-stone-600">
                {isAm ? "የስትሮቤሪ አልጋ ፎቶ ያስገቡ" : "Add a strawberry bed photo"}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col items-center gap-2 p-4 rounded-lg bg-stone-50 hover:bg-stone-100 cursor-pointer transition">
                  <Camera className="size-6 text-stone-400" />
                  <span className="text-xs font-medium text-stone-600">{isAm ? "ፎቶ አንሳ" : "Take Photo"}</span>
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
                </label>
                <label className="flex flex-col items-center gap-2 p-4 rounded-lg bg-stone-50 hover:bg-stone-100 cursor-pointer transition">
                  <ImageUp className="size-6 text-stone-400" />
                  <span className="text-xs font-medium text-stone-600">{isAm ? "ከጋለሪ ምረጥ" : "Upload from Gallery"}</span>
                  <input type="file" accept="image/*" className="hidden" onChange={onFile} />
                </label>
              </div>
              <div className="text-center text-[11px] text-stone-400">
                {mode === "demo"
                  ? (isAm ? "ለዴሞ ሁነታ ማንኛውም ፎቶ ያሰራል" : "Any image works in demo mode")
                  : (isAm ? "ለተሻለ ውጤት የቅጠሎቹ ቅርብ ፎቶ ያስፈልጋል" : "Close-up of leaves/fruit for best results")}
              </div>
            </div>
          )}
        </div>

        {mode === "demo" && (
          <Button onClick={() => runDetection()} disabled={loading} className="w-full">
            {loading
              ? <><Loader2 className="size-4 animate-spin mr-2" />{isAm ? "እየተፈተሸ ነው…" : "Analyzing…"}</>
              : <><Sparkles className="size-4 mr-2" />{isAm ? "ዴሞ ትንተና ያስሂዱ" : "Run demo analysis"}</>}
          </Button>
        )}

        {loading && mode === "live" && (
          <div className="flex items-center justify-center py-4 text-sm text-stone-500">
            <Loader2 className="size-4 animate-spin mr-2" />
            {isAm ? "AI ሞዴል እየጠሩ ነው…" : "Calling AI vision model…"}
          </div>
        )}

        {result && (
          <div className="space-y-3 border-t pt-3">
            {/* Disease result */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {result.disease === "none"
                  ? <CheckCircle2 className="size-5 text-emerald-600" />
                  : <AlertTriangle className="size-5 text-rose-600" />}
                <div>
                  <div className="font-bold">{isAm ? amDisease : result.diseaseLabel}</div>
                  {isAm && result.disease !== "none" && (
                    <div className="text-[10px] text-stone-400">{result.diseaseLabel}</div>
                  )}
                  <div className="text-[11px] text-stone-500">
                    {result.mode === "live" ? `Live · ${result.provider}` : "Demo"} ·{" "}
                    {isAm ? "ትክክለኛነት" : "confidence"} {result.confidence}%
                  </div>
                </div>
              </div>
              {result.severity > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {isAm ? "ክብደት" : "Severity"} {result.severity}%
                </Badge>
              )}
            </div>

            {/* Fruit counts */}
            {(result.fruitCount !== undefined || result.estimatedYieldKg !== undefined) && (
              <div className="grid grid-cols-3 gap-2 text-center">
                {result.fruitCount !== undefined && (
                  <div className="bg-stone-50 rounded p-2">
                    <div className="text-lg font-bold">{result.fruitCount}</div>
                    <div className="text-[10px] text-stone-500">{isAm ? "ፍሬ" : "fruits"}</div>
                  </div>
                )}
                {result.ripeFruitCount !== undefined && (
                  <div className="bg-stone-50 rounded p-2">
                    <div className="text-lg font-bold text-rose-600">{result.ripeFruitCount}</div>
                    <div className="text-[10px] text-stone-500">{isAm ? "익은 ፍሬ" : "ripe"}</div>
                  </div>
                )}
                {result.estimatedYieldKg !== undefined && (
                  <div className="bg-stone-50 rounded p-2">
                    <div className="text-lg font-bold">{result.estimatedYieldKg}kg</div>
                    <div className="text-[10px] text-stone-500">{isAm ? "የሚጠበቅ ምርት" : "est. yield"}</div>
                  </div>
                )}
              </div>
            )}

            {/* Notes */}
            <div className="text-xs text-stone-600 bg-stone-50 rounded p-3 italic">
              &ldquo;{isAm ? (amNote ?? result.rawNotes) : result.rawNotes}&rdquo;
            </div>

            {/* Treatment */}
            {result.disease !== "none" && (
              <div className="bg-amber-50 border border-amber-200 rounded p-3 text-xs space-y-2">
                <div className="font-semibold text-amber-900 flex items-center gap-1.5">
                  💊 {isAm ? "የሚመከር ህክምና" : "Suggested treatment"}
                </div>
                <div className="text-amber-800">
                  {isAm ? (amTreatment ?? result.suggestedTreatment) : result.suggestedTreatment}
                </div>
                {isAm && amTreatment && (
                  <div className="text-amber-700 text-[10px] italic border-t border-amber-200 pt-2">
                    EN: {result.suggestedTreatment}
                  </div>
                )}
              </div>
            )}

            {result.disease !== "none" && bedId && (() => {
              const bed = getBed(bedId);
              const bedLen = bed?.lengthM ?? 0;
              const autoEst = bedLen > 0 ? Math.round(bedLen * (result.severity / 100) * 10) / 10 : 0;
              const displayLen = infectedLengthM > 0 ? infectedLengthM : autoEst;
              const pct = bedLen > 0 ? Math.round((displayLen / bedLen) * 100) : 0;
              return (
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 space-y-2">
                  <div className="text-xs font-semibold text-rose-800 flex items-center gap-1.5">
                    📏 {isAm ? "የተጎዳ የአልጋ ርዝመት" : "Infected bed length"}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={bedLen || 999}
                      step={0.5}
                      value={infectedLengthM || ""}
                      placeholder={`${autoEst} (auto)`}
                      onChange={e => setInfectedLengthM(Number(e.target.value))}
                      className="w-24 border border-rose-200 rounded-md px-2 py-1.5 text-sm bg-white text-center tabular-nums"
                    />
                    <span className="text-xs text-rose-700 font-medium">
                      metres
                    </span>
                    {bedLen > 0 && (
                      <span className="ml-auto text-xs font-bold text-rose-700 bg-rose-100 border border-rose-200 px-2 py-0.5 rounded-full">
                        {pct}% of {bedLen}m bed
                      </span>
                    )}
                  </div>
                  {autoEst > 0 && !infectedLengthM && (
                    <div className="text-[10px] text-rose-500 italic">
                      {isAm ? "AI ስሌት ላይ ተመስርቶ" : "Auto-estimated from severity"} ({result.severity}%)
                    </div>
                  )}
                </div>
              );
            })()}

            {result.disease !== "none" && bedId && (
              <Button onClick={reportAsDisease} className="w-full bg-rose-600 hover:bg-rose-700">
                {isAm ? "ሪፖርት ያስገቡ — ሥራ አስኪያጅን ያሳውቁ" : "File disease report & notify manager"}
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
