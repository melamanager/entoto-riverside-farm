"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Wheat, Plus, Package, ArrowRight, MessageSquareText } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/lib/lang";
import { EN, AM } from "@/lib/translations";
import type { Bed, Farmer, HarvestRecord, Valve } from "@/lib/types";

type PackPrompt = { bedId: string; kg: number; grade: "A" | "B" | "C" };

export default function HarvestPage() {
  const { isAm } = useLang();
  const t = isAm ? AM : EN;
  // multi-bed logging: selected bed id -> kg (string while typing)
  const [sel, setSel] = useState<Record<string, string>>({});
  const [fillAll, setFillAll] = useState("");
  const [farmerId, setFarmerId] = useState("");
  const [grade, setGrade] = useState<"A"|"B"|"C">("A");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [packPrompt, setPackPrompt] = useState<PackPrompt | null>(null);

  const [beds, setBeds] = useState<Bed[]>([]);
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [harvests, setHarvests] = useState<HarvestRecord[]>([]);
  const [valves, setValves] = useState<Valve[]>([]);

  function loadHarvests() {
    fetch("/api/harvest").then(r => r.json()).then((h: Array<HarvestRecord & { kg: string | number }>) => {
      const sorted = [...h]
        .map(rec => ({ ...rec, kg: parseFloat(rec.kg.toString()) }))
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 30);
      setHarvests(sorted);
    });
  }

  useEffect(() => {
    Promise.all([
      fetch("/api/beds").then(r => r.json()),
      fetch("/api/farmers").then(r => r.json()),
      fetch("/api/valves").then(r => r.json()),
    ]).then(([b, f, v]) => {
      setBeds(b);
      setFarmers(f);
      setValves(v);
      const farmers = f as Farmer[];
      const firstFarmer = farmers.find(fm => fm.role === "farmer");
      if (firstFarmer) setFarmerId(firstFarmer.id);
    });
    loadHarvests();
  }, []);

  const selCount = Object.keys(sel).length;

  function toggleBed(id: string) {
    setSel(prev => {
      const next = { ...prev };
      if (id in next) delete next[id];
      else next[id] = fillAll || "";
      return next;
    });
  }
  function toggleValve(valveId: string) {
    const vBeds = beds.filter(b => b.valveId === valveId).map(b => b.id);
    const allOn = vBeds.every(id => id in sel);
    setSel(prev => {
      const next = { ...prev };
      for (const id of vBeds) {
        if (allOn) delete next[id];
        else if (!(id in next)) next[id] = fillAll || "";
      }
      return next;
    });
  }
  function applyFillAll(v: string) {
    setFillAll(v);
    setSel(prev => Object.fromEntries(Object.keys(prev).map(id => [id, v])));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const entries = Object.entries(sel);
    if (entries.length === 0) { toast.error("Select at least one bed"); return; }
    const bad = entries.filter(([, v]) => !v || +v <= 0).map(([id]) => id);
    if (bad.length) { toast.error(`Enter kg for: ${bad.join(", ")}`); return; }

    const date = new Date().toLocaleDateString("en-CA");
    const records = entries.map(([bedId, v]) => ({
      bedId, kg: +v, farmerId, qualityGrade: grade, date, note: note.trim() || undefined,
    }));

    setSaving(true);
    const res = await fetch("/api/harvest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(records.length === 1 ? records[0] : records),
    });
    setSaving(false);
    if (!res.ok) { toast.error("Failed to log harvest"); return; }

    const totalKg = records.reduce((s, r) => s + r.kg, 0);
    toast.success(
      records.length === 1
        ? `Logged ${totalKg}kg from ${records[0].bedId}`
        : `Logged ${records.length} beds · ${totalKg.toFixed(1)} kg total`,
      { description: note.trim() ? "Your note was sent to the manager." : "Updated valve totals & farmer performance." },
    );
    // packaging prompt keeps its single-bed flow; for bulk, prompt with the total
    if (records.length === 1) setPackPrompt({ bedId: records[0].bedId, kg: records[0].kg, grade });
    setSel({});
    setFillAll("");
    setNote("");
    loadHarvests();
  }

  // other crops stay separate from the strawberry log
  const [cropFilter, setCropFilter] = useState<string>("");
  const cropOf = (bedId: string) => beds.find(b => b.id === bedId)?.crop ?? "Strawberry";
  const cropsPresent = [...new Set(beds.map(b => b.crop ?? "Strawberry"))];
  const recent = cropFilter ? harvests.filter(h => cropOf(h.bedId) === cropFilter) : harvests;

  function getBed(id: string) { return beds.find(b => b.id === id) ?? null; }
  function getValve(id: string) { return valves.find(v => v.id === id) ?? null; }
  function getFarmer(id: string) { return farmers.find(f => f.id === id) ?? null; }

  return (
    <>
    <div className="p-6 md:p-8 max-w-[1400px] mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Wheat className="size-6 text-rose-600" /> {t.harvest.title}</h1>
        <p className="text-muted-foreground text-sm">{t.harvest.subtitle}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-1">
          <h3 className="font-bold mb-3 flex items-center gap-2"><Plus className="size-4 text-primary" /> {t.harvest.recordHarvest}</h3>
          <form onSubmit={submit} className="space-y-3">
            {/* ── multi-bed picker, grouped by valve ─────────────────────── */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs">Beds</Label>
                <span className="text-[10px] text-muted-foreground">{selCount === 0 ? "tap to select — one or many" : `${selCount} selected`}</span>
              </div>
              <div className="space-y-2 max-h-56 overflow-y-auto rounded-md border border-border p-2">
                {valves.map(v => {
                  const vBeds = beds.filter(b => b.valveId === v.id);
                  if (vBeds.length === 0) return null;
                  const allOn = vBeds.every(b => b.id in sel);
                  return (
                    <div key={v.id}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="size-2 rounded-sm inline-block" style={{ background: v.color }} />
                        <span className="text-[11px] font-bold" style={{ color: v.color }}>{v.name}</span>
                        <button type="button" onClick={() => toggleValve(v.id)}
                          className="ml-auto text-[10px] font-semibold text-muted-foreground hover:text-foreground border border-border rounded px-1.5 py-0.5">
                          {allOn ? "None" : "All"}
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {vBeds.map(b => {
                          const on = b.id in sel;
                          return (
                            <button key={b.id} type="button" onClick={() => toggleBed(b.id)}
                              title={`${b.crop && b.crop !== "Strawberry" ? b.crop + " - " : ""}${b.variety}`}
                              className={`text-[10px] font-mono font-semibold px-2 py-1 rounded-md border transition-colors ${
                                on ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-border hover:bg-accent"
                              }`}>
                              {b.id.replace("-BED-", "-")}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── per-bed kg (shown once beds are selected) ─────────────── */}
            {selCount > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Label className="text-xs shrink-0">{t.harvest.weight}</Label>
                  <Input type="number" step="0.1" min="0" value={fillAll}
                    onChange={e => applyFillAll(e.target.value)}
                    placeholder="same kg for all…" className="h-7 text-xs" />
                </div>
                <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto">
                  {Object.keys(sel).sort().map(id => (
                    <div key={id} className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono font-semibold w-14 shrink-0">{id.replace("-BED-", "-")}</span>
                      <Input type="number" step="0.1" min="0" value={sel[id]}
                        onChange={e => setSel(p => ({ ...p, [id]: e.target.value }))}
                        placeholder="kg" className="h-7 text-xs" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <Label className="text-xs">Farmer</Label>
              <select value={farmerId} onChange={e=>setFarmerId(e.target.value)} className="w-full border border-border rounded-md px-3 py-2 text-sm bg-card">
                {farmers.filter(f=>f.role==="farmer").map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs">{t.harvest.qualityGrade}</Label>
              <div className="grid grid-cols-3 gap-2">
                {(["A","B","C"] as const).map(g => (
                  <button key={g} type="button" onClick={()=>setGrade(g)} className={`py-2 rounded-md text-sm font-semibold border ${grade===g?"bg-primary text-white border-primary":"bg-card text-foreground border-border"}`}>{g}</button>
                ))}
              </div>
            </div>
            {/* ── field note → reaches the manager directly ─────────────── */}
            <div>
              <Label className="text-xs flex items-center gap-1">
                <MessageSquareText className="size-3 text-primary" /> Additional note <span className="text-muted-foreground font-normal">(sent to the manager)</span>
              </Label>
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
                placeholder="e.g. 3 kg spoiled by rain, birds got into A-04…"
                className="w-full border border-border rounded-md px-3 py-2 text-sm bg-card resize-y" />
            </div>
            <Button type="submit" disabled={saving} className="w-full">
              {saving ? "Saving…" : selCount > 1 ? `${t.harvest.logHarvest} (${selCount} beds)` : t.harvest.logHarvest}
            </Button>
          </form>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h3 className="font-bold">{t.harvest.recentHarvests}</h3>
            {cropsPresent.length > 1 && (
              <div className="flex gap-1.5 flex-wrap">
                <button onClick={() => setCropFilter("")}
                  className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${!cropFilter ? "bg-primary/15 text-primary border-primary/30" : "border-border text-muted-foreground hover:text-foreground"}`}>All</button>
                {cropsPresent.map(c => (
                  <button key={c} onClick={() => setCropFilter(cropFilter === c ? "" : c)}
                    className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${cropFilter === c ? "bg-primary/15 text-primary border-primary/30" : "border-border text-muted-foreground hover:text-foreground"}`}>{c}</button>
                ))}
              </div>
            )}
          </div>
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-sm">
              <thead className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                <tr>
                  <th className="text-left py-2 px-5">Date</th>
                  <th className="text-left py-2">Valve</th>
                  <th className="text-left py-2">Bed</th>
                  <th className="text-left py-2">Farmer</th>
                  <th className="text-left py-2">Grade</th>
                  <th className="text-left py-2">Note</th>
                  <th className="text-right py-2 px-5">KG</th>
                </tr>
              </thead>
              <tbody>
                {recent.map(h => {
                  const b = getBed(h.bedId);
                  const v = b ? getValve(b.valveId) : null;
                  const f = getFarmer(h.farmerId);
                  return (
                    <tr key={h.id} className="border-b border-border last:border-0 hover:bg-accent">
                      <td className="py-2.5 px-5 text-muted-foreground text-xs">{new Date(h.date).toLocaleDateString("en",{month:"short",day:"numeric"})}</td>
                      <td className="py-2.5"><span className="text-xs font-medium" style={{color:v?.color}}>{v?.name}</span></td>
                      <td className="py-2.5"><Link href={`/beds/${h.bedId}`} className="font-mono font-semibold hover:text-primary">{h.bedId}</Link></td>
                      <td className="py-2.5 text-muted-foreground text-xs">{f?.name}</td>
                      <td className="py-2.5"><Badge variant="outline" className="text-[10px]">Grade {h.qualityGrade}</Badge></td>
                      <td className="py-2.5 max-w-[180px]">
                        {h.note
                          ? <span className="text-xs text-amber-300 flex items-start gap-1" title={h.note}><MessageSquareText className="size-3 shrink-0 mt-0.5" /><span className="truncate">{h.note}</span></span>
                          : <span className="text-muted-foreground/40 text-xs">—</span>}
                      </td>
                      <td className="py-2.5 px-5 text-right font-semibold tabular-nums">{parseFloat(h.kg.toString()).toFixed(1)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
    {/* Flow 4: packaging prompt after harvest log */}
    <Dialog open={!!packPrompt} onOpenChange={o => !o && setPackPrompt(null)}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="size-4 text-violet-600" /> {t.harvest.packPromptTitle}
          </DialogTitle>
        </DialogHeader>
        {packPrompt && (
          <div className="space-y-4">
            <div className="bg-muted border border-border rounded-lg p-3 text-sm">
              <div className="font-semibold text-foreground">{packPrompt.kg} kg from {packPrompt.bedId}</div>
              <div className="text-muted-foreground text-xs mt-0.5">Grade {packPrompt.grade} · Logged just now</div>
            </div>
            <p className="text-sm text-muted-foreground">{t.harvest.packPromptBody}</p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setPackPrompt(null)}>
                {t.harvest.later}
              </Button>
              <Link href={`/packaging?bedId=${packPrompt.bedId}&kg=${packPrompt.kg}&grade=${packPrompt.grade}`} className="flex-1">
                <Button className="w-full bg-violet-600 hover:bg-violet-700 gap-2" onClick={() => setPackPrompt(null)}>
                  {t.harvest.packNow} <ArrowRight className="size-3.5" />
                </Button>
              </Link>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}
