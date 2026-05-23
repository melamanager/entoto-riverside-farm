"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Package, CheckCircle2, Truck, Clock, BarChart3, Plus, Pencil,
  Search, ScanLine, Wheat, MapPin, User, Leaf, Calendar, X, AlertCircle,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import type { PackagingRecord, PackagingStatus, PackageSize, PackagingPurpose, CustomerOrder } from "@/lib/erp-types";
import type { Farmer, Valve, Bed } from "@/lib/types";
import { useLang } from "@/lib/lang";
import { EN, AM } from "@/lib/translations";

const STATUS_STYLE: Record<PackagingStatus, string> = {
  in_progress: "bg-blue-100 text-blue-700 border-blue-200",
  packed:      "bg-emerald-100 text-emerald-700 border-emerald-200",
  dispatched:  "bg-amber-100 text-amber-700 border-amber-200",
};
const PURPOSE_STYLE: Record<PackagingPurpose, string> = {
  export:      "bg-purple-100 text-purple-700 border-purple-200",
  juice:       "bg-orange-100 text-orange-700 border-orange-200",
  jam:         "bg-rose-100 text-rose-700 border-rose-200",
  local:       "bg-stone-100 text-stone-700 border-stone-200",
  hotel:       "bg-sky-100 text-sky-700 border-sky-200",
  supermarket: "bg-teal-100 text-teal-700 border-teal-200",
};
const PURPOSES: PackagingPurpose[] = ["export", "juice", "jam", "local", "hotel", "supermarket"];
const STATUSES: PackagingStatus[] = ["in_progress", "packed", "dispatched"];
const SIZES: PackageSize[] = ["250g", "500g", "1kg", "2kg", "bulk"];

type HarvestRecord = { id: string; bedId: string; date: string; kg: number; farmerId: string; qualityGrade: string; bed?: { valveId: string; variety: string } };

const EMPTY_FORM = {
  batchNumber: "", harvestDate: "2026-05-17", packedDate: "2026-05-17",
  valveId: "", variety: "",
  harvestedKg: 20, gradedKg: 18, packedKg: 16,
  rejectedKg: 2, packageSize: "500g" as PackageSize, packageCount: 32,
  cartonCount: 2, plateCount: 0, lostKg: 0, purpose: "export" as PackagingPurpose,
  gradeAPct: 75, gradeBPct: 25, packedBy: "", status: "in_progress" as PackagingStatus,
  orderId: "",
};

