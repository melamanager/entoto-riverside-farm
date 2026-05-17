"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sprout, Users, Wheat, AlertTriangle, Plus, Pencil, Trash2, X } from "lucide-react";
import { ValveIcon } from "@/components/valve-icon";
import { toast } from "sonner";
import { VALVES, BEDS, FARMERS, plantsInBed, totalKgValve, getFarmer } from "@/lib/data";
import type { Valve } from "@/lib/types";

const COLORS = [
  "#10b981", "#3b82f6", "#a855f7", "#f59e0b",
  "#ef4444", "#ec4899", "#14b8a6", "#f97316",
];

const EMPTY_FORM = {
  name: "", color: "#10b981", irrigationSchedule: "", supervisorId: "",
};

export default function ValvesIndex() {
  const beds = BEDS();
  const supervisors = FARMERS.filter(f => f.role === "supervisor" || f.role === "manager");

  const [valves, setValves] = useState<Valve[]>(VALVES);
  const [createOpen, setCreateOpen]   = useState(false);
  const [editTarget, setEditTarget]   = useState<Valve | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Valve | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  // ── Helpers ──────────────────────────────────────────────────────────────
  function openCreate() {
    setForm(EMPTY_FORM);
    setCreateOpen(true);
  }

  function openEdit(v: Valve) {
    setForm({
      name: v.name,
      color: v.color,
      irrigationSchedule: v.irrigationSchedule,
      supervisorId: v.supervisorId,
    });
    setEditTarget(v);
  }

  function handleCreate() {
    if (!form.name.trim()) { toast.error("Valve name is required"); return; }
    if (!form.supervisorId) { toast.error("Please assign a supervisor"); return; }
    const id = `valve-${form.name.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`;
    const newValve: Valve = {
      id, name: form.name.trim(), color: form.color,
      irrigationSchedule: form.irrigationSchedule || "06:00 & 17:00 — 25 min",
      supervisorId: form.supervisorId,
      x: 40 + valves.length * 140, y: 60, width: 260, height: 180,
    };
    setValves(prev => [...prev, newValve]);
    // Keep shared array in sync for other pages this session
    VALVES.push(newValve);
    toast.success(`${newValve.name} created`);
    setCreateOpen(false);
  }

  function handleEdit() {
    if (!editTarget) return;
    if (!form.name.trim()) { toast.error("Valve name is required"); return; }
    setValves(prev => prev.map(v =>
      v.id === editTarget.id
        ? { ...v, name: form.name.trim(), color: form.color, irrigationSchedule: form.irrigationSchedule, supervisorId: form.supervisorId }
        : v
    ));
    // Sync shared array
    const idx = VALVES.findIndex(v => v.id === editTarget.id);
    if (idx >= 0) Object.assign(VALVES[idx], { name: form.name.trim(), color: form.color, irrigationSchedule: form.irrigationSchedule, supervisorId: form.supervisorId });
    toast.success(`${form.name} updated`);
    setEditTarget(null);
  }

  function handleDelete() {
    if (!deleteTarget) return;
    const hasBeds = beds.some(b => b.valveId === deleteTarget.id);
    if (hasBeds) {
      toast.error("Cannot delete — this valve has active beds assigned to it.");
      setDeleteTarget(null);
      return;
    }
    setValves(prev => prev.filter(v => v.id !== deleteTarget.id));
    const idx = VALVES.findIndex(v => v.id === deleteTarget.id);
    if (idx >= 0) VALVES.splice(idx, 1);
    toast.success(`${deleteTarget.name} deleted`);
    setDeleteTarget(null);
  }

  // ── Shared form fields ────────────────────────────────────────────────────
  function ValveForm() {
    return (
      <div className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-slate-700 block mb-1.5">Valve Name <span className="text-red-500">*</span></label>
          <input
            value={form.name}
            onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
            placeholder="e.g. Valve D"
            className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-700 block mb-1.5">Zone Color</label>
          <div className="flex gap-2 flex-wrap">
            {COLORS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setForm(p => ({ ...p, color: c }))}
                className={`size-8 rounded-full border-2 transition-all ${form.color === c ? "border-slate-800 scale-110" : "border-transparent"}`}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-700 block mb-1.5">Irrigation Schedule</label>
          <input
            value={form.irrigationSchedule}
            onChange={e => setForm(p => ({ ...p, irrigationSchedule: e.target.value }))}
            placeholder="e.g. 06:00 & 17:00 — 25 min"
            className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-700 block mb-1.5">Supervisor <span className="text-red-500">*</span></label>
          <select
            value={form.supervisorId}
            onChange={e => setForm(p => ({ ...p, supervisorId: e.target.value }))}
            className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white"
          >
            <option value="">— Select supervisor —</option>
            {supervisors.map(s => (
              <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
            ))}
          </select>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 flex items-center gap-2.5">
            <ValveIcon size={28} /> Irrigation Valves
          </h1>
          <p className="text-stone-500 text-sm">Manage irrigation zones — each valve controls its own beds, farmers and water schedule.</p>
        </div>
        <Button onClick={openCreate} className="bg-emerald-600 hover:bg-emerald-700 gap-2">
          <Plus className="size-4" /> Add Valve
        </Button>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {valves.map((v) => {
          const vBeds = beds.filter(b => b.valveId === v.id);
          const plants = vBeds.reduce((s, b) => s + plantsInBed(b), 0);
          const kg = totalKgValve(v.id);
          const infected = vBeds.filter(b => b.health === "infected").length;
          const supervisor = getFarmer(v.supervisorId);
          const farmers = FARMERS.filter(f => f.assignedValves.includes(v.id) && f.role === "farmer");

          return (
            <Card key={v.id} className="p-5 relative overflow-hidden hover:shadow-lg transition-shadow">
              <div className="absolute top-0 left-0 right-0 h-1.5" style={{ background: v.color }} />

              {/* Action buttons */}
              <div className="absolute top-3 right-3 flex gap-1">
                <button
                  onClick={() => openEdit(v)}
                  className="size-7 rounded-md bg-slate-100 hover:bg-slate-200 grid place-items-center transition-colors"
                  title="Edit valve"
                >
                  <Pencil className="size-3.5 text-slate-600" />
                </button>
                <button
                  onClick={() => setDeleteTarget(v)}
                  className="size-7 rounded-md bg-slate-100 hover:bg-red-100 grid place-items-center transition-colors"
                  title="Delete valve"
                >
                  <Trash2 className="size-3.5 text-slate-600 hover:text-red-600" />
                </button>
              </div>

              <Link href={`/valves/${v.id}`} className="block">
                <div className="flex items-center gap-2 mb-3 pr-16">
                  <div className="size-9 rounded-lg grid place-items-center text-white font-bold text-sm" style={{ background: v.color }}>
                    {v.name.split(" ").pop()}
                  </div>
                  <div>
                    <div className="font-bold">{v.name}</div>
                    <div className="text-[11px] text-stone-500">{v.irrigationSchedule}</div>
                  </div>
                  {infected > 0 && (
                    <Badge variant="destructive" className="text-[10px] ml-auto">
                      <AlertTriangle className="size-3 mr-1" />{infected}
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 text-center mb-3">
                  <div className="rounded-lg bg-stone-50 p-2">
                    <Sprout className="size-4 mx-auto text-emerald-600 mb-0.5" />
                    <div className="text-base font-bold tabular-nums">{vBeds.length}</div>
                    <div className="text-[10px] text-stone-500">beds</div>
                  </div>
                  <div className="rounded-lg bg-stone-50 p-2">
                    <ValveIcon size={16} className="mx-auto mb-0.5" />
                    <div className="text-base font-bold tabular-nums">{plants.toLocaleString()}</div>
                    <div className="text-[10px] text-stone-500">plants</div>
                  </div>
                  <div className="rounded-lg bg-stone-50 p-2">
                    <Wheat className="size-4 mx-auto text-rose-600 mb-0.5" />
                    <div className="text-base font-bold tabular-nums">{kg.toFixed(0)}</div>
                    <div className="text-[10px] text-stone-500">kg total</div>
                  </div>
                </div>

                <div className="text-xs text-stone-600 border-t pt-3 flex items-center gap-2">
                  <Users className="size-3.5" />
                  <span><strong>Supervisor:</strong> {supervisor?.name ?? "—"}</span>
                </div>
                <div className="text-xs text-stone-500 mt-1 truncate">
                  Farmers: {farmers.map(f => f.name.split(" ")[0]).join(", ") || "None assigned"}
                </div>
              </Link>
            </Card>
          );
        })}

        {/* Add placeholder */}
        <button
          onClick={openCreate}
          className="border-2 border-dashed border-slate-200 rounded-xl p-5 flex flex-col items-center justify-center gap-3 hover:border-emerald-400 hover:bg-emerald-50/40 transition-all text-slate-400 hover:text-emerald-600 min-h-[200px]"
        >
          <Plus className="size-8" />
          <span className="text-sm font-semibold">Add New Valve</span>
        </button>
      </div>

      {/* ── Create Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={createOpen} onOpenChange={o => !o && setCreateOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="size-4 text-emerald-600" /> Add Irrigation Valve
            </DialogTitle>
          </DialogHeader>
          <ValveForm />
          <div className="flex gap-2 mt-2">
            <Button variant="outline" className="flex-1" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={handleCreate}>Create Valve</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Edit Dialog ───────────────────────────────────────────────────── */}
      <Dialog open={!!editTarget} onOpenChange={o => !o && setEditTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="size-4 text-slate-600" /> Edit {editTarget?.name}
            </DialogTitle>
          </DialogHeader>
          <ValveForm />
          <div className="flex gap-2 mt-2">
            <Button variant="outline" className="flex-1" onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={handleEdit}>Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm ────────────────────────────────────────────────── */}
      <Dialog open={!!deleteTarget} onOpenChange={o => !o && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <Trash2 className="size-4" /> Delete {deleteTarget?.name}?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            This will permanently remove <strong>{deleteTarget?.name}</strong>. Any beds assigned to this valve must be reassigned first.
          </p>
          <div className="flex gap-2 mt-2">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button className="flex-1 bg-red-600 hover:bg-red-700" onClick={handleDelete}>Delete</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
