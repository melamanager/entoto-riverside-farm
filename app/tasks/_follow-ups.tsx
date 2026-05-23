"use client";

import { useState, useMemo, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip } from "@/components/ui/tooltip";
import {
  Bell, CheckCircle2, Clock, AlertTriangle, Plus, Pencil,
  Bug, Sprout, Droplets, ListChecks, FileText, Filter, ClipboardPlus,
} from "lucide-react";
import { toast } from "sonner";
import type { FollowUp, FollowUpEntityType, FollowUpStatus, FollowUpPriority } from "@/lib/erp-types";
import { FOLLOW_UP_ENTITY_LABELS, FOLLOW_UP_ENTITY_ICONS } from "@/lib/erp-types";
import type { Farmer, Valve, Bed } from "@/lib/types";
import { useLang } from "@/lib/lang";
import { EN, AM } from "@/lib/translations";

const TODAY = new Date().toISOString().split("T")[0];

const PRIORITY_STYLE: Record<FollowUpPriority, string> = {
  low:    "bg-slate-100 text-slate-600 border-slate-200",
  normal: "bg-blue-100 text-blue-700 border-blue-200",
  urgent: "bg-rose-100 text-rose-700 border-rose-200",
};

const STATUS_ICON = {
  pending: <Clock className="size-3.5 text-blue-500" />,
  done:    <CheckCircle2 className="size-3.5 text-emerald-600" />,
  overdue: <AlertTriangle className="size-3.5 text-rose-600" />,
};

const ENTITY_ICONS: Record<FollowUpEntityType, React.ReactNode> = {
  disease:     <Bug className="size-4 text-rose-500" />,
  planting:    <Sprout className="size-4 text-emerald-600" />,
  fertigation: <Droplets className="size-4 text-violet-600" />,
  task:        <ListChecks className="size-4 text-amber-600" />,
  general:     <FileText className="size-4 text-slate-500" />,
};

function daysUntil(dueDate: string) {
  const d = new Date(dueDate).getTime() - new Date(TODAY).getTime();
  return Math.round(d / 86_400_000);
}

const EMPTY_FORM = {
  entityType: "general" as FollowUpEntityType,
  entityId: "farm",
  title: "",
  description: "",
  dueDate: TODAY,
  priority: "normal" as FollowUpPriority,
  assignedTo: "",
  createdBy: "",
  bedId: "",
  valveId: "",
};

type FilterTab = "all" | "pending" | "overdue" | "done" | "today";

