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
import { useAuth } from "@/lib/auth";
import { useOptions } from "@/lib/use-options";

function emptyExpense(userId = ""): Omit<Expense, "id"> {
  return {
    date: new Date().toISOString().split("T")[0],
    category: "chemicals",
    description: "",
    amountETB: 0,
    paidBy: userId,
    vendor: "",
    receiptRef: "",
    note: "",
  };
}

export default function ExpensesPage() {
  const { user } = useAuth();
  const options = useOptions();
  const categories = options.expenseCategories.map(o => o.value as ExpenseCategory);
  const thisMonth = new Date().toISOString().slice(0, 7);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [loading, setLoading] = useState(true);
  const [catFilter, setCatFilter] = useState<ExpenseCategory | "all">("all");
  const [addOpen, setAddOpen]     = useState(false);
  const [editTarget, setEditTarget] = useState<Expense | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [form, setForm] = useState(() => emptyExpense(user?.id ?? ""));

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

  const monthlyTotal  = expenses.filter(e => e.date.startsWith(thisMonth)).reduce((s, e) => s + e.amountETB, 0);
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
    return categories.map(c => ({ category: c, total: sums[c] ?? 0 }))
      .filter(x => x.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [categories, expenses]);

  const maxBar = byCategory[0]?.total ?? 1;

  function openAdd() { setForm(emptyExpense(user?.id ?? "")); setAddOpen(true); }
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
    return <div className="p-8 text-muted-foreground text-sm">Loading…</div>;
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-5 max-w-[1400px] mx-auto">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground tracking-tight">Expenses</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Track and manage all farm expenditures</p>
        </div>
        <Button onClick={openAdd} className="bg-primary hover:bg-primary/90 text-background shrink-0">
          <Plus className="size-4 mr-2" />Add Expense
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "This Month",   value: `${monthlyTotal.toLocaleString()} ETB`, icon: Wallet,      color: "text-primary bg-primary/10" },
          { label: "All Time",      value: `${allTimeTotal.toLocaleString()} ETB`, icon: TrendingDown, color: "text-red-600 bg-red-50" },
          { label: "Transactions",  value: expenses.length,                         icon: ListOrdered,  color: "text-blue-600 bg-blue-50" },
          { label: "Top Category",  value: EXPENSE_CATEGORY_LABELS[topCategory],    icon: Tag,          color: "text-amber-600 bg-amber-50" },
        ].map(card => {
          const Icon = card.icon;
          return (
            <Card key={card.label} className="border border-border shadow-sm p-4 flex items-start gap-3">
              <div className={`size-9 rounded-lg grid place-items-center shrink-0 ${card.color}`}>
                <Icon className="size-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] text-muted-foreground font-medium">{card.label}</div>
                <div className="text-base font-extrabold text-foreground truncate">{card.value}</div>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Category breakdown */}
        <Card className="border border-border shadow-sm p-4 md:p-5">
          <div className="font-bold text-foreground mb-4">Spending by Category</div>
          <div className="space-y-3">
            {byCategory.map(({ category, total }) => (
              <div key={category}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium text-foreground">{EXPENSE_CATEGORY_LABELS[category]}</span>
                  <span className="tabular-nums font-bold text-foreground">{total.toLocaleString()} <span className="text-muted-foreground font-normal">ETB</span></span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${(total / maxBar) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Expense table */}
        <Card className="lg:col-span-2 border border-border shadow-sm overflow-hidden">
          {/* Category filter */}
          <div className="px-4 py-3 border-b border-border flex gap-1.5 flex-wrap">
            <button
              onClick={() => setCatFilter("all")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${catFilter === "all" ? "bg-primary text-background" : "bg-muted text-muted-foreground hover:bg-accent"}`}
            >
              All
            </button>
            {categories.map(c => (
              <button
                key={c}
                onClick={() => setCatFilter(c)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${catFilter === c ? "bg-primary text-background" : "bg-muted text-muted-foreground hover:bg-accent"}`}
              >
                {EXPENSE_CATEGORY_LABELS[c].split(" ")[0]}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto">
            {filtered.length === 0 ? (
              <div className="p-10 text-center text-muted-foreground text-sm">No expenses found</div>
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
                        <td className="text-muted-foreground text-xs tabular-nums whitespace-nowrap">
                          {new Date(exp.date).toLocaleDateString("en", { month: "short", day: "numeric" })}
                        </td>
                        <td>
                          <Badge className={`text-[10px] border ${EXPENSE_CATEGORY_COLORS[exp.category]}`}>
                            {EXPENSE_CATEGORY_LABELS[exp.category].split(" ")[0]}
                          </Badge>
                        </td>
                        <td className="max-w-[180px]">
                          <div className="font-medium text-foreground text-xs truncate">{exp.description}</div>
                          {exp.receiptRef && <div className="text-[10px] text-muted-foreground">{exp.receiptRef}</div>}
                        </td>
                        <td className="hidden md:table-cell text-xs text-muted-foreground truncate max-w-[120px]">
                          {exp.vendor || "—"}
                        </td>
                        <td className="text-right tabular-nums font-bold text-foreground whitespace-nowrap">
                          {exp.amountETB.toLocaleString()}
                          <span className="text-[10px] text-muted-foreground font-normal ml-0.5">ETB</span>
                        </td>
                        <td className="hidden sm:table-cell text-xs text-muted-foreground">
                          {payer?.name.split(" ")[0] ?? "—"}
                        </td>
                        <td>
                          <div className="flex items-center gap-1">
                            <button onClick={() => openEdit(exp)} className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                              <Pencil className="size-3.5" />
                            </button>
                            <button onClick={() => setDeleteTarget(exp)} className="p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors">
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
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Receipt className="size-4 text-primary" />Add Expense</DialogTitle></DialogHeader>
          <ExpenseForm form={form} setForm={setForm} payers={managerNames} categories={options.expenseCategories} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button className="bg-primary hover:bg-primary/90 text-background" onClick={handleSaveAdd}>Create</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editTarget} onOpenChange={v => { if (!v) setEditTarget(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Pencil className="size-4 text-muted-foreground" />Edit Expense</DialogTitle></DialogHeader>
          <ExpenseForm form={form} setForm={setForm} payers={managerNames} categories={options.expenseCategories} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button className="bg-primary hover:bg-primary/90 text-background" onClick={handleSaveEdit}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={v => { if (!v) setDeleteTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="text-red-700">Delete Expense?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{deleteTarget?.description} — <strong>{deleteTarget?.amountETB.toLocaleString()} ETB</strong></p>
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
  categories: Array<{ value: string; label: string }>;
};

function ExpenseForm({ form, setForm, payers, categories }: FormProps) {
  const f = (field: keyof Omit<Expense, "id">) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [field]: field === "amountETB" ? parseFloat(e.target.value) || 0 : e.target.value }));

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs font-semibold text-foreground/80 mb-1 block">Date</span>
          <input type="date" value={form.date} onChange={f("date")} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-foreground/80 mb-1 block">Category</span>
          <select value={form.category} onChange={f("category")} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
            {categories.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="block">
        <span className="text-xs font-semibold text-foreground/80 mb-1 block">Description</span>
        <input type="text" value={form.description} onChange={f("description")} placeholder="e.g. Kumulus DF sulphur fungicide" className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs font-semibold text-foreground/80 mb-1 block">Amount (ETB)</span>
          <input type="number" min="0" value={form.amountETB || ""} onChange={f("amountETB")} placeholder="0" className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-foreground/80 mb-1 block">Paid By</span>
          <select value={form.paidBy} onChange={f("paidBy")} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
            {payers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs font-semibold text-foreground/80 mb-1 block">Vendor</span>
          <input type="text" value={form.vendor ?? ""} onChange={f("vendor")} placeholder="Supplier name" className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-foreground/80 mb-1 block">Receipt Ref</span>
          <input type="text" value={form.receiptRef ?? ""} onChange={f("receiptRef")} placeholder="e.g. AGR-2241" className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </label>
      </div>
      <label className="block">
        <span className="text-xs font-semibold text-foreground/80 mb-1 block">Notes</span>
        <textarea rows={2} value={form.note ?? ""} onChange={f("note")} placeholder="Optional note" className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
      </label>
    </div>
  );
}
