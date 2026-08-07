"use client";

import { useRef, useState } from "react";
import { Camera, Upload, X, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { resizeDiseasePhoto } from "@/lib/resize-image";

export type Angle = { data: string; angle?: string | null };

/** Suggestions, not a fixed list — the reporter can type anything. */
const SUGGESTED = ["Whole plant", "Leaf top", "Leaf underside", "Fruit", "Stem / crown", "Close-up"];

type Props = {
  photos: Angle[];
  onChange: (next: Angle[]) => void;
  max?: number;
  /** Called once per newly added photo, e.g. to re-run detection. */
  onAdded?: (all: Angle[]) => void;
  label?: string;
  hint?: string;
};

/**
 * Capture the same problem from several angles.
 *
 * Every image is resized before it leaves the phone — a raw capture is several
 * MB of base64 and these are stored in the database, so a handful of angles
 * would otherwise be tens of MB per report.
 */
export function PhotoAngles({
  photos, onChange, max = 6, onAdded,
  label = "Photos",
  hint = "Add a few angles — the AI reads them together.",
}: Props) {
  const camRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const full = photos.length >= max;

  async function addFiles(list: FileList | null) {
    if (!list?.length) return;
    const room = max - photos.length;
    if (room <= 0) { toast.error(`Up to ${max} photos`); return; }

    setBusy(true);
    const added: Angle[] = [];
    for (const file of Array.from(list).slice(0, room)) {
      try {
        added.push({ data: await resizeDiseasePhoto(file) });
      } catch {
        toast.error(`Couldn't read ${file.name}`);
      }
    }
    setBusy(false);
    if (added.length === 0) return;

    const next = [...photos, ...added];
    onChange(next);
    onAdded?.(next);
    if (list.length > room) toast.info(`Added ${room} — limit is ${max} photos`);
  }

  function setAngle(i: number, angle: string) {
    onChange(photos.map((p, idx) => (idx === i ? { ...p, angle } : p)));
  }

  function remove(i: number) {
    onChange(photos.filter((_, idx) => idx !== i));
  }

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <label className="text-xs font-semibold text-foreground">
          {label} {photos.length > 0 && <span className="text-muted-foreground">({photos.length}/{max})</span>}
        </label>
        {photos.length > 0 && !full && (
          <button type="button" onClick={() => camRef.current?.click()}
            className="text-[11px] font-semibold text-primary hover:underline inline-flex items-center gap-1">
            <Plus className="size-3" /> Add angle
          </button>
        )}
      </div>

      {photos.length === 0 ? (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => camRef.current?.click()} disabled={busy}
            className="flex flex-col items-center gap-1.5 border border-dashed border-border rounded-lg py-5 hover:bg-accent transition-colors disabled:opacity-50">
            {busy ? <Loader2 className="size-5 animate-spin text-primary" /> : <Camera className="size-5 text-primary" />}
            <span className="text-[11px] font-medium">Take photo</span>
          </button>
          <button type="button" onClick={() => fileRef.current?.click()} disabled={busy}
            className="flex flex-col items-center gap-1.5 border border-dashed border-border rounded-lg py-5 hover:bg-accent transition-colors disabled:opacity-50">
            <Upload className="size-5 text-muted-foreground" />
            <span className="text-[11px] font-medium">Upload</span>
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2">
            {photos.map((p, i) => (
              <div key={i} className="relative rounded-lg overflow-hidden border border-border bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.data} alt={p.angle ?? `Angle ${i + 1}`} className="w-full h-20 object-cover" />
                <button type="button" onClick={() => remove(i)} aria-label="Remove photo"
                  className="absolute top-1 right-1 size-6 rounded-full bg-black/65 text-white grid place-items-center hover:bg-black/85">
                  <X className="size-3" />
                </button>
                <input
                  value={p.angle ?? ""}
                  onChange={e => setAngle(i, e.target.value)}
                  list="photo-angle-suggestions"
                  placeholder={`Angle ${i + 1}`}
                  className="w-full text-[10px] px-1.5 py-1 bg-card border-t border-border text-foreground outline-none"
                />
              </div>
            ))}
            {!full && (
              <button type="button" onClick={() => camRef.current?.click()} disabled={busy}
                className="h-[calc(5rem+1.65rem)] flex flex-col items-center justify-center gap-1 border border-dashed border-border rounded-lg hover:bg-accent transition-colors disabled:opacity-50">
                {busy ? <Loader2 className="size-4 animate-spin text-primary" /> : <Plus className="size-4 text-primary" />}
                <span className="text-[10px] font-medium">Add</span>
              </button>
            )}
          </div>
          <datalist id="photo-angle-suggestions">
            {SUGGESTED.map(s => <option key={s} value={s} />)}
          </datalist>
        </div>
      )}

      <p className="text-[10px] text-muted-foreground mt-1.5">{hint}</p>

      {/* `capture` opens the camera on a phone; the other one is the gallery */}
      <input ref={camRef} type="file" accept="image/*" capture="environment" multiple className="hidden"
        onChange={e => { addFiles(e.target.files); e.target.value = ""; }} />
      <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
        onChange={e => { addFiles(e.target.files); e.target.value = ""; }} />
    </div>
  );
}