export function FollowUpsSection() {
  const { isAm } = useLang();
  const t = isAm ? AM : EN;
  const [followUps, setFollowUps]   = useState<FollowUp[]>([]);
  const [farmers, setFarmers]       = useState<Farmer[]>([]);
  const [valves, setValves]         = useState<Valve[]>([]);
  const [beds, setBeds]             = useState<Bed[]>([]);
  const [tab, setTab]               = useState<FilterTab>("all");
  const [entityFilter, setEntity]   = useState<FollowUpEntityType | "all">("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<FollowUp | null>(null);
  const [doneTarget, setDoneTarget] = useState<FollowUp | null>(null);
  const [doneNote, setDoneNote]     = useState("");
  const [form, setForm]             = useState({ ...EMPTY_FORM });

  useEffect(() => {
    fetch("/api/follow-ups").then(r => r.json()).then(setFollowUps);
    fetch("/api/farmers").then(r => r.json()).then(setFarmers);
    fetch("/api/valves").then(r => r.json()).then(setValves);
    fetch("/api/beds").then(r => r.json()).then(setBeds);
  }, []);

  const managers = farmers.filter(f => f.role === "manager" || f.role === "supervisor");

  const computed = useMemo(() => {
    return followUps.map(fu => {
      const days = daysUntil(fu.dueDate);
      const status: FollowUpStatus =
        fu.status === "done" ? "done"
        : days < 0 ? "overdue"
        : "pending";
      return { ...fu, status, days };
    });
  }, [followUps]);

  const filtered = useMemo(() => {
    let list = computed;
    if (tab === "pending") list = list.filter(f => f.status === "pending");
    else if (tab === "overdue") list = list.filter(f => f.status === "overdue");
    else if (tab === "done")    list = list.filter(f => f.status === "done");
    else if (tab === "today")   list = list.filter(f => f.status !== "done" && f.days === 0);
    if (entityFilter !== "all") list = list.filter(f => f.entityType === entityFilter);
    return list.sort((a, b) => {
      if (a.status === "done" && b.status !== "done") return 1;
      if (b.status === "done" && a.status !== "done") return -1;
      if (a.priority === "urgent" && b.priority !== "urgent") return -1;
      if (b.priority === "urgent" && a.priority !== "urgent") return 1;
      return a.dueDate.localeCompare(b.dueDate);
    });
  }, [computed, tab, entityFilter]);

  const counts = useMemo(() => ({
    pending: computed.filter(f => f.status === "pending").length,
    overdue: computed.filter(f => f.status === "overdue").length,
    done:    computed.filter(f => f.status === "done").length,
    today:   computed.filter(f => f.status !== "done" && f.days === 0).length,
  }), [computed]);

  async function markDone() {
    if (!doneTarget) return;
    const res = await fetch(`/api/follow-ups/${doneTarget.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "done", completedAt: TODAY, completionNote: doneNote || undefined }),
    });
    if (res.ok) {
      const updated = await res.json();
      setFollowUps(prev => prev.map(f => f.id === doneTarget.id ? updated : f));
      toast.success("Follow-up marked as done");
    } else {
      toast.error("Failed to update follow-up");
    }
    setDoneTarget(null);
    setDoneNote("");
  }

  async function handleCreate() {
    if (!form.title.trim()) { toast.error("Title is required"); return; }
    if (!form.assignedTo)   { toast.error("Please assign to someone"); return; }
    const res = await fetch("/api/follow-ups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entityType: form.entityType,
        entityId: form.entityId || "farm",
        title: form.title,
        description: form.description || undefined,
        dueDate: form.dueDate,
        status: "pending",
        priority: form.priority,
        assignedTo: form.assignedTo,
        createdBy: form.createdBy || (farmers.find(f => f.role === "manager")?.id ?? "f-008"),
        bedId: form.bedId || undefined,
        valveId: form.valveId || undefined,
      }),
    });
    if (res.ok) {
      const created = await res.json();
      setFollowUps(prev => [...prev, created]);
      toast.success("Follow-up created");
      setCreateOpen(false);
    } else {
      toast.error("Failed to create follow-up");
    }
  }

  async function handleEdit() {
    if (!editTarget) return;
    const res = await fetch(`/api/follow-ups/${editTarget.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title, description: form.description || undefined,
        dueDate: form.dueDate, priority: form.priority,
        assignedTo: form.assignedTo, entityType: form.entityType,
        bedId: form.bedId || undefined, valveId: form.valveId || undefined,
      }),
    });
    if (res.ok) {
      const updated = await res.json();
      setFollowUps(prev => prev.map(f => f.id === editTarget.id ? updated : f));
      toast.success("Follow-up updated");
      setEditTarget(null);
    } else {
      toast.error("Failed to update follow-up");
    }
  }

  function openEdit(fu: FollowUp) {
    setForm({
      entityType: fu.entityType, entityId: fu.entityId,
      title: fu.title, description: fu.description ?? "",
      dueDate: fu.dueDate, priority: fu.priority,
      assignedTo: fu.assignedTo, createdBy: fu.createdBy,
      bedId: fu.bedId ?? "", valveId: fu.valveId ?? "",
    });
    setEditTarget(fu);
  }

  async function assignAsTask(fu: FollowUp) {
    const categoryMap: Record<FollowUpEntityType, string> = {
      disease:    "disease",
      planting:   "general",
      fertigation:"general",
      task:       "general",
      general:    "general",
    };
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title:       fu.title,
        description: fu.description ?? "",
        assignedTo:  fu.assignedTo,
        createdBy:   fu.createdBy,
        bedId:       fu.bedId,
        status:      "pending",
        priority:    fu.priority === "urgent" ? "high" : fu.priority === "normal" ? "medium" : "low",
        category:    categoryMap[fu.entityType],
        createdAt:   new Date().toISOString(),
        dueDate:     fu.dueDate,
      }),
    });
    toast.success("Assigned as Task", {
      description: `"${fu.title.slice(0, 40)}…" added to daily tasks`,
    });
  }

  return (
    <div className="space-y-5">
      {/* Action row */}
      <div className="flex items-center justify-end">
        <Button
          onClick={() => { setForm({ ...EMPTY_FORM, assignedTo: managers[0]?.id ?? "" }); setCreateOpen(true); }}
          className="bg-amber-500 hover:bg-amber-600 gap-2"
        >
          <Plus className="size-4" /> {t.followUps.newFollowUp}
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: t.common.pending,     value: counts.pending, color: "text-blue-700",    bg: "bg-blue-50 border-blue-200",    tabKey: "pending" as FilterTab },
          { label: t.common.overdue,     value: counts.overdue, color: "text-rose-700",    bg: "bg-rose-50 border-rose-200",    tabKey: "overdue" as FilterTab },
          { label: t.followUps.dueToday, value: counts.today,   color: "text-amber-700",   bg: "bg-amber-50 border-amber-200",  tabKey: "today" as FilterTab },
          { label: t.common.done,        value: counts.done,    color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", tabKey: "done" as FilterTab },
        ].map(({ label, value, color, bg, tabKey }) => (
          <button key={label} onClick={() => setTab(tabKey)}
            className={`rounded-xl border p-4 text-left transition-all hover:shadow-sm ${bg} ${tab === tabKey ? "ring-2 ring-offset-1 ring-slate-400" : ""}`}>
            <div className={`text-2xl font-bold tabular-nums ${color}`}>{value}</div>
            <div className={`text-xs font-medium mt-0.5 ${color}`}>{label}</div>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
          {(["all", "pending", "overdue", "today", "done"] as FilterTab[]).map(f => (
            <button key={f} onClick={() => setTab(f)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all capitalize ${
                tab === f ? "bg-white shadow text-slate-900" : "text-slate-500 hover:text-slate-700"
              }`}>
              {f === "today" ? t.followUps.dueToday : f}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 ml-2">
          <Filter className="size-3.5 text-slate-400" />
          {(["all", "disease", "planting", "fertigation", "task", "general"] as (FollowUpEntityType | "all")[]).map(e => (
            <button key={e} onClick={() => setEntity(e)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all capitalize ${
                entityFilter === e
                  ? "bg-slate-800 text-white border-slate-800"
                  : "bg-white text-slate-500 border-slate-200 hover:border-slate-400"
              }`}>
              {e === "all" ? t.followUps.allTypes : `${FOLLOW_UP_ENTITY_ICONS[e]} ${FOLLOW_UP_ENTITY_LABELS[e]}`}
            </button>
          ))}
        </div>
      </div>

      {/* Follow-up list */}
      <div className="space-y-2">
        {filtered.map(fu => {
          const worker  = farmers.find(f => f.id === fu.assignedTo);
          const valve   = valves.find(v => v.id === fu.valveId);
          const days    = daysUntil(fu.dueDate);
          const isOverdue = fu.status === "overdue";
          return (
            <Card key={fu.id} className={`p-4 transition-all ${
              fu.status === "done" ? "opacity-60 bg-slate-50"
              : isOverdue ? "border-rose-300 bg-rose-50/30"
              : fu.priority === "urgent" ? "border-amber-300 bg-amber-50/20"
              : ""
            }`}>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0">{ENTITY_ICONS[fu.entityType]}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-slate-900 text-sm leading-tight">{fu.title}</div>
                      {fu.description && (
                        <div className="text-xs text-slate-500 mt-0.5 leading-relaxed">{fu.description}</div>
                      )}
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <Badge className={`text-[10px] capitalize ${PRIORITY_STYLE[fu.priority]}`}>{fu.priority}</Badge>
                        <span className="text-[10px] text-slate-400 capitalize">{FOLLOW_UP_ENTITY_LABELS[fu.entityType]}</span>
                        {fu.bedId && <span className="text-[10px] font-mono text-slate-400">{fu.bedId}</span>}
                        {valve && <span className="text-[10px] font-semibold" style={{ color: valve.color }}>{valve.name}</span>}
                        {worker && <span className="text-[10px] text-slate-500">→ {worker.name.split(" ")[0]}</span>}
                      </div>
                      {fu.completionNote && (
                        <div className="text-[11px] text-emerald-700 bg-emerald-50 rounded px-2 py-1 mt-2 italic">
                          ✓ {fu.completionNote}
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="flex items-center gap-1 justify-end">
                        {STATUS_ICON[fu.status]}
                        <span className={`text-xs font-semibold capitalize ${
                          fu.status === "done" ? "text-emerald-600"
                          : isOverdue ? "text-rose-600"
                          : "text-blue-600"
                        }`}>{fu.status}</span>
                      </div>
                      <div className={`text-[11px] mt-0.5 ${isOverdue ? "text-rose-600 font-bold" : "text-slate-400"}`}>
                        {fu.status === "done"
                          ? `Done ${fu.completedAt ? new Date(fu.completedAt).toLocaleDateString("en", { month: "short", day: "numeric" }) : ""}`
                          : isOverdue ? `${Math.abs(days)}${t.followUps.dOverdue}`
                          : days === 0 ? t.common.today
                          : `${t.followUps.dueIn} ${days}${t.followUps.dDays}`}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {new Date(fu.dueDate).toLocaleDateString("en", { month: "short", day: "numeric" })}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  {fu.status !== "done" && (
                    <Tooltip content="Mark as complete">
                      <button
                        onClick={() => { setDoneTarget(fu); setDoneNote(""); }}
                        className="size-7 rounded-md bg-emerald-100 hover:bg-emerald-200 grid place-items-center transition-colors">
                        <CheckCircle2 className="size-3.5 text-emerald-700" />
                      </button>
                    </Tooltip>
                  )}
                  {fu.status !== "done" && (
                    <Tooltip content="Assign as Task">
                      <button
                        onClick={() => assignAsTask(fu)}
                        className="size-7 rounded-md bg-blue-100 hover:bg-blue-200 grid place-items-center transition-colors">
                        <ClipboardPlus className="size-3.5 text-blue-700" />
                      </button>
                    </Tooltip>
                  )}
                  <Tooltip content="Edit">
                    <button onClick={() => openEdit(fu)}
                      className="size-7 rounded-md bg-slate-100 hover:bg-slate-200 grid place-items-center transition-colors">
                      <Pencil className="size-3.5 text-slate-600" />
                    </button>
                  </Tooltip>
                </div>
              </div>
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <Bell className="size-8 mx-auto mb-3 opacity-30" />
            <div className="font-medium">All clear</div>
            <div className="text-sm">No follow-ups match the current filter.</div>
          </div>
        )}
      </div>

      {/* Mark done dialog */}
      <Dialog open={!!doneTarget} onOpenChange={o => !o && setDoneTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-600" /> {t.followUps.markComplete}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">{doneTarget?.title}</p>
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">{t.followUps.completionNote}</label>
            <Textarea value={doneNote} onChange={e => setDoneNote(e.target.value)}
              placeholder="Describe what was done, any observations..."
              className="text-sm min-h-[80px]" />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setDoneTarget(null)}>{t.common.cancel}</Button>
            <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={markDone}>{t.followUps.confirmDone}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create / Edit dialog */}
      {[
        { open: createOpen,    onClose: () => setCreateOpen(false), title: "New Follow-up",  onSave: handleCreate },
        { open: !!editTarget, onClose: () => setEditTarget(null),  title: "Edit Follow-up", onSave: handleEdit },
      ].map(({ open: dOpen, onClose, title, onSave }) => (
        <Dialog key={title} open={dOpen} onOpenChange={o => !o && onClose()}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Bell className="size-4 text-amber-500" /> {title}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Title <span className="text-red-500">*</span></label>
                <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="Describe the action needed..."
                  className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Details</label>
                <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Additional context, what to check, what to bring..."
                  className="text-sm min-h-[70px]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Category</label>
                  <select value={form.entityType}
                    onChange={e => setForm(p => ({ ...p, entityType: e.target.value as FollowUpEntityType }))}
                    className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white">
                    {Object.entries(FOLLOW_UP_ENTITY_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{FOLLOW_UP_ENTITY_ICONS[k as FollowUpEntityType]} {v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Priority</label>
                  <select value={form.priority}
                    onChange={e => setForm(p => ({ ...p, priority: e.target.value as FollowUpPriority }))}
                    className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white capitalize">
                    <option value="low">🟢 Low</option>
                    <option value="normal">🔵 Normal</option>
                    <option value="urgent">🔴 Urgent</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Due date</label>
                  <input type="date" value={form.dueDate}
                    onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))}
                    className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Assigned to <span className="text-red-500">*</span></label>
                  <select value={form.assignedTo}
                    onChange={e => setForm(p => ({ ...p, assignedTo: e.target.value }))}
                    className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white">
                    <option value="">— Select —</option>
                    {farmers.map(f => <option key={f.id} value={f.id}>{f.name} ({f.role})</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Valve (optional)</label>
                  <select value={form.valveId} onChange={e => setForm(p => ({ ...p, valveId: e.target.value }))}
                    className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white">
                    <option value="">— None —</option>
                    {valves.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Bed (optional)</label>
                  <select value={form.bedId} onChange={e => setForm(p => ({ ...p, bedId: e.target.value }))}
                    className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white">
                    <option value="">— None —</option>
                    {beds.map(b => <option key={b.id} value={b.id}>{b.id}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-2">
              <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
              <Button className="flex-1 bg-amber-500 hover:bg-amber-600" onClick={onSave}>Save</Button>
            </div>
          </DialogContent>
        </Dialog>
      ))}
    </div>
  );
}