export default function PackagingPage() {
  const { isAm } = useLang();
  const t = isAm ? AM : EN;
  const [records, setRecords]   = useState<PackagingRecord[]>([]);
  const [orders, setOrders]     = useState<CustomerOrder[]>([]);
  const [harvests, setHarvests] = useState<HarvestRecord[]>([]);
  const [farmers, setFarmers]   = useState<Farmer[]>([]);
  const [valves, setValves]     = useState<Valve[]>([]);
  const [beds, setBeds]         = useState<Bed[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<PackagingRecord | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [harvestSource, setHarvestSource] = useState<string>("");

  useEffect(() => {
    fetch("/api/packaging")
      .then(r => r.json())
      .then((data: (PackagingRecord & { harvestedKg: number | string; gradedKg: number | string; packedKg: number | string; rejectedKg: number | string; lostKg: number | string })[]) =>
        setRecords(data.map(p => ({
          ...p,
          harvestedKg: parseFloat(String(p.harvestedKg)),
          gradedKg:    parseFloat(String(p.gradedKg)),
          packedKg:    parseFloat(String(p.packedKg)),
          rejectedKg:  parseFloat(String(p.rejectedKg)),
          lostKg:      parseFloat(String(p.lostKg)),
        })))
      )
      .catch(() => toast.error("Failed to load packaging records"));

    fetch("/api/orders")
      .then(r => r.json())
      .then((data: (CustomerOrder & { quantityKg: number | string; pricePerKg: number | string; totalAmount: number | string; advancePaid: number | string })[]) =>
        setOrders(data.map(o => ({
          ...o,
          quantityKg:  parseFloat(String(o.quantityKg)),
          pricePerKg:  parseFloat(String(o.pricePerKg)),
          totalAmount: parseFloat(String(o.totalAmount)),
          advancePaid: parseFloat(String(o.advancePaid)),
        })))
      )
      .catch(() => toast.error("Failed to load orders"));

    fetch("/api/harvest")
      .then(r => r.json())
      .then((data: (HarvestRecord & { kg: number | string })[]) =>
        setHarvests(data.map(h => ({ ...h, kg: parseFloat(String(h.kg)) })))
      )
      .catch(() => toast.error("Failed to load harvest records"));

    fetch("/api/farmers")
      .then(r => r.json())
      .then((data: Farmer[]) => setFarmers(data))
      .catch(() => toast.error("Failed to load farmers"));

    fetch("/api/valves")
      .then(r => r.json())
      .then((data: Valve[]) => setValves(data))
      .catch(() => toast.error("Failed to load valves"));

    fetch("/api/beds")
      .then(r => r.json())
      .then((data: Bed[]) => setBeds(data))
      .catch(() => toast.error("Failed to load beds"));
  }, []);

  function openCreate() {
    const next = String(records.length + 54).padStart(3, "0");
    setForm({ ...EMPTY_FORM, batchNumber: `PKG-2026-0${next}`, valveId: valves[0]?.id ?? "", packedBy: farmers[0]?.id ?? "" });
    setHarvestSource("");
    setCreateOpen(true);
  }

  function openEdit(r: PackagingRecord) {
    setForm({
      batchNumber: r.batchNumber, harvestDate: r.harvestDate, packedDate: r.packedDate,
      valveId: r.valveId, variety: r.variety,
      harvestedKg: r.harvestedKg, gradedKg: r.gradedKg,
      packedKg: r.packedKg, rejectedKg: r.rejectedKg, packageSize: r.packageSize,
      packageCount: r.packageCount, cartonCount: r.cartonCount, plateCount: r.plateCount,
      lostKg: r.lostKg, purpose: r.purpose, gradeAPct: r.gradeAPct, gradeBPct: r.gradeBPct,
      packedBy: r.packedBy, status: r.status, orderId: r.orderId ?? "",
    });
    setEditTarget(r);
  }

  async function handleCreate() {
    if (!form.batchNumber.trim()) { toast.error("Batch number required"); return; }
    if (!form.valveId)            { toast.error("Please select a valve"); return; }
    const body = { ...form, orderId: form.orderId || null };
    const res = await fetch("/api/packaging", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) { toast.error("Failed to create batch"); return; }
    const created = await res.json() as PackagingRecord & { harvestedKg: number | string; gradedKg: number | string; packedKg: number | string; rejectedKg: number | string; lostKg: number | string };
    const newRec: PackagingRecord = {
      ...created,
      harvestedKg: parseFloat(String(created.harvestedKg)),
      gradedKg:    parseFloat(String(created.gradedKg)),
      packedKg:    parseFloat(String(created.packedKg)),
      rejectedKg:  parseFloat(String(created.rejectedKg)),
      lostKg:      parseFloat(String(created.lostKg)),
    };
    setRecords(prev => [newRec, ...prev]);
    toast.success(`${form.batchNumber} created`);
    setCreateOpen(false);
  }

  async function handleEdit() {
    if (!editTarget) return;
    const body = { ...form, orderId: form.orderId || null };
    const res = await fetch(`/api/packaging/${editTarget.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) { toast.error("Failed to update batch"); return; }
    const updated = await res.json() as PackagingRecord & { harvestedKg: number | string; gradedKg: number | string; packedKg: number | string; rejectedKg: number | string; lostKg: number | string };
    const updatedRec: PackagingRecord = {
      ...updated,
      harvestedKg: parseFloat(String(updated.harvestedKg)),
      gradedKg:    parseFloat(String(updated.gradedKg)),
      packedKg:    parseFloat(String(updated.packedKg)),
      rejectedKg:  parseFloat(String(updated.rejectedKg)),
      lostKg:      parseFloat(String(updated.lostKg)),
    };
    setRecords(prev => prev.map(r => r.id === editTarget.id ? updatedRec : r));
    toast.success(`${form.batchNumber} updated`);
    setEditTarget(null);
  }

  const dispatched     = records.filter(r => r.status === "dispatched").length;
  const packed         = records.filter(r => r.status === "packed").length;
  const inProgress     = records.filter(r => r.status === "in_progress").length;
  const totalHarvested = records.reduce((s, r) => s + r.harvestedKg, 0);
  const totalPacked    = records.reduce((s, r) => s + r.packedKg, 0);
  const totalRejected  = records.reduce((s, r) => s + r.rejectedKg, 0);
  const totalPackages  = records.reduce((s, r) => s + r.packageCount, 0);
  const totalCartons   = records.reduce((s, r) => s + r.cartonCount, 0);
  const totalPlates    = records.reduce((s, r) => s + r.plateCount, 0);
  const totalLost      = records.reduce((s, r) => s + r.lostKg, 0);
  const avgGradeA      = records.length ? Math.round(records.reduce((s, r) => s + r.gradeAPct, 0) / records.length) : 0;

  // ── Tracker state ──────────────────────────────────────────────────────────
  const [trackQuery, setTrackQuery] = useState("");
  const trackResult = trackQuery.trim()
    ? records.find(r =>
        r.batchNumber.toLowerCase() === trackQuery.trim().toLowerCase() ||
        r.batchNumber.toLowerCase().includes(trackQuery.trim().toLowerCase())
      ) ?? null
    : null;
  const trackValve    = trackResult ? valves.find(v => v.id === trackResult.valveId) ?? null : null;
  const trackPacker   = trackResult ? farmers.find(f => f.id === trackResult.packedBy) ?? null : null;
  const trackHarvests = trackResult
    ? harvests.filter(h => {
        const b = beds.find(x => x.id === h.bedId);
        return b?.valveId === trackResult.valveId && b?.variety === trackResult.variety && h.date === trackResult.harvestDate;
      })
    : [];
  const trackBeds = [...new Set(trackHarvests.map(h => h.bedId))].map(bid => beds.find(b => b.id === bid)).filter(Boolean);
  const trackFarmers = [...new Set(trackHarvests.map(h => h.farmerId))].map(fid => farmers.find(f => f.id === fid)).filter(Boolean);

  const valveBeds = form.valveId ? [...new Set(beds.filter(b => b.valveId === form.valveId).map(b => b.variety))] : [];

  // Group harvest records by date+valve+variety for "link from harvest" picker
  const harvestGroups = (() => {
    const groups: Record<string, {
      key: string; date: string; valveId: string; variety: string;
      totalKg: number; beds: string[];
    }> = {};
    harvests.forEach(h => {
      const bed = beds.find(b => b.id === h.bedId);
      if (!bed) return;
      const key = `${h.date}|${bed.valveId}|${bed.variety}`;
      if (!groups[key]) groups[key] = { key, date: h.date, valveId: bed.valveId, variety: bed.variety, totalKg: 0, beds: [] };
      groups[key].totalKg = Math.round((groups[key].totalKg + h.kg) * 10) / 10;
      if (!groups[key].beds.includes(h.bedId)) groups[key].beds.push(h.bedId);
    });
    return Object.values(groups).sort((a, b) => b.date.localeCompare(a.date));
  })();

  const packagedKeys = new Set(
    records.map(r => `${r.harvestDate}|${r.valveId}|${r.variety}`)
  );

  function applyHarvestSource(key: string) {
    const g = harvestGroups.find(x => x.key === key);
    if (!g) return;
    setHarvestSource(key);
    setForm(p => ({
      ...p,
      harvestDate: g.date,
      valveId: g.valveId,
      variety: g.variety,
      harvestedKg: g.totalKg,
      gradedKg: Math.round(g.totalKg * 0.9 * 10) / 10,
      packedKg:  Math.round(g.totalKg * 0.8 * 10) / 10,
      rejectedKg: Math.round(g.totalKg * 0.1 * 10) / 10,
    }));
  }

  function BatchForm() {
    return (
      <div className="space-y-3">
        {/* Link from harvest log */}
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 mb-1">
          <div className="flex items-center gap-1.5 mb-2">
            <Wheat className="size-3.5 text-emerald-600" />
            <span className="text-xs font-semibold text-emerald-800">Link from Harvest Log</span>
            <span className="text-[10px] text-emerald-600 ml-auto">Auto-fills kg, variety &amp; date</span>
          </div>
          <select
            value={harvestSource}
            onChange={e => applyHarvestSource(e.target.value)}
            className="w-full border border-emerald-200 rounded-md px-3 py-2 text-xs bg-white"
          >
            <option value="">— Pick a harvest event (optional) —</option>
            {harvestGroups.map(g => {
              const valve = valves.find(v => v.id === g.valveId);
              const alreadyPacked = packagedKeys.has(g.key);
              return (
                <option key={g.key} value={g.key}>
                  {g.date} · {valve?.name ?? g.valveId} · {g.variety} · {g.totalKg.toFixed(1)} kg
                  {alreadyPacked ? " ✓ packed" : ""}
                </option>
              );
            })}
          </select>
          {harvestSource && (
            <button
              type="button"
              onClick={() => { setHarvestSource(""); }}
              className="mt-1.5 text-[10px] text-slate-500 hover:text-slate-700 underline"
            >
              Clear selection
            </button>
          )}
        </div>
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
              onChange={e => setForm(p => ({ ...p, valveId: e.target.value, variety: "" }))}
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white">
              <option value="">— Select —</option>
              {valves.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Variety / Origin <span className="text-red-500">*</span></label>
            <select value={form.variety}
              onChange={e => setForm(p => ({ ...p, variety: e.target.value }))}
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white">
              <option value="">— Select —</option>
              {valveBeds.map(v => <option key={v} value={v}>{v}</option>)}
              {!form.valveId && <option disabled>Select valve first</option>}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Purpose <span className="text-red-500">*</span></label>
            <select value={form.purpose}
              onChange={e => setForm(p => ({ ...p, purpose: e.target.value as PackagingPurpose }))}
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white capitalize">
              {PURPOSES.map(p => <option key={p} value={p} className="capitalize">{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
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

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Package Count</label>
            <input type="number" min={0} value={form.packageCount}
              onChange={e => setForm(p => ({ ...p, packageCount: Number(e.target.value) }))}
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Cartons 📦</label>
            <input type="number" min={0} value={form.cartonCount}
              onChange={e => setForm(p => ({ ...p, cartonCount: Number(e.target.value) }))}
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1 flex items-center gap-1"><BarChart3 className="size-3 text-sky-500" /> Plates</label>
            <input type="number" min={0} value={form.plateCount}
              onChange={e => setForm(p => ({ ...p, plateCount: Number(e.target.value) }))}
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-red-700 block mb-1 flex items-center gap-1"><AlertCircle className="size-3 text-red-500" /> Lost (kg)</label>
            <input type="number" min={0} step={0.1} value={form.lostKg}
              onChange={e => setForm(p => ({ ...p, lostKg: Number(e.target.value) }))}
              className="w-full border border-red-100 rounded-md px-3 py-2 text-sm" />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-700 block mb-1">Package Size</label>
          <select value={form.packageSize}
            onChange={e => setForm(p => ({ ...p, packageSize: e.target.value as PackageSize }))}
            className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white">
            {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
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
              {farmers.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
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

        <div>
          <label className="text-xs font-semibold text-slate-700 block mb-1">Customer Order <span className="text-slate-400 font-normal">(optional)</span></label>
          <select value={form.orderId}
            onChange={e => setForm(p => ({ ...p, orderId: e.target.value }))}
            className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white">
            <option value="">— Unlinked —</option>
            {orders.map(o => (
              <option key={o.id} value={o.id}>{o.customerName} · {o.quantityKg}kg · {o.deliveryDate}</option>
            ))}
          </select>
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
            <h1 className="text-2xl font-bold text-slate-900">{t.packaging.title}</h1>
          </div>
          <p className="text-slate-500 text-sm">{t.packaging.subtitle}</p>
        </div>
        <Button onClick={openCreate} className="bg-amber-600 hover:bg-amber-700 gap-2">
          <Plus className="size-4" /> {t.packaging.newBatch}
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
          <div className="flex items-center gap-2">
            <div>
              <div className="text-xl font-bold text-slate-700 tabular-nums">{avgGradeA}%</div>
              <div className="text-xs text-slate-500 font-medium mt-0.5">Avg Grade A</div>
            </div>
            <BarChart3 className="size-6 text-slate-300 ml-auto" />
          </div>
        </Card>
      </div>

      {/* Carton / plate / lost summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4 border-purple-200 bg-purple-50">
          <div className="text-2xl font-bold text-purple-700 tabular-nums">{totalCartons}</div>
          <div className="text-xs text-purple-600 font-medium mt-0.5 flex items-center gap-1"><Package className="size-3" /> Total Cartons</div>
        </Card>
        <Card className="p-4 border-sky-200 bg-sky-50">
          <div className="text-2xl font-bold text-sky-700 tabular-nums">{totalPlates}</div>
          <div className="text-xs text-sky-600 font-medium mt-0.5 flex items-center gap-1"><BarChart3 className="size-3" /> Total Plates</div>
        </Card>
        <Card className="p-4 border-red-200 bg-red-50">
          <div className="text-2xl font-bold text-red-700 tabular-nums">{totalLost.toFixed(1)} kg</div>
          <div className="text-xs text-red-600 font-medium mt-0.5 flex items-center gap-1"><AlertCircle className="size-3" /> Lost (kg)</div>
        </Card>
        <Card className="p-4">
          <div className="text-xl font-bold text-slate-700 tabular-nums">{totalPacked.toFixed(1)} kg</div>
          <div className="text-xs text-slate-500 font-medium mt-0.5">{totalPackages} packages</div>
        </Card>
      </div>

      <Tabs defaultValue="batches">
        <TabsList>
          <TabsTrigger value="batches">Batch Records</TabsTrigger>
          <TabsTrigger value="tracker"><ScanLine className="size-3.5 mr-1.5" />Package Tracker</TabsTrigger>
        </TabsList>

        <TabsContent value="tracker" className="space-y-4 mt-4">
          <Card className="p-5">
            <h3 className="font-semibold mb-1 flex items-center gap-2"><ScanLine className="size-4 text-amber-600" /> Carton Lookup</h3>
            <p className="text-xs text-slate-500 mb-4">Enter or scan a batch number to trace the full history of that carton — valve zone, beds, harvest date, origin, and farmer.</p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                <input
                  value={trackQuery}
                  onChange={e => setTrackQuery(e.target.value)}
                  placeholder="e.g. PKG-2026-051"
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              {trackQuery && (
                <button onClick={() => setTrackQuery("")} className="p-2 rounded-md border border-slate-200 hover:bg-slate-50">
                  <X className="size-4 text-slate-400" />
                </button>
              )}
            </div>

            {trackQuery && !trackResult && (
              <div className="mt-4 text-center py-8 text-slate-400">
                <Package className="size-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No batch found for "{trackQuery}"</p>
              </div>
            )}

            {trackResult && (
              <div className="mt-5 space-y-4">
                {/* Batch header */}
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <div className="font-mono font-bold text-lg text-slate-900">{trackResult.batchNumber}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{trackResult.variety} · Packed {new Date(trackResult.packedDate).toLocaleDateString("en", { day: "numeric", month: "long", year: "numeric" })}</div>
                  </div>
                  <div className="flex gap-2">
                    <Badge className={`text-[10px] capitalize ${PURPOSE_STYLE[trackResult.purpose]}`}>{trackResult.purpose}</Badge>
                    <Badge className={`text-[10px] capitalize ${STATUS_STYLE[trackResult.status]}`}>{trackResult.status.replace("_"," ")}</Badge>
                  </div>
                </div>

                {/* Timeline */}
                <div className="relative pl-7 space-y-4">
                  <div className="absolute left-2.5 top-2 bottom-2 w-px bg-slate-200" />

                  {/* Step 1 – Harvest */}
                  <div className="relative">
                    <div className="absolute -left-[18px] top-1 size-5 rounded-full bg-emerald-100 border-2 border-emerald-400 grid place-items-center">
                      <Wheat className="size-2.5 text-emerald-700" />
                    </div>
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                      <div className="text-xs font-semibold text-emerald-800 mb-1 flex items-center gap-1.5"><Wheat className="size-3" /> Harvested</div>
                      <div className="text-xs text-emerald-700">
                        <span className="font-medium">{new Date(trackResult.harvestDate).toLocaleDateString("en", { weekday: "short", day: "numeric", month: "long", year: "numeric" })}</span>
                      </div>
                      <div className="text-xs text-emerald-600 mt-1">
                        {trackResult.harvestedKg} kg harvested · {trackResult.rejectedKg} kg rejected · {trackResult.lostKg > 0 ? `${trackResult.lostKg} kg lost · ` : ""}{trackResult.packedKg} kg packed
                      </div>
                      {trackHarvests.length > 0 && (
                        <div className="mt-1 text-xs text-emerald-600">
                          Total yield from contributing beds: {trackHarvests.reduce((s,h)=>s+h.kg,0).toFixed(1)} kg
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Step 2 – Valve & Beds */}
                  <div className="relative">
                    <div className="absolute -left-[18px] top-1 size-5 rounded-full bg-blue-100 border-2 border-blue-400 grid place-items-center">
                      <MapPin className="size-2.5 text-blue-700" />
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <div className="text-xs font-semibold text-blue-800 mb-2 flex items-center gap-1.5"><MapPin className="size-3" /> Zone & Beds</div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ background: trackValve?.color ?? "#666" }}>{trackValve?.name}</span>
                        <span className="text-xs text-blue-600">{trackValve?.irrigationSchedule}</span>
                      </div>
                      {trackBeds.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {trackBeds.map(b => (
                            <span key={b!.id} className="text-[11px] font-mono bg-white border border-blue-200 rounded px-2 py-0.5 text-blue-700">{b!.id}</span>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-blue-600">All beds in {trackValve?.name} with {trackResult.variety}</div>
                      )}
                    </div>
                  </div>

                  {/* Step 3 – Origin */}
                  <div className="relative">
                    <div className="absolute -left-[18px] top-1 size-5 rounded-full bg-amber-100 border-2 border-amber-400 grid place-items-center">
                      <Leaf className="size-2.5 text-amber-700" />
                    </div>
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <div className="text-xs font-semibold text-amber-800 mb-1 flex items-center gap-1.5"><Leaf className="size-3" /> Origin / Variety</div>
                      <div className="text-xs text-amber-700 font-medium">{trackResult.variety}</div>
                      {trackBeds[0] && (
                        <div className="text-xs text-amber-600 mt-0.5">{(trackBeds[0] as { origin?: string }).origin ?? ""}</div>
                      )}
                    </div>
                  </div>

                  {/* Step 4 – Farmer */}
                  <div className="relative">
                    <div className="absolute -left-[18px] top-1 size-5 rounded-full bg-purple-100 border-2 border-purple-400 grid place-items-center">
                      <User className="size-2.5 text-purple-700" />
                    </div>
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                      <div className="text-xs font-semibold text-purple-800 mb-2 flex items-center gap-1.5"><User className="size-3" /> Harvested by</div>
                      <div className="flex flex-wrap gap-2">
                        {(trackFarmers.length > 0 ? trackFarmers : [trackPacker]).filter(Boolean).map(f => (
                          <div key={f!.id} className="flex items-center gap-1.5 bg-white border border-purple-200 rounded-lg px-2.5 py-1.5">
                            <div className="size-5 rounded-full bg-purple-100 grid place-items-center text-[10px] font-bold text-purple-700">{f!.avatar}</div>
                            <div>
                              <div className="text-xs font-medium text-purple-900">{f!.name}</div>
                              <div className="text-[10px] text-purple-500 capitalize">{f!.role}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Step 5 – Packaging */}
                  <div className="relative">
                    <div className="absolute -left-[18px] top-1 size-5 rounded-full bg-slate-100 border-2 border-slate-400 grid place-items-center">
                      <Package className="size-2.5 text-slate-700" />
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                      <div className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1.5"><Package className="size-3" /> Packaging details</div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-white rounded border border-slate-200 p-2">
                          <div className="text-base font-bold text-purple-700">{trackResult.cartonCount}</div>
                          <div className="text-[10px] text-slate-500">Cartons</div>
                        </div>
                        <div className="bg-white rounded border border-slate-200 p-2">
                          <div className="text-base font-bold text-sky-700">{trackResult.plateCount}</div>
                          <div className="text-[10px] text-slate-500">Plates</div>
                        </div>
                        <div className="bg-white rounded border border-red-200 p-2">
                          <div className="text-base font-bold text-red-600">{trackResult.lostKg} kg</div>
                          <div className="text-[10px] text-slate-500">Lost kg</div>
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-slate-500">
                        {trackResult.packageSize} packs · Grade A {trackResult.gradeAPct}% · Grade B {trackResult.gradeBPct}%
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        Packed by {trackPacker?.name} · {new Date(trackResult.packedDate).toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric" })}
                      </div>
                      {trackResult.orderId && (() => {
                        const ord = orders.find(o => o.id === trackResult.orderId);
                        return ord ? (
                          <div className="mt-2 flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-md px-2.5 py-2">
                            <div className="size-5 rounded-full bg-indigo-100 grid place-items-center shrink-0">
                              <User className="size-3 text-indigo-700" />
                            </div>
                            <div className="text-xs">
                              <span className="font-semibold text-indigo-800">{ord.customerName}</span>
                              <span className="text-indigo-500 ml-1.5">· {ord.quantityKg} kg · ETB {ord.totalAmount.toLocaleString()} · delivery {new Date(ord.deliveryDate).toLocaleDateString("en",{day:"numeric",month:"short"})}</span>
                            </div>
                          </div>
                        ) : null;
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="batches" className="space-y-4 mt-4">
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
                <th>Batch #</th><th>Customer Order</th><th>Valve</th><th>Variety</th><th>Purpose</th>
                <th>Harvested</th><th>Packed</th><th>Rejected</th>
                <th>Cartons</th><th>Plates</th><th>Lost kg</th><th>Pkgs</th>
                <th>Grade A</th><th>Packed By</th><th>Status</th><th className="w-12"></th>
              </tr>
            </thead>
            <tbody>
              {[...records].sort((a, b) => b.harvestDate.localeCompare(a.harvestDate)).map(rec => {
                const valve = valves.find(v => v.id === rec.valveId);
                const worker = farmers.find(f => f.id === rec.packedBy);
                return (
                  <tr key={rec.id} className="group">
                    <td className="font-mono text-xs font-semibold text-slate-700">{rec.batchNumber}</td>
                    <td>
                      {rec.orderId ? (() => {
                        const ord = orders.find(o => o.id === rec.orderId);
                        return ord ? (
                          <div className="text-xs">
                            <div className="font-semibold text-indigo-700 truncate max-w-[120px]">{ord.customerName}</div>
                            <div className="text-[10px] text-slate-400">{ord.quantityKg} kg</div>
                          </div>
                        ) : <span className="text-slate-300 text-xs">—</span>;
                      })() : <span className="text-slate-300 text-xs">—</span>}
                    </td>
                    <td><span className="text-xs font-semibold" style={{ color: valve?.color }}>{valve?.name}</span></td>
                    <td className="text-xs text-slate-600 max-w-[120px] truncate">{rec.variety}</td>
                    <td><Badge className={`text-[10px] capitalize ${PURPOSE_STYLE[rec.purpose]}`}>{rec.purpose}</Badge></td>
                    <td className="tabular-nums font-semibold">{rec.harvestedKg.toFixed(1)}</td>
                    <td className="tabular-nums text-emerald-700 font-semibold">{rec.packedKg.toFixed(1)}</td>
                    <td className="tabular-nums text-red-600 font-semibold">{rec.rejectedKg.toFixed(1)}</td>
                    <td className="tabular-nums text-center font-bold text-purple-700">{rec.cartonCount}</td>
                    <td className="tabular-nums text-center font-bold text-sky-700">{rec.plateCount}</td>
                    <td className={`tabular-nums text-center font-bold ${rec.lostKg > 0 ? "text-red-600" : "text-slate-300"}`}>{rec.lostKg > 0 ? `${rec.lostKg.toFixed(1)}` : "—"}</td>
                    <td className="tabular-nums text-center text-slate-500 text-xs">{rec.packageCount}</td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <div className="w-10 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${rec.gradeAPct}%` }} />
                        </div>
                        <span className="text-xs tabular-nums font-semibold text-emerald-700">{rec.gradeAPct}%</span>
                      </div>
                    </td>
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
        </TabsContent>
      </Tabs>

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
            <Button variant="outline" className="flex-1" onClick={() => setCreateOpen(false)}>{t.common.cancel}</Button>
            <Button className="flex-1 bg-amber-600 hover:bg-amber-700" onClick={handleCreate}>{t.common.create}</Button>
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
            <Button variant="outline" className="flex-1" onClick={() => setEditTarget(null)}>{t.common.cancel}</Button>
            <Button className="flex-1 bg-amber-600 hover:bg-amber-700" onClick={handleEdit}>{t.common.save}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
