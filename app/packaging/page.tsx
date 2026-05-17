"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Package, CheckCircle2, Truck, Clock, BarChart3, Plus, Pencil } from "lucide-react";
import { toast } from "sonner";
import { PACKAGING_RECORDS } from "@/lib/erp-data";
import { FARMERS, VALVES } from "@/lib/data";
import type { PackagingRecord, PackagingStatus, PackageSize } from "@/lib/erp-types";

const STATUS_STYLE: Record<PackagingStatus, string> = {
  in_progress: "bg-blue-100 text-blue-700 border-blue-200",
  packed:      "bg-emerald-100 text-emerald-700 border-emerald-200",
  dispatched:  "bg-amber-100 text-amber-700 border-amber-200",
};
const STATUSES: PackagingStatus[] = ["in_progress", "packed", "dispatched"];
const SIZES: PackageSize[] = ["250g", "500g", "1kg", "2kg", "bulk"];

const EMPTY_FORM = {
  batchNumber: "", harvestDate: "2026-05-17", packedDate: "2026-05-17",
  valveId: "", harvestedKg: 20, gradedKg: 18, packedKg: 16,
  rejectedKg: 2, packageSize: "500g" as PackageSize, packageCount: 32,
  gradeAPct: 75, gradeBPct: 25, packedBy: "", status: "in_progress" as PackagingStatus,
};

