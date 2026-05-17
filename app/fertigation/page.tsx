"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Beaker, CheckCircle2, Clock, Droplets, Calendar, Plus, Pencil } from "lucide-react";
import { toast } from "sonner";
import { FERTIGATION_RECORDS } from "@/lib/erp-data";
import { FARMERS, VALVES, BEDS } from "@/lib/data";
import type { FertigationRecord, FertigationStatus, ApplicationMethod } from "@/lib/erp-types";

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
const METHODS: ApplicationMethod[] = ["drip", "foliar", "soil_drench"];
const STATUSES: FertigationStatus[] = ["scheduled", "applied", "skipped"];

const COMMON_FERTILIZERS = [
  "NPK 20-20-20", "Calcium Nitrate", "Potassium Sulfate",
  "Humic Acid", "Iron Chelate (EDTA-Fe)", "Magnesium Sulfate", "Other",
];

const EMPTY_FORM = {
  valveId: "", bedId: "",
  fertilizerType: "NPK 20-20-20", activeIngredient: "Nitrogen, Phosphorus, Potassium",
  dosageGPerL: 2.5, waterVolumeLiters: 400,
  applicationDate: "2026-05-17", nextScheduleDate: "2026-05-24",
  responsibleWorkerId: "", applicationMethod: "drip" as ApplicationMethod,
  status: "scheduled" as FertigationStatus, cost: 300, notes: "",
};

