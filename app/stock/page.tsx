"use client";

import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Tooltip } from "@/components/ui/tooltip";
import {
  Package, AlertTriangle, Plus, ArrowDownCircle, ArrowUpCircle,
  History, CheckCircle2, Pencil, TrendingDown,
} from "lucide-react";
import { toast } from "sonner";
import { STOCK_ITEMS, STOCK_TRANSACTIONS, FERTIGATION_RECORDS } from "@/lib/erp-data";
import { FARMERS } from "@/lib/data";
import type { StockItem, StockTransaction, StockCategory, TransactionType } from "@/lib/erp-types";
import { STOCK_CATEGORY_LABELS, STOCK_CATEGORY_ICONS } from "@/lib/erp-types";

const CATEGORY_FILTER = ["all", "fertilizer", "pesticide", "packaging", "tool", "seed", "other"] as const;

const UNIT_LABELS: Record<string, string> = {
  kg: "kg", L: "L", g: "g", ml: "ml",
  piece: "pcs", box: "boxes", bag: "bags", roll: "rolls",
};

function stockLevel(item: StockItem): "ok" | "low" | "critical" {
  if (item.currentQty <= item.reorderLevel * 0.5) return "critical";
  if (item.currentQty <= item.reorderLevel) return "low";
  return "ok";
}

function levelColor(level: "ok" | "low" | "critical") {
  return level === "ok" ? "bg-emerald-500" : level === "low" ? "bg-amber-500" : "bg-rose-500";
}

const EMPTY_ITEM: Omit<StockItem, "id"> = {
  name: "", category: "fertilizer", unit: "kg",
  currentQty: 0, reorderLevel: 1, maxCapacity: 50,
  costPerUnit: 0, supplier: "", lastRestockedDate: "2026-05-19",
};

const EMPTY_TX: { itemId: string; type: TransactionType; quantity: number; notes: string; performedBy: string } = {
  itemId: "", type: "stock_in", quantity: 1, notes: "", performedBy: "",
};

