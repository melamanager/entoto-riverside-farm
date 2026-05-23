"use client";

import { useState, useMemo, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Receipt, Plus, Pencil, Trash2, TrendingDown, Wallet, ListOrdered, Tag,
} from "lucide-react";
import { toast } from "sonner";
import type { Expense, ExpenseCategory, Farmer } from "@/lib/types";
import { EXPENSE_CATEGORY_LABELS, EXPENSE_CATEGORY_COLORS } from "@/lib/types";

const CATEGORIES = Object.keys(EXPENSE_CATEGORY_LABELS) as ExpenseCategory[];
const THIS_MONTH = "2026-05";

const EMPTY: Omit<Expense, "id"> = {
  date: "2026-05-17",
  category: "chemicals",
  description: "",
  amountETB: 0,
  paidBy: "f-008",
  vendor: "",
  receiptRef: "",
  note: "",
};

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [loading, setLoading] = useState(true);
  const [catFilter, setCatFilter] = useState<ExpenseCategory | "all">("all");
  const [addOpen, setAddOpen]     = useState(false);
  const [editTarget, setEditTarget] = useState<Expense | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [form, setForm] = useState({ ...EMPTY });

  async function fetchExpenses() {
    const r = await fetch("/api/expenses");
    const data: Array<Omit<Expense, "amountETB"> & { amountETB: string | number }> = await r.json();
    setExpenses(data.map(e => ({ ...e, amountETB: parseFloat(String(e.amountETB)) })));
  }

  useEffect(() => {
    Promise.all([
      fetch("/api/expenses").then(r => r.json()),
      fetch("/api/farmers").then(r => r.json()),
    ]).then(([expData, farmData]) => {
      setExpenses(
        (expData as Array<Omit<Expense, "amountETB"> & { amountETB: string | number }>).map(
          e => ({ ...e, amountETB: parseFloat(String(e.amountETB)) })
        )
      );
      setFarmers(farmData as Farmer[]);
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(() =>
    catFilter === "all" ? expenses : expenses.filter(e => e.category === catFilter),
    [expenses, catFilter]
  );

  const monthlyTotal  = expenses.filter(e => e.date.startsWith(THIS_MONTH)).reduce((s, e) => s + e.amountETB, 0);
  const allTimeTotal  = expenses.reduce((s, e) => s + e.amountETB, 0);

  const topCategory = useMemo(() => {
    const sums: Partial<Record<ExpenseCategory, number>> = {};
    expenses.forEach(e => { sums[e.category] = (sums[e.category] ?? 0) + e.amountETB; });
    let top: ExpenseCategory = "other";
    let max = 0;
    (Object.entries(sums) as [ExpenseCategory, number][]).forEach(([k, v]) => { if (v > max) { max = v; top = k; } });
    return top;
  }, [expenses]);

  const byCategory = useMemo(() => {
    const sums: Partial<Record<ExpenseCategory, number>> = {};
    expenses.forEach(e => { sums[e.category] = (sums[e.category] ?? 0) + e.amountETB; });
    return CATEGORIES.map(c => ({ category: c, total: sums[c] ?? 0 }))
      .filter(x => x.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [expenses]);

  const maxBar = byCategory[0]?.total ?? 1;

  function openAdd() { setForm({ ...EMPTY }); setAddOpen(true); }
  function openEdit(e: Expense) { setForm({ date: e.date, category: e.category, description: e.description, amountETB: e.amountETB, paidBy: e.paidBy, vendor: e.vendor ?? "", receiptRef: e.receiptRef ?? "", note: e.note ?? "" }); setEditTarget(e); }

  async function handleSaveAdd() {
    if (!form.description.trim() || form.amountETB <= 0) { toast.error("Description and amount required"); return; }
    await fetch("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    await fetchExpenses();
    setAddOpen(false);
    toast.success("Expense recorded");
  }

  async function handleSaveEdit() {
    if (!editTarget || !form.description.trim() || form.amountETB <= 0) { toast.error("Description and amount required"); return; }
    await fetch(`/api/expenses/${editTarget.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    await fetchExpenses();
    setEditTarget(null);
    toast.success("Expense updated");
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await fetch(`/api/expenses/${deleteTarget.id}`, { method: "DELETE" });
    await fetchExpenses();
    setDeleteTarget(null);
    toast.success("Expense deleted");
  }

  const managerNames = farmers.filter(f => f.role !== "farmer");

  if (loading) {
    return <div className="p-8 text-slate-400 text-sm">Loading…</div>;
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-5 max-w-[1400px] mx-auto">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Expenses</h1>
          <p className="text-sm text-slate-500 mt-0.5">Track and manage all farm expenditures</p>
        </div>
        <Button onClick={openAdd} className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0">
          <Plus className="size-4 mr-2" />Add Expense
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "This Month",   value: `${monthlyTotal.toLocaleString()} ETB`, icon: Wallet,      color: "text-emerald-600 bg-emerald-50" },
          { label: "All Time",      value: `${allTimeTotal.toLocaleString()} ETB`, icon: TrendingDown, color: "text-red-600 bg-red-50" },
          { label: "Transactions",  value: expenses.length,                         icon: ListOrdered,  color: "text-blue-600 bg-blue-50" },
          { label: "Top Category",  value: EXPENSE_CATEGORY_LABELS[topCategory],    icon: Tag,          color: "text-amber-600 bg-amber-50" },
        ].map(card => {
          const Icon = card.icon;
          return (
            <Card key={card.label} className="border border-slate-200 shadow-sm p-4 flex items-start gap-3">
              <div className={`size-9 rounded-lg grid place-items-center shrink-0 ${card.color}`}>
                <Icon className="size-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] text-slate-500 font-medium">{card.label}</div>
                <div className="text-base font-extrabold text-slate-900 truncate">{card.value}</div>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Category breakdown */}
        <Card className="border border-slate-200 shadow-sm p-4 md:p-5">
          <div className="font-bold text-slate-900 mb-4">Spending by Category</div>
          <div className="space-y-3">
            {byCategory.map(({ category, total }) => (
              <div key={category}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium text-slate-700">{EXPENSE_CATEGORY_LABELS[category]}</span>
                  <span className="tabular-nums font-bold text-slate-800">{total.toLocaleString()} <span className="text-slate-400 font-normal">ETB</span></span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${(total / maxBar) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Expense table */}
        <Card className="lg:col-span-2 border border-slate-200 shadow-sm overflow-hidden">
          {/* Category filter */}
          <div className="px-4 py-3 border-b border-slate-100 flex gap-1.5 flex-wrap">
            <button
              onClick={() => setCatFilter("all")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${catFilter === "all" ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
            >
              All
            </button>
            {CATEGORIES.map(c => (
              <button
                key={c}
                onClick={() => setCatFilter(c)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${catFilter === c ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              >
                {EXPENSE_CATEGORY_LABELS[c].split(" ")[0]}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto">
            {filtered.length === 0 ? (
              <div className="p-10 text-center text-slate-400 text-sm">No expenses found</div>
            ) : (
              <table className="w-full pro-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Category</th>
                    <th>Description</th>
                    <th className="hidden md:table-cell">Vendor</th>
                    <th className="text-right">Amount</th>
                    <th className="hidden sm:table-cell">Paid By</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(exp => {
                    const payer = farmers.find(f => f.id === exp.paidBy);
                    return (
                      <tr key={exp.id}>
                        <td className="text-slate-500 text-xs tabular-nums whitespace-nowrap">
                          {new Date(exp.date).toLocaleDateString("en", { month: "short", day: "numeric" })}
                        </td>
                        <td>
                          <Badge className={`text-[10px] border ${EXPENSE_CATEGORY_COLORS[exp.category]}`}>
                            {EXPENSE_CATEGORY_LABELS[exp.category].split(" ")[0]}
                          </Badge>
                        </td>
                        <td className="max-w-[180px]">
                          <div className="font-medium text-slate-800 text-xs truncate">{exp.description}</div>
                          {exp.receiptRef && <div className="text-[10px] text-slate-400">{exp.receiptRef}</div>}
                        </td>
                        <td className="hidden md:table-cell text-xs text-slate-500 truncate max-w-[120px]">
                          {exp.vendor || "—"}
                        </td>
                        <td className="text-right tabular-nums font-bold text-slate-900 whitespace-nowrap">
                          {exp.amountETB.toLocaleString()}
                          <span className="text-[10px] text-slate-400 font-normal ml-0.5">ETB</span>
                        </td>
                        <td className="hidden sm:table-cell text-xs text-slate-600">
                          {payer?.name.split(" ")[0] ?? "—"}
                        </td>
                        <td>
                          <div className="flex items-center gap-1">
                            <button onClick={() => openEdit(exp)} className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors">
                              <Pencil className="size-3.5" />
                            </button>
                            <button onClick={() => setDeleteTarget(exp)} className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors">
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </Card>
      </div>

      {/* Add dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Receipt className="size-4 text-emerald-600" />Add Expense</DialogTitle></DialogHeader>
          <ExpenseForm form={form} setForm={setForm} payers={managerNames} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleSaveAdd}>Create</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editTarget} onOpenChange={v => { if (!v) setEditTarget(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Pencil className="size-4 text-emerald-600" />Edit Expense</DialogTitle></DialogHeader>
          <ExpenseForm form={form} setForm={setForm} payers={managerNames} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleSaveEdit}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={v => { if (!v) setDeleteTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="text-red-700">Delete Expense?</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-600">{deleteTarget?.description} — <strong>{deleteTarget?.amountETB.toLocaleString()} ETB</strong></p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type FormProps = {
  form: Omit<Expense, "id">;
  setForm: React.Dispatch<React.SetStateAction<Omit<Expense, "id">>>;
  payers: Array<{ id: string; name: string }>;
};

function ExpenseForm({ form, setForm, payers }: FormProps) {
  const f = (field: keyof Omit<Expense, "id">) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [field]: field === "amountETB" ? parseFloat(e.target.value) || 0 : e.target.value }));

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs font-semibold text-slate-600 mb-1 block">Date</span>
          <input type="date" value={form.date} onChange={f("date")} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-slate-600 mb-1 block">Category</span>
          <select value={form.category} onChange={f("category")} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
            {(Object.keys(EXPENSE_CATEGORY_LABELS) as ExpenseCategory[]).map(c => (
              <option key={c} value={c}>{EXPENSE_CATEGORY_LABELS[c]}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="block">
        <span className="text-xs font-semibold text-slate-600 mb-1 block">Description</span>
        <input type="text" value={form.description} onChange={f("description")} placeholder="e.g. Kumulus DF sulphur fungicide" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs font-semibold text-slate-600 mb-1 block">Amount (ETB)</span>
          <input type="number" min="0" value={form.amountETB || ""} onChange={f("amountETB")} placeholder="0" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-slate-600 mb-1 block">Paid By</span>
          <select value={form.paidBy} onChange={f("paidBy")} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
            {payers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs font-semibold text-slate-600 mb-1 block">Vendor</span>
          <input type="text" value={form.vendor ?? ""} onChange={f("vendor")} placeholder="Supplier name" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-slate-600 mb-1 block">Receipt Ref</span>
          <input type="text" value={form.receiptRef ?? ""} onChange={f("receiptRef")} placeholder="e.g. AGR-2241" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </label>
      </div>
      <label className="block">
        <span className="text-xs font-semibold text-slate-600 mb-1 block">Notes</span>
        <textarea rows={2} value={form.note ?? ""} onChange={f("note")} placeholder="Optional note" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
      </label>
    </div>
  );
}
