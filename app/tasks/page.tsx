"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  ListChecks, Plus, CheckCircle2, Clock, AlertCircle,
  Upload, ImageIcon, Eye, X, FileImage, ShieldCheck,
  ClipboardList, Bell, UserPlus, Users, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { TASKS, FARMERS, getFarmer, getBed } from "@/lib/data";
import { FOLLOW_UPS } from "@/lib/erp-data";
import { useAuth } from "@/lib/auth";
import { useLang } from "@/lib/lang";
import { EN, AM } from "@/lib/translations";
import type { Task, TaskWorkerAssignment } from "@/lib/types";
import { AssignmentsSection } from "./_assignments";
import { FollowUpsSection } from "./_follow-ups";

const PRIORITY_COLORS = {
  high: "bg-red-500",
  medium: "bg-amber-500",
  low: "bg-slate-400",
};
const CATEGORY_COLORS: Record<string, string> = {
  disease:    "bg-red-100 text-red-700 border-red-200",
  harvest:    "bg-emerald-100 text-emerald-700 border-emerald-200",
  irrigation: "bg-blue-100 text-blue-700 border-blue-200",
  inspection: "bg-purple-100 text-purple-700 border-purple-200",
  general:    "bg-slate-100 text-slate-600 border-slate-200",
};
const SHIFT_LABELS: Record<TaskWorkerAssignment["shift"], string> = {
  morning:   "🌅 Morning",
  afternoon: "☀️ Afternoon",
  full_day:  "⏰ Full Day",
};

type Section = "tasks" | "assignments" | "follow-ups";
const SECTION_TABS: { key: Section; label: string; icon: typeof ListChecks }[] = [
  { key: "tasks",       label: "Daily Tasks",  icon: ListChecks    },
  { key: "assignments", label: "Assignments",  icon: ClipboardList },
  { key: "follow-ups",  label: "Follow-ups",   icon: Bell          },
];

const FARMERS_ONLY = FARMERS.filter(f => f.role === "farmer");
const SUPERVISORS  = FARMERS.filter(f => f.role === "supervisor");

