"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Wheat, Plus, Package, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/lib/lang";
import { EN, AM } from "@/lib/translations";
import type { Bed, Farmer, HarvestRecord, Valve } from "@/lib/types";

type PackPrompt = { bedId: string; kg: number; grade: "A" | "B" | "C" };

export default function HarvestPage() {
  const { isAm } = useLang();
  const t = isAm ? AM : EN;
  const [bedId, setBedId] = useState("");
  const [kg, setKg] = useState("");
  const [farmerId, setFarmerId] = useState("");
  const [grade, setGrade] = useState<"A"|"B"|"C">("A");
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
      if (b.length > 0) setBedId(b[0].id);
      const farmers = f as Farmer[];
      const firstFarmer = farmers.find(fm => fm.role === "farmer");
      if (firstFarmer) setFarmerId(firstFarmer.id);
    });
    loadHarvests();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!kg || +kg <= 0) {
      toast.error("Enter a valid weight");
      return;
    }
    const res = await fetch("/api/harvest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bedId, kg: +kg, farmerId, qualityGrade: grade,
        date: new Date().toISOString().split("T")[0],
      }),
    });
    if (res.ok) {
      toast.success(`Logged ${kg}kg from ${bedId}`, { description: "Updated valve totals & farmer performance." });
      // Flow 4: prompt to create packaging batch
      setPackPrompt({ bedId, kg: +kg, grade });
      setKg("");
      loadHarvests();
    } else {
      toast.error("Failed to log harvest");
    }
  }

  const recent = harvests;

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
            <div>
              <Label className="text-xs">Bed</Label>
              <select value={bedId} onChange={e=>setBedId(e.target.value)} className="w-full border border-border rounded-md px-3 py-2 text-sm bg-card">
                {beds.map(b => <option key={b.id} value={b.id}>{b.id} — {b.variety}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs">{t.harvest.weight}</Label>
              <Input type="number" step="0.1" min="0" value={kg} onChange={e=>setKg(e.target.value)} placeholder="e.g. 14.5" />
            </div>
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
            <Button type="submit" className="w-full">{t.harvest.logHarvest}</Button>
          </form>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <h3 className="font-bold mb-3">{t.harvest.recentHarvests}</h3>
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-sm">
              <thead className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                <tr>
                  <th className="text-left py-2 px-5">Date</th>
                  <th className="text-left py-2">Valve</th>
                  <th className="text-left py-2">Bed</th>
                  <th className="text-left py-2">Farmer</th>
                  <th className="text-left py-2">Grade</th>
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
