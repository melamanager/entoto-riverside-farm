"use client";

import { useState, useEffect } from "react";
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
import type { Farmer, Valve, Task } from "@/lib/types";
import type { WorkerAssignment } from "@/lib/erp-types";
import { useOptions } from "@/lib/use-options";

const ROLE_STYLE = {
  manager:    { badge: "bg-amber-100 text-amber-800 border-amber-200",    dot: "bg-amber-400"   },
  supervisor: { badge: "bg-blue-100 text-blue-800 border-blue-200",       dot: "bg-blue-400"    },
  farmer:     { badge: "bg-primary/15 text-primary border-primary/30", dot: "bg-primary" },
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
  const options = useOptions();
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [valves, setValves] = useState<Valve[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [assignments, setAssignments] = useState<WorkerAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen]     = useState(false);
  const [editTarget, setEditTarget]     = useState<Farmer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Farmer | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  async function fetchFarmers() {
    const data: Farmer[] = await fetch("/api/farmers").then(r => r.json());
    setFarmers(data);
  }

  useEffect(() => {
    Promise.all([
      fetch("/api/farmers").then(r => r.json()),
      fetch("/api/valves").then(r => r.json()),
      fetch("/api/tasks").then(r => r.json()),
      fetch("/api/assignments").then(r => r.json()),
    ]).then(([farmData, valveData, taskData, assignData]) => {
      setFarmers(farmData as Farmer[]);
      setValves(valveData as Valve[]);
      setTasks(taskData as Task[]);
      setAssignments(assignData as WorkerAssignment[]);
      setLoading(false);
    });
  }, []);

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

  async function handleCreate() {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    if (!form.phone.trim()) { toast.error("Phone number is required"); return; }
    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      avatar: initials(form.name),
      role: form.role,
      performanceScore: 80,
      attendanceRate: 95,
      joinedDate: form.joinedDate,
      assignedValves: form.assignedValves,
      nationalId: form.nationalId || undefined,
      emergencyContact: form.emergencyContact || undefined,
    };
    const res = await fetch("/api/farmers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => null);
      toast.error(error?.error ?? "Failed to add staff member");
      return;
    }
    await fetchFarmers();
    toast.success(`${form.name.trim()} added to staff`);
    setCreateOpen(false);
  }

  async function handleEdit() {
    if (!editTarget) return;
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      role: form.role,
      avatar: initials(form.name),
      nationalId: form.nationalId || undefined,
      emergencyContact: form.emergencyContact || undefined,
      assignedValves: form.assignedValves,
      joinedDate: form.joinedDate,
    };
    const res = await fetch(`/api/farmers/${editTarget.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => null);
      toast.error(error?.error ?? "Failed to update staff member");
      return;
    }
    await fetchFarmers();
    toast.success(`${form.name.trim()} updated`);
    setEditTarget(null);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const res = await fetch(`/api/farmers/${deleteTarget.id}`, { method: "DELETE" });
    if (!res.ok) {
      const error = await res.json().catch(() => null);
      toast.error(error?.error ?? "Failed to delete staff member");
      setDeleteTarget(null);
      return;
    }
    toast.success(`${deleteTarget.name} removed from staff`);
    setDeleteTarget(null);
    await fetchFarmers();
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
            <label className="text-xs font-semibold text-foreground/80 block mb-1">Full Name <span className="text-red-500">*</span></label>
            <input
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Hiwot Tesfaye"
              className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-foreground/80 block mb-1">Phone <span className="text-red-500">*</span></label>
            <input
              value={form.phone}
              onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
              placeholder="+251-91-..."
              className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-foreground/80 block mb-1">Role</label>
            <select
              value={form.role}
              onChange={e => setForm(p => ({ ...p, role: e.target.value as Farmer["role"] }))}
              className="w-full border border-border rounded-md px-3 py-2 text-sm bg-card"
            >
              {options.farmerRoles.map(role => (
                <option key={role.value} value={role.value}>{role.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-foreground/80 block mb-1">National ID</label>
            <input
              value={form.nationalId}
              onChange={e => setForm(p => ({ ...p, nationalId: e.target.value }))}
              placeholder="ETH-XXXX-X"
              className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-foreground/80 block mb-1">Join Date</label>
            <input
              type="date"
              value={form.joinedDate}
              onChange={e => setForm(p => ({ ...p, joinedDate: e.target.value }))}
              className="w-full border border-border rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-semibold text-foreground/80 block mb-1">Emergency Contact</label>
            <input
              value={form.emergencyContact}
              onChange={e => setForm(p => ({ ...p, emergencyContact: e.target.value }))}
              placeholder="+251-91-..."
              className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-foreground/80 block mb-1.5">Assigned Valves</label>
          <div className="flex gap-2 flex-wrap">
            {valves.map(v => (
              <button
                key={v.id}
                type="button"
                onClick={() => toggleValve(v.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition-all ${
                  form.assignedValves.includes(v.id)
                    ? "border-current text-white"
                    : "border-border text-muted-foreground bg-card"
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
          <Icon className="size-4 text-muted-foreground" />
          <h2 className="font-semibold text-foreground">{title}</h2>
          <Badge variant="outline" className="text-[10px]">{people.length}</Badge>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {people.map(f => {
            const style = ROLE_STYLE[f.role];
            const farmerValves = valves.filter(v => f.assignedValves.includes(v.id));
            const farmerTasks = tasks.filter(t => t.assignedTo === f.id);
            const farmerAssignments = assignments.filter(a => a.farmerId === f.id);
            const completedJobs = farmerAssignments.filter(a => a.status === "completed").length;

            return (
              <Card key={f.id} className="p-5 hover:shadow-md transition-shadow relative">
                {/* Edit / Delete buttons */}
                <div className="absolute top-3 right-3 flex gap-1">
                  <button
                    onClick={() => openEdit(f)}
                    className="size-7 rounded-md bg-muted hover:bg-accent grid place-items-center"
                    title="Edit"
                  >
                    <Pencil className="size-3 text-muted-foreground" />
                  </button>
                  {f.role !== "manager" && (
                    <button
                      onClick={() => setDeleteTarget(f)}
                      className="size-7 rounded-md bg-muted hover:bg-red-100 grid place-items-center"
                      title="Remove"
                    >
                      <Trash2 className="size-3 text-muted-foreground" />
                    </button>
                  )}
                </div>

                <div className="flex items-start gap-3 mb-4 pr-16">
                  <Avatar className="size-12 ring-2 ring-border">
                    <AvatarFallback className={`font-bold text-sm ${
                      f.role === "manager" ? "bg-amber-100 text-amber-700" :
                      f.role === "supervisor" ? "bg-blue-100 text-blue-700" :
                      "bg-primary/15 text-primary"
                    }`}>{f.avatar}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-foreground truncate">{f.name}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{f.nationalId ?? "—"}</div>
                    <Badge className={`text-[10px] capitalize mt-1 ${style.badge}`}>{f.role}</Badge>
                  </div>
                </div>

                <div className="space-y-2 mb-3">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Attendance</span>
                      <span className="font-semibold">{f.attendanceRate}%</span>
                    </div>
                    <Progress value={f.attendanceRate} className="h-1.5" />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Performance</span>
                      <span className="font-semibold">{f.performanceScore}</span>
                    </div>
                    <Progress value={f.performanceScore} className="h-1.5" />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-3 text-center">
                  <div className="bg-muted rounded-lg py-2">
                    <div className="text-sm font-bold text-foreground">{completedJobs}</div>
                    <div className="text-[10px] text-muted-foreground">Jobs done</div>
                  </div>
                  <div className="bg-muted rounded-lg py-2">
                    <div className="text-sm font-bold text-foreground">{farmerTasks.filter(t => t.status === "done").length}</div>
                    <div className="text-[10px] text-muted-foreground">Tasks done</div>
                  </div>
                  <div className="bg-muted rounded-lg py-2">
                    <div className="text-sm font-bold text-foreground">{farmerValves.length}</div>
                    <div className="text-[10px] text-muted-foreground">Valves</div>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="size-3 shrink-0" /><span>{f.phone}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="size-3 shrink-0" />
                    <span>Joined {new Date(f.joinedDate).toLocaleDateString("en", { month: "long", year: "numeric" })}</span>
                  </div>
                </div>

                {farmerValves.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-3 pt-3 border-t border-border">
                    {farmerValves.map(v => (
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
            className="border-2 border-dashed border-border rounded-xl p-5 flex flex-col items-center justify-center gap-2 hover:border-primary/40 hover:bg-primary/10 transition-all text-muted-foreground hover:text-primary min-h-[180px]"
          >
            <Plus className="size-7" />
            <span className="text-sm font-semibold">Add Staff Member</span>
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="p-8 text-muted-foreground text-sm">Loading…</div>;
  }

  return (
    <div className="p-6 md:p-8 max-w-[1400px] mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Users className="size-5 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Employees</h1>
          </div>
          <p className="text-muted-foreground text-sm">Manage all farm staff — add, edit, or remove workers and supervisors</p>
        </div>
        <Button onClick={openCreate} className="bg-primary hover:bg-primary/90 gap-2">
          <Plus className="size-4" /> Add Staff Member
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
        <Card className="p-4 bg-primary/10 border-primary/30">
          <div className="text-2xl font-bold text-primary">{fieldWorkers.length}</div>
          <div className="text-xs text-primary font-medium mt-0.5">Field Workers</div>
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
              <Plus className="size-4 text-primary" /> Add Staff Member
            </DialogTitle>
          </DialogHeader>
          <StaffForm />
          <div className="flex gap-2 mt-2">
            <Button variant="outline" className="flex-1" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button className="flex-1 bg-primary hover:bg-primary/90" onClick={handleCreate}>Add to Staff</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Edit Dialog ───────────────────────────────────────────────────── */}
      <Dialog open={!!editTarget} onOpenChange={o => !o && setEditTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="size-4 text-muted-foreground" /> Edit {editTarget?.name}
            </DialogTitle>
          </DialogHeader>
          <StaffForm />
          <div className="flex gap-2 mt-2">
            <Button variant="outline" className="flex-1" onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button className="flex-1 bg-primary hover:bg-primary/90" onClick={handleEdit}>Save Changes</Button>
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
          <p className="text-sm text-muted-foreground">
            This will remove <strong>{deleteTarget?.name}</strong> from the farm staff roster. Their historical records will be preserved.
          </p>
          <div className="flex gap-2 mt-2">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button className="flex-1 bg-red-600 hover:bg-red-700" onClick={handleDelete}>Remove Staff</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