export default function TasksPage() {
  const { isAm } = useLang();
  const t = isAm ? AM : EN;
  const { user, isManager, isSupervisor } = useAuth();

  const [section, setSection]               = useState<Section>("tasks");
  const [tasks, setTasks]                   = useState<Task[]>(TASKS);
  const [filter, setFilter]                 = useState<"all" | "pending" | "in_progress" | "done">("all");
  const [selectedTask, setSelectedTask]     = useState<Task | null>(null);
  const [progressNote, setProgressNote]     = useState("");
  const [proofImage, setProofImage]         = useState<string | null>(null);
  const [proofImageName, setProofImageName] = useState("");
  const [newTaskOpen, setNewTaskOpen]       = useState(false);
  const [requireImageNew, setRequireImageNew] = useState(false);
  const [requireFollowUpNew, setRequireFollowUpNew] = useState(false);
  const [followUpDateNew, setFollowUpDateNew] = useState("2026-05-22");
  const [newTask, setNewTask] = useState({
    title: "", description: "",
    assignedTo: isSupervisor ? (user?.id ?? "f-001") : "f-001",
    priority: "medium" as Task["priority"],
    category: "general" as Task["category"],
    dueDate: "2026-05-20",
  });
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [managerNote, setManagerNote]   = useState("");
  const [extendDate, setExtendDate]     = useState("");
  const [showMgrActions, setShowMgrActions] = useState(false);

  // Worker assignment state (inside task detail)
  const [assignWorkerOpen, setAssignWorkerOpen] = useState(false);
  const [newWorker, setNewWorker] = useState<{ farmerId: string; shift: TaskWorkerAssignment["shift"] }>({
    farmerId: FARMERS_ONLY[0]?.id ?? "",
    shift: "morning",
  });

  const proofInputRef = useRef<HTMLInputElement>(null);

  const supervisorId  = user?.id;
  const visibleTasks  = isSupervisor
    ? tasks.filter(t => t.assignedTo === supervisorId)
    : tasks;
  const filtered   = visibleTasks.filter(t => filter === "all" || t.status === filter);
  const pending    = visibleTasks.filter(t => t.status === "pending").length;
  const inProgress = visibleTasks.filter(t => t.status === "in_progress").length;
  const done       = visibleTasks.filter(t => t.status === "done").length;
  const total      = visibleTasks.length;
  const TODAY = "2026-05-20";
  const overdueTasks = visibleTasks.filter(t => t.status !== "done" && t.dueDate < TODAY);

  /* ── Proof photo ─────────────────────────────────────────────────── */
  function handleProofUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setProofImageName(file.name);
    const reader = new FileReader();
    reader.onload = ev => setProofImage(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  /* ── Task status update ──────────────────────────────────────────── */
  function updateStatus(taskId: string, status: Task["status"]) {
    const updated = tasks.map(t =>
      t.id === taskId ? {
        ...t, status,
        completedAt: status === "done" ? new Date().toISOString() : t.completedAt,
        progressNote: progressNote || t.progressNote,
        proofImageUrl: proofImage ?? t.proofImageUrl,
      } : t
    );
    setTasks(updated);
    const t2 = updated.find(t => t.id === taskId);
    if (t2) setSelectedTask(t2);
    toast.success(status === "done" ? "Task marked complete ✓" : "Task updated", {
      description: progressNote ? `"${progressNote}"` : undefined,
    });
    if (status === "done") {
      setSelectedTask(null);
      setProgressNote("");
      setProofImage(null);
      setProofImageName("");
    }
  }

  /* ── Worker assignments ──────────────────────────────────────────── */
  function addWorkerToTask() {
    if (!selectedTask || !newWorker.farmerId) return;
    if ((selectedTask.workerAssignments ?? []).some(w => w.farmerId === newWorker.farmerId)) {
      toast.error("This farmer is already assigned");
      return;
    }
    const wa: TaskWorkerAssignment = { farmerId: newWorker.farmerId, shift: newWorker.shift };
    const updated = { ...selectedTask, workerAssignments: [...(selectedTask.workerAssignments ?? []), wa] };
    setSelectedTask(updated);
    setTasks(prev => prev.map(t => t.id === updated.id ? updated : t));
    setAssignWorkerOpen(false);
    setNewWorker({ farmerId: FARMERS_ONLY[0]?.id ?? "", shift: "morning" });
    toast.success(`${getFarmer(wa.farmerId)?.name.split(" ")[0]} assigned — ${SHIFT_LABELS[wa.shift]}`);
  }

  function removeWorkerFromTask(farmerId: string) {
    if (!selectedTask) return;
    const updated = {
      ...selectedTask,
      workerAssignments: (selectedTask.workerAssignments ?? []).filter(w => w.farmerId !== farmerId),
    };
    setSelectedTask(updated);
    setTasks(prev => prev.map(t => t.id === updated.id ? updated : t));
  }

  /* ── Create task ─────────────────────────────────────────────────── */
  function createTask() {
    if (!newTask.title.trim()) { toast.error("Title is required"); return; }
    const id = `t-${String(tasks.length + 1).padStart(3, "0")}`;
    const task: Task = {
      ...newTask,
      id,
      createdBy: user?.id ?? "f-008",
      status: "pending",
      createdAt: new Date().toISOString(),
      requiresImageProof: requireImageNew,
      requiresFollowUp: requireFollowUpNew,
      followUpDueDate: requireFollowUpNew ? followUpDateNew : undefined,
    };
    setTasks(prev => [task, ...prev]);

    // Auto-create follow-up if requested
    if (requireFollowUpNew) {
      FOLLOW_UPS.push({
        id: `fu-task-${Date.now()}`,
        entityType: "task",
        entityId: id,
        title: `Follow up: ${newTask.title}`,
        description: `Verify task completion by ${getFarmer(newTask.assignedTo)?.name ?? "supervisor"}`,
        dueDate: followUpDateNew,
        status: "pending",
        priority: newTask.priority === "high" ? "urgent" : "normal",
        assignedTo: user?.id ?? "f-008",
        createdBy: user?.id ?? "f-008",
      });
    }

    toast.success("Task created", {
      description: `Assigned to ${getFarmer(newTask.assignedTo)?.name}${requireFollowUpNew ? " · Follow-up scheduled" : ""}`,
    });
    setNewTaskOpen(false);
    setRequireImageNew(false);
    setRequireFollowUpNew(false);
    setFollowUpDateNew("2026-05-22");
    setNewTask({
      title: "", description: "",
      assignedTo: isSupervisor ? (user?.id ?? "f-001") : "f-001",
      priority: "medium", category: "general", dueDate: "2026-05-20",
    });
  }

  /* ── Open task detail ────────────────────────────────────────────── */
  function openTask(task: Task) {
    setSelectedTask(task);
    setProgressNote(task.progressNote ?? "");
    setProofImage(task.proofImageUrl ?? null);
    setProofImageName(task.proofImageUrl ? "existing-proof.jpg" : "");
    setAssignWorkerOpen(false);
    setShowMgrActions(false);
    setManagerNote("");
    setExtendDate("");
  }

  function sendOverdueReminder(task: Task) {
    const updated = tasks.map(t =>
      t.id === task.id ? { ...t, overdueNotifiedAt: new Date().toISOString() } : t
    );
    setTasks(updated);
    if (selectedTask?.id === task.id) setSelectedTask(updated.find(t => t.id === task.id) ?? null);
    toast.success("Reminder sent", {
      description: `${getFarmer(task.assignedTo)?.name} has been notified about "${task.title}"`,
    });
  }

  function saveExtendDeadline() {
    if (!selectedTask || !extendDate) return;
    const updated = tasks.map(t =>
      t.id === selectedTask.id ? { ...t, dueDate: extendDate } : t
    );
    const next = updated.find(t => t.id === selectedTask.id)!;
    setTasks(updated);
    setSelectedTask(next);
    toast.success("Deadline extended to " + new Date(extendDate).toLocaleDateString("en", { month: "short", day: "numeric" }));
    setExtendDate("");
  }

  function saveManagerNote() {
    if (!selectedTask || !managerNote.trim()) return;
    const updated = tasks.map(t =>
      t.id === selectedTask.id ? { ...t, managerNote: managerNote.trim() } : t
    );
    const next = updated.find(t => t.id === selectedTask.id)!;
    setTasks(updated);
    setSelectedTask(next);
    toast.success("Penalty note saved");
    setManagerNote("");
  }

  const canCreateTask = isManager || isSupervisor;

  return (
    <div className="p-6 md:p-8 max-w-[1400px] mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ListChecks className="size-5 text-blue-600" />
            <h1 className="text-2xl font-bold text-slate-900">{t.tasks.title}</h1>
          </div>
          <p className="text-slate-500 text-sm">{t.tasks.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          {isSupervisor && section === "tasks" && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-700">
              <ShieldCheck className="size-3.5" />
              <span>Your assigned tasks</span>
            </div>
          )}
          {canCreateTask && section === "tasks" && (
            <Button
              onClick={() => {
                setNewTask(p => ({ ...p, assignedTo: isSupervisor ? (user?.id ?? "f-001") : "f-001" }));
                setNewTaskOpen(true);
              }}
              className="bg-emerald-600 hover:bg-emerald-700 gap-2"
            >
              <Plus className="size-4" /> {t.tasks.newTask}
            </Button>
          )}
        </div>
      </div>

      {/* Section tabs */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl w-fit">
        {SECTION_TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setSection(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              section === key ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"
            }`}>
            <Icon className="size-4" /> {label}
          </button>
        ))}
      </div>

      {/* ── Tasks section ─────────────────────────────────────────────── */}
      {section === "tasks" && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="p-4 border-amber-200 bg-amber-50">
              <div className="flex items-center justify-between">
                <div><div className="text-2xl font-bold text-amber-700">{pending}</div>
                  <div className="text-xs text-amber-600 font-medium">{t.common.pending}</div></div>
                <AlertCircle className="size-8 text-amber-400" />
              </div>
            </Card>
            <Card className="p-4 border-blue-200 bg-blue-50">
              <div className="flex items-center justify-between">
                <div><div className="text-2xl font-bold text-blue-700">{inProgress}</div>
                  <div className="text-xs text-blue-600 font-medium">{t.tasks.inProgress}</div></div>
                <Clock className="size-8 text-blue-400" />
              </div>
            </Card>
            <Card className="p-4 border-emerald-200 bg-emerald-50">
              <div className="flex items-center justify-between">
                <div><div className="text-2xl font-bold text-emerald-700">{done}</div>
                  <div className="text-xs text-emerald-600 font-medium">{t.tasks.complete}</div></div>
                <CheckCircle2 className="size-8 text-emerald-400" />
              </div>
            </Card>
          </div>

          {/* Progress */}
          {total > 0 && (
            <Card className="p-4 border border-slate-200">
              <div className="flex items-center justify-between mb-2 text-sm">
                <span className="font-medium text-slate-700">Overall Progress</span>
                <span className="font-bold text-slate-900 tabular-nums">{Math.round((done / total) * 100)}%</span>
              </div>
              <Progress value={(done / total) * 100} className="h-2" />
              <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                <span>{done} of {total} tasks done</span>
                <span>{pending} remaining</span>
              </div>
            </Card>
          )}

          {/* Overdue alert banner — manager only */}
          {isManager && overdueTasks.length > 0 && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-red-50 border border-red-200">
              <div className="size-8 rounded-lg bg-red-100 grid place-items-center shrink-0">
                <AlertCircle className="size-4 text-red-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-red-800">
                  {overdueTasks.length} overdue task{overdueTasks.length > 1 ? "s" : ""}
                </div>
                <div className="text-[11px] text-red-600 truncate">
                  {overdueTasks.map(t => t.title).join(" · ")}
                </div>
              </div>
              <button
                onClick={() => setFilter("pending")}
                className="text-xs font-semibold text-red-700 hover:text-red-900 shrink-0"
              >
                View all →
              </button>
            </div>
          )}

          {/* Filter tabs */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit">
            {(["all", "pending", "in_progress", "done"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all capitalize ${filter === f ? "bg-white shadow text-slate-900" : "text-slate-500 hover:text-slate-700"}`}>
                {f.replace("_", " ")}
              </button>
            ))}
          </div>

          {/* Task list */}
          <div className="space-y-2">
            {filtered.length === 0 && (
              <div className="text-center py-12 text-slate-400">
                <ListChecks className="size-10 mx-auto mb-2 opacity-20" />
                <p className="text-sm">{t.tasks.noTasks}</p>
              </div>
            )}
            {filtered.map(task => {
              const farmer  = getFarmer(task.assignedTo);
              const creator = getFarmer(task.createdBy);
              const bed     = task.bedId ? getBed(task.bedId) : null;
              const overdue = task.status !== "done" && task.dueDate < TODAY;
              const workerCount = task.workerAssignments?.length ?? 0;
              return (
                <Card key={task.id}
                  className="border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all cursor-pointer"
                  onClick={() => openTask(task)}>
                  <div className="flex items-start gap-4 p-4">
                    <span className={`size-2.5 rounded-full mt-1.5 shrink-0 ${PRIORITY_COLORS[task.priority]}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2 flex-wrap">
                        <span className={`font-semibold text-sm ${task.status === "done" ? "line-through text-slate-400" : "text-slate-900"}`}>
                          {task.title}
                        </span>
                        <Badge className={`text-[10px] capitalize ${CATEGORY_COLORS[task.category]}`}>{task.category}</Badge>
                        {overdue && <Badge variant="destructive" className="text-[10px]">Overdue</Badge>}
                        {task.requiresImageProof && (
                          <Badge className="text-[10px] bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-100 gap-0.5">
                            <ImageIcon className="size-2.5" /> Photo Required
                          </Badge>
                        )}
                        {task.requiresFollowUp && (
                          <Badge className="text-[10px] bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 gap-0.5">
                            <Bell className="size-2.5" /> Follow-up
                          </Badge>
                        )}
                        {bed && (
                          <Link href={`/beds/${bed.id}`} onClick={e => e.stopPropagation()}
                            className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded hover:bg-slate-200">
                            {bed.id}
                          </Link>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-1">{task.description}</p>
                      {task.progressNote && (
                        <div className="mt-2 text-[11px] text-slate-600 bg-slate-50 border border-slate-200 rounded px-2 py-1 italic">
                          "{task.progressNote}"
                        </div>
                      )}
                      {task.proofImageUrl && (
                        <button onClick={e => { e.stopPropagation(); setPreviewUrl(task.proofImageUrl!); }}
                          className="mt-1.5 flex items-center gap-1.5 text-[11px] text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded hover:bg-purple-100 transition-colors">
                          <FileImage className="size-3" /> View proof photo
                        </button>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-400">
                        <span>By {creator?.name.split(" ")[0]}</span>
                        <span>·</span>
                        <span>Due {new Date(task.dueDate).toLocaleDateString("en", { month: "short", day: "numeric" })}</span>
                        {workerCount > 0 && (
                          <span className="flex items-center gap-1 text-blue-500">
                            <Users className="size-3" /> {workerCount} worker{workerCount > 1 ? "s" : ""}
                          </span>
                        )}
                        {task.completedAt && (
                          <><span>·</span><span className="text-emerald-600">✓ Done {new Date(task.completedAt).toLocaleDateString("en", { month: "short", day: "numeric" })}</span></>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="flex items-center gap-2">
                        <Avatar className="size-7">
                          <AvatarFallback className="bg-slate-100 text-slate-700 text-[10px] font-bold">{farmer?.avatar}</AvatarFallback>
                        </Avatar>
                        <div className="hidden sm:block">
                          <div className="text-[11px] font-semibold text-slate-700">{farmer?.name.split(" ")[0]}</div>
                          <div className="text-[10px] text-slate-400 capitalize">{farmer?.role}</div>
                        </div>
                      </div>
                      <Badge className={`text-[10px] capitalize ${
                        task.status === "done" ? "bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100" :
                        task.status === "in_progress" ? "bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100" :
                        "bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100"
                      }`}>{task.status.replace("_", " ")}</Badge>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* ── Task detail dialog ──────────────────────────────────────── */}
          <Dialog open={!!selectedTask} onOpenChange={o => { if (!o) { setSelectedTask(null); setAssignWorkerOpen(false); } }}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 pr-6">
                  <ListChecks className="size-4 text-blue-600 shrink-0" />
                  <span className="truncate">{selectedTask?.title}</span>
                </DialogTitle>
              </DialogHeader>
              {selectedTask && (
                <div className="space-y-4">
                  {/* Status badges */}
                  <div className="flex flex-wrap gap-2">
                    <Badge className={`text-[10px] capitalize ${CATEGORY_COLORS[selectedTask.category]}`}>{selectedTask.category}</Badge>
                    <Badge variant="outline" className="text-[10px] capitalize">{selectedTask.priority} priority</Badge>
                    <Badge className={`text-[10px] capitalize ${
                      selectedTask.status === "done" ? "bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100" :
                      selectedTask.status === "in_progress" ? "bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100" :
                      "bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100"
                    }`}>{selectedTask.status.replace("_", " ")}</Badge>
                    {selectedTask.requiresImageProof && (
                      <Badge className="text-[10px] bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-100 gap-0.5">
                        <ImageIcon className="size-2.5" /> Photo Required
                      </Badge>
                    )}
                    {selectedTask.requiresFollowUp && (
                      <Badge className="text-[10px] bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 gap-0.5">
                        <Bell className="size-2.5" /> Follow-up {selectedTask.followUpDueDate ? `by ${new Date(selectedTask.followUpDueDate).toLocaleDateString("en", { month: "short", day: "numeric" })}` : ""}
                      </Badge>
                    )}
                  </div>

                  {/* Description */}
                  <p className="text-sm text-slate-700 leading-relaxed">{selectedTask.description}</p>

                  {/* Meta */}
                  <div className="bg-slate-50 rounded-lg p-3 text-xs space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Assigned to</span>
                      <span className="font-semibold">{getFarmer(selectedTask.assignedTo)?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Created by</span>
                      <span className="font-semibold">{getFarmer(selectedTask.createdBy)?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Due date</span>
                      <span className="font-semibold">{new Date(selectedTask.dueDate).toLocaleDateString("en", { weekday: "short", month: "short", day: "numeric" })}</span>
                    </div>
                    {selectedTask.bedId && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Related bed</span>
                        <Link href={`/beds/${selectedTask.bedId}`} className="font-mono font-semibold text-emerald-700 hover:underline">{selectedTask.bedId}</Link>
                      </div>
                    )}
                  </div>

                  {/* ── Worker assignment section ──────────────────────── */}
                  <div className="rounded-lg border border-slate-200 overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-200">
                      <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                        <Users className="size-3.5 text-slate-400" /> Workers on this task
                      </span>
                      {selectedTask.status !== "done" && (
                        <button onClick={() => setAssignWorkerOpen(p => !p)}
                          className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 transition-colors">
                          <UserPlus className="size-3.5" /> Assign worker
                        </button>
                      )}
                    </div>

                    {/* Inline assignment form */}
                    {assignWorkerOpen && (
                      <div className="px-3 py-2.5 bg-emerald-50 border-b border-emerald-200 flex items-center gap-2 flex-wrap">
                        <select
                          value={newWorker.farmerId}
                          onChange={e => setNewWorker(p => ({ ...p, farmerId: e.target.value }))}
                          className="flex-1 min-w-32 border border-slate-200 rounded-md px-2 py-1.5 text-xs bg-white"
                        >
                          <option value="">— Pick farmer —</option>
                          {FARMERS_ONLY.map(f => (
                            <option key={f.id} value={f.id}>{f.name}</option>
                          ))}
                        </select>
                        <select
                          value={newWorker.shift}
                          onChange={e => setNewWorker(p => ({ ...p, shift: e.target.value as TaskWorkerAssignment["shift"] }))}
                          className="border border-slate-200 rounded-md px-2 py-1.5 text-xs bg-white"
                        >
                          {Object.entries(SHIFT_LABELS).map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                          ))}
                        </select>
                        <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 px-3"
                          onClick={addWorkerToTask} disabled={!newWorker.farmerId}>
                          Add
                        </Button>
                        <button onClick={() => setAssignWorkerOpen(false)} className="text-slate-400 hover:text-slate-600">
                          <X className="size-4" />
                        </button>
                      </div>
                    )}

                    {/* Worker list */}
                    <div className="divide-y divide-slate-50">
                      {(selectedTask.workerAssignments ?? []).length === 0 && (
                        <div className="px-3 py-4 text-center text-xs text-slate-400">No workers assigned yet</div>
                      )}
                      {(selectedTask.workerAssignments ?? []).map(wa => {
                        const farmer = getFarmer(wa.farmerId);
                        return (
                          <div key={wa.farmerId} className="flex items-center gap-3 px-3 py-2">
                            <Avatar className="size-7 shrink-0">
                              <AvatarFallback className="bg-slate-100 text-slate-700 text-[10px] font-bold">{farmer?.avatar}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-semibold text-slate-800">{farmer?.name}</div>
                              <div className="text-[10px] text-slate-400 capitalize">{farmer?.role}</div>
                            </div>
                            <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full font-semibold shrink-0">
                              {SHIFT_LABELS[wa.shift]}
                            </span>
                            {selectedTask.status !== "done" && (
                              <button onClick={() => removeWorkerFromTask(wa.farmerId)}
                                className="size-5 rounded hover:bg-red-50 grid place-items-center transition-colors shrink-0">
                                <Trash2 className="size-3 text-slate-400 hover:text-red-500" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* ── Manager overdue actions ──────────────────────── */}
                  {isManager && selectedTask.status !== "done" && selectedTask.dueDate < TODAY && (
                    <div className="rounded-lg border border-red-200 overflow-hidden">
                      <button
                        onClick={() => setShowMgrActions(p => !p)}
                        className="w-full flex items-center justify-between px-3 py-2 bg-red-50 hover:bg-red-100 transition-colors"
                      >
                        <span className="flex items-center gap-2 text-xs font-semibold text-red-700">
                          <AlertCircle className="size-3.5" /> Manager Actions — Overdue
                        </span>
                        <span className="text-[10px] text-red-500">{showMgrActions ? "▲ hide" : "▼ show"}</span>
                      </button>
                      {showMgrActions && (
                        <div className="p-3 space-y-3 bg-red-50/40">
                          {/* Send reminder */}
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <div className="text-xs font-semibold text-slate-700">📩 Send Reminder</div>
                              <div className="text-[10px] text-slate-500">Notify {getFarmer(selectedTask.assignedTo)?.name.split(" ")[0]} about this overdue task</div>
                              {selectedTask.overdueNotifiedAt && (
                                <div className="text-[10px] text-emerald-600 mt-0.5">
                                  ✓ Last notified {new Date(selectedTask.overdueNotifiedAt).toLocaleDateString("en", { month: "short", day: "numeric" })}
                                </div>
                              )}
                            </div>
                            <Button size="sm" variant="outline" className="shrink-0 text-xs border-red-300 text-red-700 hover:bg-red-100"
                              onClick={() => sendOverdueReminder(selectedTask)}>
                              Send
                            </Button>
                          </div>

                          {/* Extend deadline */}
                          <div>
                            <div className="text-xs font-semibold text-slate-700 mb-1.5">⏰ Extend Deadline</div>
                            <div className="flex gap-2">
                              <input type="date" value={extendDate}
                                min={TODAY}
                                onChange={e => setExtendDate(e.target.value)}
                                className="flex-1 border border-slate-200 rounded-md px-2 py-1.5 text-xs" />
                              <Button size="sm" className="text-xs bg-amber-500 hover:bg-amber-600 shrink-0"
                                disabled={!extendDate} onClick={saveExtendDeadline}>
                                Save
                              </Button>
                            </div>
                          </div>

                          {/* Penalty note */}
                          <div>
                            <div className="text-xs font-semibold text-slate-700 mb-1.5">⚠️ Penalty / Escalation Note</div>
                            {selectedTask.managerNote && (
                              <div className="mb-1.5 text-[11px] bg-red-100 text-red-800 border border-red-200 rounded px-2 py-1.5 italic">
                                "{selectedTask.managerNote}"
                              </div>
                            )}
                            <div className="flex gap-2">
                              <input value={managerNote}
                                onChange={e => setManagerNote(e.target.value)}
                                placeholder="Note penalty, escalation reason…"
                                className="flex-1 border border-slate-200 rounded-md px-2 py-1.5 text-xs" />
                              <Button size="sm" variant="outline" className="text-xs border-red-300 text-red-700 hover:bg-red-100 shrink-0"
                                disabled={!managerNote.trim()} onClick={saveManagerNote}>
                                Save
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Progress / completion ──────────────────────────── */}
                  {selectedTask.status !== "done" && (
                    <>
                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1.5">Progress Note</label>
                        <Textarea value={progressNote} onChange={e => setProgressNote(e.target.value)}
                          placeholder="Describe what was done, any issues encountered…"
                          className="text-sm resize-none" rows={3} />
                      </div>
                      <div>
                        <label className={`text-xs font-semibold block mb-1.5 ${selectedTask.requiresImageProof ? "text-purple-700" : "text-slate-700"}`}>
                          Completion Photo {selectedTask.requiresImageProof
                            ? <span className="text-red-500">* (Required)</span>
                            : <span className="text-slate-400 font-normal">(Optional)</span>}
                        </label>
                        <input ref={proofInputRef} type="file" accept="image/*" capture="environment"
                          className="hidden" onChange={handleProofUpload} />
                        {proofImage ? (
                          <div className="relative rounded-lg overflow-hidden border border-slate-200">
                            <img src={proofImage} alt="Proof" className="w-full max-h-36 object-cover" />
                            <div className="absolute top-2 right-2 flex gap-1">
                              <button onClick={() => setPreviewUrl(proofImage)}
                                className="size-7 rounded-full bg-black/60 text-white grid place-items-center hover:bg-black/80">
                                <Eye className="size-3.5" />
                              </button>
                              <button onClick={() => { setProofImage(null); setProofImageName(""); }}
                                className="size-7 rounded-full bg-black/60 text-white grid place-items-center hover:bg-black/80">
                                <X className="size-3.5" />
                              </button>
                            </div>
                            <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[10px] px-2 py-1 truncate">{proofImageName}</div>
                          </div>
                        ) : (
                          <button type="button" onClick={() => proofInputRef.current?.click()}
                            className={`w-full flex flex-col items-center gap-2 p-4 rounded-lg border-2 border-dashed transition-colors ${selectedTask.requiresImageProof ? "border-purple-300 bg-purple-50 hover:bg-purple-100" : "border-slate-200 bg-slate-50 hover:bg-slate-100"}`}>
                            <Upload className={`size-5 ${selectedTask.requiresImageProof ? "text-purple-400" : "text-slate-400"}`} />
                            <div className="text-xs text-slate-500">
                              <span className={`font-semibold ${selectedTask.requiresImageProof ? "text-purple-600" : "text-slate-600"}`}>Click to upload</span> or take a photo
                            </div>
                            <div className="text-[10px] text-slate-400">JPG, PNG, HEIC — max 10 MB</div>
                          </button>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {selectedTask.status === "pending" && (
                          <Button variant="outline" className="flex-1 text-sm"
                            onClick={() => updateStatus(selectedTask.id, "in_progress")}>
                            <Clock className="size-3.5 mr-1.5" /> Start Task
                          </Button>
                        )}
                        <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-sm"
                          disabled={selectedTask.requiresImageProof && !proofImage}
                          onClick={() => updateStatus(selectedTask.id, "done")}>
                          <CheckCircle2 className="size-3.5 mr-1.5" /> Mark Complete
                        </Button>
                      </div>
                      {selectedTask.requiresImageProof && !proofImage && (
                        <p className="text-[11px] text-purple-600 text-center -mt-2">Upload a proof photo to complete this task</p>
                      )}
                    </>
                  )}

                  {/* Done state proof */}
                  {selectedTask.status === "done" && selectedTask.proofImageUrl && (
                    <div>
                      <div className="text-xs font-semibold text-slate-700 mb-2">Completion Photo</div>
                      <div className="relative rounded-lg overflow-hidden border border-slate-200">
                        <img src={selectedTask.proofImageUrl} alt="Proof" className="w-full max-h-48 object-cover" />
                        <button onClick={() => setPreviewUrl(selectedTask.proofImageUrl!)}
                          className="absolute top-2 right-2 size-7 rounded-full bg-black/60 text-white grid place-items-center hover:bg-black/80">
                          <Eye className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* ── New task dialog ──────────────────────────────────────────── */}
          <Dialog open={newTaskOpen} onOpenChange={setNewTaskOpen}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Plus className="size-4" /> {t.tasks.createTask}
                  {isSupervisor && <Badge className="text-[10px] bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100">Supervisor task</Badge>}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Title <span className="text-red-500">*</span></label>
                  <input value={newTask.title}
                    onChange={e => setNewTask(p => ({ ...p, title: e.target.value }))}
                    placeholder="e.g. Apply fungicide to Zone A-BED-03"
                    className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Instructions</label>
                  <Textarea value={newTask.description}
                    onChange={e => setNewTask(p => ({ ...p, description: e.target.value }))}
                    placeholder="Step-by-step instructions…" rows={3} className="text-sm resize-none" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {/* Managers assign to supervisors; supervisors are assigned to themselves */}
                  {isManager && (
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">Assign to</label>
                      <select value={newTask.assignedTo}
                        onChange={e => setNewTask(p => ({ ...p, assignedTo: e.target.value }))}
                        className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white">
                        {SUPERVISORS.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">Due Date</label>
                    <input type="date" value={newTask.dueDate}
                      onChange={e => setNewTask(p => ({ ...p, dueDate: e.target.value }))}
                      className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">Priority</label>
                    <select value={newTask.priority}
                      onChange={e => setNewTask(p => ({ ...p, priority: e.target.value as Task["priority"] }))}
                      className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white">
                      <option value="high">🔴 High</option>
                      <option value="medium">🟡 Medium</option>
                      <option value="low">⚪ Low</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">Category</label>
                    <select value={newTask.category}
                      onChange={e => setNewTask(p => ({ ...p, category: e.target.value as Task["category"] }))}
                      className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white">
                      <option value="disease">Disease</option>
                      <option value="harvest">Harvest</option>
                      <option value="irrigation">Irrigation</option>
                      <option value="inspection">Inspection</option>
                      <option value="general">General</option>
                    </select>
                  </div>
                </div>

                {/* Require photo proof */}
                <button type="button" onClick={() => setRequireImageNew(p => !p)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left ${requireImageNew ? "border-purple-500 bg-purple-50" : "border-slate-200 bg-white hover:border-slate-300"}`}>
                  <div className={`size-5 rounded border-2 grid place-items-center shrink-0 transition-colors ${requireImageNew ? "bg-purple-500 border-purple-500" : "border-slate-300"}`}>
                    {requireImageNew && <CheckCircle2 className="size-3 text-white" />}
                  </div>
                  <div>
                    <div className={`text-xs font-semibold ${requireImageNew ? "text-purple-800" : "text-slate-700"}`}>Require photo proof on completion</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">Supervisor must upload a photo to mark this task as done</div>
                  </div>
                  <ImageIcon className={`size-4 ml-auto shrink-0 ${requireImageNew ? "text-purple-500" : "text-slate-300"}`} />
                </button>

                {/* Require follow-up — only managers set follow-ups on supervisor tasks */}
                {isManager && (
                  <div>
                    <button type="button" onClick={() => setRequireFollowUpNew(p => !p)}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left ${requireFollowUpNew ? "border-amber-400 bg-amber-50" : "border-slate-200 bg-white hover:border-slate-300"}`}>
                      <div className={`size-5 rounded border-2 grid place-items-center shrink-0 transition-colors ${requireFollowUpNew ? "bg-amber-400 border-amber-400" : "border-slate-300"}`}>
                        {requireFollowUpNew && <CheckCircle2 className="size-3 text-white" />}
                      </div>
                      <div>
                        <div className={`text-xs font-semibold ${requireFollowUpNew ? "text-amber-800" : "text-slate-700"}`}>Schedule a follow-up reminder</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">Auto-creates a follow-up to verify task was completed properly</div>
                      </div>
                      <Bell className={`size-4 ml-auto shrink-0 ${requireFollowUpNew ? "text-amber-500" : "text-slate-300"}`} />
                    </button>
                    {requireFollowUpNew && (
                      <div className="mt-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                        <label className="text-xs font-semibold text-amber-800 block mb-1">Follow-up due date</label>
                        <input type="date" value={followUpDateNew}
                          onChange={e => setFollowUpDateNew(e.target.value)}
                          className="w-full border border-amber-200 rounded-md px-3 py-1.5 text-sm bg-white" />
                        <p className="text-[10px] text-amber-700 mt-1.5">A follow-up will appear in the Follow-ups tab assigned to you on this date.</p>
                      </div>
                    )}
                  </div>
                )}

                <Button onClick={createTask} disabled={!newTask.title}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 gap-2">
                  <Plus className="size-4" /> {t.tasks.createTask}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}

      {/* ── Assignments section ──────────────────────────────────────────── */}
      {section === "assignments" && <AssignmentsSection />}

      {/* ── Follow-ups section ───────────────────────────────────────────── */}
      {section === "follow-ups" && <FollowUpsSection />}

      {/* Image lightbox */}
      {previewUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPreviewUrl(null)}>
          <div className="relative max-w-2xl w-full" onClick={e => e.stopPropagation()}>
            <img src={previewUrl} alt="Proof" className="w-full rounded-xl shadow-2xl" />
            <button onClick={() => setPreviewUrl(null)}
              className="absolute top-3 right-3 size-8 rounded-full bg-black/60 text-white grid place-items-center hover:bg-black/80">
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
