"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ShoppingCart, Truck, Phone, Plus, Pencil, Trash2, Package, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { CUSTOMER_ORDERS, PACKAGING_RECORDS } from "@/lib/erp-data";
import { CUSTOMER_TYPE_LABELS } from "@/lib/erp-types";
import type { CustomerOrder, CustomerType, PaymentStatus, DeliveryStatus } from "@/lib/erp-types";
import { useLang } from "@/lib/lang";
import { EN, AM } from "@/lib/translations";

const PAYMENT_STYLE: Record<PaymentStatus, string> = {
  paid:    "bg-emerald-100 text-emerald-700 border-emerald-200",
  partial: "bg-amber-100 text-amber-700 border-amber-200",
  pending: "bg-slate-100 text-slate-600 border-slate-200",
  overdue: "bg-red-100 text-red-700 border-red-200",
};
const DELIVERY_STYLE: Record<DeliveryStatus, string> = {
  delivered:  "bg-emerald-100 text-emerald-700 border-emerald-200",
  in_transit: "bg-blue-100 text-blue-700 border-blue-200",
  pending:    "bg-amber-100 text-amber-700 border-amber-200",
  cancelled:  "bg-red-100 text-red-700 border-red-200",
};
const CUSTOMER_ICONS: Record<CustomerType, string> = {
  hotel: "🏨", supermarket: "🛒", restaurant: "🍽️", direct: "🧺", export: "✈️",
};

const EMPTY_FORM = {
  customerName: "", customerType: "direct" as CustomerType,
  orderDate: new Date().toISOString().split("T")[0],
  deliveryDate: new Date(Date.now() + 3 * 86400000).toISOString().split("T")[0],
  quantityKg: 10, pricePerKg: 140,
  advancePaid: 0,
  paymentStatus: "pending" as PaymentStatus,
  deliveryStatus: "pending" as DeliveryStatus,
  variety: "", phone: "", notes: "",
};

