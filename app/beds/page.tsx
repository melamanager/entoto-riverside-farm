"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Bed, GrowthStage, HealthStatus, Farmer, Valve } from "@/lib/types";
import { useLang } from "@/lib/lang";
import { EN, AM } from "@/lib/translations";
import { useOptions } from "@/lib/use-options";

const EMPTY_FORM = {
  valveId: "", lengthM: 40, plantsPerMeter: 8,
  variety: "California Albion", origin: "USA — California",
  plantedDate: new Date().toISOString().split("T")[0],
  stage: "vegetative" as GrowthStage,
  health: "healthy" as HealthStatus,
  farmerId: "",
};

function healthClass(h: HealthStatus) {
  if (h === "healthy")  return "bg-primary/15 text-primary hover:bg-primary/15";
  if (h === "warning")  return "bg-amber-100 text-amber-700 hover:bg-amber-100";
  return "bg-rose-100 text-rose-700 hover:bg-rose-100";
}

type HarvestRecord = { id: string; bedId: string; kg: number };

export default function BedsIndex() {
  const { isAm } = useLang();
  const t = isAm ? AM : EN;
  const options = useOptions();
  const [beds, setBeds]     = useState<Bed[]>([]);
  const [valves, setValves] = useState<Valve[]>([]);
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [harvests, setHarvests] = useState<HarvestRecord[]>([]);
  const [createOpen, setCreateOpen]     = useState(false);
  const [editTarget, setEditTarget]     = useState<Bed | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Bed | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    fetch("/api/beds")
      .then(r => r.json())
      .then((data: Bed[]) => setBeds(data))
      .catch(() => toast.error("Failed to load beds"));

    fetch("/api/valves")
      .then(r => r.json())
      .then((data: Valve[]) => setValves(data))
      .catch(() => toast.error("Failed to load valves"));

    fetch("/api/farmers")
      .then(r => r.json())
      .then((data: Farmer[]) => setFarmers(data))
      .catch(() => toast.error("Failed to load farmers"));

    fetch("/api/harvest")
      .then(r => r.json())
      .then((data: (HarvestRecord & { kg: number | string })[]) =>
        setHarvests(data.map(h => ({ ...h, kg: parseFloat(String(h.kg)) })))
      )
      .catch(() => toast.error("Failed to load harvest records"));
  }, []);

  function plantsInBed(b: Bed) { return Math.round(b.lengthM * b.plantsPerMeter); }

  function totalKgBed(bedId: string) {
    return harvests.filter(h => h.bedId === bedId).reduce((s, h) => s + h.kg, 0);
  }

  function getValve(valveId: string) { return valves.find(v => v.id === valveId) ?? null; }

  function openCreate() {
    setForm({ ...EMPTY_FORM, valveId: valves[0]?.id ?? "", farmerId: farmers.find(f => f.role === "farmer")?.id ?? "" });
    setCreateOpen(true);
  }

  function openEdit(b: Bed) {
    setForm({
      valveId: b.valveId, lengthM: b.lengthM, plantsPerMeter: b.plantsPerMeter,
      variety: b.variety, origin: b.origin, plantedDate: b.plantedDate,
      stage: b.stage, health: b.health, farmerId: b.farmerId,
    });
    setEditTarget(b);
  }

  async function handleCreate() {
    if (!form.valveId) { toast.error("Please select a valve"); return; }
    if (!form.farmerId) { toast.error("Please assign a farmer"); return; }
    if (form.lengthM <= 0) { toast.error("Length must be > 0"); return; }
    const valve = valves.find(v => v.id === form.valveId);
    const letter = valve?.name.split(" ").pop()?.toUpperCase() ?? "X";
    const existing = beds.filter(b => b.valveId === form.valveId).length;
    const id = `${letter}-BED-${String(existing + 1).padStart(2, "0")}`;
    const variety = options.varieties.find(v => v.value === form.variety) ?? options.varieties[0];
    const newBed: Bed = {
      id, valveId: form.valveId, lengthM: form.lengthM,
      plantsPerMeter: form.plantsPerMeter, variety: form.variety,
      origin: String(variety?.meta?.origin ?? ""), plantedDate: form.plantedDate,
      stage: form.stage, health: form.health, farmerId: form.farmerId,
      row: Math.floor(existing / 4), col: existing % 4,
    };
    const res = await fetch("/api/beds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newBed),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => null);
      toast.error(error?.error ?? "Failed to create bed");
      return;
    }
    const created = await res.json();
    setBeds(prev => [...prev, created]);
    toast.success(`${created.id} created`);
    setCreateOpen(false);
  }

  async function handleEdit() {
    if (!editTarget) return;
    const variety = options.varieties.find(v => v.value === form.variety);
    const body = {
      valveId: form.valveId, lengthM: form.lengthM,
      plantsPerMeter: form.plantsPerMeter, variety: form.variety,
      origin: String(variety?.meta?.origin ?? editTarget.origin),
      plantedDate: form.plantedDate, stage: form.stage,
      health: form.health, farmerId: form.farmerId,
    };
    const res = await fetch(`/api/beds/${editTarget.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) { toast.error("Failed to update bed"); return; }
    setBeds(prev => prev.map(b => b.id === editTarget.id ? { ...b, ...body } : b));
    toast.success(`${editTarget.id} updated`);
    setEditTarget(null);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const res = await fetch(`/api/beds/${deleteTarget.id}`, { method: "DELETE" });
    if (!res.ok) {
      const error = await res.json().catch(() => null);
      toast.error(error?.error ?? "Failed to delete bed");
      setDeleteTarget(null);
      return;
    }
    setBeds(prev => prev.filter(b => b.id !== deleteTarget.id));
    toast.success(`${deleteTarget.id} deleted`);
    setDeleteTarget(null);
  }

  // Farmers eligible to assign (farmers only)
  const farmersOnly = farmers.filter(f => f.role === "farmer");

  function BedForm() {
    const valveFarmers = farmersOnly.filter(
      f => !form.valveId || (f.assignedValves as string[]).includes(form.valveId)
    );
    const eligible = valveFarmers.length > 0 ? valveFarmers : farmersOnly;

    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-foreground/80 block mb-1">Valve <span className="text-red-500">*</span></label>
            <select
              value={form.valveId}
              onChange={e => setForm(p => ({ ...p, valveId: e.target.value, farmerId: "" }))}
              className="w-full border border-border rounded-md px-3 py-2 text-sm bg-card"
            >
              <option value="">— Select valve —</option>
              {valves.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-foreground/80 block mb-1">Assigned Farmer <span className="text-red-500">*</span></label>
            <select
              value={form.farmerId}
              onChange={e => setForm(p => ({ ...p, farmerId: e.target.value }))}
              className="w-full border border-border rounded-md px-3 py-2 text-sm bg-card"
            >
              <option value="">— Select farmer —</option>
              {eligible.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-foreground/80 block mb-1">Variety</label>
          <select
            value={form.variety}
            onChange={e => setForm(p => ({ ...p, variety: e.target.value }))}
            className="w-full border border-border rounded-md px-3 py-2 text-sm bg-card"
          >
            {options.varieties.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-foreground/80 block mb-1">Length (m)</label>
            <input
              type="number" min={5} max={200} value={form.lengthM}
              onChange={e => setForm(p => ({ ...p, lengthM: Number(e.target.value) }))}
              className="w-full border border-border rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-foreground/80 block mb-1">Plants / meter</label>
            <input
              type="number" min={1} max={20} value={form.plantsPerMeter}
              onChange={e => setForm(p => ({ ...p, plantsPerMeter: Number(e.target.value) }))}
              className="w-full border border-border rounded-md px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-foreground/80 block mb-1">Planted Date</label>
          <input
            type="date" value={form.plantedDate}
            onChange={e => setForm(p => ({ ...p, plantedDate: e.target.value }))}
            className="w-full border border-border rounded-md px-3 py-2 text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-foreground/80 block mb-1">Growth Stage</label>
            <select
              value={form.stage}
              onChange={e => setForm(p => ({ ...p, stage: e.target.value as GrowthStage }))}
              className="w-full border border-border rounded-md px-3 py-2 text-sm bg-card capitalize"
            >
              {options.growthStages.map(s => <option key={s.value} value={s.value}>{t.growthStages[s.value as GrowthStage] ?? s.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-foreground/80 block mb-1">Health Status</label>
            <select
              value={form.health}
              onChange={e => setForm(p => ({ ...p, health: e.target.value as HealthStatus }))}
              className="w-full border border-border rounded-md px-3 py-2 text-sm bg-card capitalize"
            >
              {options.healthStatuses.map(h => <option key={h.value} value={h.value} className="capitalize">{h.label}</option>)}
            </select>
          </div>
        </div>
      </div>
    );
  }

  const totalPlants = beds.reduce((s, b) => s + plantsInBed(b), 0);

  return (
    <div className="p-6 md:p-8 max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">🌱 {t.beds.title}</h1>
          <p className="text-muted-foreground text-sm">{beds.length} beds · {totalPlants.toLocaleString()} plants</p>
        </div>
        <Button onClick={openCreate} className="bg-primary hover:bg-primary/90 gap-2">
          <Plus className="size-4" /> Add Bed
        </Button>
      </div>

      {/* Table */}
      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left py-2.5 px-4">Bed</th>
              <th className="text-left py-2.5">Valve</th>
              <th className="text-left py-2.5">Length</th>
              <th className="text-left py-2.5">Plants</th>
              <th className="text-left py-2.5">Variety</th>
              <th className="text-left py-2.5">Stage</th>
              <th className="text-left py-2.5">Health</th>
              <th className="text-right py-2.5 px-4">Total kg</th>
              <th className="py-2.5 px-2 w-16"></th>
            </tr>
          </thead>
          <tbody>
            {beds.map(b => {
              const v = getValve(b.valveId);
              const kg = totalKgBed(b.id);
              return (
                <tr key={b.id} className="border-t hover:bg-accent group">
                  <td className="py-2.5 px-4">
                    <Link href={`/beds/${b.id}`} className="font-mono font-semibold hover:text-primary">{b.id}</Link>
                  </td>
                  <td className="py-2.5">
                    <Link href={`/valves/${v?.id}`} className="hover:underline" style={{ color: v?.color }}>{v?.name}</Link>
                  </td>
                  <td className="py-2.5 tabular-nums">{b.lengthM}m</td>
                  <td className="py-2.5 tabular-nums">{plantsInBed(b)}</td>
                  <td className="py-2.5 text-muted-foreground max-w-[140px] truncate">{b.variety}</td>
                  <td className="py-2.5">
                    <Badge variant="outline" className="text-[10px]">{t.growthStages[b.stage]}</Badge>
                  </td>
                  <td className="py-2.5">
                    <Badge className={`text-[10px] capitalize ${healthClass(b.health)}`}>{b.health}</Badge>
                  </td>
                  <td className="py-2.5 px-4 text-right tabular-nums font-semibold">{kg.toFixed(1)}</td>
                  <td className="py-2.5 px-2">
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEdit(b)}
                        className="size-6 rounded bg-muted hover:bg-accent grid place-items-center"
                        title="Edit bed"
                      >
                        <Pencil className="size-3 text-muted-foreground" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(b)}
                        className="size-6 rounded bg-muted hover:bg-red-100 grid place-items-center"
                        title="Delete bed"
                      >
                        <Trash2 className="size-3 text-muted-foreground" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {/* ── Create Dialog ──────────────────────────────────────────────────── */}
      <Dialog open={createOpen} onOpenChange={o => !o && setCreateOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="size-4 text-primary" /> Add Raised Bed
            </DialogTitle>
          </DialogHeader>
          <BedForm />
          <div className="flex gap-2 mt-2">
            <Button variant="outline" className="flex-1" onClick={() => setCreateOpen(false)}>{t.common.cancel}</Button>
            <Button className="flex-1 bg-primary hover:bg-primary/90" onClick={handleCreate}>{t.common.create}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Edit Dialog ────────────────────────────────────────────────────── */}
      <Dialog open={!!editTarget} onOpenChange={o => !o && setEditTarget(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="size-4 text-muted-foreground" /> Edit {editTarget?.id}
            </DialogTitle>
          </DialogHeader>
          <BedForm />
          <div className="flex gap-2 mt-2">
            <Button variant="outline" className="flex-1" onClick={() => setEditTarget(null)}>{t.common.cancel}</Button>
            <Button className="flex-1 bg-primary hover:bg-primary/90" onClick={handleEdit}>{t.common.save}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm ─────────────────────────────────────────────────── */}
      <Dialog open={!!deleteTarget} onOpenChange={o => !o && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <Trash2 className="size-4" /> Delete {deleteTarget?.id}?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Permanently remove <strong>{deleteTarget?.id}</strong> ({deleteTarget?.variety})? Harvest records for this bed will be orphaned.
          </p>
          <div className="flex gap-2 mt-2">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteTarget(null)}>{t.common.cancel}</Button>
            <Button className="flex-1 bg-red-600 hover:bg-red-700" onClick={handleDelete}>{t.common.delete}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
