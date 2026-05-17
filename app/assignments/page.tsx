"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ClipboardList, CheckCircle2, Clock, AlertCircle, Calendar, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { WORKER_ASSIGNMENTS } from "@/lib/erp-data";
import { FARMERS, VALVES, BEDS } from "@/lib/data";
import { ACTIVITY_LABELS, ACTIVITY_ICONS } from "@/lib/erp-types";
import type { WorkerAssignment, AssignmentStatus, ActivityType, Shift } from "@/lib/erp-types";

const STATUS_STYLE: Record<AssignmentStatus, string> = {
  assigned:    "bg-amber-100 text-amber-700 border-amber-200",
  in_progress: "bg-blue-100 text-blue-700 border-blue-200",
  completed:   "bg-emerald-100 text-emerald-700 border-emerald-200",
};
const SHIFT_LABELS: Record<Shift, string> = { morning: "Morning", afternoon: "Afternoon", full_day: "Full Day" };

const ACTIVITIES = Object.keys(ACTIVITY_LABELS) as ActivityType[];
const SHIFTS: Shift[] = ["morning", "afternoon", "full_day"];
const SUPERVISORS = FARMERS.filter(f => f.role === "supervisor" || f.role === "manager");

const EMPTY_FORM = {
  farmerId: "", activity: "harvesting" as ActivityType,
  supervisorId: "", valveId: "", bedId: "",
  date: "2026-05-17", shift: "morning" as Shift,
  hoursExpected: 4, hoursActual: "" as number | "",
  status: "assigned" as AssignmentStatus, notes: "",
};