export default function OrdersPage() {
  const { isAm } = useLang();
  const t = isAm ? AM : EN;
  const [orders, setOrders] = useState<CustomerOrder[]>(CUSTOMER_ORDERS);
  const [filter, setFilter]         = useState<"all" | PaymentStatus>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<CustomerOrder | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CustomerOrder | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  function openCreate() { setForm(EMPTY_FORM); setCreateOpen(true); }
  function openEdit(o: CustomerOrder) {
    setForm({
      customerName: o.customerName, customerType: o.customerType,
      orderDate: o.orderDate, deliveryDate: o.deliveryDate,
      quantityKg: o.quantityKg, pricePerKg: o.pricePerKg,
      advancePaid: o.advancePaid, paymentStatus: o.paymentStatus,
      deliveryStatus: o.deliveryStatus, variety: o.variety ?? "",
      phone: o.phone ?? "", notes: o.notes ?? "",
    });
    setEditTarget(o);
  }

  function totalAmt() { return form.quantityKg * form.pricePerKg; }

  function handleCreate() {
    if (!form.customerName.trim()) { toast.error("Customer name is required"); return; }
    if (form.quantityKg <= 0)      { toast.error("Quantity must be > 0"); return; }
    if (form.pricePerKg <= 0)      { toast.error("Price must be > 0"); return; }
    const id = `ord-${Date.now()}`;
    const newOrder: CustomerOrder = {
      id, customerName: form.customerName.trim(),
      customerType: form.customerType,
      orderDate: form.orderDate, deliveryDate: form.deliveryDate,
      quantityKg: form.quantityKg, pricePerKg: form.pricePerKg,
      totalAmount: totalAmt(), advancePaid: form.advancePaid,
      paymentStatus: form.paymentStatus, deliveryStatus: form.deliveryStatus,
      variety: form.variety || undefined,
      phone: form.phone || undefined, notes: form.notes || undefined,
    };
    CUSTOMER_ORDERS.push(newOrder);
    setOrders([...CUSTOMER_ORDERS]);
    toast.success(`Order for ${newOrder.customerName} created`);
    setCreateOpen(false);
  }

  function handleEdit() {
    if (!editTarget) return;
    const idx = CUSTOMER_ORDERS.findIndex(o => o.id === editTarget.id);
    if (idx < 0) return;
    Object.assign(CUSTOMER_ORDERS[idx], {
      customerName: form.customerName.trim(),
      customerType: form.customerType,
      orderDate: form.orderDate, deliveryDate: form.deliveryDate,
      quantityKg: form.quantityKg, pricePerKg: form.pricePerKg,
      totalAmount: totalAmt(), advancePaid: form.advancePaid,
      paymentStatus: form.paymentStatus, deliveryStatus: form.deliveryStatus,
      variety: form.variety || undefined,
      phone: form.phone || undefined, notes: form.notes || undefined,
    });
    setOrders([...CUSTOMER_ORDERS]);
    toast.success(`Order updated`);
    setEditTarget(null);
  }

  function handleDelete() {
    if (!deleteTarget) return;
    if (deleteTarget.deliveryStatus !== "pending") {
      toast.error("Can only delete pending orders");
      setDeleteTarget(null);
      return;
    }
    const idx = CUSTOMER_ORDERS.findIndex(o => o.id === deleteTarget.id);
    if (idx >= 0) CUSTOMER_ORDERS.splice(idx, 1);
    setOrders([...CUSTOMER_ORDERS]);
    toast.success(`Order deleted`);
    setDeleteTarget(null);
  }

  const records = filter === "all" ? orders : orders.filter(o => o.paymentStatus === filter);
  const totalRevenue = orders.reduce((s, o) => s + o.totalAmount, 0);
  const collected    = orders.reduce((s, o) => s + o.advancePaid, 0);
  const outstanding  = totalRevenue - collected;
  const delivered    = orders.filter(o => o.deliveryStatus === "delivered").length;
  const pending      = orders.filter(o => o.deliveryStatus === "pending").length;

  function OrderForm() {
    const total = form.quantityKg * form.pricePerKg;
    return (
      <div className="space-y-3">
        <div>
          <label className="text-xs font-semibold text-slate-700 block mb-1">Customer Name <span className="text-red-500">*</span></label>
          <input
            value={form.customerName}
            onChange={e => setForm(p => ({ ...p, customerName: e.target.value }))}
            placeholder="e.g. Skylight Hotel"
            className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Customer Type</label>
            <select
              value={form.customerType}
              onChange={e => setForm(p => ({ ...p, customerType: e.target.value as CustomerType }))}
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white"
            >
              {(Object.keys(CUSTOMER_TYPE_LABELS) as CustomerType[]).map(ct => (
                <option key={ct} value={ct}>{CUSTOMER_ICONS[ct]} {CUSTOMER_TYPE_LABELS[ct]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Phone</label>
            <input
              value={form.phone}
              onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
              placeholder="+251..."
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Order Date</label>
            <input type="date" value={form.orderDate}
              onChange={e => setForm(p => ({ ...p, orderDate: e.target.value }))}
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Delivery Date</label>
            <input type="date" value={form.deliveryDate}
              onChange={e => setForm(p => ({ ...p, deliveryDate: e.target.value }))}
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Qty (kg)</label>
            <input type="number" min={1} value={form.quantityKg}
              onChange={e => setForm(p => ({ ...p, quantityKg: Number(e.target.value) }))}
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Price / kg (ETB)</label>
            <input type="number" min={1} value={form.pricePerKg}
              onChange={e => setForm(p => ({ ...p, pricePerKg: Number(e.target.value) }))}
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Total (ETB)</label>
            <div className="border border-slate-100 bg-slate-50 rounded-md px-3 py-2 text-sm font-bold text-slate-700 tabular-nums">
              {total.toLocaleString()}
            </div>
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-700 block mb-1">Advance Paid (ETB)</label>
          <input type="number" min={0} value={form.advancePaid}
            onChange={e => setForm(p => ({ ...p, advancePaid: Number(e.target.value) }))}
            className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Payment Status</label>
            <select value={form.paymentStatus}
              onChange={e => setForm(p => ({ ...p, paymentStatus: e.target.value as PaymentStatus }))}
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white capitalize">
              {(["pending","partial","paid","overdue"] as PaymentStatus[]).map(s => (
                <option key={s} value={s} className="capitalize">{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Delivery Status</label>
            <select value={form.deliveryStatus}
              onChange={e => setForm(p => ({ ...p, deliveryStatus: e.target.value as DeliveryStatus }))}
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white">
              {(["pending","in_transit","delivered","cancelled"] as DeliveryStatus[]).map(s => (
                <option key={s} value={s}>{s.replace("_", " ")}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-700 block mb-1">Notes</label>
          <textarea value={form.notes}
            onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
            rows={2} placeholder="Any special requirements..."
            className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm resize-none" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-[1400px] mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShoppingCart className="size-5 text-indigo-600" />
            <h1 className="text-2xl font-bold text-slate-900">{t.orders.title}</h1>
          </div>
          <p className="text-slate-500 text-sm">{t.orders.subtitle}</p>
        </div>
        <Button onClick={openCreate} className="bg-indigo-600 hover:bg-indigo-700 gap-2">
          <Plus className="size-4" /> {t.orders.newOrder}
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4 bg-indigo-50 border-indigo-200">
          <div className="text-xl font-bold text-indigo-700 tabular-nums">{(totalRevenue / 1000).toFixed(1)}k ETB</div>
          <div className="text-xs text-indigo-600 font-medium mt-0.5">Total Order Value</div>
        </Card>
        <Card className="p-4 bg-emerald-50 border-emerald-200">
          <div className="text-xl font-bold text-emerald-700 tabular-nums">{(collected / 1000).toFixed(1)}k ETB</div>
          <div className="text-xs text-emerald-600 font-medium mt-0.5">Collected</div>
        </Card>
        <Card className="p-4 bg-red-50 border-red-200">
          <div className="text-xl font-bold text-red-700 tabular-nums">{(outstanding / 1000).toFixed(1)}k ETB</div>
          <div className="text-xs text-red-600 font-medium mt-0.5">Outstanding</div>
        </Card>
        <Card className="p-4 bg-slate-50 border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xl font-bold text-slate-700 tabular-nums">{delivered}/{orders.length}</div>
              <div className="text-xs text-slate-500 font-medium mt-0.5">Delivered · {pending} pending</div>
            </div>
            <Truck className="size-7 text-slate-300" />
          </div>
        </Card>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit">
        {(["all", "paid", "partial", "pending", "overdue"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all capitalize ${filter === f ? "bg-white shadow text-slate-900" : "text-slate-500 hover:text-slate-700"}`}>
            {f}
          </button>
        ))}
      </div>

      {/* Table */}
      <Card className="border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full pro-table">
            <thead>
              <tr>
                <th>Customer</th><th>Type</th><th>Order</th><th>Delivery</th>
                <th>Qty</th><th>Price</th><th>Total</th>
                <th>Advance</th><th>Balance</th><th>Payment</th><th>Delivery</th>
                <th>Batches</th><th className="w-16"></th>
              </tr>
            </thead>
            <tbody>
              {records.map(ord => {
                const balance = ord.totalAmount - ord.advancePaid;
                const isOverdue = ord.deliveryStatus === "pending" && ord.deliveryDate < "2026-05-17";
                const batches = PACKAGING_RECORDS.filter(p => p.orderId === ord.id);
                const fulfilledKg = batches.reduce((s, p) => s + p.packedKg, 0);
                const isExpanded = expandedOrder === ord.id;
                return (
                  <>
                  <tr key={ord.id} className="group">
                    <td>
                      <div className="font-semibold text-slate-800 text-sm">{ord.customerName}</div>
                      {ord.phone && (
                        <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5">
                          <Phone className="size-2.5" /> {ord.phone}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className="flex items-center gap-1 text-xs">
                        <span>{CUSTOMER_ICONS[ord.customerType]}</span>
                        <span className="text-slate-600">{CUSTOMER_TYPE_LABELS[ord.customerType]}</span>
                      </span>
                    </td>
                    <td className="tabular-nums text-xs">
                      {new Date(ord.orderDate).toLocaleDateString("en", { month: "short", day: "numeric" })}
                    </td>
                    <td className="tabular-nums text-xs">
                      <span className={isOverdue ? "text-red-600 font-semibold" : ""}>
                        {new Date(ord.deliveryDate).toLocaleDateString("en", { month: "short", day: "numeric" })}
                        {isOverdue && " ⚠️"}
                      </span>
                    </td>
                    <td className="tabular-nums font-semibold">{ord.quantityKg}</td>
                    <td className="tabular-nums">{ord.pricePerKg}</td>
                    <td className="tabular-nums font-bold text-slate-800">{ord.totalAmount.toLocaleString()}</td>
                    <td className="tabular-nums text-emerald-700">{ord.advancePaid.toLocaleString()}</td>
                    <td className={`tabular-nums font-semibold ${balance > 0 ? "text-red-600" : "text-slate-400"}`}>
                      {balance > 0 ? balance.toLocaleString() : "—"}
                    </td>
                    <td><Badge className={`text-[10px] capitalize ${PAYMENT_STYLE[ord.paymentStatus]}`}>{ord.paymentStatus}</Badge></td>
                    <td><Badge className={`text-[10px] capitalize ${DELIVERY_STYLE[ord.deliveryStatus]}`}>{ord.deliveryStatus.replace("_", " ")}</Badge></td>
                    <td>
                      {batches.length > 0 ? (
                        <button onClick={() => setExpandedOrder(isExpanded ? null : ord.id)}
                          className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800">
                          <Package className="size-3" /> {batches.length}
                          <ChevronDown className={`size-3 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                        </button>
                      ) : <span className="text-slate-300 text-xs">—</span>}
                    </td>
                    <td>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(ord)}
                          className="size-6 rounded bg-slate-100 hover:bg-slate-200 grid place-items-center" title="Edit">
                          <Pencil className="size-3 text-slate-600" />
                        </button>
                        <button onClick={() => setDeleteTarget(ord)}
                          className="size-6 rounded bg-slate-100 hover:bg-red-100 grid place-items-center" title="Delete">
                          <Trash2 className="size-3 text-slate-600" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr key={`${ord.id}-batches`} className="bg-indigo-50/50">
                      <td colSpan={13} className="px-4 py-3">
                        <div className="text-xs font-semibold text-indigo-700 mb-2 flex items-center gap-1.5">
                          <Package className="size-3.5" /> Fulfilled by {batches.length} batch{batches.length > 1 ? "es" : ""} · {fulfilledKg.toFixed(1)} kg packed of {ord.quantityKg} kg ordered
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {batches.map(b => (
                            <div key={b.id} className="flex items-center gap-2 bg-white border border-indigo-200 rounded-lg px-3 py-2">
                              <Package className="size-3.5 text-indigo-500 shrink-0" />
                              <div>
                                <div className="font-mono text-xs font-bold text-slate-800">{b.batchNumber}</div>
                                <div className="text-[10px] text-slate-500">{b.packedKg} kg · {b.variety} · {b.packedDate}</div>
                              </div>
                              <Badge className={`text-[10px] ml-1 ${b.status === "dispatched" ? "bg-amber-100 text-amber-700 border-amber-200" : b.status === "packed" ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-blue-100 text-blue-700 border-blue-200"}`}>
                                {b.status.replace("_"," ")}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                  </>
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
              <Plus className="size-4 text-indigo-600" /> New Customer Order
            </DialogTitle>
          </DialogHeader>
          <OrderForm />
          <div className="flex gap-2 mt-2">
            <Button variant="outline" className="flex-1" onClick={() => setCreateOpen(false)}>{t.common.cancel}</Button>
            <Button className="flex-1 bg-indigo-600 hover:bg-indigo-700" onClick={handleCreate}>{t.common.create}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Edit ───────────────────────────────────────────────────────────── */}
      <Dialog open={!!editTarget} onOpenChange={o => !o && setEditTarget(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="size-4 text-slate-600" /> Edit Order — {editTarget?.customerName}
            </DialogTitle>
          </DialogHeader>
          <OrderForm />
          <div className="flex gap-2 mt-2">
            <Button variant="outline" className="flex-1" onClick={() => setEditTarget(null)}>{t.common.cancel}</Button>
            <Button className="flex-1 bg-indigo-600 hover:bg-indigo-700" onClick={handleEdit}>{t.common.save}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete ─────────────────────────────────────────────────────────── */}
      <Dialog open={!!deleteTarget} onOpenChange={o => !o && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <Trash2 className="size-4" /> Delete Order?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            Delete order for <strong>{deleteTarget?.customerName}</strong>?
            {deleteTarget?.deliveryStatus !== "pending" && (
              <span className="block mt-2 text-red-600 font-medium">⚠ Only pending orders can be deleted.</span>
            )}
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