export default function PackagingPage() {
  const [records, setRecords] = useState<PackagingRecord[]>(PACKAGING_RECORDS);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<PackagingRecord | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  function openCreate() {
    const next = String(records.length + 54).padStart(3, "0");
    setForm({ ...EMPTY_FORM, batchNumber: `PKG-2026-0${next}`, valveId: VALVES[0]?.id ?? "", packedBy: FARMERS[0]?.id ?? "" });
    setCreateOpen(true);
  }

  function openEdit(r: PackagingRecord) {
    setForm({
      batchNumber: r.batchNumber, harvestDate: r.harvestDate, packedDate: r.packedDate,
      valveId: r.valveId, harvestedKg: r.harvestedKg, gradedKg: r.gradedKg,
      packedKg: r.packedKg, rejectedKg: r.rejectedKg, packageSize: r.packageSize,
      packageCount: r.packageCount, gradeAPct: r.gradeAPct, gradeBPct: r.gradeBPct,
      packedBy: r.packedBy, status: r.status,
    });
    setEditTarget(r);
  }

  function handleCreate() {
    if (!form.batchNumber.trim()) { toast.error("Batch number required"); return; }
    if (!form.valveId)            { toast.error("Please select a valve"); return; }
    const id = `pk-${Date.now()}`;
    const newRec: PackagingRecord = { id, ...form };
    PACKAGING_RECORDS.push(newRec);
    setRecords([...PACKAGING_RECORDS]);
    toast.success(`${form.batchNumber} created`);
    setCreateOpen(false);
  }

  function handleEdit() {
    if (!editTarget) return;
    const idx = PACKAGING_RECORDS.findIndex(r => r.id === editTarget.id);
    if (idx < 0) return;
    Object.assign(PACKAGING_RECORDS[idx], form);
    setRecords([...PACKAGING_RECORDS]);
    toast.success(`${form.batchNumber} updated`);
    setEditTarget(null);
  }

  const dispatched    = records.filter(r => r.status === "dispatched").length;
  const packed        = records.filter(r => r.status === "packed").length;
  const inProgress    = records.filter(r => r.status === "in_progress").length;
  const totalHarvested = records.reduce((s, r) => s + r.harvestedKg, 0);
  const totalPacked   = records.reduce((s, r) => s + r.packedKg, 0);
  const totalRejected = records.reduce((s, r) => s + r.rejectedKg, 0);
  const totalPackages = records.reduce((s, r) => s + r.packageCount, 0);
  const avgGradeA     = records.length ? Math.round(records.reduce((s, r) => s + r.gradeAPct, 0) / records.length) : 0;

  function BatchForm() {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Batch # <span className="text-red-500">*</span></label>
            <input value={form.batchNumber}
              onChange={e => setForm(p => ({ ...p, batchNumber: e.target.value }))}
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Valve <span className="text-red-500">*</span></label>
            <select value={form.valveId}
              onChange={e => setForm(p => ({ ...p, valveId: e.target.value }))}
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white">
              <option value="">— Select —</option>
              {VALVES.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Harvest Date</label>
            <input type="date" value={form.harvestDate}
              onChange={e => setForm(p => ({ ...p, harvestDate: e.target.value }))}
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Packed Date</label>
            <input type="date" value={form.packedDate}
              onChange={e => setForm(p => ({ ...p, packedDate: e.target.value }))}
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Harvested (kg)</label>
            <input type="number" min={0} step={0.1} value={form.harvestedKg}
              onChange={e => setForm(p => ({ ...p, harvestedKg: Number(e.target.value) }))}
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Packed (kg)</label>
            <input type="number" min={0} step={0.1} value={form.packedKg}
              onChange={e => setForm(p => ({ ...p, packedKg: Number(e.target.value) }))}
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Rejected (kg)</label>
            <input type="number" min={0} step={0.1} value={form.rejectedKg}
              onChange={e => setForm(p => ({ ...p, rejectedKg: Number(e.target.value) }))}
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Package Size</label>
            <select value={form.packageSize}
              onChange={e => setForm(p => ({ ...p, packageSize: e.target.value as PackageSize }))}
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white">
              {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Package Count</label>
            <input type="number" min={0} value={form.packageCount}
              onChange={e => setForm(p => ({ ...p, packageCount: Number(e.target.value) }))}
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Grade A %</label>
            <input type="number" min={0} max={100} value={form.gradeAPct}
              onChange={e => setForm(p => ({ ...p, gradeAPct: Number(e.target.value), gradeBPct: 100 - Number(e.target.value) }))}
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Grade B %</label>
            <div className="border border-slate-100 bg-slate-50 rounded-md px-3 py-2 text-sm text-slate-600 tabular-nums">
              {form.gradeBPct}%
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Packed By</label>
            <select value={form.packedBy}
              onChange={e => setForm(p => ({ ...p, packedBy: e.target.value }))}
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white">
              <option value="">— Select —</option>
              {FARMERS.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Status</label>
            <select value={form.status}
              onChange={e => setForm(p => ({ ...p, status: e.target.value as PackagingStatus }))}
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white capitalize">
              {STATUSES.map(s => <option key={s} value={s} className="capitalize">{s.replace("_"," ")}</option>)}
            </select>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-[1400px] mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Package className="size-5 text-amber-600" />
            <h1 className="text-2xl font-bold text-slate-900">Packaging</h1>
          </div>
          <p className="text-slate-500 text-sm">Batch tracking, grading & dispatch management</p>
        </div>
        <Button onClick={openCreate} className="bg-amber-600 hover:bg-amber-700 gap-2">
          <Plus className="size-4" /> New Batch
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="p-4 bg-amber-50 border-amber-200">
          <div className="text-2xl font-bold text-amber-700 tabular-nums">{dispatched}</div>
          <div className="text-xs text-amber-600 font-medium flex items-center gap-1 mt-0.5"><Truck className="size-3" /> Dispatched</div>
        </Card>
        <Card className="p-4 bg-emerald-50 border-emerald-200">
          <div className="text-2xl font-bold text-emerald-700 tabular-nums">{packed}</div>
          <div className="text-xs text-emerald-600 font-medium flex items-center gap-1 mt-0.5"><CheckCircle2 className="size-3" /> Packed</div>
        </Card>
        <Card className="p-4 bg-blue-50 border-blue-200">
          <div className="text-2xl font-bold text-blue-700 tabular-nums">{inProgress}</div>
          <div className="text-xs text-blue-600 font-medium flex items-center gap-1 mt-0.5"><Clock className="size-3" /> In Progress</div>
        </Card>
        <Card className="p-4">
          <div className="text-xl font-bold text-slate-700 tabular-nums">{totalPacked.toFixed(1)} kg</div>
          <div className="text-xs text-slate-500 font-medium mt-0.5">{totalPackages} packages</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div>
              <div className="text-xl font-bold text-slate-700 tabular-nums">{avgGradeA}%</div>
              <div className="text-xs text-slate-500 font-medium mt-0.5">Avg Grade A</div>
            </div>
            <BarChart3 className="size-6 text-slate-300 ml-auto" />
          </div>
        </Card>
      </div>

      {/* Yield summary */}
      <Card className="p-4 flex items-center gap-6 flex-wrap border-red-100 bg-red-50/40">
        <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1 w-full">Yield Summary</div>
        <div className="flex items-center gap-6 flex-wrap text-sm">
          <span className="text-slate-700">Harvested: <strong className="tabular-nums">{totalHarvested.toFixed(1)} kg</strong></span>
          <span className="text-emerald-700">Packed: <strong className="tabular-nums">{totalPacked.toFixed(1)} kg</strong></span>
          <span className="text-red-600">Rejected: <strong className="tabular-nums">{totalRejected.toFixed(1)} kg</strong></span>
          <span className="text-slate-500">Yield rate: <strong>{totalHarvested > 0 ? Math.round((totalPacked / totalHarvested) * 100) : 0}%</strong></span>
        </div>
      </Card>

      {/* Table */}
      <Card className="border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full pro-table">
            <thead>
              <tr>
                <th>Batch #</th><th>Valve</th><th>Harvest Date</th>
                <th>Harvested</th><th>Packed</th><th>Rejected</th>
                <th>Size</th><th>Pkgs</th><th>Grade A</th><th>Grade B</th>
                <th>Packed By</th><th>Status</th><th className="w-12"></th>
              </tr>
            </thead>
            <tbody>
              {[...records].sort((a, b) => b.harvestDate.localeCompare(a.harvestDate)).map(rec => {
                const valve = VALVES.find(v => v.id === rec.valveId);
                const worker = FARMERS.find(f => f.id === rec.packedBy);
                return (
                  <tr key={rec.id} className="group">
                    <td className="font-mono text-xs font-semibold text-slate-700">{rec.batchNumber}</td>
                    <td><span className="text-xs font-semibold" style={{ color: valve?.color }}>{valve?.name}</span></td>
                    <td className="tabular-nums text-xs">{new Date(rec.harvestDate).toLocaleDateString("en", { month: "short", day: "numeric" })}</td>
                    <td className="tabular-nums font-semibold">{rec.harvestedKg.toFixed(1)}</td>
                    <td className="tabular-nums text-emerald-700 font-semibold">{rec.packedKg.toFixed(1)}</td>
                    <td className="tabular-nums text-red-600 font-semibold">{rec.rejectedKg.toFixed(1)}</td>
                    <td><Badge variant="outline" className="text-[10px]">{rec.packageSize}</Badge></td>
                    <td className="tabular-nums text-center font-semibold">{rec.packageCount}</td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${rec.gradeAPct}%` }} />
                        </div>
                        <span className="text-xs tabular-nums font-semibold text-emerald-700">{rec.gradeAPct}%</span>
                      </div>
                    </td>
                    <td className="tabular-nums text-xs text-amber-700 font-semibold">{rec.gradeBPct}%</td>
                    <td className="text-xs text-slate-600">{worker?.name.split(" ")[0]}</td>
                    <td><Badge className={`text-[10px] capitalize ${STATUS_STYLE[rec.status]}`}>{rec.status.replace("_", " ")}</Badge></td>
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
              <Plus className="size-4 text-amber-600" /> New Packaging Batch
            </DialogTitle>
          </DialogHeader>
          <BatchForm />
          <div className="flex gap-2 mt-2">
            <Button variant="outline" className="flex-1" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button className="flex-1 bg-amber-600 hover:bg-amber-700" onClick={handleCreate}>Create Batch</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Edit ───────────────────────────────────────────────────────────── */}
      <Dialog open={!!editTarget} onOpenChange={o => !o && setEditTarget(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="size-4 text-slate-600" /> Edit {editTarget?.batchNumber}
            </DialogTitle>
          </DialogHeader>
          <BatchForm />
          <div className="flex gap-2 mt-2">
            <Button variant="outline" className="flex-1" onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button className="flex-1 bg-amber-600 hover:bg-amber-700" onClick={handleEdit}>Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