export default function StockPage() {
  const [items, setItems]         = useState<StockItem[]>(STOCK_ITEMS);
  const [transactions, setTx]     = useState<StockTransaction[]>(STOCK_TRANSACTIONS);
  const [catFilter, setCatFilter] = useState<typeof CATEGORY_FILTER[number]>("all");
  const [historyItem, setHistoryItem] = useState<StockItem | null>(null);
  const [txDialogOpen, setTxDialogOpen] = useState(false);
  const [newItemOpen, setNewItemOpen]   = useState(false);
  const [editTarget, setEditTarget]     = useState<StockItem | null>(null);
  const [txForm, setTxForm]   = useState({ ...EMPTY_TX });
  const [itemForm, setItemForm] = useState({ ...EMPTY_ITEM });

  const filtered = useMemo(() =>
    catFilter === "all" ? items : items.filter(i => i.category === catFilter),
    [items, catFilter]);

  const lowCount  = items.filter(i => stockLevel(i) === "low" || stockLevel(i) === "critical").length;
  const totalValue = items.reduce((s, i) => s + i.currentQty * i.costPerUnit, 0);

  // Compute g/kg used per stock item from fertigation records
  const fertigationUsage = useMemo(() => {
    const map: Record<string, number> = {};
    FERTIGATION_RECORDS.filter(r => r.status === "applied").forEach(r => {
      const kgUsed = (r.dosageGPerL * r.waterVolumeLiters) / 1000;
      // Match fertilizer name to stock item
      const si = items.find(i => i.name.toLowerCase().includes(r.fertilizerType.split(" ")[0].toLowerCase()));
      if (si) map[si.id] = (map[si.id] ?? 0) + kgUsed;
    });
    return map;
  }, [items]);

  function itemTransactions(itemId: string) {
    return transactions.filter(t => t.itemId === itemId).sort((a, b) => b.date.localeCompare(a.date));
  }

  function openTxDialog(itemId?: string, type: TransactionType = "stock_in") {
    setTxForm({ ...EMPTY_TX, itemId: itemId ?? items[0]?.id ?? "", type, performedBy: FARMERS[0]?.id ?? "" });
    setTxDialogOpen(true);
  }

  function handleTx() {
    if (!txForm.itemId) { toast.error("Select an item"); return; }
    if (txForm.quantity <= 0) { toast.error("Quantity must be > 0"); return; }
    const item = items.find(i => i.id === txForm.itemId);
    if (!item) return;
    if (txForm.type === "stock_out" && txForm.quantity > item.currentQty) {
      toast.error("Not enough stock", { description: `Only ${item.currentQty} ${item.unit} available` });
      return;
    }
    const newTx: StockTransaction = {
      id: `st-${Date.now()}`, itemId: txForm.itemId, type: txForm.type,
      quantity: txForm.quantity, date: "2026-05-19",
      referenceType: "manual", performedBy: txForm.performedBy, notes: txForm.notes || undefined,
    };
    STOCK_TRANSACTIONS.push(newTx);
    setTx([...STOCK_TRANSACTIONS]);
    // Update currentQty
    const delta = txForm.type === "stock_in" ? txForm.quantity
      : txForm.type === "stock_out" || txForm.type === "waste" ? -txForm.quantity : 0;
    const idx = STOCK_ITEMS.findIndex(i => i.id === txForm.itemId);
    if (idx >= 0) {
      STOCK_ITEMS[idx].currentQty = Math.max(0, STOCK_ITEMS[idx].currentQty + delta);
      if (txForm.type === "stock_in") STOCK_ITEMS[idx].lastRestockedDate = "2026-05-19";
    }
    setItems([...STOCK_ITEMS]);
    toast.success(txForm.type === "stock_in" ? `${item.name} restocked +${txForm.quantity} ${item.unit}` : `${item.name} usage recorded`);
    setTxDialogOpen(false);
  }

  function handleNewItem() {
    if (!itemForm.name.trim()) { toast.error("Item name is required"); return; }
    const newItem: StockItem = { id: `si-${Date.now()}`, ...itemForm };
    STOCK_ITEMS.push(newItem);
    setItems([...STOCK_ITEMS]);
    toast.success(`${itemForm.name} added to inventory`);
    setNewItemOpen(false);
  }

  function handleEditItem() {
    if (!editTarget) return;
    const idx = STOCK_ITEMS.findIndex(i => i.id === editTarget.id);
    if (idx < 0) return;
    Object.assign(STOCK_ITEMS[idx], itemForm);
    setItems([...STOCK_ITEMS]);
    toast.success("Item updated");
    setEditTarget(null);
  }

  function openEdit(item: StockItem) {
    setItemForm({ name: item.name, category: item.category, unit: item.unit,
      currentQty: item.currentQty, reorderLevel: item.reorderLevel, maxCapacity: item.maxCapacity,
      costPerUnit: item.costPerUnit, supplier: item.supplier ?? "", lastRestockedDate: item.lastRestockedDate ?? "",
      notes: item.notes ?? "" });
    setEditTarget(item);
  }

  const farmers = FARMERS;

  return (
    <div className="p-6 md:p-8 max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Package className="size-5 text-emerald-600" />
            <h1 className="text-2xl font-bold text-slate-900">Input Store</h1>
          </div>
          <p className="text-slate-500 text-sm">
            Track fertilizers, pesticides, packaging & tools. Stock deducts automatically when applications are logged.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => openTxDialog(undefined, "stock_out")} className="gap-2">
            <ArrowDownCircle className="size-4 text-rose-500" /> Record Use
          </Button>
          <Button onClick={() => { setItemForm({ ...EMPTY_ITEM }); setNewItemOpen(true); }} className="bg-emerald-600 hover:bg-emerald-700 gap-2">
            <Plus className="size-4" /> Add Item
          </Button>
        </div>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="text-2xl font-bold text-slate-900">{items.length}</div>
          <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
            <Package className="size-3" /> Items tracked
          </div>
        </Card>
        <Card className={`p-4 ${lowCount > 0 ? "bg-rose-50 border-rose-200" : "bg-emerald-50 border-emerald-200"}`}>
          <div className={`text-2xl font-bold ${lowCount > 0 ? "text-rose-700" : "text-emerald-700"}`}>{lowCount}</div>
          <div className={`text-xs font-medium mt-0.5 flex items-center gap-1 ${lowCount > 0 ? "text-rose-600" : "text-emerald-600"}`}>
            <AlertTriangle className="size-3" /> Low / out of stock
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xl font-bold text-slate-900">
            {totalValue.toLocaleString()} ETB
          </div>
          <div className="text-xs text-slate-500 mt-0.5">Total inventory value</div>
        </Card>
        <Card className="p-4">
          <div className="text-xl font-bold text-slate-900">
            {transactions.filter(t => t.type === "stock_out").length}
          </div>
          <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
            <TrendingDown className="size-3" /> Usage transactions
          </div>
        </Card>
      </div>

      {/* Category filter */}
      <div className="flex items-center gap-1 flex-wrap">
        {CATEGORY_FILTER.map(c => (
          <button key={c} onClick={() => setCatFilter(c)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all capitalize ${
              catFilter === c
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
            }`}>
            {c === "all" ? "All Items" : `${STOCK_CATEGORY_ICONS[c as StockCategory]} ${STOCK_CATEGORY_LABELS[c as StockCategory]}`}
          </button>
        ))}
      </div>

      {/* Stock table */}
      <div className="space-y-2">
        {filtered.map(item => {
          const level   = stockLevel(item);
          const pct     = Math.min(100, (item.currentQty / item.maxCapacity) * 100);
          const usage   = fertigationUsage[item.id];
          const txCount = itemTransactions(item.id).length;
          return (
            <Card key={item.id}
              className={`p-4 transition-all ${level === "critical" ? "border-rose-300 bg-rose-50/40" : level === "low" ? "border-amber-300 bg-amber-50/40" : ""}`}>
              <div className="flex items-center gap-4 flex-wrap">
                {/* Icon + name */}
                <div className="flex items-center gap-3 min-w-[220px] flex-1">
                  <span className="text-xl">{STOCK_CATEGORY_ICONS[item.category]}</span>
                  <div>
                    <div className="font-semibold text-slate-900 text-sm flex items-center gap-2">
                      {item.name}
                      {level !== "ok" && (
                        <Tooltip content={level === "critical" ? "Critically low — order immediately!" : "Below reorder level — time to restock"}>
                          <AlertTriangle className={`size-3.5 ${level === "critical" ? "text-rose-600" : "text-amber-500"}`} />
                        </Tooltip>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400 capitalize">
                      {STOCK_CATEGORY_LABELS[item.category]} · {item.supplier ?? "—"}
                    </div>
                    {item.notes && (
                      <div className="text-[10px] text-slate-500 mt-0.5 italic">{item.notes}</div>
                    )}
                  </div>
                </div>

                {/* Stock level bar */}
                <div className="min-w-[140px] flex-1 max-w-[200px]">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-bold text-slate-800 tabular-nums">
                      {item.currentQty} <span className="text-xs font-normal text-slate-500">{UNIT_LABELS[item.unit] ?? item.unit}</span>
                    </span>
                    <span className="text-[10px] text-slate-400">of {item.maxCapacity}</span>
                  </div>
                  <Progress value={pct} className="h-2"
                    style={{ "--progress-color": level === "ok" ? "#22c55e" : level === "low" ? "#f59e0b" : "#ef4444" } as React.CSSProperties} />
                  <div className="text-[9px] text-slate-400 mt-0.5">
                    Reorder at {item.reorderLevel} {UNIT_LABELS[item.unit] ?? item.unit}
                  </div>
                </div>

                {/* Cost */}
                <div className="text-center hidden md:block">
                  <div className="text-sm font-semibold tabular-nums">{(item.currentQty * item.costPerUnit).toLocaleString()} ETB</div>
                  <div className="text-[10px] text-slate-400">{item.costPerUnit} ETB/{item.unit}</div>
                </div>

                {/* Usage from fertigation */}
                {usage !== undefined && (
                  <Tooltip content={`${usage.toFixed(2)} ${item.unit} consumed in fertigation applications this month`} side="top">
                    <div className="text-center cursor-help hidden lg:block">
                      <div className="text-sm font-semibold text-violet-700 tabular-nums">−{usage.toFixed(2)} {item.unit}</div>
                      <div className="text-[10px] text-violet-400">This month used</div>
                    </div>
                  </Tooltip>
                )}

                {/* Last restocked */}
                <div className="text-center hidden lg:block">
                  <div className="text-xs text-slate-600">
                    {item.lastRestockedDate
                      ? new Date(item.lastRestockedDate).toLocaleDateString("en", { month: "short", day: "numeric" })
                      : "—"}
                  </div>
                  <div className="text-[10px] text-slate-400">Last restock</div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <Tooltip content="Add stock (receive delivery)" side="top">
                    <button onClick={() => openTxDialog(item.id, "stock_in")}
                      className="size-7 rounded-md bg-emerald-100 hover:bg-emerald-200 grid place-items-center transition-colors">
                      <ArrowUpCircle className="size-3.5 text-emerald-700" />
                    </button>
                  </Tooltip>
                  <Tooltip content="Record usage / stock out" side="top">
                    <button onClick={() => openTxDialog(item.id, "stock_out")}
                      className="size-7 rounded-md bg-rose-100 hover:bg-rose-200 grid place-items-center transition-colors">
                      <ArrowDownCircle className="size-3.5 text-rose-700" />
                    </button>
                  </Tooltip>
                  <Tooltip content={`${txCount} transaction${txCount !== 1 ? "s" : ""}`} side="top">
                    <button onClick={() => setHistoryItem(item)}
                      className="size-7 rounded-md bg-slate-100 hover:bg-slate-200 grid place-items-center transition-colors">
                      <History className="size-3.5 text-slate-600" />
                    </button>
                  </Tooltip>
                  <button onClick={() => openEdit(item)}
                    className="size-7 rounded-md bg-slate-100 hover:bg-slate-200 grid place-items-center transition-colors">
                    <Pencil className="size-3.5 text-slate-600" />
                  </button>
                </div>
              </div>
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-slate-400 text-sm">No items in this category.</div>
        )}
      </div>

      {/* ── Transaction dialog ──────────────────────────────────────────────── */}
      <Dialog open={txDialogOpen} onOpenChange={o => !o && setTxDialogOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {txForm.type === "stock_in"
                ? <><ArrowUpCircle className="size-4 text-emerald-600" /> Receive Stock</>
                : <><ArrowDownCircle className="size-4 text-rose-600" /> Record Usage</>}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Item <span className="text-red-500">*</span></label>
              <select value={txForm.itemId}
                onChange={e => setTxForm(p => ({ ...p, itemId: e.target.value }))}
                className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white">
                {items.map(i => <option key={i.id} value={i.id}>{i.name} ({i.currentQty} {i.unit} in stock)</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Transaction type</label>
              <select value={txForm.type}
                onChange={e => setTxForm(p => ({ ...p, type: e.target.value as TransactionType }))}
                className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white">
                <option value="stock_in">➕ Received / Restocked</option>
                <option value="stock_out">➖ Used / Issued</option>
                <option value="adjustment">🔄 Adjustment (recount)</option>
                <option value="waste">🗑️ Waste / Damaged</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Quantity ({items.find(i => i.id === txForm.itemId)?.unit ?? "units"})
              </label>
              <input type="number" min={0.01} step={0.01} value={txForm.quantity}
                onChange={e => setTxForm(p => ({ ...p, quantity: Number(e.target.value) }))}
                className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Performed by</label>
              <select value={txForm.performedBy}
                onChange={e => setTxForm(p => ({ ...p, performedBy: e.target.value }))}
                className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white">
                <option value="">— Select —</option>
                {farmers.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Notes (optional)</label>
              <input value={txForm.notes}
                onChange={e => setTxForm(p => ({ ...p, notes: e.target.value }))}
                placeholder="e.g. Delivered from Agri Supply..."
                className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="flex gap-2 mt-2">
            <Button variant="outline" className="flex-1" onClick={() => setTxDialogOpen(false)}>Cancel</Button>
            <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={handleTx}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Transaction history ─────────────────────────────────────────────── */}
      <Dialog open={!!historyItem} onOpenChange={o => !o && setHistoryItem(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="size-4" /> {historyItem?.name} — History
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 mt-2">
            {historyItem && itemTransactions(historyItem.id).length === 0 && (
              <p className="text-sm text-slate-400 text-center py-4">No transactions recorded yet.</p>
            )}
            {historyItem && itemTransactions(historyItem.id).map(tx => {
              const worker = FARMERS.find(f => f.id === tx.performedBy);
              const isIn   = tx.type === "stock_in";
              return (
                <div key={tx.id} className="flex items-start gap-3 p-3 rounded-lg border bg-white">
                  <div className={`mt-0.5 size-6 rounded-full grid place-items-center flex-shrink-0 ${isIn ? "bg-emerald-100" : "bg-rose-100"}`}>
                    {isIn
                      ? <ArrowUpCircle className="size-3.5 text-emerald-700" />
                      : <ArrowDownCircle className="size-3.5 text-rose-700" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-semibold ${isIn ? "text-emerald-700" : "text-rose-700"}`}>
                        {isIn ? "+" : "−"}{tx.quantity} {historyItem.unit}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(tx.date).toLocaleDateString("en", { month: "short", day: "numeric" })}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 capitalize">{tx.type.replace("_", " ")} · {worker?.name ?? tx.performedBy}</div>
                    {tx.notes && <div className="text-[10px] text-slate-400 mt-0.5 italic">{tx.notes}</div>}
                    {tx.referenceId && (
                      <div className="text-[10px] text-violet-500 mt-0.5">Ref: {tx.referenceType} · {tx.referenceId}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── New / Edit item dialog ──────────────────────────────────────────── */}
      {[
        { open: newItemOpen, onClose: () => setNewItemOpen(false), title: "Add New Item", onSave: handleNewItem },
        { open: !!editTarget, onClose: () => setEditTarget(null), title: "Edit Item", onSave: handleEditItem },
      ].map(({ open: dOpen, onClose, title, onSave }) => (
        <Dialog key={title} open={dOpen} onOpenChange={o => !o && onClose()}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Package className="size-4" /> {title}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Item name <span className="text-red-500">*</span></label>
                <input value={itemForm.name} onChange={e => setItemForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. NPK 20-20-20" className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Category</label>
                  <select value={itemForm.category} onChange={e => setItemForm(p => ({ ...p, category: e.target.value as StockCategory }))}
                    className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white">
                    {Object.entries(STOCK_CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Unit</label>
                  <select value={itemForm.unit} onChange={e => setItemForm(p => ({ ...p, unit: e.target.value as any }))}
                    className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white">
                    {["kg", "L", "g", "ml", "piece", "box", "bag", "roll"].map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Current stock</label>
                  <input type="number" min={0} step={0.01} value={itemForm.currentQty}
                    onChange={e => setItemForm(p => ({ ...p, currentQty: Number(e.target.value) }))}
                    className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    <Tooltip content="Send a low-stock alert when quantity falls below this level">
                      <span className="border-b border-dotted border-slate-400 cursor-help">Reorder at</span>
                    </Tooltip>
                  </label>
                  <input type="number" min={0} step={0.1} value={itemForm.reorderLevel}
                    onChange={e => setItemForm(p => ({ ...p, reorderLevel: Number(e.target.value) }))}
                    className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Max capacity</label>
                  <input type="number" min={1} value={itemForm.maxCapacity}
                    onChange={e => setItemForm(p => ({ ...p, maxCapacity: Number(e.target.value) }))}
                    className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Cost per unit (ETB)</label>
                  <input type="number" min={0} value={itemForm.costPerUnit}
                    onChange={e => setItemForm(p => ({ ...p, costPerUnit: Number(e.target.value) }))}
                    className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Supplier</label>
                  <input value={itemForm.supplier} onChange={e => setItemForm(p => ({ ...p, supplier: e.target.value }))}
                    placeholder="Supplier name" className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Notes</label>
                <input value={itemForm.notes ?? ""} onChange={e => setItemForm(p => ({ ...p, notes: e.target.value }))}
                  placeholder="Storage instructions, warnings, etc."
                  className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="flex gap-2 mt-2">
              <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
              <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={onSave}>Save</Button>
            </div>
          </DialogContent>
        </Dialog>
      ))}
    </div>
  );
}
