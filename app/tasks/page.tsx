"use client";

import { useState, useRef, useEffect } from "react";
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
  ClipboardList, Bell, UserPlus, Users, Trash2, GitBranch,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useLang } from "@/lib/lang";
import { EN, AM } from "@/lib/translations";
import type { Task, TaskWorkerAssignment, Farmer, Bed, ProgressNote } from "@/lib/types";
import { useOptions } from "@/lib/use-options";
import { AssignmentsSection } from "./_assignments";
import { FollowUpsSection } from "./_follow-ups";

const PRIORITY_COLORS = {
  high: "bg-red-500",
  medium: "bg-amber-500",
  low: "bg-muted-foreground/50",
};
const CATEGORY_COLORS: Record<string, string> = {
  disease:    "bg-red-100 text-red-700 border-red-200",
  harvest:    "bg-emerald-100 text-emerald-700 border-emerald-200",
  irrigation: "bg-blue-100 text-blue-700 border-blue-200",
  inspection: "bg-purple-100 text-purple-700 border-purple-200",
  general:    "bg-muted text-muted-foreground border-border",
};
type Section = "tasks" | "assignments" | "follow-ups";
const SECTION_TABS: { key: Section; label: string; icon: typeof ListChecks }[] = [
  { key: "tasks",       label: "Daily Tasks",  icon: ListChecks    },
  { key: "assignments", label: "Assignments",  icon: ClipboardList },
  { key: "follow-ups",  label: "Follow-ups",   icon: Bell          },
];

