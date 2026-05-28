"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Beaker, CheckCircle2, Clock, Droplets, Calendar, Plus, Pencil } from "lucide-react";
import { toast } from "sonner";
import type { FertigationRecord, FertigationStatus, ApplicationMethod } from "@/lib/erp-types";
import type { StockItem } from "@/lib/erp-types";
import type { Farmer, Valve, Bed } from "@/lib/types";
import { useLang } from "@/lib/lang";
import { EN, AM } from "@/lib/translations";
import { useOptions } from "@/lib/use-options";

const STATUS_STYLE: Record<FertigationStatus, string> = {
  applied:   "bg-emerald-100 text-emerald-700 border-emerald-200",
  scheduled: "bg-blue-100 text-blue-700 border-blue-200",
  skipped:   "bg-slate-100 text-slate-500 border-slate-200",
};
const METHOD_STYLE: Record<ApplicationMethod, string> = {
  drip:        "bg-blue-100 text-blue-700",
  foliar:      "bg-purple-100 text-purple-700",
  soil_drench: "bg-amber-100 text-amber-700",
};
function emptyForm() {
  const today    = new Date().toISOString().split("T")[0];
  const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
  return {
    valveId: "", bedId: "",
    fertilizerType: "NPK 20-20-20", activeIngredient: "Nitrogen, Phosphorus, Potassium",
    dosageGPerL: 2.5, waterVolumeLiters: 400,
    applicationDate: today, nextScheduleDate: nextWeek,
    responsibleWorkerId: "", applicationMethod: "drip" as ApplicationMethod,
    status: "scheduled" as FertigationStatus, cost: 300, notes: "",
  };
}

function parseStockItem(raw: Record<string, unknown>): StockItem {
  return {
    ...raw,
    currentQty:   parseFloat((raw.currentQty as { toString(): string }).toString()),
    reorderLevel: parseFloat((raw.reorderLevel as { toString(): string }).toString()),
    maxCapacity:  parseFloat((raw.maxCapacity as { toString(): string }).toString()),
    costPerUnit:  parseFloat((raw.costPerUnit as { toString(): string }).toString()),
  } as StockItem;
}

function parseFertigationRecord(raw: Record<string, unknown>): FertigationRecord {
  return {
    ...raw,
    cost: parseFloat((raw.cost as { toString(): string }).toString()),
  } as FertigationRecord;
}

