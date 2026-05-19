"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CalendarDays, Sprout, CheckCircle2, Clock, AlertTriangle, Plus, Pencil } from "lucide-react";
import { toast } from "sonner";
import { PLANTING_RECORDS } from "@/lib/erp-data";
import { BEDS, VALVES, FARMERS, getBed } from "@/lib/data";
import type { PlantingRecord, PlantingStatus } from "@/lib/erp-types";
import type { GrowthStage } from "@/lib/types";
import { useLang } from "@/lib/lang";
import { EN, AM } from "@/lib/translations";

const STATUS_STYLE: Record<PlantingStatus, { badge: string; dot: string }> = {
  planned:   { badge: "bg-slate-100 text-slate-600 border-slate-200",       dot: "bg-slate-400"   },
  planted:   { badge: "bg-blue-100 text-blue-700 border-blue-200",          dot: "bg-blue-500"    },
  growing:   { badge: "bg-emerald-100 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  harvested: { badge: "bg-amber-100 text-amber-700 border-amber-200",       dot: "bg-amber-500"   },
  failed:    { badge: "bg-red-100 text-red-700 border-red-200",             dot: "bg-red-500"     },
};
const STATUSES: PlantingStatus[] = ["planned", "planted", "growing", "harvested", "failed"];

const SEED_SOURCES = ["Nakuru Horticulture KE", "Ethiopian Horticulture", "Holland Horticulture", "Local Nursery"];

const EMPTY_FORM = {
  bedId: "", valveId: "", variety: "Festival",
  plannedDate: "2026-05-17", actualDate: "",
  expectedHarvestDate: "", ageInDays: 0,
  seedsPerMeter: 8, seedSource: "Nakuru Horticulture KE",
  status: "planned" as PlantingStatus,
  notes: "", createdBy: "",
};

export default function PlantingPage() {
  const { isAm } = useLang();
  const t = isAm ? AM : EN;
  const [plantings, setPlantings] = useState<PlantingRecord[]>(PLANTING_RECORDS);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<PlantingRecord | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const beds = BEDS();

  function openCreate() {
    setForm({ ...EMPTY_FORM, bedId: beds[0]?.id ?? "", valveId: VALVES[0]?.id ?? "", createdBy: FARMERS.find(f => f.role === "manager")?.id ?? "" });
    setCreateOpen(true);
  }

  function openEdit(r: PlantingRecord) {
    setForm({
      bedId: r.bedId, valveId: r.valveId, variety: r.variety,
      plannedDate: r.plannedDate, actualDate: r.actualDate ?? "",
      expectedHarvestDate: r.expectedHarvestDate, ageInDays: r.ageInDays,
      seedsPerMeter: r.seedsPerMeter, seedSource: r.seedSource,
      status: r.status, notes: r.notes ?? "", createdBy: r.createdBy,
    });
    setEditTarget(r);
  }

  function handleCreate() {
    if (!form.bedId)             { toast.error("Please select a bed"); return; }
    if (!form.expectedHarvestDate) { toast.error("Expected harvest date is required"); return; }
    const id = `pl-${Date.now()}`;
    const newRec: PlantingRecord = {
      id, bedId: form.bedId, valveId: form.valveId, variety: form.variety,
      plannedDate: form.plannedDate, actualDate: form.actualDate || undefined,
      expectedHarvestDate: form.expectedHarvestDate, ageInDays: form.ageInDays,
      seedsPerMeter: form.seedsPerMeter, seedSource: form.seedSource,
      status: form.status, notes: form.notes || undefined, createdBy: form.createdBy,
    };
    PLANTING_RECORDS.push(newRec);
    setPlantings([...PLANTING_RECORDS]);
    toast.success(`Planting record for ${form.bedId} created`);
    setCreateOpen(false);
  }

  function handleEdit() {
    if (!editTarget) return;
    const idx = PLANTING_RECORDS.findIndex(r => r.id === editTarget.id);
    if (idx < 0) return;
    const prevStatus = editTarget.status;
    Object.assign(PLANTING_RECORDS[idx], {
      bedId: form.bedId, valveId: form.valveId, variety: form.variety,
      plannedDate: form.plannedDate, actualDate: form.actualDate || undefined,
      expectedHarvestDate: form.expectedHarvestDate, ageInDays: form.ageInDays,
      seedsPerMeter: form.seedsPerMeter, seedSource: form.seedSource,
      status: form.status, notes: form.notes || undefined,
    });

    // Flow 3: sync bed stage when planting status changes
    if (prevStatus !== form.status && form.bedId) {
      const stageMap: Partial<Record<PlantingStatus, GrowthStage>> = {
        planted:   "vegetative",
        growing:   "flowering",
        harvested: "harvest",
      };
      const newStage = stageMap[form.status as PlantingStatus];
      const bed = getBed(form.bedId);
      if (bed && newStage) {
        bed.stage = newStage;
        toast.success(`Planting record updated`, { description: `Bed ${form.bedId} stage synced → ${newStage}` });
      } else {
        toast.success(`Planting record updated`);
      }
    } else {
      toast.success(`Planting record updated`);
    }
    setPlantings([...PLANTING_RECORDS]);
    setEditTarget(null);
  }

  const growing   = plantings.filter(p => p.status === "growing").length;
  const planned   = plantings.filter(p => p.status === "planned").length;
  const harvested = plantings.filter(p => p.status === "harvested").length;
  const failed    = plantings.filter(p => p.status === "failed").length;

  const byVariety = plantings.reduce<Record<string, number>>((acc, p) => {
    acc[p.variety] = (acc[p.variety] ?? 0) + 1;
    return acc;
  }, {});

  const valveBeds = (valveId: string) => beds.filter(b => b.valveId === valveId);

  function PlantingForm() {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Valve</label>
            <select value={form.valveId}
              onChange={e => setForm(p => ({ ...p, valveId: e.target.value, bedId: "" }))}
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white">
              <option value="">— Select —</option>
              {VALVES.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Bed <span className="text-red-500">*</span></label>
            <select value={form.bedId}
              onChange={e => setForm(p => ({ ...p, bedId: e.target.value }))}
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white"
              disabled={!form.valveId}>
              <option value="">— Select —</option>
              {valveBeds(form.valveId).map(b => <option key={b.id} value={b.id}>{b.id}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-700 block mb-1">Variety</label>
          <input value={form.variety}
            onChange={e => setForm(p => ({ ...p, variety: e.target.value }))}
            placeholder="e.g. Festival"
            className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Planned Date</label>
            <input type="date" value={form.plannedDate}
              onChange={e => setForm(p => ({ ...p, plannedDate: e.target.value }))}
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Actual Date (if planted)</label>
            <input type="date" value={form.actualDate}
              onChange={e => setForm(p => ({ ...p, actualDate: e.target.value }))}
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm" />
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-700 block mb-1">Expected Harvest Date <span className="text-red-500">*</span></label>
          <input type="date" value={form.expectedHarvestDate}
            onChange={e => setForm(p => ({ ...p, expectedHarvestDate: e.target.value }))}
            className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Seeds / meter</label>
            <input type="number" min={1} max={20} value={form.seedsPerMeter}
              onChange={e => setForm(p => ({ ...p, seedsPerMeter: Number(e.target.value) }))}
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Seed Source</label>
            <select value={form.seedSource}
              onChange={e => setForm(p => ({ ...p, seedSource: e.target.value }))}
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white">
              {SEED_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-700 block mb-1">Status</label>
          <select value={form.status}
            onChange={e => setForm(p => ({ ...p, status: e.target.value as PlantingStatus }))}
            className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white capitalize">
            {STATUSES.map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-700 block mb-1">Notes</label>
          <input value={form.notes}
            onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
            placeholder="Optional observation..."
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
            <CalendarDays className="size-5 text-emerald-600" />
            <h1 className="text-2xl font-bold text-slate-900">{t.planting.title}</h1>
          </div>
          <p className="text-slate-500 text-sm">{t.planting.subtitle}</p>
        </div>
        <Button onClick={openCreate} className="bg-emerald-600 hover:bg-emerald-700 gap-2">
          <Plus className="size-4" /> {t.planting.schedulePlanting}
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4 bg-emerald-50 border-emerald-200">
          <div className="flex items-center justify-between">
            <div><div className="text-2xl font-bold text-emerald-700 tabular-nums">{growing}</div><div className="text-xs text-emerald-600 font-medium">{t.planting.growing}</div></div>
            <Sprout className="size-7 text-emerald-400" />
          </div>
        </Card>
        <Card className="p-4 bg-blue-50 border-blue-200">
          <div className="flex items-center justify-between">
            <div><div className="text-2xl font-bold text-blue-700 tabular-nums">{planned}</div><div className="text-xs text-blue-600 font-medium">{t.planting.planned}</div></div>
            <Clock className="size-7 text-blue-400" />
          </div>
        </Card>
        <Card className="p-4 bg-amber-50 border-amber-200">
          <div className="flex items-center justify-between">
            <div><div className="text-2xl font-bold text-amber-700 tabular-nums">{harvested}</div><div className="text-xs text-amber-600 font-medium">{t.planting.harvested}</div></div>
            <CheckCircle2 className="size-7 text-amber-400" />
          </div>
        </Card>
        <Card className="p-4 bg-red-50 border-red-200">
          <div className="flex items-center justify-between">
            <div><div className="text-2xl font-bold text-red-700 tabular-nums">{failed}</div><div className="text-xs text-red-600 font-medium">{t.planting.failed}</div></div>
            <AlertTriangle className="size-7 text-red-400" />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Variety breakdown */}
        <Card className="p-5 lg:col-span-1">
          <h3 className="font-semibold text-slate-900 mb-4">{t.planting.varietyBreakdown}</h3>
          <div className="space-y-3">
            {Object.entries(byVariety).map(([variety, count]) => (
              <div key={variety} className="flex items-center justify-between">
                <span className="text-sm text-slate-700">{variety}</span>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(count / plantings.length) * 100}%` }} />
                  </div>
                  <span className="text-xs font-bold text-slate-600 tabular-nums w-4">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Table */}
        <Card className="border border-slate-200 shadow-sm overflow-hidden lg:col-span-3">
          <div className="px-5 py-3.5 border-b border-slate-100 font-semibold text-slate-900">
            {t.planting.allRecords}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full pro-table">
              <thead>
                <tr>
                  <th>Bed</th><th>Valve</th><th>Variety</th>
                  <th>Planted</th><th>Exp. Harvest</th><th>Age</th>
                  <th>Status</th><th>Notes</th><th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {plantings.map(rec => {
                  const valve = VALVES.find(v => v.id === rec.valveId);
                  const s = STATUS_STYLE[rec.status];
                  return (
                    <tr key={rec.id} className="group">
                      <td className="font-mono font-semibold text-slate-800">{rec.bedId}</td>
                      <td><span className="text-xs font-semibold" style={{ color: valve?.color }}>{valve?.name ?? rec.valveId}</span></td>
                      <td className="font-medium">{rec.variety}</td>
                      <td className="tabular-nums text-slate-500 text-xs">
                        {rec.actualDate
                          ? new Date(rec.actualDate).toLocaleDateString("en", { month: "short", day: "numeric" })
                          : <span className="text-slate-400 italic">Pending</span>}
                      </td>
                      <td className="tabular-nums text-xs">
                        {new Date(rec.expectedHarvestDate).toLocaleDateString("en", { month: "short", day: "numeric", year: "2-digit" })}
                      </td>
                      <td className="tabular-nums font-semibold text-slate-700">{rec.ageInDays}d</td>
                      <td>
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border ${s.badge}`}>
                          <span className={`size-1.5 rounded-full ${s.dot}`} />
                          {rec.status}
                        </span>
                      </td>
                      <td className="text-xs text-slate-500 max-w-[160px] truncate">{rec.notes ?? "—"}</td>
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
      </div>

      {/* ── Create ─────────────────────────────────────────────────────────── */}
      <Dialog open={createOpen} onOpenChange={o => !o && setCreateOpen(false)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="size-4 text-emerald-600" /> Schedule New Planting
            </DialogTitle>
          </DialogHeader>
          <PlantingForm />
          <div className="flex gap-2 mt-2">
            <Button variant="outline" className="flex-1" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={handleCreate}>Create Record</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Edit ───────────────────────────────────────────────────────────── */}
      <Dialog open={!!editTarget} onOpenChange={o => !o && setEditTarget(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="size-4 text-slate-600" /> Edit Planting — {editTarget?.bedId}
            </DialogTitle>
          </DialogHeader>
          <PlantingForm />
          <div className="flex gap-2 mt-2">
            <Button variant="outline" className="flex-1" onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={handleEdit}>Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