export default function TasksPage() {
  const { isAm } = useLang();
  const t = isAm ? AM : EN;
  const { user, isManager, isSupervisor } = useAuth();
  const options = useOptions();

  const [section, setSection]               = useState<Section>("tasks");
  const [tasks, setTasks]                   = useState<Task[]>([]);
  const [farmers, setFarmers]               = useState<Farmer[]>([]);
  const [beds, setBeds]                     = useState<Bed[]>([]);
  const [filter, setFilter]                 = useState<"all" | "pending" | "in_progress" | "done">("all");
  const [selectedTask, setSelectedTask]     = useState<Task | null>(null);
  const [progressNote, setProgressNote]     = useState("");
  const [proofImage, setProofImage]         = useState<string | null>(null);
  const [proofImageName, setProofImageName] = useState("");
  const [newTaskOpen, setNewTaskOpen]       = useState(false);
  const [requireImageNew, setRequireImageNew] = useState(false);
  const [requireFollowUpNew, setRequireFollowUpNew] = useState(false);
  const [followUpDateNew, setFollowUpDateNew] = useState(() => new Date(Date.now() + 2 * 86400000).toISOString().split("T")[0]);
  const [newTask, setNewTask] = useState({
    title: "", description: "",
    assignedTo: isSupervisor ? (user?.id ?? "") : "",
    priority: "medium" as Task["priority"],
    category: "general" as Task["category"],
    dueDate: new Date(Date.now() + 86400000).toISOString().split("T")[0],
  });
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [managerNote, setManagerNote]   = useState("");
  const [extendDate, setExtendDate]     = useState("");
  const [showMgrActions, setShowMgrActions] = useState(false);

  // Worker assignment state (inside task detail)
  const [assignWorkerOpen, setAssignWorkerOpen] = useState(false);
  const [newWorker, setNewWorker] = useState<{ farmerId: string; shift: TaskWorkerAssignment["shift"] }>({
    farmerId: "",
    shift: "morning",
  });

  // New state for task flow features
  const [progressNoteInput, setProgressNoteInput] = useState("");
  const [completionNoteInput, setCompletionNoteInput] = useState("");
  const [showCompleteForm, setShowCompleteForm] = useState(false);
  const [requestCorrectionOpen, setRequestCorrectionOpen] = useState(false);
  const [correctionForm, setCorrectionForm] = useState({
    title: "",
    assignedTo: "",
    dueDate: new Date(Date.now() + 2 * 86400000).toISOString().split("T")[0],
    priority: "medium" as Task["priority"],
    category: "general" as Task["category"],
    description: "",
  });

  const proofInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/tasks").then(r => r.json()).then(setTasks);
    fetch("/api/farmers").then(r => r.json()).then((data: Farmer[]) => {
      setFarmers(data);
      setNewWorker(prev => ({ ...prev, farmerId: data.find(f => f.role === "farmer")?.id ?? "" }));
    });
    fetch("/api/beds").then(r => r.json()).then(setBeds);
  }, []);

  const FARMERS_ONLY  = farmers.filter(f => f.role === "farmer");
  const SUPERVISORS   = farmers.filter(f => f.role === "supervisor");
  const SUPERVISORS_AND_MANAGERS = farmers.filter(f => f.role === "supervisor" || f.role === "manager");
  const shiftLabel = (shift: TaskWorkerAssignment["shift"]) =>
    options.shifts.find(s => s.value === shift)?.label ?? shift.replace("_", " ");

  function getFarmer(farmerId: string): Farmer | undefined {
    return farmers.find(f => f.id === farmerId);
  }

  function getBed(bedId: string): Bed | undefined {
    return beds.find(b => b.id === bedId);
  }

  /** Replace a task in the tasks array (also updates selectedTask if open) */
  function replaceTask(updated: Task) {
    setTasks(prev => prev.map(t => {
      if (t.id === updated.id) return updated;
      // Also update if this task appears as a child
      if (t.children) {
        return { ...t, children: t.children.map(c => c.id === updated.id ? updated : c) };
      }
      return t;
    }));
    if (selectedTask?.id === updated.id) setSelectedTask(updated);
  }

  const supervisorId  = user?.id;
  const visibleTasks  = isSupervisor
    ? tasks.filter(t => t.assignedTo === supervisorId)
    : tasks;
  // Top-level only (no parentTaskId) for the main list
  const topLevelVisible = visibleTasks.filter(t => !t.parentTaskId);
  const filtered   = topLevelVisible.filter(t => filter === "all" || t.status === filter);
  const pending    = visibleTasks.filter(t => t.status === "pending").length;
  const inProgress = visibleTasks.filter(t => t.status === "in_progress").length;
  const done       = visibleTasks.filter(t => t.status === "done").length;
  const total      = visibleTasks.length;
  const TODAY = new Date().toISOString().split("T")[0];
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

  /* ── Task status update (legacy, kept for safety) ───────────────── */
  async function updateStatus(taskId: string, status: Task["status"]) {
    const patchBody: Partial<Task> = {
      status,
      ...(status === "done" ? { completedAt: new Date().toISOString() } : {}),
      ...(progressNote ? { progressNote } : {}),
      ...(proofImage ? { proofImageUrl: proofImage } : {}),
    };

    await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patchBody),
    });

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

  /* ── New action API helpers ──────────────────────────────────────── */
  async function startTask(taskId: string) {
    const res = await fetch(`/api/tasks/${taskId}/start`, { method: "PATCH" });
    if (!res.ok) { toast.error("Could not start task"); return; }
    const updated: Task = await res.json();
    replaceTask(updated);
    toast.success("Task started");
  }

  async function addProgressNote(taskId: string, note: string) {
    if (!note.trim()) return;
    const res = await fetch(`/api/tasks/${taskId}/progress`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    });
    if (!res.ok) { toast.error("Could not add note"); return; }
    const updated: Task = await res.json();
    replaceTask(updated);
    setProgressNoteInput("");
    toast.success("Progress note added");
  }

  async function completeTask(taskId: string, completionNote: string, proofImageUrl?: string) {
    const res = await fetch(`/api/tasks/${taskId}/complete`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completionNote: completionNote || undefined, proofImageUrl }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: string };
      toast.error(err.error ?? "Could not complete task");
      return;
    }
    const updated: Task = await res.json();
    replaceTask(updated);
    setShowCompleteForm(false);
    setCompletionNoteInput("");
    setProofImage(null);
    setProofImageName("");
    toast.success("Task completed ✓");
  }

  async function approveTask(taskId: string) {
    const res = await fetch(`/api/tasks/${taskId}/approve`, { method: "PATCH" });
    if (!res.ok) { toast.error("Could not approve task"); return; }
    const updated: Task = await res.json();
    replaceTask(updated);
    toast.success("Task approved ✓");
  }

  async function submitCorrection(taskId: string) {
    if (!correctionForm.title.trim() || !correctionForm.assignedTo) {
      toast.error("Title and assignee required");
      return;
    }
    const res = await fetch(`/api/tasks/${taskId}/followup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: correctionForm.title.trim(),
        description: correctionForm.description.trim(),
        assignedTo: correctionForm.assignedTo,
        dueDate: correctionForm.dueDate,
        priority: correctionForm.priority,
        category: correctionForm.category,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: string };
      toast.error(err.error ?? "Could not create correction task");
      return;
    }
    const newChild: Task = await res.json();
    // Add child to parent task in state
    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        return { ...t, children: [...(t.children ?? []), newChild] };
      }
      return t;
    }));
    if (selectedTask?.id === taskId) {
      setSelectedTask(prev => prev ? { ...prev, children: [...(prev.children ?? []), newChild] } : prev);
    }
    setRequestCorrectionOpen(false);
    setCorrectionForm({
      title: "", assignedTo: "", description: "",
      dueDate: new Date(Date.now() + 2 * 86400000).toISOString().split("T")[0],
      priority: "medium", category: "general",
    });
    toast.success("Correction task created");
  }

  /* ── Worker assignments ──────────────────────────────────────────── */
  async function addWorkerToTask() {
    if (!selectedTask || !newWorker.farmerId) return;
    if ((selectedTask.workerAssignments ?? []).some(w => w.farmerId === newWorker.farmerId)) {
      toast.error("This farmer is already assigned");
      return;
    }
    const wa: TaskWorkerAssignment = { farmerId: newWorker.farmerId, shift: newWorker.shift };
    const updatedAssignments = [...(selectedTask.workerAssignments ?? []), wa];

    await fetch(`/api/tasks/${selectedTask.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workerAssignments: updatedAssignments }),
    });

    const updated = { ...selectedTask, workerAssignments: updatedAssignments };
    setSelectedTask(updated);
    setTasks(prev => prev.map(t => t.id === updated.id ? updated : t));
    setAssignWorkerOpen(false);
    setNewWorker({ farmerId: FARMERS_ONLY[0]?.id ?? "", shift: "morning" });
    toast.success(`${getFarmer(wa.farmerId)?.name.split(" ")[0]} assigned — ${shiftLabel(wa.shift)}`);
  }

  async function removeWorkerFromTask(farmerId: string) {
    if (!selectedTask) return;
    const updatedAssignments = (selectedTask.workerAssignments ?? []).filter(w => w.farmerId !== farmerId);

    await fetch(`/api/tasks/${selectedTask.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workerAssignments: updatedAssignments }),
    });

    const updated = {
      ...selectedTask,
      workerAssignments: updatedAssignments,
    };
    setSelectedTask(updated);
    setTasks(prev => prev.map(t => t.id === updated.id ? updated : t));
  }

  /* ── Create task ─────────────────────────────────────────────────── */
  async function createTask() {
    if (!newTask.title.trim()) { toast.error("Title is required"); return; }
    const taskBody = {
      ...newTask,
      createdBy: user?.id ?? "",
      status: "pending" as const,
      createdAt: new Date().toISOString(),
      requiresImageProof: requireImageNew,
      requiresFollowUp: requireFollowUpNew,
      followUpDueDate: requireFollowUpNew ? followUpDateNew : undefined,
    };

    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(taskBody),
    });
    const task: Task = await res.json();
    setTasks(prev => [task, ...prev]);

    // Auto-create follow-up if requested
    if (requireFollowUpNew) {
      await fetch("/api/follow-ups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType: "task",
          entityId: task.id,
          title: `Follow up: ${newTask.title}`,
          description: `Verify task completion by ${getFarmer(newTask.assignedTo)?.name ?? "supervisor"}`,
          dueDate: followUpDateNew,
          status: "pending",
          priority: newTask.priority === "high" ? "urgent" : "normal",
          assignedTo: user?.id ?? "",
          createdBy: user?.id ?? "",
        }),
      });
    }

    toast.success("Task created", {
      description: `Assigned to ${getFarmer(newTask.assignedTo)?.name}${requireFollowUpNew ? " · Follow-up scheduled" : ""}`,
    });
    setNewTaskOpen(false);
    setRequireImageNew(false);
    setRequireFollowUpNew(false);
    setFollowUpDateNew(new Date(Date.now() + 2 * 86400000).toISOString().split("T")[0]);
    setNewTask({
      title: "", description: "",
      assignedTo: isSupervisor ? (user?.id ?? "") : "",
      priority: "medium", category: "general", dueDate: new Date(Date.now() + 86400000).toISOString().split("T")[0],
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
    setProgressNoteInput("");
    setCompletionNoteInput("");
    setShowCompleteForm(false);
    setRequestCorrectionOpen(false);
    setCorrectionForm({
      title: "", assignedTo: "", description: "",
      dueDate: new Date(Date.now() + 2 * 86400000).toISOString().split("T")[0],
      priority: "medium", category: "general",
    });
  }

  async function sendOverdueReminder(task: Task) {
    const overdueNotifiedAt = new Date().toISOString();

    await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ overdueNotifiedAt }),
    });

    const updated = tasks.map(t =>
      t.id === task.id ? { ...t, overdueNotifiedAt } : t
    );
    setTasks(updated);
    if (selectedTask?.id === task.id) setSelectedTask(updated.find(t => t.id === task.id) ?? null);
    toast.success("Reminder sent", {
      description: `${getFarmer(task.assignedTo)?.name} has been notified about "${task.title}"`,
    });
  }

  async function saveExtendDeadline() {
    if (!selectedTask || !extendDate) return;

    await fetch(`/api/tasks/${selectedTask.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dueDate: extendDate }),
    });

    const updated = tasks.map(t =>
      t.id === selectedTask.id ? { ...t, dueDate: extendDate } : t
    );
    const next = updated.find(t => t.id === selectedTask.id)!;
    setTasks(updated);
    setSelectedTask(next);
    toast.success("Deadline extended to " + new Date(extendDate).toLocaleDateString("en", { month: "short", day: "numeric" }));
    setExtendDate("");
  }

  async function saveManagerNote() {
    if (!selectedTask || !managerNote.trim()) return;

    await fetch(`/api/tasks/${selectedTask.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ managerNote: managerNote.trim() }),
    });

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

  /* ── Render a single task card ───────────────────────────────────── */
  function renderTaskCard(task: Task, isChild = false) {
    const farmer  = getFarmer(task.assignedTo);
    const creator = getFarmer(task.createdBy);
    const bed     = task.bedId ? getBed(task.bedId) : null;
    const overdue = task.status !== "done" && task.dueDate < TODAY;
    const workerCount = task.workerAssignments?.length ?? 0;
    return (
      <Card key={task.id}
        className={`border border-border hover:border-border/80 hover:shadow-sm transition-all cursor-pointer ${isChild ? "border-l-4 border-l-blue-400 ml-6" : ""}`}
        onClick={() => openTask(task)}>
        <div className="flex items-start gap-4 p-4">
          <span className={`size-2.5 rounded-full mt-1.5 shrink-0 ${PRIORITY_COLORS[task.priority]}`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2 flex-wrap">
              {isChild && (
                <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                  <GitBranch className="size-2.5" /> Follow-up
                </span>
              )}
              <span className={`font-semibold text-sm ${task.status === "done" ? "line-through text-muted-foreground" : "text-foreground"}`}>
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
                  className="text-[10px] font-mono bg-muted text-muted-foreground px-1.5 py-0.5 rounded hover:bg-accent">
                  {bed.id}
                </Link>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{task.description}</p>
            {task.progressNote && (
              <div className="mt-2 text-[11px] text-foreground/80 bg-muted border border-border rounded px-2 py-1 italic">
                &ldquo;{task.progressNote}&rdquo;
              </div>
            )}
            {task.proofImageUrl && (
              <button onClick={e => { e.stopPropagation(); setPreviewUrl(task.proofImageUrl!); }}
                className="mt-1.5 flex items-center gap-1.5 text-[11px] text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded hover:bg-purple-100 transition-colors">
                <FileImage className="size-3" /> View proof photo
              </button>
            )}
            <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
              <span>By {creator?.name.split(" ")[0]}</span>
              <span>·</span>
              <span>Due {new Date(task.dueDate).toLocaleDateString("en", { month: "short", day: "numeric" })}</span>
              {workerCount > 0 && (
                <span className="flex items-center gap-1 text-blue-500">
                  <Users className="size-3" /> {workerCount} worker{workerCount > 1 ? "s" : ""}
                </span>
              )}
              {task.completedAt && (
                <><span>·</span><span className="text-primary">✓ Done {new Date(task.completedAt).toLocaleDateString("en", { month: "short", day: "numeric" })}</span></>
              )}
              {task.reviewedAt && (
                <><span>·</span><span className="text-primary font-semibold">✓ Approved</span></>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-2">
              <Avatar className="size-7">
                <AvatarFallback className="bg-muted text-muted-foreground text-[10px] font-bold">{farmer?.avatar}</AvatarFallback>
              </Avatar>
              <div className="hidden sm:block">
                <div className="text-[11px] font-semibold text-foreground">{farmer?.name.split(" ")[0]}</div>
                <div className="text-[10px] text-muted-foreground capitalize">{farmer?.role}</div>
              </div>
            </div>
            <Badge className={`text-[10px] capitalize ${
              task.status === "done" ? "bg-primary/15 text-primary border-primary/30 hover:bg-primary/15" :
              task.status === "in_progress" ? "bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100" :
              "bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100"
            }`}>{task.status.replace("_", " ")}</Badge>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-[1400px] mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ListChecks className="size-5 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">{t.tasks.title}</h1>
          </div>
          <p className="text-muted-foreground text-sm">{t.tasks.subtitle}</p>
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
                setNewTask(p => ({ ...p, assignedTo: isSupervisor ? (user?.id ?? "") : "" }));
                setNewTaskOpen(true);
              }}
              className="bg-primary hover:bg-primary/90 gap-2"
            >
              <Plus className="size-4" /> {t.tasks.newTask}
            </Button>
          )}
        </div>
      </div>

      {/* Section tabs */}
      <div className="flex items-center gap-1 p-1 bg-muted rounded-xl w-fit">
        {SECTION_TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setSection(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              section === key ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
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
            <Card className="p-4 border-primary/30 bg-primary/10">
              <div className="flex items-center justify-between">
                <div><div className="text-2xl font-bold text-primary">{done}</div>
                  <div className="text-xs text-primary font-medium">{t.tasks.complete}</div></div>
                <CheckCircle2 className="size-8 text-primary/60" />
              </div>
            </Card>
          </div>

          {/* Progress */}
          {total > 0 && (
            <Card className="p-4 border border-border">
              <div className="flex items-center justify-between mb-2 text-sm">
                <span className="font-medium text-foreground">Overall Progress</span>
                <span className="font-bold text-foreground tabular-nums">{Math.round((done / total) * 100)}%</span>
              </div>
              <Progress value={(done / total) * 100} className="h-2" />
              <div className="flex justify-between text-[11px] text-muted-foreground mt-1">
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
          <div className="flex items-center gap-1 p-1 bg-muted rounded-lg w-fit">
            {(["all", "pending", "in_progress", "done"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all capitalize ${filter === f ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                {f.replace("_", " ")}
              </button>
            ))}
          </div>

          {/* Task list — top-level with indented children */}
          <div className="space-y-2">
            {filtered.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <ListChecks className="size-10 mx-auto mb-2 opacity-20" />
                <p className="text-sm">{t.tasks.noTasks}</p>
              </div>
            )}
            {filtered.map(task => (
              <div key={task.id} className="space-y-1.5">
                {renderTaskCard(task, false)}
                {/* Indented follow-up children */}
                {(task.children ?? []).length > 0 && (
                  <div className="space-y-1.5">
                    {(task.children ?? []).map(child => renderTaskCard(child, true))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* ── Task detail dialog ──────────────────────────────────────── */}
          <Dialog open={!!selectedTask} onOpenChange={o => { if (!o) { setSelectedTask(null); setAssignWorkerOpen(false); setShowCompleteForm(false); setRequestCorrectionOpen(false); setProgressNoteInput(""); setCompletionNoteInput(""); setManagerNote(""); setExtendDate(""); } }}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 pr-6">
                  <ListChecks className="size-4 text-blue-600 shrink-0" />
                  <span className="truncate">{selectedTask?.title}</span>
                </DialogTitle>
              </DialogHeader>
              {selectedTask && (
                <div className="space-y-4">

                  {/* Follow-up for parent info box */}
                  {selectedTask.parentTaskId && (() => {
                    const parent = tasks.find(t => t.id === selectedTask.parentTaskId);
                    return (
                      <div className="flex items-center gap-2 p-2.5 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-700">
                        <GitBranch className="size-3.5 shrink-0" />
                        <span>Follow-up for: <span className="font-semibold">{parent?.title ?? selectedTask.parentTaskId}</span></span>
                      </div>
                    );
                  })()}

                  {/* Status badges */}
                  <div className="flex flex-wrap gap-2">
                    <Badge className={`text-[10px] capitalize ${CATEGORY_COLORS[selectedTask.category]}`}>{selectedTask.category}</Badge>
                    <Badge variant="outline" className="text-[10px] capitalize">{selectedTask.priority} priority</Badge>
                    <Badge className={`text-[10px] capitalize ${
                      selectedTask.status === "done" ? "bg-primary/15 text-primary border-primary/30 hover:bg-primary/15" :
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
                    {selectedTask.reviewedAt && (
                      <Badge className="text-[10px] bg-primary/15 text-primary border-primary/30 hover:bg-primary/15 gap-0.5">
                        <CheckCircle2 className="size-2.5" /> Approved
                      </Badge>
                    )}
                  </div>

                  {/* Description */}
                  <p className="text-sm text-foreground/80 leading-relaxed">{selectedTask.description}</p>

                  {/* Meta */}
                  <div className="bg-muted rounded-lg p-3 text-xs space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Assigned to</span>
                      <span className="font-semibold">{getFarmer(selectedTask.assignedTo)?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Created by</span>
                      <span className="font-semibold">{getFarmer(selectedTask.createdBy)?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Due date</span>
                      <span className="font-semibold">{new Date(selectedTask.dueDate).toLocaleDateString("en", { weekday: "short", month: "short", day: "numeric" })}</span>
                    </div>
                    {selectedTask.bedId && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Related bed</span>
                        <Link href={`/beds/${selectedTask.bedId}`} className="font-mono font-semibold text-primary hover:underline">{selectedTask.bedId}</Link>
                      </div>
                    )}
                    {selectedTask.reviewedAt && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Approved by</span>
                        <span className="font-semibold text-primary">
                          {selectedTask.reviewedBy ? (getFarmer(selectedTask.reviewedBy)?.name ?? selectedTask.reviewedBy) : "Manager"} on {new Date(selectedTask.reviewedAt).toLocaleDateString("en", { month: "short", day: "numeric" })}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* ── Completion note (if done) ─────────────────────── */}
                  {selectedTask.status === "done" && selectedTask.completionNote && (
                    <div className="p-3 rounded-lg bg-primary/10 border border-primary/30">
                      <div className="text-xs font-semibold text-primary mb-1">Completion Note</div>
                      <p className="text-xs text-primary/80 italic">&ldquo;{selectedTask.completionNote}&rdquo;</p>
                    </div>
                  )}

                  {/* ── Approved badge (full) ─────────────────────────── */}
                  {selectedTask.reviewedAt && (
                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-primary/10 border border-primary/30 text-xs text-primary">
                      <CheckCircle2 className="size-3.5 shrink-0" />
                      <span>Approved by <span className="font-semibold">{getFarmer(selectedTask.reviewedBy ?? "")?.name ?? selectedTask.reviewedBy}</span> on {new Date(selectedTask.reviewedAt).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })}</span>
                    </div>
                  )}

                  {/* ── Worker assignment section ──────────────────────── */}
                  <div className="rounded-lg border border-border overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 bg-muted border-b border-border">
                      <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Users className="size-3.5 text-muted-foreground" /> Workers on this task
                      </span>
                      {selectedTask.status !== "done" && (
                        <button onClick={() => setAssignWorkerOpen(p => !p)}
                          className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:text-primary/80 transition-colors">
                          <UserPlus className="size-3.5" /> Assign worker
                        </button>
                      )}
                    </div>

                    {/* Inline assignment form */}
                    {assignWorkerOpen && (
                      <div className="px-3 py-2.5 bg-primary/10 border-b border-primary/30 flex items-center gap-2 flex-wrap">
                        <select
                          value={newWorker.farmerId}
                          onChange={e => setNewWorker(p => ({ ...p, farmerId: e.target.value }))}
                          className="flex-1 min-w-32 border border-border rounded-md px-2 py-1.5 text-xs bg-card"
                        >
                          <option value="">— Pick farmer —</option>
                          {FARMERS_ONLY.map(f => (
                            <option key={f.id} value={f.id}>{f.name}</option>
                          ))}
                        </select>
                        <select
                          value={newWorker.shift}
                          onChange={e => setNewWorker(p => ({ ...p, shift: e.target.value as TaskWorkerAssignment["shift"] }))}
                          className="border border-border rounded-md px-2 py-1.5 text-xs bg-card"
                        >
                          {options.shifts.map(s => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                          ))}
                        </select>
                        <Button size="sm" className="h-7 text-xs bg-primary hover:bg-primary/90 px-3"
                          onClick={addWorkerToTask} disabled={!newWorker.farmerId}>
                          Add
                        </Button>
                        <button onClick={() => setAssignWorkerOpen(false)} className="text-muted-foreground hover:text-foreground">
                          <X className="size-4" />
                        </button>
                      </div>
                    )}

                    {/* Worker list */}
                    <div className="divide-y divide-border">
                      {(selectedTask.workerAssignments ?? []).length === 0 && (
                        <div className="px-3 py-4 text-center text-xs text-muted-foreground">No workers assigned yet</div>
                      )}
                      {(selectedTask.workerAssignments ?? []).map(wa => {
                        const farmer = getFarmer(wa.farmerId);
                        return (
                          <div key={wa.farmerId} className="flex items-center gap-3 px-3 py-2">
                            <Avatar className="size-7 shrink-0">
                              <AvatarFallback className="bg-muted text-muted-foreground text-[10px] font-bold">{farmer?.avatar}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-semibold text-foreground">{farmer?.name}</div>
                              <div className="text-[10px] text-muted-foreground capitalize">{farmer?.role}</div>
                            </div>
                            <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full font-semibold shrink-0">
                              {shiftLabel(wa.shift)}
                            </span>
                            {selectedTask.status !== "done" && (
                              <button onClick={() => removeWorkerFromTask(wa.farmerId)}
                                className="size-5 rounded hover:bg-red-50 grid place-items-center transition-colors shrink-0">
                                <Trash2 className="size-3 text-muted-foreground hover:text-red-500" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* ── Progress notes timeline ───────────────────────── */}
                  {(selectedTask.progressNotes ?? []).length > 0 && (
                    <div className="rounded-lg border border-border overflow-hidden">
                      <div className="px-3 py-2 bg-muted border-b border-border">
                        <span className="text-xs font-semibold text-foreground">Progress Notes</span>
                      </div>
                      <div className="divide-y divide-border">
                        {(selectedTask.progressNotes as ProgressNote[]).map((pn, i) => {
                          const noteAuthor = getFarmer(pn.by);
                          return (
                            <div key={i} className="flex items-start gap-3 px-3 py-2.5">
                              <Avatar className="size-6 shrink-0 mt-0.5">
                                <AvatarFallback className="bg-blue-100 text-blue-700 text-[9px] font-bold">{noteAuthor?.avatar ?? pn.by.slice(0, 2).toUpperCase()}</AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <span className="text-[11px] font-semibold text-foreground">{noteAuthor?.name ?? pn.by}</span>
                                  <span className="text-[10px] text-muted-foreground">{new Date(pn.at).toLocaleDateString("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                                </div>
                                <p className="text-xs text-foreground/80">{pn.note}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Add progress note (shown when task not done) */}
                  {selectedTask.status !== "done" && (
                    <div>
                      <label className="text-xs font-semibold text-foreground/80 block mb-1.5">Add Progress Note</label>
                      <div className="flex gap-2">
                        <input
                          value={progressNoteInput}
                          onChange={e => setProgressNoteInput(e.target.value)}
                          placeholder="Describe progress, issues encountered…"
                          className="flex-1 border border-border rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addProgressNote(selectedTask.id, progressNoteInput); } }}
                        />
                        <Button size="sm" variant="outline" className="text-xs shrink-0"
                          disabled={!progressNoteInput.trim()}
                          onClick={() => addProgressNote(selectedTask.id, progressNoteInput)}>
                          Add
                        </Button>
                      </div>
                    </div>
                  )}

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
                              <div className="text-xs font-semibold text-foreground">📩 Send Reminder</div>
                              <div className="text-[10px] text-muted-foreground">Notify {getFarmer(selectedTask.assignedTo)?.name.split(" ")[0]} about this overdue task</div>
                              {selectedTask.overdueNotifiedAt && (
                                <div className="text-[10px] text-primary mt-0.5">
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
                            <div className="text-xs font-semibold text-foreground mb-1.5">⏰ Extend Deadline</div>
                            <div className="flex gap-2">
                              <input type="date" value={extendDate}
                                min={TODAY}
                                onChange={e => setExtendDate(e.target.value)}
                                className="flex-1 border border-border rounded-md px-2 py-1.5 text-xs" />
                              <Button size="sm" className="text-xs bg-amber-500 hover:bg-amber-600 shrink-0"
                                disabled={!extendDate} onClick={saveExtendDeadline}>
                                Save
                              </Button>
                            </div>
                          </div>

                          {/* Penalty note */}
                          <div>
                            <div className="text-xs font-semibold text-foreground mb-1.5">⚠️ Penalty / Escalation Note</div>
                            {selectedTask.managerNote && (
                              <div className="mb-1.5 text-[11px] bg-red-100 text-red-800 border border-red-200 rounded px-2 py-1.5 italic">
                                &ldquo;{selectedTask.managerNote}&rdquo;
                              </div>
                            )}
                            <div className="flex gap-2">
                              <input value={managerNote}
                                onChange={e => setManagerNote(e.target.value)}
                                placeholder="Note penalty, escalation reason…"
                                className="flex-1 border border-border rounded-md px-2 py-1.5 text-xs" />
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
                        <label className={`text-xs font-semibold block mb-1.5 ${selectedTask.requiresImageProof ? "text-purple-700" : "text-foreground/80"}`}>
                          Completion Photo {selectedTask.requiresImageProof
                            ? <span className="text-red-500">* (Required)</span>
                            : <span className="text-muted-foreground font-normal">(Optional)</span>}
                        </label>
                        <input ref={proofInputRef} type="file" accept="image/*" capture="environment"
                          className="hidden" onChange={handleProofUpload} />
                        {proofImage ? (
                          <div className="relative rounded-lg overflow-hidden border border-border">
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
                            className={`w-full flex flex-col items-center gap-2 p-4 rounded-lg border-2 border-dashed transition-colors ${selectedTask.requiresImageProof ? "border-purple-300 bg-purple-50 hover:bg-purple-100" : "border-border bg-muted hover:bg-accent"}`}>
                            <Upload className={`size-5 ${selectedTask.requiresImageProof ? "text-purple-400" : "text-muted-foreground"}`} />
                            <div className="text-xs text-muted-foreground">
                              <span className={`font-semibold ${selectedTask.requiresImageProof ? "text-purple-600" : "text-foreground/80"}`}>Click to upload</span> or take a photo
                            </div>
                            <div className="text-[10px] text-muted-foreground">JPG, PNG, HEIC — max 10 MB</div>
                          </button>
                        )}
                      </div>

                      {/* Start / Complete buttons */}
                      {!showCompleteForm && (
                        <div className="flex gap-2">
                          {selectedTask.status === "pending" && (
                            <Button variant="outline" className="flex-1 text-sm"
                              onClick={() => startTask(selectedTask.id)}>
                              <Clock className="size-3.5 mr-1.5" /> Start Task
                            </Button>
                          )}
                          <Button className="flex-1 bg-primary hover:bg-primary/90 text-sm"
                            onClick={() => setShowCompleteForm(true)}>
                            <CheckCircle2 className="size-3.5 mr-1.5" /> Mark Complete
                          </Button>
                        </div>
                      )}

                      {/* Inline complete form */}
                      {showCompleteForm && (
                        <div className="rounded-lg border border-primary/30 bg-primary/10 p-3 space-y-3">
                          <div className="text-xs font-semibold text-primary">Complete Task</div>
                          <div>
                            <label className="text-xs font-semibold text-foreground/80 block mb-1">Completion note</label>
                            <Textarea
                              value={completionNoteInput}
                              onChange={e => setCompletionNoteInput(e.target.value)}
                              placeholder="Describe what was completed, any notes…"
                              className="text-sm resize-none" rows={3}
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button className="flex-1 bg-primary hover:bg-primary/90 text-sm"
                              disabled={selectedTask.requiresImageProof && !proofImage}
                              onClick={() => completeTask(selectedTask.id, completionNoteInput, proofImage ?? undefined)}>
                              <CheckCircle2 className="size-3.5 mr-1.5" /> Confirm Complete
                            </Button>
                            <Button variant="outline" className="text-sm" onClick={() => setShowCompleteForm(false)}>
                              Cancel
                            </Button>
                          </div>
                          {selectedTask.requiresImageProof && !proofImage && (
                            <p className="text-[11px] text-purple-600 -mt-1">Upload a proof photo to complete this task</p>
                          )}
                        </div>
                      )}

                      {!showCompleteForm && selectedTask.requiresImageProof && !proofImage && (
                        <p className="text-[11px] text-purple-600 text-center -mt-2">Upload a proof photo to complete this task</p>
                      )}
                    </>
                  )}

                  {/* Done state proof */}
                  {selectedTask.status === "done" && selectedTask.proofImageUrl && (
                    <div>
                      <div className="text-xs font-semibold text-foreground/80 mb-2">Completion Photo</div>
                      <div className="relative rounded-lg overflow-hidden border border-border">
                        <img src={selectedTask.proofImageUrl} alt="Proof" className="w-full max-h-48 object-cover" />
                        <button onClick={() => setPreviewUrl(selectedTask.proofImageUrl!)}
                          className="absolute top-2 right-2 size-7 rounded-full bg-black/60 text-white grid place-items-center hover:bg-black/80">
                          <Eye className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ── Manager approval section ──────────────────────── */}
                  {isManager && selectedTask.status === "done" && !selectedTask.reviewedAt && (
                    <div className="rounded-lg border border-primary/30 overflow-hidden">
                      <div className="px-3 py-2 bg-primary/10 border-b border-primary/30">
                        <span className="text-xs font-semibold text-primary">Manager Review</span>
                      </div>
                      <div className="p-3 space-y-3">
                        {!requestCorrectionOpen ? (
                          <div className="flex gap-2">
                            <Button className="flex-1 bg-primary hover:bg-primary/90 text-sm"
                              onClick={() => approveTask(selectedTask.id)}>
                              <CheckCircle2 className="size-3.5 mr-1.5" /> Approve
                            </Button>
                            <Button variant="outline" className="flex-1 text-sm border-amber-300 text-amber-700 hover:bg-amber-50"
                              onClick={() => {
                                setRequestCorrectionOpen(true);
                                setCorrectionForm(p => ({
                                  ...p,
                                  title: `Correction: ${selectedTask.title}`,
                                  assignedTo: SUPERVISORS_AND_MANAGERS[0]?.id ?? "",
                                }));
                              }}>
                              Request Correction
                            </Button>
                          </div>
                        ) : (
                          <div className="space-y-2.5">
                            <div className="text-xs font-semibold text-amber-800">Create Correction Task</div>
                            <div>
                              <label className="text-[11px] font-semibold text-foreground/80 block mb-1">Title</label>
                              <input
                                value={correctionForm.title}
                                onChange={e => setCorrectionForm(p => ({ ...p, title: e.target.value }))}
                                className="w-full border border-border rounded-md px-2 py-1.5 text-xs"
                              />
                            </div>
                            <div>
                              <label className="text-[11px] font-semibold text-foreground/80 block mb-1">Description</label>
                              <Textarea
                                value={correctionForm.description}
                                onChange={e => setCorrectionForm(p => ({ ...p, description: e.target.value }))}
                                placeholder="What needs to be corrected?"
                                rows={2}
                                className="text-xs resize-none"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[11px] font-semibold text-foreground/80 block mb-1">Assign to</label>
                                <select
                                  value={correctionForm.assignedTo}
                                  onChange={e => setCorrectionForm(p => ({ ...p, assignedTo: e.target.value }))}
                                  className="w-full border border-border rounded-md px-2 py-1.5 text-xs bg-card"
                                >
                                  {SUPERVISORS_AND_MANAGERS.map(f => (
                                    <option key={f.id} value={f.id}>{f.name}</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="text-[11px] font-semibold text-foreground/80 block mb-1">Due date</label>
                                <input
                                  type="date"
                                  value={correctionForm.dueDate}
                                  onChange={e => setCorrectionForm(p => ({ ...p, dueDate: e.target.value }))}
                                  className="w-full border border-border rounded-md px-2 py-1.5 text-xs"
                                />
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button className="flex-1 bg-amber-500 hover:bg-amber-600 text-sm"
                                onClick={() => submitCorrection(selectedTask.id)}>
                                Create Task
                              </Button>
                              <Button variant="outline" className="text-sm"
                                onClick={() => setRequestCorrectionOpen(false)}>
                                Cancel
                              </Button>
                            </div>
                          </div>
                        )}
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
                  <label className="text-xs font-semibold text-foreground/80 block mb-1">Title <span className="text-red-500">*</span></label>
                  <input value={newTask.title}
                    onChange={e => setNewTask(p => ({ ...p, title: e.target.value }))}
                    placeholder="e.g. Apply fungicide to Zone A-BED-03"
                    className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground/80 block mb-1">Instructions</label>
                  <Textarea value={newTask.description}
                    onChange={e => setNewTask(p => ({ ...p, description: e.target.value }))}
                    placeholder="Step-by-step instructions…" rows={3} className="text-sm resize-none" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {/* Managers assign to supervisors; supervisors are assigned to themselves */}
                  {isManager && (
                    <div>
                      <label className="text-xs font-semibold text-foreground/80 block mb-1">Assign to</label>
                      <select value={newTask.assignedTo}
                        onChange={e => setNewTask(p => ({ ...p, assignedTo: e.target.value }))}
                        className="w-full border border-border rounded-md px-3 py-2 text-sm bg-card">
                        {SUPERVISORS.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="text-xs font-semibold text-foreground/80 block mb-1">Due Date</label>
                    <input type="date" value={newTask.dueDate}
                      onChange={e => setNewTask(p => ({ ...p, dueDate: e.target.value }))}
                      className="w-full border border-border rounded-md px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-foreground/80 block mb-1">Priority</label>
                    <select value={newTask.priority}
                      onChange={e => setNewTask(p => ({ ...p, priority: e.target.value as Task["priority"] }))}
                      className="w-full border border-border rounded-md px-3 py-2 text-sm bg-card">
                      {options.taskPriorities.map(p => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-foreground/80 block mb-1">Category</label>
                    <select value={newTask.category}
                      onChange={e => setNewTask(p => ({ ...p, category: e.target.value as Task["category"] }))}
                      className="w-full border border-border rounded-md px-3 py-2 text-sm bg-card">
                      {options.taskCategories.map(c => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Require photo proof */}
                <button type="button" onClick={() => setRequireImageNew(p => !p)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left ${requireImageNew ? "border-purple-500 bg-purple-50" : "border-border bg-card hover:border-border/60"}`}>
                  <div className={`size-5 rounded border-2 grid place-items-center shrink-0 transition-colors ${requireImageNew ? "bg-purple-500 border-purple-500" : "border-muted-foreground/40"}`}>
                    {requireImageNew && <CheckCircle2 className="size-3 text-white" />}
                  </div>
                  <div>
                    <div className={`text-xs font-semibold ${requireImageNew ? "text-purple-800" : "text-foreground/80"}`}>Require photo proof on completion</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">Supervisor must upload a photo to mark this task as done</div>
                  </div>
                  <ImageIcon className={`size-4 ml-auto shrink-0 ${requireImageNew ? "text-purple-500" : "text-muted-foreground/40"}`} />
                </button>

                {/* Require follow-up — only managers set follow-ups on supervisor tasks */}
                {isManager && (
                  <div>
                    <button type="button" onClick={() => setRequireFollowUpNew(p => !p)}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left ${requireFollowUpNew ? "border-amber-400 bg-amber-50" : "border-border bg-card hover:border-border/60"}`}>
                      <div className={`size-5 rounded border-2 grid place-items-center shrink-0 transition-colors ${requireFollowUpNew ? "bg-amber-400 border-amber-400" : "border-muted-foreground/40"}`}>
                        {requireFollowUpNew && <CheckCircle2 className="size-3 text-white" />}
                      </div>
                      <div>
                        <div className={`text-xs font-semibold ${requireFollowUpNew ? "text-amber-800" : "text-foreground/80"}`}>Schedule a follow-up reminder</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">Auto-creates a follow-up to verify task was completed properly</div>
                      </div>
                      <Bell className={`size-4 ml-auto shrink-0 ${requireFollowUpNew ? "text-amber-500" : "text-muted-foreground/40"}`} />
                    </button>
                    {requireFollowUpNew && (
                      <div className="mt-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                        <label className="text-xs font-semibold text-amber-800 block mb-1">Follow-up due date</label>
                        <input type="date" value={followUpDateNew}
                          onChange={e => setFollowUpDateNew(e.target.value)}
                          className="w-full border border-amber-200 rounded-md px-3 py-1.5 text-sm bg-card" />
                        <p className="text-[10px] text-amber-700 mt-1.5">A follow-up will appear in the Follow-ups tab assigned to you on this date.</p>
                      </div>
                    )}
                  </div>
                )}

                <Button onClick={createTask} disabled={!newTask.title}
                  className="w-full bg-primary hover:bg-primary/90 gap-2">
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