export default function AssignmentsPage() {
  const [assignments, setAssignments] = useState<WorkerAssignment[]>(WORKER_ASSIGNMENTS);
  const [filter, setFilter]           = useState<AssignmentStatus | "all">("all");
  const [dateFilter, setDateFilter]   = useState("2026-05-17");
  const [createOpen, setCreateOpen]   = useState(false);
  const [editTarget, setEditTarget]   = useState<WorkerAssignment | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WorkerAssignment | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const beds = BEDS();

  function openCreate() {
    setForm({ ...EMPTY_FORM, farmerId: FARMERS[0]?.id ?? "", supervisorId: SUPERVISORS[0]?.id ?? "", valveId: VALVES[0]?.id ?? "" });
    setCreateOpen(true);
  }

  function openEdit(a: WorkerAssignment) {
    setForm({
      farmerId: a.farmerId, activity: a.activity,
      supervisorId: a.supervisorId, valveId: a.valveId ?? "",
      bedId: a.bedId ?? "", date: a.date, shift: a.shift,
      hoursExpected: a.hoursExpected, hoursActual: a.hoursActual ?? "",
      status: a.status, notes: a.notes ?? "",
    });
    setEditTarget(a);
  }

  function handleCreate() {
    if (!form.farmerId)     { toast.error("Please select a worker"); return; }
    if (!form.supervisorId) { toast.error("Please select a supervisor"); return; }
    const id = `wa-${Date.now()}`;
    const newA: WorkerAssignment = {
      id, farmerId: form.farmerId, activity: form.activity,
      supervisorId: form.supervisorId,
      valveId: form.valveId || undefined, bedId: form.bedId || undefined,
      date: form.date, shift: form.shift, hoursExpected: form.hoursExpected,
      hoursActual: form.hoursActual !== "" ? Number(form.hoursActual) : undefined,
      status: form.status, notes: form.notes || undefined,
    };
    WORKER_ASSIGNMENTS.push(newA);
    setAssignments([...WORKER_ASSIGNMENTS]);
    toast.success("Assignment created");
    setCreateOpen(false);
  }

  function handleEdit() {
    if (!editTarget) return;
    const idx = WORKER_ASSIGNMENTS.findIndex(a => a.id === editTarget.id);
    if (idx < 0) return;
    Object.assign(WORKER_ASSIGNMENTS[idx], {
      farmerId: form.farmerId, activity: form.activity,
      supervisorId: form.supervisorId,
      valveId: form.valveId || undefined, bedId: form.bedId || undefined,
      date: form.date, shift: form.shift, hoursExpected: form.hoursExpected,
      hoursActual: form.hoursActual !== "" ? Number(form.hoursActual) : undefined,
      status: form.status, notes: form.notes || undefined,
    });
    setAssignments([...WORKER_ASSIGNMENTS]);
    toast.success("Assignment updated");
    setEditTarget(null);
  }

  function handleDelete() {
    if (!deleteTarget) return;
    if (deleteTarget.status === "completed") {
      toast.error("Cannot delete completed assignments");
      setDeleteTarget(null);
      return;
    }
    const idx = WORKER_ASSIGNMENTS.findIndex(a => a.id === deleteTarget.id);
    if (idx >= 0) WORKER_ASSIGNMENTS.splice(idx, 1);
    setAssignments([...WORKER_ASSIGNMENTS]);
    toast.success("Assignment deleted");
    setDeleteTarget(null);
  }

  const dateRecords = dateFilter ? assignments.filter(a => a.date === dateFilter) : assignments;
  const records = filter === "all" ? dateRecords : dateRecords.filter(a => a.status === filter);

  const completed  = assignments.filter(a => a.status === "completed").length;
  const inProgress = assignments.filter(a => a.status === "in_progress").length;
  const assigned   = assignments.filter(a => a.status === "assigned").length;
  const totalHours = assignments.filter(a => a.hoursActual).reduce((s, a) => s + (a.hoursActual ?? 0), 0);

  const valveBeds = (valveId: string) => beds.filter(b => b.valveId === valveId);

  function AssignmentForm() {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Worker <span className="text-red-500">*</span></label>
            <select value={form.farmerId}
              onChange={e => setForm(p => ({ ...p, farmerId: e.target.value }))}
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white">
              <option value="">— Select —</option>
              {FARMERS.filter(f => f.role === "farmer").map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Supervisor <span className="text-red-500">*</span></label>
            <select value={form.supervisorId}
              onChange={e => setForm(p => ({ ...p, supervisorId: e.target.value }))}
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white">
              <option value="">— Select —</option>
              {SUPERVISORS.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-700 block mb-1">Activity</label>
          <select value={form.activity}
            onChange={e => setForm(p => ({ ...p, activity: e.target.value as ActivityType }))}
            className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white">
            {ACTIVITIES.map(a => (
              <option key={a} value={a}>{ACTIVITY_ICONS[a]} {ACTIVITY_LABELS[a]}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Valve</label>
            <select value={form.valveId}
              onChange={e => setForm(p => ({ ...p, valveId: e.target.value, bedId: "" }))}
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white">
              <option value="">— None —</option>
              {VALVES.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Bed (optional)</label>
            <select value={form.bedId}
              onChange={e => setForm(p => ({ ...p, bedId: e.target.value }))}
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white"
              disabled={!form.valveId}>
              <option value="">— None —</option>
              {valveBeds(form.valveId).map(b => <option key={b.id} value={b.id}>{b.id}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Date</label>
            <input type="date" value={form.date}
              onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Shift</label>
            <select value={form.shift}
              onChange={e => setForm(p => ({ ...p, shift: e.target.value as Shift }))}
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white">
              {SHIFTS.map(s => <option key={s} value={s}>{SHIFT_LABELS[s]}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Hrs Expected</label>
            <input type="number" min={0.5} step={0.5} value={form.hoursExpected}
              onChange={e => setForm(p => ({ ...p, hoursExpected: Number(e.target.value) }))}
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Hrs Actual</label>
            <input type="number" min={0} step={0.5} value={form.hoursActual}
              onChange={e => setForm(p => ({ ...p, hoursActual: e.target.value === "" ? "" : Number(e.target.value) }))}
              placeholder="—"
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Status</label>
            <select value={form.status}
              onChange={e => setForm(p => ({ ...p, status: e.target.value as AssignmentStatus }))}
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white capitalize">
              {(["assigned","in_progress","completed"] as AssignmentStatus[]).map(s => (
                <option key={s} value={s} className="capitalize">{s.replace("_"," ")}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-700 block mb-1">Notes</label>
          <input value={form.notes}
            onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
            placeholder="Optional observation..."
            className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-[1400px] mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ClipboardList className="size-5 text-blue-600" />
            <h1 className="text-2xl font-bold text-slate-900">Worker Assignments</h1>
          </div>
          <p className="text-slate-500 text-sm">Daily task assignments, shift scheduling & hours tracking</p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="size-4 text-slate-400" />
          <input type="date" value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
            className="text-xs border border-slate-200 rounded-md px-2 py-1.5 text-slate-700" />
          <Button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 gap-2">
            <Plus className="size-4" /> Assign
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4 bg-emerald-50 border-emerald-200">
          <div className="text-2xl font-bold text-emerald-700 tabular-nums">{completed}</div>
          <div className="text-xs text-emerald-600 font-medium flex items-center gap-1 mt-0.5">
            <CheckCircle2 className="size-3" /> Completed
          </div>
        </Card>
        <Card className="p-4 bg-blue-50 border-blue-200">
          <div className="text-2xl font-bold text-blue-700 tabular-nums">{inProgress}</div>
          <div className="text-xs text-blue-600 font-medium flex items-center gap-1 mt-0.5">
            <Clock className="size-3" /> In Progress
          </div>
        </Card>
        <Card className="p-4 bg-amber-50 border-amber-200">
          <div className="text-2xl font-bold text-amber-700 tabular-nums">{assigned}</div>
          <div className="text-xs text-amber-600 font-medium flex items-center gap-1 mt-0.5">
            <AlertCircle className="size-3" /> Assigned
          </div>
        </Card>
        <Card className="p-4 bg-slate-50 border-slate-200">
          <div className="text-2xl font-bold text-slate-700 tabular-nums">{totalHours.toFixed(1)}h</div>
          <div className="text-xs text-slate-500 font-medium mt-0.5">Hours Logged</div>
        </Card>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit">
        {(["all", "assigned", "in_progress", "completed"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all capitalize ${filter === f ? "bg-white shadow text-slate-900" : "text-slate-500 hover:text-slate-700"}`}>
            {f.replace("_", " ")}
          </button>
        ))}
      </div>

      {/* Table */}
      <Card className="border border-slate-200 shadow-sm overflow-hidden">
        {records.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <ClipboardList className="size-10 mx-auto mb-2 opacity-20" />
            <p className="text-sm">No assignments for selected filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full pro-table">
              <thead>
                <tr>
                  <th>Worker</th><th>Activity</th><th>Valve / Bed</th>
                  <th>Supervisor</th><th>Date</th><th>Shift</th>
                  <th>Exp.</th><th>Act.</th><th>Status</th><th>Notes</th>
                  <th className="w-16"></th>
                </tr>
              </thead>
              <tbody>
                {records.map(a => {
                  const farmer = FARMERS.find(f => f.id === a.farmerId);
                  const supervisor = FARMERS.find(f => f.id === a.supervisorId);
                  const valve = VALVES.find(v => v.id === a.valveId);
                  return (
                    <tr key={a.id} className="group">
                      <td>
                        <div className="flex items-center gap-2">
                          <Avatar className="size-7">
                            <AvatarFallback className="bg-slate-100 text-slate-700 text-[10px] font-bold">{farmer?.avatar}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="text-sm font-semibold text-slate-800">{farmer?.name}</div>
                            <div className="text-[10px] text-slate-400 capitalize">{farmer?.role}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="flex items-center gap-1.5">
                          <span>{ACTIVITY_ICONS[a.activity]}</span>
                          <span className="text-sm">{ACTIVITY_LABELS[a.activity]}</span>
                        </span>
                      </td>
                      <td>
                        <div>
                          {valve && <span className="text-xs font-semibold" style={{ color: valve.color }}>{valve.name}</span>}
                          {a.bedId && <div className="text-[10px] font-mono text-slate-400">{a.bedId}</div>}
                        </div>
                      </td>
                      <td className="text-xs text-slate-600">{supervisor?.name.split(" ")[0]}</td>
                      <td className="tabular-nums text-xs">
                        {new Date(a.date).toLocaleDateString("en", { month: "short", day: "numeric" })}
                      </td>
                      <td>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                          a.shift === "full_day" ? "bg-slate-100 text-slate-700" :
                          a.shift === "morning" ? "bg-amber-50 text-amber-700" :
                          "bg-indigo-50 text-indigo-700"
                        }`}>{SHIFT_LABELS[a.shift]}</span>
                      </td>
                      <td className="tabular-nums text-center">{a.hoursExpected}h</td>
                      <td className="tabular-nums text-center font-semibold">
                        {a.hoursActual ? `${a.hoursActual}h` : <span className="text-slate-400">—</span>}
                      </td>
                      <td>
                        <Badge className={`text-[10px] capitalize ${STATUS_STYLE[a.status]}`}>
                          {a.status.replace("_", " ")}
                        </Badge>
                      </td>
                      <td className="text-xs text-slate-500 max-w-[120px] truncate">{a.notes ?? "—"}</td>
                      <td>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openEdit(a)}
                            className="size-6 rounded bg-slate-100 hover:bg-slate-200 grid place-items-center">
                            <Pencil className="size-3 text-slate-600" />
                          </button>
                          <button onClick={() => setDeleteTarget(a)}
                            className="size-6 rounded bg-slate-100 hover:bg-red-100 grid place-items-center">
                            <Trash2 className="size-3 text-slate-600" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── Create ──────────────────────────────────────────────────────────── */}
      <Dialog open={createOpen} onOpenChange={o => !o && setCreateOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="size-4 text-blue-600" /> New Assignment
            </DialogTitle>
          </DialogHeader>
          <AssignmentForm />
          <div className="flex gap-2 mt-2">
            <Button variant="outline" className="flex-1" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button className="flex-1 bg-blue-600 hover:bg-blue-700" onClick={handleCreate}>Create</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Edit ────────────────────────────────────────────────────────────── */}
      <Dialog open={!!editTarget} onOpenChange={o => !o && setEditTarget(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="size-4 text-slate-600" /> Edit Assignment
            </DialogTitle>
          </DialogHeader>
          <AssignmentForm />
          <div className="flex gap-2 mt-2">
            <Button variant="outline" className="flex-1" onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button className="flex-1 bg-blue-600 hover:bg-blue-700" onClick={handleEdit}>Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete ──────────────────────────────────────────────────────────── */}
      <Dialog open={!!deleteTarget} onOpenChange={o => !o && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <Trash2 className="size-4" /> Delete Assignment?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            Remove this assignment?
            {deleteTarget?.status === "completed" && (
              <span className="block mt-2 text-red-600 font-medium">⚠ Completed assignments cannot be deleted.</span>
            )}
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