export default function FertigationPage() {
  const [records, setRecords] = useState<FertigationRecord[]>(FERTIGATION_RECORDS);
  const [filter, setFilter]   = useState<FertigationStatus | "all">("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<FertigationRecord | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const beds = BEDS();

  function openCreate() {
    setForm({ ...EMPTY_FORM, valveId: VALVES[0]?.id ?? "", responsibleWorkerId: FARMERS.filter(f => f.role === "farmer")[0]?.id ?? "" });
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

  function handleCreate() {
    if (!form.valveId)              { toast.error("Please select a valve"); return; }
    if (!form.responsibleWorkerId)  { toast.error("Please select a responsible worker"); return; }
    const id = `ft-${Date.now()}`;
    const newRec: FertigationRecord = {
      id, valveId: form.valveId, bedId: form.bedId || undefined,
      fertilizerType: form.fertilizerType, activeIngredient: form.activeIngredient,
      dosageGPerL: form.dosageGPerL, waterVolumeLiters: form.waterVolumeLiters,
      applicationDate: form.applicationDate, nextScheduleDate: form.nextScheduleDate,
      responsibleWorkerId: form.responsibleWorkerId, applicationMethod: form.applicationMethod,
      status: form.status, cost: form.cost, notes: form.notes || undefined,
    };
    FERTIGATION_RECORDS.push(newRec);
    setRecords([...FERTIGATION_RECORDS]);
    toast.success(`${form.fertilizerType} scheduled`);
    setCreateOpen(false);
  }

  function handleEdit() {
    if (!editTarget) return;
    const idx = FERTIGATION_RECORDS.findIndex(r => r.id === editTarget.id);
    if (idx < 0) return;
    Object.assign(FERTIGATION_RECORDS[idx], {
      valveId: form.valveId, bedId: form.bedId || undefined,
      fertilizerType: form.fertilizerType, activeIngredient: form.activeIngredient,
      dosageGPerL: form.dosageGPerL, waterVolumeLiters: form.waterVolumeLiters,
      applicationDate: form.applicationDate, nextScheduleDate: form.nextScheduleDate,
      responsibleWorkerId: form.responsibleWorkerId, applicationMethod: form.applicationMethod,
      status: form.status, cost: form.cost, notes: form.notes || undefined,
    });
    setRecords([...FERTIGATION_RECORDS]);
    toast.success(`${form.fertilizerType} updated`);
    setEditTarget(null);
  }

  const filtered   = filter === "all" ? records : records.filter(r => r.status === filter);
  const applied    = records.filter(r => r.status === "applied").length;
  const scheduled  = records.filter(r => r.status === "scheduled").length;
  const totalCost  = records.filter(r => r.status === "applied").reduce((s, r) => s + r.cost, 0);
  const totalLiters = records.filter(r => r.status === "applied").reduce((s, r) => s + r.waterVolumeLiters, 0);

  const valveBeds = (valveId: string) => beds.filter(b => b.valveId === valveId);

  function FertigationForm() {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Valve <span className="text-red-500">*</span></label>
            <select value={form.valveId}
              onChange={e => setForm(p => ({ ...p, valveId: e.target.value, bedId: "" }))}
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white">
              <option value="">— Select —</option>
              {VALVES.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
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
          <select value={COMMON_FERTILIZERS.includes(form.fertilizerType) ? form.fertilizerType : "Other"}
            onChange={e => setForm(p => ({ ...p, fertilizerType: e.target.value === "Other" ? "" : e.target.value }))}
            className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white">
            {COMMON_FERTILIZERS.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
          {!COMMON_FERTILIZERS.slice(0, -1).includes(form.fertilizerType) && (
            <input value={form.fertilizerType}
              onChange={e => setForm(p => ({ ...p, fertilizerType: e.target.value }))}
              placeholder="Enter fertilizer name..."
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm mt-1" />
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
              {METHODS.map(m => <option key={m} value={m} className="capitalize">{m.replace("_", " ")}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Responsible Worker</label>
            <select value={form.responsibleWorkerId}
              onChange={e => setForm(p => ({ ...p, responsibleWorkerId: e.target.value }))}
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white">
              <option value="">— Select —</option>
              {FARMERS.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-700 block mb-1">Status</label>
          <select value={form.status}
            onChange={e => setForm(p => ({ ...p, status: e.target.value as FertigationStatus }))}
            className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white capitalize">
            {STATUSES.map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
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
            <h1 className="text-2xl font-bold text-slate-900">Fertigation</h1>
          </div>
          <p className="text-slate-500 text-sm">Fertilizer applications, scheduling & nutrient tracking</p>
        </div>
        <Button onClick={openCreate} className="bg-violet-600 hover:bg-violet-700 gap-2">
          <Plus className="size-4" /> Schedule Application
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4 bg-emerald-50 border-emerald-200">
          <div className="text-2xl font-bold text-emerald-700 tabular-nums">{applied}</div>
          <div className="text-xs text-emerald-600 font-medium flex items-center gap-1 mt-0.5"><CheckCircle2 className="size-3" /> Applied</div>
        </Card>
        <Card className="p-4 bg-blue-50 border-blue-200">
          <div className="text-2xl font-bold text-blue-700 tabular-nums">{scheduled}</div>
          <div className="text-xs text-blue-600 font-medium flex items-center gap-1 mt-0.5"><Clock className="size-3" /> Scheduled</div>
        </Card>
        <Card className="p-4 bg-violet-50 border-violet-200">
          <div className="text-lg font-bold text-violet-700 tabular-nums">{totalLiters.toLocaleString()} L</div>
          <div className="text-xs text-violet-600 font-medium flex items-center gap-1 mt-0.5"><Droplets className="size-3" /> Water Applied</div>
        </Card>
        <Card className="p-4 bg-amber-50 border-amber-200">
          <div className="text-lg font-bold text-amber-700 tabular-nums">{totalCost.toLocaleString()} ETB</div>
          <div className="text-xs text-amber-600 font-medium flex items-center gap-1 mt-0.5"><Beaker className="size-3" /> Input Cost</div>
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
                const valve = VALVES.find(v => v.id === rec.valveId);
                const worker = FARMERS.find(f => f.id === rec.responsibleWorkerId);
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
              <Plus className="size-4 text-violet-600" /> Schedule Fertigation
            </DialogTitle>
          </DialogHeader>
          <FertigationForm />
          <div className="flex gap-2 mt-2">
            <Button variant="outline" className="flex-1" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button className="flex-1 bg-violet-600 hover:bg-violet-700" onClick={handleCreate}>Create</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Edit ───────────────────────────────────────────────────────────── */}
      <Dialog open={!!editTarget} onOpenChange={o => !o && setEditTarget(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="size-4 text-slate-600" /> Edit Fertigation Record
            </DialogTitle>
          </DialogHeader>
          <FertigationForm />
          <div className="flex gap-2 mt-2">
            <Button variant="outline" className="flex-1" onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button className="flex-1 bg-violet-600 hover:bg-violet-700" onClick={handleEdit}>Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
