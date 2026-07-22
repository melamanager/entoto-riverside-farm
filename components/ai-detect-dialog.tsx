"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Camera, Loader2, CheckCircle2, AlertTriangle, ImageUp, Languages } from "lucide-react";
import { toast } from "sonner";
import type { AIDetectionResult } from "@/lib/ai";
import { useAuth } from "@/lib/auth";
import { useReference } from "@/lib/reference";

interface Props {
  bedId?: string;
  trigger?: React.ReactNode;
}

// ─── Amharic disease names and natural treatment advice ────────────────────────
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
    "የተጎዱ ቅጠሎችን ቆርጠህ አስወግድ፤ አየር እንዲዘዋወር አድርግ። ወተት ከውሃ 1:9 ቀላቅለህ ጥዋት ረጭ፤ " +
    "በየ5–7 ቀኑ ለ3 ሳምንት ድገም። ውሃ ስሩ ላይ ብቻ ስጥ። ካልቀነሰ ብቻ ወደ ሰልፈር አልፍ።",
  root_rot:
    "ውሃ ማጠጣቱን ወዲያው ቀንስ፤ የፍሳሽ መውጫ አሻሽል (ኮምፖስት ጨምር)። በስሩ ላይ ትንሽ ቀረፋ (cinnamon) ነስንስ። " +
    "በጣም የተበሰበሱ ዕፅዋትን ነቅለህ አስወግድ (አታዳብር)። ትሪኮደርማ ካለ ስጥ።",
  gray_mold:
    "የበሰበሱ ፍሬና ቅጠሎችን ሰብስበህ በከረጢት አስወግድ። የተጨናነቁ ቅጠሎችን አስወግድ አየር እንዲገባ። " +
    "ቤኪንግ ሶዳ (1 ማንኪያ + ጥቂት ሳሙና በ1 ሊትር ውሃ) ረጭ። ጥዋት ብቻ ውሃ ስጥ።",
  leaf_spot:
    "ነጠብጣብ ያሉ ቅጠሎችን አስወግድ። ኒም ዘይት (5ml + ጠብታ ሳሙና በ1 ሊትር) ረጭ ወይም ነጭ ሽንኩርት+በርበሬ ውሃ። " +
    "ቅጠሎቹ ሳይረጡ በdrip ብቻ ውሃ ስጥ። በየ7–10 ቀኑ ድገም።",
  nitrogen_deficiency:
    "ይህ በሽታ አይደለም — ተክሉ ተርቧል። የኮምፖስት/ፍግ ሻይ አዘጋጅተህ በስሩ ስጥ፤ የበሰበሰ ፍግ ጨምር። " +
    "ከ5–7 ቀን ውስጥ ቀለሙ ይሻሻላል። ዩሪያ በጣም ሲያስፈልግ ብቻ ተጠቀም።",
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

const inputCls = "w-full border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring";

