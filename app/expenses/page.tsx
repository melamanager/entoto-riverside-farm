"use client";

import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Receipt, Plus, Pencil, Trash2, TrendingDown, Wallet, ListOrdered, Tag,
} from "lucide-react";
import { toast } from "sonner";
import { EXPENSES, addExpense, updateExpense, deleteExpense, FARMERS } from "@/lib/data";
import type { Expense, ExpenseCategory } from "@/lib/types";
import { EXPENSE_CATEGORY_LABELS, EXPENSE_CATEGORY_COLORS } from "@/lib/types";
import { useLang } from "@/lib/lang";
import { EN, AM } from "@/lib/translations";

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
  const { isAm } = useLang();
  const t = isAm ? AM : EN;

  const [expenses, setExpenses] = useState<Expense[]>(EXPENSES);
  const [catFilter, setCatFilter] = useState<ExpenseCategory | "all">("all");
  const [addOpen, setAddOpen]     = useState(false);
  const [editTarget, setEditTarget] = useState<Expense | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [form, setForm] = useState({ ...EMPTY });

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

  function handleSaveAdd() {
    if (!form.description.trim() || form.amountETB <= 0) { toast.error("Description and amount required"); return; }
    addExpense(form);
    setExpenses([...EXPENSES]);
    setAddOpen(false);
    toast.success("Expense recorded");
  }

  function handleSaveEdit() {
    if (!editTarget || !form.description.trim() || form.amountETB <= 0) { toast.error("Description and amount required"); return; }
    updateExpense(editTarget.id, form);
    setExpenses([...EXPENSES]);
    setEditTarget(null);
    toast.success("Expense updated");
  }

  function handleDelete() {
    if (!deleteTarget) return;
    deleteExpense(deleteTarget.id);
    setExpenses([...EXPENSES]);
    setDeleteTarget(null);
    toast.success("Expense deleted");
  }

  const managerNames = FARMERS.filter(f => f.role !== "farmer");

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-5 max-w-[1400px] mx-auto">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground tracking-tight">{t.expenses.title}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t.expenses.subtitle}</p>
        </div>
        <Button onClick={openAdd} className="bg-primary hover:bg-emerald-700 text-white shrink-0">
          <Plus className="size-4 mr-2" />{t.expenses.addExpense}
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: t.expenses.totalMonth,   value: `${monthlyTotal.toLocaleString()} ETB`, icon: Wallet,      color: "text-primary bg-primary/10" },
          { label: t.expenses.totalAll,      value: `${allTimeTotal.toLocaleString()} ETB`, icon: TrendingDown, color: "text-red-600 bg-red-50" },
          { label: t.expenses.transactions,  value: expenses.length,                         icon: ListOrdered,  color: "text-blue-600 bg-blue-50" },
          { label: t.expenses.topCategory,   value: EXPENSE_CATEGORY_LABELS[topCategory],    icon: Tag,          color: "text-amber-600 bg-amber-50" },
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
                  <span className="font-medium text-foreground/80">{EXPENSE_CATEGORY_LABELS[category]}</span>
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
          <div className="px-4 py-3 border-b border-border/60 flex gap-1.5 flex-wrap">
            <button
              onClick={() => setCatFilter("all")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${catFilter === "all" ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-muted"}`}
            >
              {t.expenses.all}
            </button>
            {CATEGORIES.map(c => (
              <button
                key={c}
                onClick={() => setCatFilter(c)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${catFilter === c ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-muted"}`}
              >
                {EXPENSE_CATEGORY_LABELS[c].split(" ")[0]}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto">
            {filtered.length === 0 ? (
              <div className="p-10 text-center text-muted-foreground text-sm">{t.expenses.noExpenses}</div>
            ) : (
              <table className="w-full pro-table">
                <thead>
                  <tr>
                    <th>{t.common.date}</th>
                    <th>{t.expenses.category}</th>
                    <th>{t.expenses.description}</th>
                    <th className="hidden md:table-cell">{t.expenses.vendor}</th>
                    <th className="text-right">{t.expenses.amount}</th>
                    <th className="hidden sm:table-cell">{t.expenses.paidBy}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(exp => {
                    const payer = FARMERS.find(f => f.id === exp.paidBy);
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
                            <button onClick={() => openEdit(exp)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground/80 transition-colors">
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
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Receipt className="size-4 text-primary" />{t.expenses.addExpense}</DialogTitle></DialogHeader>
          <ExpenseForm form={form} setForm={setForm} payers={managerNames} t={t} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setAddOpen(false)}>{t.common.cancel}</Button>
            <Button className="bg-primary hover:bg-emerald-700 text-white" onClick={handleSaveAdd}>{t.common.create}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editTarget} onOpenChange={v => { if (!v) setEditTarget(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Pencil className="size-4 text-primary" />{t.common.edit} {t.expenses.title}</DialogTitle></DialogHeader>
          <ExpenseForm form={form} setForm={setForm} payers={managerNames} t={t} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setEditTarget(null)}>{t.common.cancel}</Button>
            <Button className="bg-primary hover:bg-emerald-700 text-white" onClick={handleSaveEdit}>{t.common.save}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={v => { if (!v) setDeleteTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="text-red-700">Delete Expense?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{deleteTarget?.description} — <strong>{deleteTarget?.amountETB.toLocaleString()} ETB</strong></p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>{t.common.cancel}</Button>
            <Button variant="destructive" onClick={handleDelete}>{t.common.delete}</Button>
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
  t: typeof AM;
};

function ExpenseForm({ form, setForm, payers, t }: FormProps) {
  const f = (field: keyof Omit<Expense, "id">) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [field]: field === "amountETB" ? parseFloat(e.target.value) || 0 : e.target.value }));

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs font-semibold text-muted-foreground mb-1 block">{t.common.date}</span>
          <input type="date" value={form.date} onChange={f("date")} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-muted-foreground mb-1 block">{t.expenses.category}</span>
          <select value={form.category} onChange={f("category")} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
            {(Object.keys(EXPENSE_CATEGORY_LABELS) as ExpenseCategory[]).map(c => (
              <option key={c} value={c}>{EXPENSE_CATEGORY_LABELS[c]}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="block">
        <span className="text-xs font-semibold text-muted-foreground mb-1 block">{t.expenses.description}</span>
        <input type="text" value={form.description} onChange={f("description")} placeholder="e.g. Kumulus DF sulphur fungicide" className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs font-semibold text-muted-foreground mb-1 block">{t.expenses.amount}</span>
          <input type="number" min="0" value={form.amountETB || ""} onChange={f("amountETB")} placeholder="0" className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-muted-foreground mb-1 block">{t.expenses.paidBy}</span>
          <select value={form.paidBy} onChange={f("paidBy")} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
            {payers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs font-semibold text-muted-foreground mb-1 block">{t.expenses.vendor}</span>
          <input type="text" value={form.vendor ?? ""} onChange={f("vendor")} placeholder="Supplier name" className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-muted-foreground mb-1 block">{t.expenses.receiptRef}</span>
          <input type="text" value={form.receiptRef ?? ""} onChange={f("receiptRef")} placeholder="e.g. AGR-2241" className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </label>
      </div>
      <label className="block">
        <span className="text-xs font-semibold text-muted-foreground mb-1 block">{t.common.notes}</span>
        <textarea rows={2} value={form.note ?? ""} onChange={f("note")} placeholder="Optional note" className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
      </label>
    </div>
  );
}
