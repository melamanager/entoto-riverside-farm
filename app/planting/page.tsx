"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  CalendarDays, Sprout, CheckCircle2, Clock, AlertTriangle,
  Plus, Pencil, LayoutList, CalendarRange, ChevronDown, ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import type { PlantingRecord, PlantingStatus } from "@/lib/erp-types";
import type { Bed, Valve, Farmer } from "@/lib/types";
import { useLang } from "@/lib/lang";
import { EN, AM } from "@/lib/translations";

const TODAY = "2026-05-20";
// Timeline range — covers all planting/harvest windows
const TLINE_START = "2026-01-01";
const TLINE_END   = "2026-08-01";

const STATUS_STYLE: Record<PlantingStatus, { badge: string; dot: string; bar: string }> = {
  planned:   { badge: "bg-slate-100 text-slate-600 border-slate-200",       dot: "bg-slate-400",   bar: "bg-slate-300"   },
  planted:   { badge: "bg-blue-100 text-blue-700 border-blue-200",          dot: "bg-blue-500",    bar: "bg-blue-400"    },
  growing:   { badge: "bg-emerald-100 text-emerald-700 border-emerald-200", dot: "bg-emerald-500", bar: "bg-emerald-500" },
  harvested: { badge: "bg-amber-100 text-amber-700 border-amber-200",       dot: "bg-amber-500",   bar: "bg-amber-400"   },
  failed:    { badge: "bg-red-100 text-red-700 border-red-200",             dot: "bg-red-500",     bar: "bg-red-400"     },
};
const STATUSES: PlantingStatus[] = ["planned", "planted", "growing", "harvested", "failed"];
const SEED_SOURCES = ["Nakuru Horticulture KE", "Ethiopian Horticulture", "Holland Horticulture", "Local Nursery"];

const EMPTY_FORM = {
  bedId: "", valveId: "", variety: "Festival",
  plannedDate: TODAY, actualDate: "",
  expectedHarvestDate: "", ageInDays: 0,
  seedsPerMeter: 8, seedSource: "Nakuru Horticulture KE",
  status: "planned" as PlantingStatus,
  notes: "", createdBy: "",
};

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

const TLINE_TOTAL = daysBetween(TLINE_START, TLINE_END); // ~212 days

function tlinePct(date: string): number {
  const d = daysBetween(TLINE_START, date);
  return Math.min(100, Math.max(0, (d / TLINE_TOTAL) * 100));
}

const TLINE_MONTHS = (() => {
  const result: { label: string; pct: number }[] = [];
  for (let m = 0; m < 8; m++) {
    const d  = new Date(2026, m, 1);
    const ds = d.toISOString().split("T")[0];
    const p  = tlinePct(ds);
    if (p >= 0 && p <= 100) {
      result.push({ label: d.toLocaleString("en", { month: "short" }), pct: p });
    }
  }
  return result;
})();

