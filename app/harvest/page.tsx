"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Wheat, Plus, Package, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { BEDS, FARMERS, HARVESTS, getBed, getValve, getFarmer } from "@/lib/data";

type PackPrompt = { bedId: string; kg: number; grade: "A" | "B" | "C" };

export default function HarvestPage() {
  const [bedId, setBedId] = useState("A-BED-01");
  const [kg, setKg] = useState("");
  const [farmerId, setFarmerId] = useState("f-001");
  const [grade, setGrade] = useState<"A"|"B"|"C">("A");
  const [refresh, setRefresh] = useState(0);
  const [packPrompt, setPackPrompt] = useState<PackPrompt | null>(null);

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
      setRefresh(r => r + 1);
    } else {
      toast.error("Failed to log harvest");
    }
  }

  const beds = BEDS();
  const recent = [...HARVESTS()].sort((a,b)=>b.date.localeCompare(a.date)).slice(0, 30);
  void refresh;

  return (
    <>
    <div className="p-6 md:p-8 max-w-[1400px] mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Wheat className="size-6 text-rose-600" /> Harvest Collection</h1>
        <p className="text-stone-500 text-sm">Record berries picked from each bed · workers update via phone / QR scan</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-1">
          <h3 className="font-bold mb-3 flex items-center gap-2"><Plus className="size-4 text-emerald-600" /> Record harvest</h3>
          <form onSubmit={submit} className="space-y-3">
            <div>
              <Label className="text-xs">Bed</Label>
              <select value={bedId} onChange={e=>setBedId(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm bg-white">
                {beds.map(b => <option key={b.id} value={b.id}>{b.id} — {b.variety}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs">Weight (kg)</Label>
              <Input type="number" step="0.1" min="0" value={kg} onChange={e=>setKg(e.target.value)} placeholder="e.g. 14.5" />
            </div>
            <div>
              <Label className="text-xs">Farmer</Label>
              <select value={farmerId} onChange={e=>setFarmerId(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm bg-white">
                {FARMERS.filter(f=>f.role==="farmer").map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs">Quality grade</Label>
              <div className="grid grid-cols-3 gap-2">
                {(["A","B","C"] as const).map(g => (
                  <button key={g} type="button" onClick={()=>setGrade(g)} className={`py-2 rounded-md text-sm font-semibold border ${grade===g?"bg-emerald-600 text-white border-emerald-600":"bg-white text-stone-700"}`}>{g}</button>
                ))}
              </div>
            </div>
            <Button type="submit" className="w-full">Log harvest</Button>
          </form>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <h3 className="font-bold mb-3">Recent harvests</h3>
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-sm">
              <thead className="text-[11px] uppercase tracking-wider text-stone-500 border-b">
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
                    <tr key={h.id} className="border-b last:border-0 hover:bg-stone-50">
                      <td className="py-2.5 px-5 text-stone-500 text-xs">{new Date(h.date).toLocaleDateString("en",{month:"short",day:"numeric"})}</td>
                      <td className="py-2.5"><span className="text-xs font-medium" style={{color:v?.color}}>{v?.name}</span></td>
                      <td className="py-2.5"><Link href={`/beds/${h.bedId}`} className="font-mono font-semibold hover:text-emerald-700">{h.bedId}</Link></td>
                      <td className="py-2.5 text-stone-600 text-xs">{f?.name}</td>
                      <td className="py-2.5"><Badge variant="outline" className="text-[10px]">Grade {h.qualityGrade}</Badge></td>
                      <td className="py-2.5 px-5 text-right font-semibold tabular-nums">{h.kg.toFixed(1)}</td>
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
            <Package className="size-4 text-violet-600" /> Pack this harvest?
          </DialogTitle>
        </DialogHeader>
        {packPrompt && (
          <div className="space-y-4">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm">
              <div className="font-semibold text-slate-800">{packPrompt.kg} kg from {packPrompt.bedId}</div>
              <div className="text-slate-500 text-xs mt-0.5">Grade {packPrompt.grade} · Logged just now</div>
            </div>
            <p className="text-sm text-slate-600">
              Ready to create a packaging batch for this harvest? This will open the packaging page with the details pre-filled.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setPackPrompt(null)}>
                Later
              </Button>
              <Link href={`/packaging?bedId=${packPrompt.bedId}&kg=${packPrompt.kg}&grade=${packPrompt.grade}`} className="flex-1">
                <Button className="w-full bg-violet-600 hover:bg-violet-700 gap-2" onClick={() => setPackPrompt(null)}>
                  Pack Now <ArrowRight className="size-3.5" />
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
