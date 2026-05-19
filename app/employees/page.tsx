"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Users, Phone, Calendar, Plus, Pencil, Trash2,
  UserCog, ShieldCheck, Shield,
} from "lucide-react";
import { toast } from "sonner";
import { FARMERS, VALVES, TASKS } from "@/lib/data";
import { WORKER_ASSIGNMENTS } from "@/lib/erp-data";
import type { Farmer } from "@/lib/types";
import { useLang } from "@/lib/lang";
import { EN, AM } from "@/lib/translations";

const ROLE_STYLE = {
  manager:    { badge: "bg-amber-100 text-amber-800 border-amber-200",    dot: "bg-amber-400"   },
  supervisor: { badge: "bg-blue-100 text-blue-800 border-blue-200",       dot: "bg-blue-400"    },
  farmer:     { badge: "bg-emerald-100 text-emerald-800 border-emerald-200", dot: "bg-emerald-400" },
};

const EMPTY_FORM = {
  name: "", phone: "", role: "farmer" as Farmer["role"],
  nationalId: "", emergencyContact: "",
  assignedValves: [] as string[],
  joinedDate: new Date().toISOString().split("T")[0],
};

function initials(name: string) {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

export default function EmployeesPage() {
  const { isAm } = useLang();
  const t = isAm ? AM : EN;
  const [farmers, setFarmers] = useState<Farmer[]>(FARMERS);
  const [createOpen, setCreateOpen]     = useState(false);
  const [editTarget, setEditTarget]     = useState<Farmer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Farmer | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const managers    = farmers.filter(f => f.role === "manager");
  const supervisors = farmers.filter(f => f.role === "supervisor");
  const fieldWorkers = farmers.filter(f => f.role === "farmer");

  function openCreate() {
    setForm(EMPTY_FORM);
    setCreateOpen(true);
  }

  function openEdit(f: Farmer) {
    setForm({
      name: f.name, phone: f.phone, role: f.role,
      nationalId: f.nationalId ?? "",
      emergencyContact: f.emergencyContact ?? "",
      assignedValves: f.assignedValves,
      joinedDate: f.joinedDate,
    });
    setEditTarget(f);
  }

  function handleCreate() {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    if (!form.phone.trim()) { toast.error("Phone number is required"); return; }
    const id = `f-${String(Date.now()).slice(-4)}`;
    const newFarmer: Farmer = {
      id, name: form.name.trim(), phone: form.phone.trim(),
      avatar: initials(form.name),
      role: form.role,
      performanceScore: 80,
      attendanceRate: 95,
      joinedDate: form.joinedDate,
      assignedValves: form.assignedValves,
      nationalId: form.nationalId || undefined,
      emergencyContact: form.emergencyContact || undefined,
    };
    setFarmers(prev => [...prev, newFarmer]);
    FARMERS.push(newFarmer);
    toast.success(`${newFarmer.name} added to staff`);
    setCreateOpen(false);
  }

  function handleEdit() {
    if (!editTarget) return;
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    const updated: Farmer = {
      ...editTarget,
      name: form.name.trim(),
      phone: form.phone.trim(),
      role: form.role,
      avatar: initials(form.name),
      nationalId: form.nationalId || undefined,
      emergencyContact: form.emergencyContact || undefined,
      assignedValves: form.assignedValves,
      joinedDate: form.joinedDate,
    };
    setFarmers(prev => prev.map(f => f.id === editTarget.id ? updated : f));
    const idx = FARMERS.findIndex(f => f.id === editTarget.id);
    if (idx >= 0) Object.assign(FARMERS[idx], updated);
    toast.success(`${updated.name} updated`);
    setEditTarget(null);
  }

  function handleDelete() {
    if (!deleteTarget) return;
    setFarmers(prev => prev.filter(f => f.id !== deleteTarget.id));
    const idx = FARMERS.findIndex(f => f.id === deleteTarget.id);
    if (idx >= 0) FARMERS.splice(idx, 1);
    toast.success(`${deleteTarget.name} removed from staff`);
    setDeleteTarget(null);
  }

  function toggleValve(valveId: string) {
    setForm(prev => ({
      ...prev,
      assignedValves: prev.assignedValves.includes(valveId)
        ? prev.assignedValves.filter(v => v !== valveId)
        : [...prev.assignedValves, valveId],
    }));
  }

  function StaffForm() {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-xs font-semibold text-slate-700 block mb-1">Full Name <span className="text-red-500">*</span></label>
            <input
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Hiwot Tesfaye"
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Phone <span className="text-red-500">*</span></label>
            <input
              value={form.phone}
              onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
              placeholder="+251-91-..."
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Role</label>
            <select
              value={form.role}
              onChange={e => setForm(p => ({ ...p, role: e.target.value as Farmer["role"] }))}
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white"
            >
              <option value="farmer">Field Worker</option>
              <option value="supervisor">Supervisor</option>
              <option value="manager">Manager</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">National ID</label>
            <input
              value={form.nationalId}
              onChange={e => setForm(p => ({ ...p, nationalId: e.target.value }))}
              placeholder="ETH-XXXX-X"
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Join Date</label>
            <input
              type="date"
              value={form.joinedDate}
              onChange={e => setForm(p => ({ ...p, joinedDate: e.target.value }))}
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-semibold text-slate-700 block mb-1">Emergency Contact</label>
            <input
              value={form.emergencyContact}
              onChange={e => setForm(p => ({ ...p, emergencyContact: e.target.value }))}
              placeholder="+251-91-..."
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-700 block mb-1.5">Assigned Valves</label>
          <div className="flex gap-2 flex-wrap">
            {VALVES.map(v => (
              <button
                key={v.id}
                type="button"
                onClick={() => toggleValve(v.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition-all ${
                  form.assignedValves.includes(v.id)
                    ? "border-current text-white"
                    : "border-slate-200 text-slate-600 bg-white"
                }`}
                style={form.assignedValves.includes(v.id) ? { background: v.color, borderColor: v.color } : {}}
              >
                {v.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  function StaffGroup({ title, people, icon: Icon }: { title: string; people: Farmer[]; icon: React.ElementType }) {
    return (
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Icon className="size-4 text-slate-500" />
          <h2 className="font-semibold text-slate-700">{title}</h2>
          <Badge variant="outline" className="text-[10px]">{people.length}</Badge>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {people.map(f => {
            const style = ROLE_STYLE[f.role];
            const valves = VALVES.filter(v => f.assignedValves.includes(v.id));
            const tasks = TASKS.filter(task => task.assignedTo === f.id);
            const assignments = WORKER_ASSIGNMENTS.filter(a => a.farmerId === f.id);
            const completedJobs = assignments.filter(a => a.status === "completed").length;

            return (
              <Card key={f.id} className="p-5 hover:shadow-md transition-shadow relative">
                {/* Edit / Delete buttons */}
                <div className="absolute top-3 right-3 flex gap-1">
                  <button
                    onClick={() => openEdit(f)}
                    className="size-7 rounded-md bg-slate-100 hover:bg-slate-200 grid place-items-center"
                    title="Edit"
                  >
                    <Pencil className="size-3 text-slate-600" />
                  </button>
                  {f.role !== "manager" && (
                    <button
                      onClick={() => setDeleteTarget(f)}
                      className="size-7 rounded-md bg-slate-100 hover:bg-red-100 grid place-items-center"
                      title="Remove"
                    >
                      <Trash2 className="size-3 text-slate-500" />
                    </button>
                  )}
                </div>

                <div className="flex items-start gap-3 mb-4 pr-16">
                  <Avatar className="size-12 ring-2 ring-slate-100">
                    <AvatarFallback className={`font-bold text-sm ${
                      f.role === "manager" ? "bg-amber-100 text-amber-700" :
                      f.role === "supervisor" ? "bg-blue-100 text-blue-700" :
                      "bg-emerald-100 text-emerald-700"
                    }`}>{f.avatar}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-slate-900 truncate">{f.name}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{f.nationalId ?? "—"}</div>
                    <Badge className={`text-[10px] capitalize mt-1 ${style.badge}`}>{f.role}</Badge>
                  </div>
                </div>

                <div className="space-y-2 mb-3">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-500">Attendance</span>
                      <span className="font-semibold">{f.attendanceRate}%</span>
                    </div>
                    <Progress value={f.attendanceRate} className="h-1.5" />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-500">Performance</span>
                      <span className="font-semibold">{f.performanceScore}</span>
                    </div>
                    <Progress value={f.performanceScore} className="h-1.5" />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-3 text-center">
                  <div className="bg-slate-50 rounded-lg py-2">
                    <div className="text-sm font-bold text-slate-800">{completedJobs}</div>
                    <div className="text-[10px] text-slate-400">Jobs done</div>
                  </div>
                  <div className="bg-slate-50 rounded-lg py-2">
                    <div className="text-sm font-bold text-slate-800">{tasks.filter(task => task.status === "done").length}</div>
                    <div className="text-[10px] text-slate-400">Tasks done</div>
                  </div>
                  <div className="bg-slate-50 rounded-lg py-2">
                    <div className="text-sm font-bold text-slate-800">{valves.length}</div>
                    <div className="text-[10px] text-slate-400">Valves</div>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center gap-2 text-slate-500">
                    <Phone className="size-3 shrink-0" /><span>{f.phone}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-500">
                    <Calendar className="size-3 shrink-0" />
                    <span>Joined {new Date(f.joinedDate).toLocaleDateString("en", { month: "long", year: "numeric" })}</span>
                  </div>
                </div>

                {valves.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-3 pt-3 border-t border-slate-100">
                    {valves.map(v => (
                      <span
                        key={v.id}
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full border"
                        style={{ color: v.color, borderColor: `${v.color}40`, background: `${v.color}10` }}
                      >
                        {v.name}
                      </span>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}

          {/* Add new card placeholder */}
          <button
            onClick={openCreate}
            className="border-2 border-dashed border-slate-200 rounded-xl p-5 flex flex-col items-center justify-center gap-2 hover:border-emerald-400 hover:bg-emerald-50/40 transition-all text-slate-400 hover:text-emerald-600 min-h-[180px]"
          >
            <Plus className="size-7" />
            <span className="text-sm font-semibold">Add Staff Member</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-[1400px] mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Users className="size-5 text-blue-600" />
            <h1 className="text-2xl font-bold text-slate-900">{t.employees.title}</h1>
          </div>
          <p className="text-slate-500 text-sm">{t.employees.subtitle}</p>
        </div>
        <Button onClick={openCreate} className="bg-emerald-600 hover:bg-emerald-700 gap-2">
          <Plus className="size-4" /> {t.common.new}
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4 bg-amber-50 border-amber-200">
          <div className="text-2xl font-bold text-amber-700">{managers.length}</div>
          <div className="text-xs text-amber-600 font-medium mt-0.5">Managers</div>
        </Card>
        <Card className="p-4 bg-blue-50 border-blue-200">
          <div className="text-2xl font-bold text-blue-700">{supervisors.length}</div>
          <div className="text-xs text-blue-600 font-medium mt-0.5">Supervisors</div>
        </Card>
        <Card className="p-4 bg-emerald-50 border-emerald-200">
          <div className="text-2xl font-bold text-emerald-700">{fieldWorkers.length}</div>
          <div className="text-xs text-emerald-600 font-medium mt-0.5">Field Workers</div>
        </Card>
      </div>

      {managers.length > 0    && <StaffGroup title="Management" people={managers}    icon={UserCog}     />}
      {supervisors.length > 0 && <StaffGroup title="Supervisors" people={supervisors} icon={ShieldCheck}  />}
      {fieldWorkers.length > 0 && <StaffGroup title="Field Workers" people={fieldWorkers} icon={Shield} />}

      {/* ── Create Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={createOpen} onOpenChange={o => !o && setCreateOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="size-4 text-emerald-600" /> Add Staff Member
            </DialogTitle>
          </DialogHeader>
          <StaffForm />
          <div className="flex gap-2 mt-2">
            <Button variant="outline" className="flex-1" onClick={() => setCreateOpen(false)}>{t.common.cancel}</Button>
            <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={handleCreate}>{t.common.create}</Button>
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
          <StaffForm />
          <div className="flex gap-2 mt-2">
            <Button variant="outline" className="flex-1" onClick={() => setEditTarget(null)}>{t.common.cancel}</Button>
            <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={handleEdit}>{t.common.save}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm ────────────────────────────────────────────────── */}
      <Dialog open={!!deleteTarget} onOpenChange={o => !o && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <Trash2 className="size-4" /> Remove {deleteTarget?.name}?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            This will remove <strong>{deleteTarget?.name}</strong> from the farm staff roster. Their historical records will be preserved.
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