export default function PlantingPage() {
  const { isAm } = useLang();
  const t = isAm ? AM : EN;
  const [plantings, setPlantings]       = useState<PlantingRecord[]>([]);
  const [beds, setBeds]                 = useState<Bed[]>([]);
  const [valves, setValves]             = useState<Valve[]>([]);
  const [farmers, setFarmers]           = useState<Farmer[]>([]);
  const [createOpen, setCreateOpen]     = useState(false);
  const [editTarget, setEditTarget]     = useState<PlantingRecord | null>(null);
  const [form, setForm]                 = useState(EMPTY_FORM);
  const [viewMode, setViewMode]         = useState<"table" | "timeline">("table");
  const [overdueOpen, setOverdueOpen]   = useState(false);

  useEffect(() => {
    fetch("/api/planting").then(r => r.json()).then(setPlantings);
    fetch("/api/beds").then(r => r.json()).then(setBeds);
    fetch("/api/valves").then(r => r.json()).then(setValves);
    fetch("/api/farmers").then(r => r.json()).then(setFarmers);
  }, []);

  // ── Overdue detection ────────────────────────────────────────────────────
  const overdueUnplanted = plantings.filter(p => p.status === "planned" && p.plannedDate < TODAY);
  const overdueHarvest   = plantings.filter(
    p => (p.status === "growing" || p.status === "planted") && p.expectedHarvestDate < TODAY,
  );
  const totalOverdue = overdueUnplanted.length + overdueHarvest.length;

  // ── Summary counts ───────────────────────────────────────────────────────
  const growing   = plantings.filter(p => p.status === "growing").length;
  const planned   = plantings.filter(p => p.status === "planned").length;
  const harvested = plantings.filter(p => p.status === "harvested").length;
  const failed    = plantings.filter(p => p.status === "failed").length;

  const byVariety = plantings.reduce<Record<string, number>>((acc, p) => {
    acc[p.variety] = (acc[p.variety] ?? 0) + 1;
    return acc;
  }, {});

  const valveBeds = (valveId: string) => beds.filter(b => b.valveId === valveId);

  // ── Form handlers ────────────────────────────────────────────────────────
  function openCreate() {
    setForm({
      ...EMPTY_FORM,
      bedId:     beds[0]?.id ?? "",
      valveId:   valves[0]?.id ?? "",
      createdBy: farmers.find(f => f.role === "manager")?.id ?? "",
    });
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

  async function handleCreate() {
    if (!form.bedId)               { toast.error("Please select a bed"); return; }
    if (!form.expectedHarvestDate) { toast.error("Expected harvest date is required"); return; }
    const body = {
      bedId: form.bedId, valveId: form.valveId, variety: form.variety,
      plannedDate: form.plannedDate, actualDate: form.actualDate || undefined,
      expectedHarvestDate: form.expectedHarvestDate, ageInDays: form.ageInDays,
      seedsPerMeter: form.seedsPerMeter, seedSource: form.seedSource,
      status: form.status, notes: form.notes || undefined, createdBy: form.createdBy,
    };
    const res = await fetch("/api/planting", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) { toast.error("Failed to create planting record"); return; }
    const newRec = await res.json() as PlantingRecord;
    setPlantings(prev => [...prev, newRec]);
    toast.success(`Planting record for ${form.bedId} created`);
    setCreateOpen(false);
  }

  async function handleEdit() {
    if (!editTarget) return;
    const body = {
      bedId: form.bedId, valveId: form.valveId, variety: form.variety,
      plannedDate: form.plannedDate, actualDate: form.actualDate || undefined,
      expectedHarvestDate: form.expectedHarvestDate, ageInDays: form.ageInDays,
      seedsPerMeter: form.seedsPerMeter, seedSource: form.seedSource,
      status: form.status, notes: form.notes || undefined,
    };
    const res = await fetch(`/api/planting/${editTarget.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) { toast.error("Failed to update planting record"); return; }
    const updated = await res.json() as PlantingRecord;
    setPlantings(prev => prev.map(r => r.id === editTarget.id ? updated : r));
    toast.success("Planting record updated");
    setEditTarget(null);
  }

  // ── Inline form ──────────────────────────────────────────────────────────
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
              {valves.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Bed <span className="text-red-500">*</span>
            </label>
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
          <label className="text-xs font-semibold text-slate-700 block mb-1">
            Expected Harvest Date <span className="text-red-500">*</span>
          </label>
          <input type="date" value={form.expectedHarvestDate}
            onChange={e => setForm(p => ({ ...p, expectedHarvestDate: e.target.value }))}
            className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Seeds / metre</label>
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
            placeholder="Optional observation…"
            className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-[1400px] mx-auto space-y-6">

      {/* Header */}
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

      {/* ── Overdue alert banner ──────────────────────────────────────────────── */}
      {totalOverdue > 0 && (
        <div className="rounded-xl border-2 border-red-200 bg-red-50 overflow-hidden">
          <button
            onClick={() => setOverdueOpen(o => !o)}
            className="w-full flex items-center justify-between px-4 py-3 text-left gap-3 hover:bg-red-100 transition-colors">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="size-4 text-red-600 shrink-0" />
              <span className="font-bold text-red-800 text-sm">
                {totalOverdue} overdue planting{totalOverdue !== 1 ? "s" : ""} need attention
              </span>
              {overdueUnplanted.length > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                  {overdueUnplanted.length} not yet planted
                </span>
              )}
              {overdueHarvest.length > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-200 text-red-800">
                  {overdueHarvest.length} past harvest date
                </span>
              )}
            </div>
            {overdueOpen
              ? <ChevronUp className="size-4 text-red-500 shrink-0" />
              : <ChevronDown className="size-4 text-red-500 shrink-0" />}
          </button>

          {overdueOpen && (
            <div className="border-t border-red-200 px-4 py-3 space-y-3">
              {overdueUnplanted.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-slate-700 mb-1.5">
                    Planned but not yet planted — planting date has passed
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {overdueUnplanted.map(p => (
                      <button key={p.id} onClick={() => openEdit(p)}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:border-red-400 transition-colors">
                        <span className="size-1.5 rounded-full bg-slate-400 shrink-0" />
                        {p.bedId} · {p.variety}
                        <span className="text-red-500 font-bold ml-1">
                          {daysBetween(p.plannedDate, TODAY)}d late
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {overdueHarvest.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-slate-700 mb-1.5">
                    Past expected harvest date — still growing
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {overdueHarvest.map(p => (
                      <button key={p.id} onClick={() => openEdit(p)}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:border-red-400 transition-colors">
                        <span className="size-1.5 rounded-full bg-emerald-500 shrink-0" />
                        {p.bedId} · {p.variety}
                        <span className="text-red-500 font-bold ml-1">
                          {daysBetween(p.expectedHarvestDate, TODAY)}d overdue
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4 bg-emerald-50 border-emerald-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-emerald-700 tabular-nums">{growing}</div>
              <div className="text-xs text-emerald-600 font-medium">{t.planting.growing}</div>
            </div>
            <Sprout className="size-7 text-emerald-400" />
          </div>
        </Card>
        <Card className="p-4 bg-blue-50 border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-blue-700 tabular-nums">{planned}</div>
              <div className="text-xs text-blue-600 font-medium">{t.planting.planned}</div>
            </div>
            <Clock className="size-7 text-blue-400" />
          </div>
        </Card>
        <Card className="p-4 bg-amber-50 border-amber-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-amber-700 tabular-nums">{harvested}</div>
              <div className="text-xs text-amber-600 font-medium">{t.planting.harvested}</div>
            </div>
            <CheckCircle2 className="size-7 text-amber-400" />
          </div>
        </Card>
        <Card className="p-4 bg-red-50 border-red-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-red-700 tabular-nums">{failed}</div>
              <div className="text-xs text-red-600 font-medium">{t.planting.failed}</div>
            </div>
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
                    <div className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${(count / plantings.length) * 100}%` }} />
                  </div>
                  <span className="text-xs font-bold text-slate-600 tabular-nums w-4">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Table / Timeline toggle */}
        <div className="lg:col-span-3 space-y-3">
          {/* View toggle */}
          <div className="flex items-center gap-2">
            <button onClick={() => setViewMode("table")}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-semibold transition-all border ${
                viewMode === "table"
                  ? "bg-emerald-700 text-white border-emerald-700"
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
              }`}>
              <LayoutList className="size-3" /> Table
            </button>
            <button onClick={() => setViewMode("timeline")}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-semibold transition-all border ${
                viewMode === "timeline"
                  ? "bg-emerald-700 text-white border-emerald-700"
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
              }`}>
              <CalendarRange className="size-3" /> Timeline
            </button>
          </div>

          {viewMode === "table" ? (
            <Card className="border border-slate-200 shadow-sm overflow-hidden">
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
                      const valve = valves.find(v => v.id === rec.valveId);
                      const s     = STATUS_STYLE[rec.status];
                      const isOverdueHarv = (rec.status === "growing" || rec.status === "planted") && rec.expectedHarvestDate < TODAY;
                      const isOverduePlnt = rec.status === "planned" && rec.plannedDate < TODAY;
                      return (
                        <tr key={rec.id} className={`group ${isOverdueHarv || isOverduePlnt ? "bg-red-50/60" : ""}`}>
                          <td className="font-mono font-semibold text-slate-800">{rec.bedId}</td>
                          <td><span className="text-xs font-semibold" style={{ color: valve?.color }}>{valve?.name ?? rec.valveId}</span></td>
                          <td className="font-medium">{rec.variety}</td>
                          <td className="tabular-nums text-slate-500 text-xs">
                            {rec.actualDate
                              ? new Date(rec.actualDate).toLocaleDateString("en", { month: "short", day: "numeric" })
                              : <span className="text-slate-400 italic">Pending</span>}
                          </td>
                          <td className={`tabular-nums text-xs ${isOverdueHarv ? "text-red-600 font-bold" : ""}`}>
                            {new Date(rec.expectedHarvestDate).toLocaleDateString("en", { month: "short", day: "numeric", year: "2-digit" })}
                            {isOverdueHarv && <span className="ml-1 text-[9px] text-red-500">overdue</span>}
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
          ) : (
            /* ── Timeline / Gantt view ─────────────────────────────────────── */
            <Card className="border border-slate-200 shadow-sm overflow-hidden p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold text-slate-900">Planting Timeline</h3>
                <span className="text-[10px] text-slate-400 italic">Jan – Jul 2026 · vertical line = today</span>
              </div>
              <div className="overflow-x-auto">
                <div className="min-w-[640px]">
                  {/* Month header */}
                  <div className="relative h-5 mb-2 ml-28">
                    {TLINE_MONTHS.map(({ label, pct }) => (
                      <div key={label} className="absolute flex flex-col items-center"
                        style={{ left: `${pct}%`, transform: "translateX(-50%)" }}>
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">{label}</span>
                      </div>
                    ))}
                  </div>

                  {/* Rows */}
                  <div className="space-y-1.5">
                    {plantings.map(rec => {
                      const barStart = tlinePct(rec.actualDate || rec.plannedDate);
                      const barEnd   = tlinePct(rec.expectedHarvestDate);
                      const barW     = Math.max(0.8, barEnd - barStart);
                      const s        = STATUS_STYLE[rec.status];
                      const isOverdueHarv = (rec.status === "growing" || rec.status === "planted") && rec.expectedHarvestDate < TODAY;
                      const isOverduePlnt = rec.status === "planned" && rec.plannedDate < TODAY;
                      const todayPct = tlinePct(TODAY);
                      return (
                        <div key={rec.id} className="flex items-center gap-2 group">
                          {/* Label */}
                          <div className="w-28 shrink-0 text-right pr-2">
                            <div className="text-[11px] font-bold text-slate-700 truncate">{rec.bedId}</div>
                            <div className="text-[9px] text-slate-400 truncate">{rec.variety}</div>
                          </div>
                          {/* Bar track */}
                          <div className="flex-1 relative h-7 rounded-md bg-slate-50 border border-slate-100">
                            {/* Month grid lines */}
                            {TLINE_MONTHS.map(({ label, pct }) => (
                              <div key={label} className="absolute top-0 bottom-0 w-px bg-slate-200"
                                style={{ left: `${pct}%` }} />
                            ))}
                            {/* Planting bar */}
                            <div
                              className={`absolute top-1.5 bottom-1.5 rounded-sm ${s.bar} transition-all ${
                                isOverdueHarv ? "ring-2 ring-red-500 ring-inset opacity-90" : ""
                              } ${isOverduePlnt ? "ring-2 ring-amber-500 ring-inset opacity-80" : ""}`}
                              style={{ left: `${barStart}%`, width: `${barW}%` }}
                              title={`${rec.actualDate ?? rec.plannedDate} → ${rec.expectedHarvestDate} (${rec.status})`}
                            />
                            {/* Today vertical line */}
                            <div className="absolute top-0 bottom-0 w-0.5 bg-red-400 z-10 pointer-events-none"
                              style={{ left: `${todayPct}%` }} />
                          </div>
                          {/* Edit button */}
                          <button onClick={() => openEdit(rec)}
                            className="size-6 rounded bg-slate-100 hover:bg-slate-200 grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <Pencil className="size-3 text-slate-600" />
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Legend */}
                  <div className="ml-28 mt-4 flex items-center gap-4 flex-wrap text-[10px] text-slate-500">
                    {(Object.entries(STATUS_STYLE) as [PlantingStatus, (typeof STATUS_STYLE)[PlantingStatus]][]).map(([k, v]) => (
                      <span key={k} className="flex items-center gap-1 capitalize">
                        <span className={`inline-block w-5 h-2 rounded-sm ${v.bar}`} />{k}
                      </span>
                    ))}
                    <span className="flex items-center gap-1">
                      <span className="inline-block w-0.5 h-3 bg-red-400" />Today
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="inline-block w-5 h-2 rounded-sm bg-emerald-500 ring-2 ring-red-500 ring-inset" />
                      Overdue harvest
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Create dialog */}
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

      {/* Edit dialog */}
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
