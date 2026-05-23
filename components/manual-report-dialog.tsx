"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Bug, Upload, X, Eye, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { DISEASE_LABELS, DISEASE_TREATMENTS, type DiseaseType, type Valve, type Bed } from "@/lib/types";

const DISEASE_TYPES = Object.entries(DISEASE_LABELS) as [DiseaseType, string][];

interface Props {
  onReported?: () => void;
}

export function ManualReportDialog({ onReported }: Props) {
  const { user, isManager } = useAuth();
  const [open, setOpen] = useState(false);
  const [bedId, setBedId] = useState("");
  const [type, setType] = useState<DiseaseType | "">("");
  const [severity, setSeverity] = useState(30);
  const [infectedLengthM, setInfectedLengthM] = useState<number>(0);
  const [notes, setNotes] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoName, setPhotoName] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [valves, setValves] = useState<Valve[]>([]);
  const [beds, setBeds] = useState<Bed[]>([]);

  useEffect(() => {
    fetch("/api/valves").then(r => r.json()).then(setValves);
    fetch("/api/beds").then(r => r.json()).then(setBeds);
  }, []);

  const assignedValves = user?.assignedValves ?? [];
  const availableBeds = isManager ? beds : beds.filter(b => assignedValves.includes(b.valveId));

  const bedsByValve = (isManager ? valves : valves.filter(v => assignedValves.includes(v.id))).map(v => ({
    valve: v,
    beds: beds.filter(b => b.valveId === v.id),
  }));

  function reset() {
    setBedId("");
    setType("");
    setSeverity(30);
    setInfectedLengthM(0);
    setNotes("");
    setPhoto(null);
    setPhotoName("");
    setPreviewUrl(null);
  }

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoName(file.name);
    const reader = new FileReader();
    reader.onload = ev => setPhoto(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function submit() {
    if (!bedId || !type) return;
    setLoading(true);
    try {
      const res = await fetch("/api/disease/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bedId,
          type,
          severity,
          reportedBy: user?.id,
          suggestedTreatment: DISEASE_TREATMENTS[type],
          notes: notes || undefined,
          photo: photo || undefined,
          infectedLengthM: infectedLengthM > 0 ? infectedLengthM : undefined,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Disease report filed", {
        description: "Manager notified via Telegram & SMS.",
      });
      reset();
      setOpen(false);
      onReported?.();
    } catch (e) {
      toast.error("Failed to submit report", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  }

  const severityColor =
    severity > 60 ? "text-red-600" : severity > 30 ? "text-amber-600" : "text-emerald-600";

  return (
    <>
      <Dialog open={open} onOpenChange={o => { if (!o) reset(); setOpen(o); }}>
        <DialogTrigger
          render={(props) => (
            <Button variant="outline" className="gap-2 border-red-300 text-red-700 hover:bg-red-50" {...props}>
              <Bug className="size-4" /> Report Manually
            </Button>
          )}
        />

        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bug className="size-5 text-red-600" />
              Report Disease Manually
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Bed selector */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                Affected Bed <span className="text-red-500">*</span>
              </label>
              <select
                value={bedId}
                onChange={e => setBedId(e.target.value)}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="">Select a bed…</option>
                {bedsByValve.map(({ valve, beds }) => (
                  <optgroup key={valve.id} label={`${valve.name} (${beds.length} beds)`}>
                    {beds.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.id} — {b.variety}
                        {b.health !== "healthy" ? ` ⚠ ${b.health}` : ""}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              {availableBeds.length === 0 && (
                <p className="text-[11px] text-red-500 mt-1">No beds in your assigned zones.</p>
              )}
            </div>

            {/* Disease type */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                Disease Type <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-1 gap-1.5">
                {DISEASE_TYPES.map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setType(key)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-left text-sm transition-all ${
                      type === key
                        ? "border-red-500 bg-red-50 text-red-900"
                        : "border-slate-200 hover:border-slate-300 text-slate-700"
                    }`}
                  >
                    <span className={`size-2 rounded-full shrink-0 ${type === key ? "bg-red-500" : "bg-slate-300"}`} />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Severity */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-700">Severity</label>
                <Badge variant="outline" className={`text-xs font-bold ${severityColor}`}>
                  {severity}%
                </Badge>
              </div>
              <input
                type="range"
                min={1}
                max={100}
                value={severity}
                onChange={e => setSeverity(Number(e.target.value))}
                className="w-full accent-red-600"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                <span>Mild</span>
                <span>Moderate</span>
                <span>Severe</span>
              </div>
            </div>

            {/* Infected length */}
            {(() => {
              const bed = bedId ? beds.find(b => b.id === bedId) : null;
              const bedLen = bed?.lengthM ?? 0;
              const autoEst = bedLen > 0 ? Math.round(bedLen * (severity / 100) * 10) / 10 : 0;
              const displayLen = infectedLengthM > 0 ? infectedLengthM : autoEst;
              const pct = bedLen > 0 ? Math.round((displayLen / bedLen) * 100) : 0;
              return (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-700">
                      Infected Length (metres)
                    </label>
                    {bedLen > 0 && (
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        pct > 60 ? "bg-red-100 text-red-700" : pct > 30 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                      }`}>
                        {pct}% of {bedLen}m
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={bedLen || 999}
                      step={0.5}
                      value={infectedLengthM || ""}
                      placeholder={autoEst > 0 ? `${autoEst} (auto)` : "e.g. 12"}
                      onChange={e => setInfectedLengthM(Number(e.target.value))}
                      className="w-28 border border-slate-200 rounded-md px-3 py-2 text-sm text-center tabular-nums focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                    <span className="text-sm text-slate-500">
                      {bedLen > 0 ? `of ${bedLen}m total` : "metres infected"}
                    </span>
                  </div>
                  {autoEst > 0 && !infectedLengthM && (
                    <p className="text-[10px] text-slate-400 mt-1 italic">
                      Auto-estimated from severity ({severity}%). Enter exact value if known.
                    </p>
                  )}
                </div>
              );
            })()}

            {/* Notes */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">Observations (optional)</label>
              <Textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Describe what you observed — affected leaves, fruit, spread…"
                rows={2}
                className="text-sm resize-none"
              />
            </div>

            {/* Photo upload */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">Photo (optional)</label>
              {photo ? (
                <div className="relative rounded-lg overflow-hidden border border-slate-200">
                  <img src={photo} alt="Disease" className="w-full max-h-40 object-cover" />
                  <div className="absolute top-2 right-2 flex gap-1">
                    <button
                      onClick={() => setPreviewUrl(photo)}
                      className="size-7 rounded-full bg-black/60 text-white grid place-items-center hover:bg-black/80"
                    >
                      <Eye className="size-3.5" />
                    </button>
                    <button
                      onClick={() => { setPhoto(null); setPhotoName(""); }}
                      className="size-7 rounded-full bg-black/60 text-white grid place-items-center hover:bg-black/80"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                  <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[10px] px-2 py-1 truncate">
                    {photoName}
                  </div>
                </div>
              ) : (
                <label className="flex flex-col items-center gap-2 p-4 rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 hover:bg-slate-100 cursor-pointer transition-colors">
                  <Upload className="size-5 text-slate-400" />
                  <span className="text-xs text-slate-500">
                    <span className="font-semibold text-slate-600">Click to upload</span> or take photo
                  </span>
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhoto} />
                </label>
              )}
            </div>

            <Button
              className="w-full bg-red-600 hover:bg-red-700 gap-2"
              disabled={!bedId || !type || loading}
              onClick={submit}
            >
              {loading
                ? <><Loader2 className="size-4 animate-spin" /> Submitting…</>
                : <><Send className="size-4" /> Submit Report & Notify Manager</>
              }
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Photo preview lightbox */}
      {previewUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPreviewUrl(null)}
        >
          <div className="relative max-w-2xl w-full" onClick={e => e.stopPropagation()}>
            <img src={previewUrl} alt="Disease" className="w-full rounded-xl shadow-2xl" />
            <button
              onClick={() => setPreviewUrl(null)}
              className="absolute top-3 right-3 size-8 rounded-full bg-black/60 text-white grid place-items-center hover:bg-black/80"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