export function AIDetectDialog({ bedId, trigger }: Props) {
  const { user } = useAuth();
  const { beds } = useReference();
  const [open, setOpen]               = useState(false);
  const [lang, setLang]               = useState<"en" | "am">("en");
  const [loading, setLoading]         = useState(false);
  const [result, setResult]           = useState<AIDetectionResult | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [infectedLengthM, setInfectedLengthM] = useState<number>(0);
  const [bedData, setBedData] = useState<{ lengthM: number; valveId: string } | null>(null);
  const [pickedBedId, setPickedBedId] = useState<string>("");
  const effectiveBedId = bedId ?? (pickedBedId || undefined);
  const isAm = lang === "am";

  // bed dimensions for the infected-length estimate (from shared cache when possible)
  useEffect(() => {
    if (!effectiveBedId || !open) return;
    const cached = beds.find(b => b.id === effectiveBedId);
    if (cached) { setBedData({ lengthM: cached.lengthM, valveId: cached.valveId }); return; }
    fetch(`/api/beds/${effectiveBedId}`).then(r => r.json()).then(setBedData).catch(() => {});
  }, [effectiveBedId, open, beds]);

  async function runDetection(imageBase64: string) {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/ai/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "live", bedId: effectiveBedId, imageBase64 }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Detection failed");
      setResult(data);
      if (data.disease !== "none") {
        toast.warning(`Detected: ${data.diseaseLabel}`, { description: `Severity ${data.severity}% · Confidence ${data.confidence}%` });
      } else {
        toast.success("No disease detected", { description: `Confidence ${data.confidence}%` });
      }
    } catch (e) {
      toast.error("AI analysis failed", { description: e instanceof Error ? e.message : "Add a clearer photo and try again." });
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
      runDetection(b64);
    };
    reader.readAsDataURL(file);
  }

  async function reportAsDisease() {
    if (!result || !effectiveBedId || result.disease === "none") return;
    const res = await fetch("/api/disease/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bedId: effectiveBedId,
        type: result.disease,
        severity: result.severity,
        suggestedTreatment: result.suggestedTreatment,
        aiConfidence: result.confidence,
        photo: imagePreview ?? undefined,
        reporterNote: result.rawNotes || undefined,
        infectedLengthM: infectedLengthM > 0 ? infectedLengthM : (bedData ? Math.round(bedData.lengthM * (result.severity / 100) * 10) / 10 : undefined),
      }),
    });
    if (!res.ok) { toast.error("Failed to file report"); return; }
    toast.success("Disease report filed", { description: "The manager is notified and will send a treatment recommendation." });
    setOpen(false);
    setResult(null);
    setImagePreview(null);
    setPickedBedId("");
  }

  const diseaseKey  = result?.disease ?? "none";
  const amDisease   = AM_DISEASE_NAMES[diseaseKey] ?? diseaseKey;
  const amTreatment = AM_TREATMENTS[diseaseKey];
  const amNote      = AM_RAW_NOTES[diseaseKey];

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
            <button
              onClick={() => setLang(l => l === "en" ? "am" : "en")}
              title={isAm ? "Switch to English" : "አማርኛ ቀይር"}
              className="ml-auto flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold bg-muted hover:bg-accent rounded-lg transition"
            >
              <Languages className="size-3.5" /> {isAm ? "EN" : "አማ"}
            </button>
          </DialogTitle>
        </DialogHeader>

        {/* Bed picker — only when a bed wasn't already chosen */}
        {!bedId && (
          <div>
            <label className="text-xs font-semibold text-foreground/80 block mb-1">
              {isAm ? "የትኛው መደብ? *" : "Which bed? *"}
            </label>
            <select value={pickedBedId} onChange={e => setPickedBedId(e.target.value)} className={inputCls}>
              <option value="">{isAm ? "መደብ ምረጥ…" : "Select a bed…"}</option>
              {beds.map(b => (
                <option key={b.id} value={b.id}>{b.id} — {b.variety}{b.health !== "healthy" ? ` ⚠ ${b.health}` : ""}</option>
              ))}
            </select>
          </div>
        )}

        {/* Image upload */}
        <div className="border-2 border-dashed border-border rounded-lg overflow-hidden">
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
              <div className="text-center text-sm font-medium text-foreground/80">
                {isAm ? "የስትሮቤሪ መደብ ፎቶ ያስገቡ — AI ይመረምረዋል" : "Add a photo — the AI analyses it instantly"}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col items-center gap-2 p-4 rounded-lg bg-muted hover:bg-accent cursor-pointer transition">
                  <Camera className="size-6 text-muted-foreground" />
                  <span className="text-xs font-medium text-foreground/80">{isAm ? "ፎቶ አንሳ" : "Take Photo"}</span>
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
                </label>
                <label className="flex flex-col items-center gap-2 p-4 rounded-lg bg-muted hover:bg-accent cursor-pointer transition">
                  <ImageUp className="size-6 text-muted-foreground" />
                  <span className="text-xs font-medium text-foreground/80">{isAm ? "ከጋለሪ ምረጥ" : "Upload from Gallery"}</span>
                  <input type="file" accept="image/*" className="hidden" onChange={onFile} />
                </label>
              </div>
              <div className="text-center text-[11px] text-muted-foreground">
                {isAm ? "ለተሻለ ውጤት የቅጠሎቹ/ፍሬዎቹ ቅርብ ፎቶ ያንሱ" : "Close-up of leaves/fruit gives the best result"}
              </div>
            </div>
          )}
        </div>

        {loading && (
          <div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin mr-2" />
            {isAm ? "AI እየመረመረ ነው…" : "Analysing the photo…"}
          </div>
        )}

        {result && !loading && (
          <div className="space-y-3 border-t border-border pt-3">
            {/* Disease result */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {result.disease === "none"
                  ? <CheckCircle2 className="size-5 text-emerald-600" />
                  : <AlertTriangle className="size-5 text-rose-600" />}
                <div>
                  <div className="font-bold text-foreground">{isAm ? amDisease : result.diseaseLabel}</div>
                  {isAm && result.disease !== "none" && (
                    <div className="text-[10px] text-muted-foreground">{result.diseaseLabel}</div>
                  )}
                  <div className="text-[11px] text-muted-foreground">
                    {result.provider ? `AI · ${result.provider}` : "AI"} · {isAm ? "ትክክለኛነት" : "confidence"} {result.confidence}%
                  </div>
                </div>
              </div>
              {result.severity > 0 && (
                <Badge variant="destructive" className="text-xs">{isAm ? "ክብደት" : "Severity"} {result.severity}%</Badge>
              )}
            </div>

            {/* Fruit counts */}
            {(result.fruitCount !== undefined || result.estimatedYieldKg !== undefined) && (
              <div className="grid grid-cols-3 gap-2 text-center">
                {result.fruitCount !== undefined && (
                  <div className="bg-muted rounded p-2"><div className="text-lg font-bold text-foreground">{result.fruitCount}</div><div className="text-[10px] text-muted-foreground">{isAm ? "ፍሬ" : "fruits"}</div></div>
                )}
                {result.ripeFruitCount !== undefined && (
                  <div className="bg-muted rounded p-2"><div className="text-lg font-bold text-rose-600">{result.ripeFruitCount}</div><div className="text-[10px] text-muted-foreground">{isAm ? "የበሰለ" : "ripe"}</div></div>
                )}
                {result.estimatedYieldKg !== undefined && (
                  <div className="bg-muted rounded p-2"><div className="text-lg font-bold text-foreground">{result.estimatedYieldKg}kg</div><div className="text-[10px] text-muted-foreground">{isAm ? "የሚጠበቅ ምርት" : "est. yield"}</div></div>
                )}
              </div>
            )}

            {/* Observation */}
            <div className="text-xs text-foreground/70 bg-muted rounded p-3 italic">
              &ldquo;{isAm ? (amNote ?? result.rawNotes) : result.rawNotes}&rdquo;
            </div>

            {/* Treatment */}
            {result.disease !== "none" && (
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 rounded p-3 text-xs space-y-2">
                <div className="font-semibold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">🌿 {isAm ? "የሚመከር ተፈጥሯዊ ህክምና" : "Suggested natural treatment"}</div>
                <div className="text-amber-800 dark:text-amber-200">{isAm ? (amTreatment ?? result.suggestedTreatment) : result.suggestedTreatment}</div>
                {isAm && amTreatment && (
                  <div className="text-amber-700 dark:text-amber-300/80 text-[10px] italic border-t border-amber-200 dark:border-amber-900/40 pt-2">EN: {result.suggestedTreatment}</div>
                )}
              </div>
            )}

            {/* Infected length */}
            {result.disease !== "none" && effectiveBedId && (() => {
              const bedLen = bedData?.lengthM ?? 0;
              const autoEst = bedLen > 0 ? Math.round(bedLen * (result.severity / 100) * 10) / 10 : 0;
              const displayLen = infectedLengthM > 0 ? infectedLengthM : autoEst;
              const pct = bedLen > 0 ? Math.round((displayLen / bedLen) * 100) : 0;
              return (
                <div className="rounded-lg border border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-950/30 p-3 space-y-2">
                  <div className="text-xs font-semibold text-rose-800 dark:text-rose-300 flex items-center gap-1.5">📏 {isAm ? "የተጎዳ የመደብ ርዝመት" : "Infected bed length"}</div>
                  <div className="flex items-center gap-2">
                    <input type="number" min={0} max={bedLen || 999} step={0.5} value={infectedLengthM || ""} placeholder={`${autoEst} (auto)`}
                      onChange={e => setInfectedLengthM(Number(e.target.value))}
                      className="w-24 border border-rose-200 dark:border-rose-900/50 rounded-md px-2 py-1.5 text-sm bg-background text-foreground text-center tabular-nums" />
                    <span className="text-xs text-rose-700 dark:text-rose-300 font-medium">metres</span>
                    {bedLen > 0 && (
                      <span className="ml-auto text-xs font-bold text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-900/40 border border-rose-200 dark:border-rose-900/50 px-2 py-0.5 rounded-full">{pct}% of {bedLen}m bed</span>
                    )}
                  </div>
                </div>
              );
            })()}

            {result.disease !== "none" && (
              effectiveBedId ? (
                <Button onClick={reportAsDisease} className="w-full bg-rose-600 hover:bg-rose-700 text-white">
                  {isAm ? "ሪፖርት ያስገቡ — ሥራ አስኪያጅን ያሳውቁ" : "File disease report & notify manager"}
                </Button>
              ) : (
                <div className="text-center text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 rounded-md py-2">
                  {isAm ? "ሪፖርት ለማስገባት ከላይ መደብ ይምረጡ" : "Pick a bed above to file this as a report"}
                </div>
              )
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