export default function FertigationPage() {
  const { isAm } = useLang();
  const t = isAm ? AM : EN;
  const options = useOptions();
  const [records, setRecords]   = useState<FertigationRecord[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [valves, setValves]     = useState<Valve[]>([]);
  const [beds, setBeds]         = useState<Bed[]>([]);
  const [farmers, setFarmers]   = useState<Farmer[]>([]);
  const [filter, setFilter]     = useState<FertigationStatus | "all">("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<FertigationRecord | null>(null);
  const [form, setForm] = useState(emptyForm());

  useEffect(() => {
    fetch("/api/fertigation").then(r => r.json()).then((data: Record<string, unknown>[]) => setRecords(data.map(parseFertigationRecord)));
    fetch("/api/stock").then(r => r.json()).then((data: Record<string, unknown>[]) => setStockItems(data.map(parseStockItem)));
    fetch("/api/valves").then(r => r.json()).then(setValves);
    fetch("/api/beds").then(r => r.json()).then(setBeds);
    fetch("/api/farmers").then(r => r.json()).then(setFarmers);
  }, []);

  function openCreate() {
    setForm({ ...emptyForm(), valveId: valves[0]?.id ?? "", responsibleWorkerId: farmers.filter(f => f.role === "farmer")[0]?.id ?? "" });
    setCreateOpen(true);
  }

  function openEdit(r: FertigationRecord) {
    setForm({
      valveId: r.valveId, bedId: r.bedId ?? "",
      fertilizerType: r.fertilizerType, activeIngredient: r.activeIngredient,
      dosageGPerL: r.dosageGPerL, waterVolumeLiters: r.waterVolumeLiters,
      applicationDate: r.applicationDate, nextScheduleDate: r.nextScheduleDate,
      responsibleWorkerId: r.responsibleWorkerId, applicationMethod: r.applicationMethod,
      status: r.status, cost: r.cost, notes: r.notes ?? "",
    });
    setEditTarget(r);
  }

  async function handleCreate() {
    if (!form.valveId)              { toast.error("Please select a valve"); return; }
    if (!form.responsibleWorkerId)  { toast.error("Please select a responsible worker"); return; }
    const body = {
      valveId: form.valveId, bedId: form.bedId || undefined,
      fertilizerType: form.fertilizerType, activeIngredient: form.activeIngredient,
      dosageGPerL: form.dosageGPerL, waterVolumeLiters: form.waterVolumeLiters,
      applicationDate: form.applicationDate, nextScheduleDate: form.nextScheduleDate,
      responsibleWorkerId: form.responsibleWorkerId, applicationMethod: form.applicationMethod,
      status: form.status, cost: form.cost, notes: form.notes || undefined,
    };
    const res = await fetch("/api/fertigation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) { toast.error("Failed to create record"); return; }
    const newRec = await res.json() as Record<string, unknown>;
    setRecords(prev => [...prev, parseFertigationRecord(newRec)]);
    toast.success(`${form.fertilizerType} scheduled`);
    setCreateOpen(false);
  }

  async function handleEdit() {
    if (!editTarget) return;
    const body = {
      valveId: form.valveId, bedId: form.bedId || undefined,
      fertilizerType: form.fertilizerType, activeIngredient: form.activeIngredient,
      dosageGPerL: form.dosageGPerL, waterVolumeLiters: form.waterVolumeLiters,
      applicationDate: form.applicationDate, nextScheduleDate: form.nextScheduleDate,
      responsibleWorkerId: form.responsibleWorkerId, applicationMethod: form.applicationMethod,
      status: form.status, cost: form.cost, notes: form.notes || undefined,
    };
    const res = await fetch(`/api/fertigation/${editTarget.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) { toast.error("Failed to update record"); return; }
    const updated = await res.json() as Record<string, unknown>;
    setRecords(prev => prev.map(r => r.id === editTarget.id ? parseFertigationRecord(updated) : r));
    toast.success(`${form.fertilizerType} updated`);
    setEditTarget(null);
  }

  const filtered   = filter === "all" ? records : records.filter(r => r.status === filter);
  const applied    = records.filter(r => r.status === "applied").length;
  const scheduled  = records.filter(r => r.status === "scheduled").length;
  const totalCost  = records.filter(r => r.status === "applied").reduce((s, r) => s + r.cost, 0);
  const totalLiters = records.filter(r => r.status === "applied").reduce((s, r) => s + r.waterVolumeLiters, 0);

  const valveBeds = (valveId: string) => beds.filter(b => b.valveId === valveId);

  function findStockItem(fertType: string) {
    if (!fertType) return null;
    const lower = fertType.toLowerCase();
    return stockItems.find(s =>
      s.category === "fertilizer" &&
      (s.name.toLowerCase().includes(lower) || lower.includes(s.name.toLowerCase().split(" ")[0]))
    ) ?? null;
  }

  function FertigationForm() {
    const fertilizerValues = [...options.fertilizers.map(f => f.value), "Other"];
    const stockItem = findStockItem(form.fertilizerType);
    const neededKg  = (form.dosageGPerL * form.waterVolumeLiters) / 1000;
    const hasEnough = stockItem ? stockItem.currentQty >= neededKg : true;
    const stockPct  = stockItem ? Math.min(100, (stockItem.currentQty / stockItem.maxCapacity) * 100) : null;

    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Valve <span className="text-red-500">*</span></label>
            <select value={form.valveId}
              onChange={e => setForm(p => ({ ...p, valveId: e.target.value, bedId: "" }))}
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white">
              <option value="">— Select —</option>
              {valves.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Bed (optional)</label>
            <select value={form.bedId}
              onChange={e => setForm(p => ({ ...p, bedId: e.target.value }))}
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white"
              disabled={!form.valveId}>
              <option value="">— None —</option>
              {valveBeds(form.valveId).map(b => <option key={b.id} value={b.id}>{b.id}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-700 block mb-1">Fertilizer Type</label>
          <select value={fertilizerValues.includes(form.fertilizerType) ? form.fertilizerType : "Other"}
            onChange={e => {
              const picked = options.fertilizers.find(f => f.value === e.target.value);
              setForm(p => ({
                ...p,
                fertilizerType: e.target.value === "Other" ? "" : e.target.value,
                activeIngredient: String(picked?.meta?.activeIngredient ?? p.activeIngredient),
              }));
            }}
            className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white">
            {options.fertilizers.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            <option value="Other">Other</option>
          </select>
          {!options.fertilizers.some(f => f.value === form.fertilizerType) && (
            <input value={form.fertilizerType}
              onChange={e => setForm(p => ({ ...p, fertilizerType: e.target.value }))}
              placeholder="Enter fertilizer name..."
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm mt-1" />
          )}
          {/* Flow 2: live stock check */}
          {stockItem && (
            <div className={`mt-2 rounded-lg border px-3 py-2 ${!hasEnough ? "bg-red-50 border-red-200" : stockItem.currentQty <= stockItem.reorderLevel ? "bg-amber-50 border-amber-200" : "bg-emerald-50 border-emerald-200"}`}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className={`font-semibold ${!hasEnough ? "text-red-700" : stockItem.currentQty <= stockItem.reorderLevel ? "text-amber-700" : "text-emerald-700"}`}>
                  {!hasEnough ? t.fertigation.insufficientStock : stockItem.currentQty <= stockItem.reorderLevel ? t.fertigation.lowStock : t.fertigation.stockOk}
                </span>
                <span className="text-slate-500 tabular-nums">{stockItem.currentQty.toFixed(2)} / {stockItem.maxCapacity} {stockItem.unit}</span>
              </div>
              <div className="w-full bg-white/60 rounded-full h-1.5 overflow-hidden">
                <div className={`h-full rounded-full ${!hasEnough ? "bg-red-500" : stockItem.currentQty <= stockItem.reorderLevel ? "bg-amber-400" : "bg-emerald-500"}`}
                  style={{ width: `${stockPct}%` }} />
              </div>
              <div className="flex justify-between text-[10px] mt-1 text-slate-500">
                <span>{t.fertigation.needed}: <strong>{neededKg.toFixed(2)} kg</strong> ({form.dosageGPerL}g/L × {form.waterVolumeLiters}L)</span>
                <span>{t.fertigation.afterUse}: {Math.max(0, stockItem.currentQty - neededKg).toFixed(2)} kg</span>
              </div>
            </div>
          )}
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-700 block mb-1">Active Ingredient</label>
          <input value={form.activeIngredient}
            onChange={e => setForm(p => ({ ...p, activeIngredient: e.target.value }))}
            placeholder="e.g. Nitrogen, Phosphorus, Potassium"
            className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Dosage (g/L)</label>
            <input type="number" min={0.1} step={0.1} value={form.dosageGPerL}
              onChange={e => setForm(p => ({ ...p, dosageGPerL: Number(e.target.value) }))}
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Volume (L)</label>
            <input type="number" min={1} value={form.waterVolumeLiters}
              onChange={e => setForm(p => ({ ...p, waterVolumeLiters: Number(e.target.value) }))}
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Cost (ETB)</label>
            <input type="number" min={0} value={form.cost}
              onChange={e => setForm(p => ({ ...p, cost: Number(e.target.value) }))}
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Application Date</label>
            <input type="date" value={form.applicationDate}
              onChange={e => setForm(p => ({ ...p, applicationDate: e.target.value }))}
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Next Schedule</label>
            <input type="date" value={form.nextScheduleDate}
              onChange={e => setForm(p => ({ ...p, nextScheduleDate: e.target.value }))}
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Method</label>
            <select value={form.applicationMethod}
              onChange={e => setForm(p => ({ ...p, applicationMethod: e.target.value as ApplicationMethod }))}
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white">
              {options.applicationMethods.map(m => <option key={m.value} value={m.value} className="capitalize">{m.label.replace("_", " ")}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Responsible Worker</label>
            <select value={form.responsibleWorkerId}
              onChange={e => setForm(p => ({ ...p, responsibleWorkerId: e.target.value }))}
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white">
              <option value="">— Select —</option>
              {farmers.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-700 block mb-1">Status</label>
          <select value={form.status}
            onChange={e => setForm(p => ({ ...p, status: e.target.value as FertigationStatus }))}
            className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white capitalize">
            {options.fertigationStatuses.map(s => <option key={s.value} value={s.value} className="capitalize">{s.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-700 block mb-1">Notes</label>
          <input value={form.notes}
            onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
            placeholder="Optional notes..."
            className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-[1400px] mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Beaker className="size-5 text-violet-600" />
            <h1 className="text-2xl font-bold text-slate-900">{t.fertigation.title}</h1>
          </div>
          <p className="text-slate-500 text-sm">{t.fertigation.subtitle}</p>
        </div>
        <Button onClick={openCreate} className="bg-violet-600 hover:bg-violet-700 gap-2">
          <Plus className="size-4" /> {t.fertigation.scheduleApplication}
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4 bg-emerald-50 border-emerald-200">
          <div className="text-2xl font-bold text-emerald-700 tabular-nums">{applied}</div>
          <div className="text-xs text-emerald-600 font-medium flex items-center gap-1 mt-0.5"><CheckCircle2 className="size-3" /> {t.common.applied}</div>
        </Card>
        <Card className="p-4 bg-blue-50 border-blue-200">
          <div className="text-2xl font-bold text-blue-700 tabular-nums">{scheduled}</div>
          <div className="text-xs text-blue-600 font-medium flex items-center gap-1 mt-0.5"><Clock className="size-3" /> {t.common.scheduled}</div>
        </Card>
        <Card className="p-4 bg-violet-50 border-violet-200">
          <div className="text-lg font-bold text-violet-700 tabular-nums">{totalLiters.toLocaleString()} L</div>
          <div className="text-xs text-violet-600 font-medium flex items-center gap-1 mt-0.5"><Droplets className="size-3" /> {t.fertigation.waterApplied}</div>
        </Card>
        <Card className="p-4 bg-amber-50 border-amber-200">
          <div className="text-lg font-bold text-amber-700 tabular-nums">{totalCost.toLocaleString()} ETB</div>
          <div className="text-xs text-amber-600 font-medium flex items-center gap-1 mt-0.5"><Beaker className="size-3" /> {t.fertigation.inputCost}</div>
        </Card>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit">
        {(["all", "applied", "scheduled", "skipped"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all capitalize ${filter === f ? "bg-white shadow text-slate-900" : "text-slate-500 hover:text-slate-700"}`}>
            {f}
          </button>
        ))}
      </div>

      {/* Table */}
      <Card className="border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full pro-table">
            <thead>
              <tr>
                <th>Valve / Bed</th><th>Fertilizer</th><th>Method</th>
                <th>g/L</th><th>Volume</th><th>Applied</th>
                <th>Next Due</th><th>Responsible</th><th>Cost</th>
                <th>Status</th><th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(rec => {
                const valve = valves.find(v => v.id === rec.valveId);
                const worker = farmers.find(f => f.id === rec.responsibleWorkerId);
                return (
                  <tr key={rec.id} className="group">
                    <td>
                      <div>
                        <span className="text-xs font-semibold" style={{ color: valve?.color }}>{valve?.name}</span>
                        {rec.bedId && <div className="text-[10px] font-mono text-slate-400">{rec.bedId}</div>}
                      </div>
                    </td>
                    <td>
                      <div className="font-medium text-sm">{rec.fertilizerType}</div>
                      <div className="text-[10px] text-slate-400 max-w-[160px] truncate">{rec.activeIngredient}</div>
                    </td>
                    <td>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold capitalize ${METHOD_STYLE[rec.applicationMethod]}`}>
                        {rec.applicationMethod.replace("_", " ")}
                      </span>
                    </td>
                    <td className="tabular-nums text-center">{rec.dosageGPerL}</td>
                    <td className="tabular-nums text-center">{rec.waterVolumeLiters} L</td>
                    <td className="tabular-nums text-xs">
                      {new Date(rec.applicationDate).toLocaleDateString("en", { month: "short", day: "numeric" })}
                    </td>
                    <td className="tabular-nums text-xs">
                      <span className="flex items-center gap-1">
                        <Calendar className="size-3 text-slate-400" />
                        {new Date(rec.nextScheduleDate).toLocaleDateString("en", { month: "short", day: "numeric" })}
                      </span>
                    </td>
                    <td className="text-xs">{worker?.name.split(" ")[0]}</td>
                    <td className="tabular-nums font-semibold text-right">{rec.cost.toLocaleString()}</td>
                    <td><Badge className={`text-[10px] capitalize ${STATUS_STYLE[rec.status]}`}>{rec.status}</Badge></td>
                    <td>
                      <button onClick={() => openEdit(rec)}
                        className="size-6 rounded bg-slate-100 hover:bg-slate-200 grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Pencil className="size-3 text-slate-600" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── Create ─────────────────────────────────────────────────────────── */}
      <Dialog open={createOpen} onOpenChange={o => !o && setCreateOpen(false)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="size-4 text-violet-600" /> {t.fertigation.scheduleApplication}
            </DialogTitle>
          </DialogHeader>
          <FertigationForm />
          <div className="flex gap-2 mt-2">
            <Button variant="outline" className="flex-1" onClick={() => setCreateOpen(false)}>{t.common.cancel}</Button>
            <Button className="flex-1 bg-violet-600 hover:bg-violet-700" onClick={handleCreate}>{t.common.create}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Edit ───────────────────────────────────────────────────────────── */}
      <Dialog open={!!editTarget} onOpenChange={o => !o && setEditTarget(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="size-4 text-slate-600" /> {t.common.edit} {t.fertigation.title}
            </DialogTitle>
          </DialogHeader>
          <FertigationForm />
          <div className="flex gap-2 mt-2">
            <Button variant="outline" className="flex-1" onClick={() => setEditTarget(null)}>{t.common.cancel}</Button>
            <Button className="flex-1 bg-violet-600 hover:bg-violet-700" onClick={handleEdit}>{t.common.save}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
