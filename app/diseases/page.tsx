"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Bug, Sparkles, Send, CheckCircle2, AlertTriangle, MessageSquare,
  Bell, BellOff, ChevronDown, ChevronUp, ClipboardList, Clock,
  Upload, ImageIcon, FileImage, ShieldCheck, X, Eye,
} from "lucide-react";
import { AIDetectDialog } from "@/components/ai-detect-dialog";
import { ManualReportDialog } from "@/components/manual-report-dialog";
import { DISEASE_LABELS, DISEASE_TREATMENT_STEPS, DISEASE_TREATMENTS } from "@/lib/types";
import type { DiseaseReport, Farmer, Bed, Valve } from "@/lib/types";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { useLang } from "@/lib/lang";
import { EN, AM } from "@/lib/translations";

export default function DiseasesPage() {
  const { isAm } = useLang();
  const t = isAm ? AM : EN;
  const { user, isManager, isSupervisor } = useAuth();
  const [diseases, setDiseases] = useState<DiseaseReport[]>([]);
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [valves, setValves] = useState<Valve[]>([]);

  useEffect(() => {
    fetch("/api/diseases").then(r => r.json()).then(setDiseases);
    fetch("/api/farmers").then(r => r.json()).then(setFarmers);
    fetch("/api/beds").then(r => r.json()).then(setBeds);
    fetch("/api/valves").then(r => r.json()).then(setValves);
  }, []);

  function refreshDiseases() {
    fetch("/api/diseases").then(r => r.json()).then(setDiseases);
  }

  function getBed(bedId: string): Bed | undefined {
    return beds.find(b => b.id === bedId);
  }

  function getFarmer(farmerId: string): Farmer | undefined {
    return farmers.find(f => f.id === farmerId);
  }

  function getValve(valveId: string): Valve | undefined {
    return valves.find(v => v.id === valveId);
  }

  // Manager: write recommendation dialog
  const [recommendOpen, setRecommendOpen] = useState(false);
  const [recommendTarget, setRecommendTarget] = useState<DiseaseReport | null>(null);
  const [recommendation, setRecommendation] = useState("");
  const [requireImage, setRequireImage] = useState(false);

  // Supervisor: confirm treatment dialog
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<DiseaseReport | null>(null);
  const [treatmentNote, setTreatmentNote] = useState("");
  const [checkedSteps, setCheckedSteps] = useState<Record<string, boolean[]>>({});
  const [proofImage, setProofImage] = useState<string | null>(null);
  const [proofImageName, setProofImageName] = useState("");
  const proofInputRef = useRef<HTMLInputElement>(null);

  // Expand treatment steps
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Preview proof image
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Flow 5: proof review before manager resolves
  const [proofReviewTarget, setProofReviewTarget] = useState<DiseaseReport | null>(null);

  // Filter diseases for supervisors — only beds in their assigned valves
  const supervisorValveIds = user?.assignedValves ?? [];
  const visibleDiseases = isSupervisor
    ? diseases.filter(d => {
        const bed = getBed(d.bedId);
        return bed && supervisorValveIds.includes(bed.valveId);
      })
    : diseases;

  const open = visibleDiseases.filter(d => d.status === "open");
  const notified = visibleDiseases.filter(d => d.status === "notified");
  const treating = visibleDiseases.filter(d => d.status === "treating");
  const resolved = visibleDiseases.filter(d => d.status === "resolved");

  /* ── Manager: send recommendation to supervisor ─────────────────────── */
  function openRecommend(d: DiseaseReport) {
    setRecommendTarget(d);
    setRecommendation(d.managerRecommendation ?? DISEASE_TREATMENTS[d.type]);
    setRequireImage(d.requiresImageProof ?? false);
    setRecommendOpen(true);
  }

  async function sendRecommendation() {
    if (!recommendTarget) return;

    const patchBody = {
      status: "notified" as const,
      managerNotified: true,
      notifiedAt: new Date().toISOString(),
      notificationChannels: ["telegram", "sms"] as Array<"telegram" | "sms">,
      managerRecommendation: recommendation,
      requiresImageProof: requireImage,
    };

    await fetch(`/api/diseases/${recommendTarget.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patchBody),
    });

    setDiseases(prev => prev.map(d =>
      d.id === recommendTarget.id ? { ...d, ...patchBody } : d
    ));

    // Flow 1: auto-create a task for the valve's supervisor
    const bed = getBed(recommendTarget.bedId);
    const valve = bed ? getValve(bed.valveId) : null;
    const supervisorId = valve?.supervisorId ?? "";
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `Treat ${DISEASE_LABELS[recommendTarget.type]} — ${recommendTarget.bedId}`,
        description: recommendation,
        assignedTo: supervisorId,
        createdBy: user?.id ?? "",
        bedId: recommendTarget.bedId,
        status: "pending",
        priority: recommendTarget.severity > 60 ? "high" : "medium",
        category: "disease",
        createdAt: new Date().toISOString(),
        dueDate: new Date(Date.now() + 86400000).toISOString().split("T")[0],
      }),
    });

    toast.success("Recommendation sent", {
      description: `📱 SMS & Telegram sent to supervisor. Task auto-created.${requireImage ? " Photo proof required." : ""}`,
      duration: 5000,
    });
    setRecommendOpen(false);
    setRecommendTarget(null);
  }

  function markResolved(d: DiseaseReport) {
    // Flow 5: if proof was required, make manager review it first
    if (d.requiresImageProof && d.proofImageUrl) {
      setProofReviewTarget(d);
      return;
    }
    if (d.requiresImageProof && !d.proofImageUrl) {
      toast.error("Cannot resolve — supervisor has not uploaded proof photo yet.");
      return;
    }
    confirmResolve(d.id);
  }

  async function confirmResolve(id: string) {
    await fetch(`/api/diseases/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "resolved" }),
    });
    setDiseases(prev => prev.map(d => d.id === id ? { ...d, status: "resolved" } : d));
    setProofReviewTarget(null);
    toast.success("Disease marked as resolved");
  }

  /* ── Supervisor: confirm treatment applied ───────────────────────────── */
  function openConfirm(d: DiseaseReport) {
    setConfirmTarget(d);
    setTreatmentNote(d.treatmentNote ?? "");
    setProofImage(d.proofImageUrl ?? null);
    setProofImageName("");
    setConfirmOpen(true);
  }

  function handleProofUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setProofImageName(file.name);
    const reader = new FileReader();
    reader.onload = ev => setProofImage(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function submitTreatment() {
    if (!confirmTarget || !user) return;

    const patchBody = {
      status: "treating" as const,
      treatmentApplied: true,
      treatmentAppliedAt: new Date().toISOString(),
      treatmentAppliedBy: user.id,
      treatmentNote: treatmentNote || "Treatment applied per manager's recommendation.",
      proofImageUrl: proofImage ?? undefined,
    };

    await fetch(`/api/diseases/${confirmTarget.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patchBody),
    });

    setDiseases(prev => prev.map(d =>
      d.id === confirmTarget.id ? { ...d, ...patchBody } : d
    ));

    toast.success("Treatment confirmed", {
      description: "Record saved. Manager will be notified to verify and close.",
    });
    setConfirmOpen(false);
    setConfirmTarget(null);
    setProofImage(null);
    setTreatmentNote("");
  }

  function toggleStep(diseaseId: string, stepIdx: number, total: number) {
    setCheckedSteps(prev => {
      const current = prev[diseaseId] ?? Array(total).fill(false);
      const next = [...current];
      next[stepIdx] = !next[stepIdx];
      return { ...prev, [diseaseId]: next };
    });
  }

  /* ── Status groups for rendering ────────────────────────────────────── */
  type StatusEntry = {
    key: DiseaseReport["status"];
    label: string;
    color: string;
    dot: string;
    border: string;
    strip: string;
    items: DiseaseReport[];
  };

  const STATUS_GROUPS: StatusEntry[] = [
    { key: "open",     label: t.diseases.groupOpen,     color: "text-red-700",     dot: "bg-red-500",     border: "border-red-200",     strip: "bg-red-500",     items: open },
    { key: "notified", label: t.diseases.groupNotified, color: "text-orange-700", dot: "bg-orange-500", border: "border-orange-200", strip: "bg-orange-500", items: notified },
    { key: "treating", label: t.diseases.groupTreating, color: "text-blue-700",   dot: "bg-blue-500",   border: "border-blue-200",   strip: "bg-blue-500",   items: treating },
    { key: "resolved", label: t.diseases.groupResolved, color: "text-emerald-700",dot: "bg-emerald-500",border: "border-emerald-200",strip: "bg-emerald-500",items: resolved },
  ];

  const visibleGroups = STATUS_GROUPS;

  return (
    <div className="p-6 md:p-8 max-w-[1400px] mx-auto space-y-6">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Bug className="size-5 text-red-600" />
            <h1 className="text-2xl font-bold text-foreground">{t.diseases.title}</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            {isSupervisor
              ? `Your zones · ${notified.length} pending treatment · ${treating.length} applied`
              : `${open.length + notified.length} active · ${treating.length} under treatment · ${resolved.length} resolved`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {(isManager || isSupervisor) && (
            <AIDetectDialog trigger={
              <Button className="gap-2 bg-amber-600 hover:bg-amber-700">
                <Sparkles className="size-4" /> {t.diseases.aiDetect}
              </Button>
            } />
          )}
          {(isManager || isSupervisor) && (
            <ManualReportDialog onReported={refreshDiseases} />
          )}
          {isSupervisor && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-700">
              <ShieldCheck className="size-3.5" />
              <span>Showing beds in your assigned valves only</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Summary cards ──────────────────────────────────────────────── */}
      <div className={`grid gap-3 ${isManager ? "grid-cols-4" : "grid-cols-3"}`}>
        {isManager && (
          <Card className="p-4 border-red-200 bg-red-50">
            <div className="text-2xl font-bold text-red-700">{open.length}</div>
            <div className="text-xs text-red-600 font-medium">{t.diseases.needsRecommendation}</div>
          </Card>
        )}
        <Card className="p-4 border-orange-200 bg-orange-50">
          <div className="text-2xl font-bold text-orange-700">{notified.length}</div>
          <div className="text-xs text-orange-600 font-medium">{isSupervisor ? t.diseases.pendingYourAction : t.diseases.awaitingTreatment}</div>
        </Card>
        <Card className="p-4 border-blue-200 bg-blue-50">
          <div className="text-2xl font-bold text-blue-700">{treating.length}</div>
          <div className="text-xs text-blue-600 font-medium">{isSupervisor ? t.diseases.treatmentApplied : t.diseases.underTreatment}</div>
        </Card>
        <Card className="p-4 border-emerald-200 bg-emerald-50">
          <div className="text-2xl font-bold text-emerald-700">{resolved.length}</div>
          <div className="text-xs text-emerald-600 font-medium">{t.diseases.groupResolved}</div>
        </Card>
      </div>

      {/* ── Status groups ──────────────────────────────────────────────── */}
      {visibleGroups.filter(g => g.items.length > 0).map(group => (
        <div key={group.key}>
          <div className="flex items-center gap-2 mb-3">
            <span className={`size-2 rounded-full ${group.dot}`} />
            <h2 className={`font-semibold text-sm ${group.color}`}>{group.label}</h2>
            <Badge variant="outline" className="text-[10px]">{group.items.length}</Badge>
          </div>

          <div className="space-y-3">
            {group.items.map(d => {
              const bed = getBed(d.bedId);
              const reporter = getFarmer(d.reportedBy);
              const applicator = d.treatmentAppliedBy ? getFarmer(d.treatmentAppliedBy) : null;
              const steps = d.treatmentSteps ?? DISEASE_TREATMENT_STEPS[d.type] ?? [];
              const stepChecks = checkedSteps[d.id] ?? Array(steps.length).fill(false);
              const doneSteps = stepChecks.filter(Boolean).length;
              const isExpanded = expandedId === d.id;

              return (
                <Card key={d.id} className={`border overflow-hidden ${group.border}`}>
                  <div className={`h-1 ${group.strip}`} />

                  <div className="p-5">
                    <div className="flex items-start gap-4 flex-wrap">
                      {/* ── Disease info ─────────────────────────────────── */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <Link href={`/beds/${d.bedId}`} className="font-mono font-bold text-foreground hover:text-primary">{d.bedId}</Link>
                          <span className="text-muted-foreground/40">·</span>
                          <span className="font-semibold text-foreground">{DISEASE_LABELS[d.type]}</span>
                          {d.aiConfidence && (
                            <Badge variant="outline" className="text-[10px] gap-0.5">
                              <Sparkles className="size-2.5 text-amber-500" /> AI {d.aiConfidence}%
                            </Badge>
                          )}
                          <Badge className={`text-[10px] capitalize ${
                            group.key === "open"     ? "bg-red-100 text-red-700 border-red-200 hover:bg-red-100" :
                            group.key === "notified" ? "bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-100" :
                            group.key === "treating" ? "bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100" :
                                                       "bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                          }`}>{group.key}</Badge>
                          {d.requiresImageProof && (
                            <Badge className="text-[10px] bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-100 gap-0.5">
                              <ImageIcon className="size-2.5" /> {t.diseases.photoRequired}
                            </Badge>
                          )}
                        </div>

                        <div className="text-xs text-muted-foreground mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span>{bed?.variety} · {bed?.valveId?.replace("valve-", "Zone ").toUpperCase()}</span>
                          <span>·</span>
                          <span>Reported by {reporter?.name}</span>
                          <span>·</span>
                          <span>{new Date(d.reportedAt).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })}</span>
                        </div>

                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-[11px] text-muted-foreground w-16">Severity</span>
                          <Progress value={d.severity} className="h-2 flex-1" />
                          <span className={`text-xs font-bold tabular-nums ${d.severity > 60 ? "text-red-600" : d.severity > 30 ? "text-amber-600" : "text-emerald-600"}`}>
                            {d.severity}%
                          </span>
                        </div>
                        {d.infectedLengthM !== undefined && d.infectedLengthM > 0 && (() => {
                          const bed = getBed(d.bedId);
                          const pct = bed ? Math.round((d.infectedLengthM / bed.lengthM) * 100) : null;
                          return (
                            <div className="flex items-center gap-2 mb-3">
                              <span className="text-[11px] text-muted-foreground w-16">Infected</span>
                              <div className="h-2 bg-muted rounded-full flex-1 overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${d.severity > 60 ? "bg-red-400" : d.severity > 30 ? "bg-amber-400" : "bg-emerald-400"}`}
                                  style={{ width: `${pct ?? 0}%` }}
                                />
                              </div>
                              <span className="text-xs font-bold tabular-nums text-foreground/80">
                                {d.infectedLengthM}m{pct !== null ? ` (${pct}%)` : ""}
                              </span>
                            </div>
                          );
                        })()}

                        {/* Manager recommendation block */}
                        {d.managerRecommendation && (
                          <div className="mb-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
                            <div className="flex items-center gap-1.5 mb-1">
                              <ShieldCheck className="size-3 text-amber-600" />
                              <span className="text-[11px] font-semibold text-amber-800">{t.diseases.managerRecommendation}</span>
                              {d.notifiedAt && (
                                <span className="text-[10px] text-amber-600 ml-auto">
                                  {new Date(d.notifiedAt).toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" })}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-amber-700 leading-relaxed">{d.managerRecommendation}</p>
                          </div>
                        )}

                        {/* Treatment applied info */}
                        {d.treatmentApplied && (
                          <div className="mt-2 space-y-1.5">
                            <div className="flex items-center gap-2 text-[11px] text-blue-700 bg-blue-50 px-2.5 py-1.5 rounded-md">
                              <CheckCircle2 className="size-3" />
                              <span>Applied by {applicator?.name} · {d.treatmentAppliedAt ? new Date(d.treatmentAppliedAt).toLocaleDateString("en", { month: "short", day: "numeric" }) : ""}</span>
                            </div>
                            {d.treatmentNote && (
                              <div className="text-[11px] text-foreground/70 italic bg-muted border border-border rounded px-2.5 py-1.5">
                                "{d.treatmentNote}"
                              </div>
                            )}
                            {d.proofImageUrl && (
                              <button
                                onClick={() => setPreviewUrl(d.proofImageUrl!)}
                                className="flex items-center gap-1.5 text-[11px] text-purple-700 bg-purple-50 border border-purple-200 px-2.5 py-1.5 rounded-md hover:bg-purple-100 transition-colors"
                              >
                                <FileImage className="size-3" /> View proof photo
                              </button>
                            )}
                          </div>
                        )}

                        {/* Not yet notified indicator */}
                        {!d.managerNotified && isManager && (
                          <div className="flex items-center gap-2 text-[11px] px-2.5 py-1.5 rounded-md bg-muted text-muted-foreground w-fit">
                            <BellOff className="size-3" /> Not yet reviewed by manager
                          </div>
                        )}
                      </div>

                      {/* ── Action buttons ───────────────────────────────── */}
                      <div className="flex flex-col gap-2 shrink-0 min-w-[200px]">
                        {/* Manager actions */}
                        {isManager && group.key === "open" && (
                          <Button
                            size="sm"
                            className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-xs w-full"
                            onClick={() => openRecommend(d)}
                          >
                            <MessageSquare className="size-3.5" /> {t.diseases.writeRecommendation}
                          </Button>
                        )}
                        {isManager && group.key === "treating" && (
                          <Button
                            size="sm"
                            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-xs w-full"
                            onClick={() => markResolved(d)}
                          >
                            <CheckCircle2 className="size-3.5" />
                            {d.requiresImageProof && d.proofImageUrl ? t.diseases.reviewResolve : t.diseases.markResolved}
                          </Button>
                        )}

                        {/* Supervisor actions */}
                        {isSupervisor && group.key === "notified" && (
                          <Button
                            size="sm"
                            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-xs w-full"
                            onClick={() => openConfirm(d)}
                          >
                            <CheckCircle2 className="size-3.5" /> {t.diseases.confirmTreatment}
                          </Button>
                        )}

                        {/* Always: expand protocol */}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-1.5 text-xs w-full text-muted-foreground"
                          onClick={() => setExpandedId(isExpanded ? null : d.id)}
                        >
                          <ClipboardList className="size-3.5" /> Protocol
                          {isExpanded ? <ChevronUp className="size-3 ml-auto" /> : <ChevronDown className="size-3 ml-auto" />}
                        </Button>
                      </div>
                    </div>

                    {/* ── Expandable treatment steps ───────────────────── */}
                    {isExpanded && (
                      <div className="mt-4 border-t border-border pt-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-sm font-semibold text-foreground">📋 Treatment Protocol</h4>
                          <div className="text-[11px] text-muted-foreground">{doneSteps}/{steps.length} steps completed</div>
                        </div>
                        <Progress value={(doneSteps / steps.length) * 100} className="h-1.5 mb-3" />
                        <div className="space-y-2">
                          {steps.map((step, i) => (
                            <button
                              key={i}
                              onClick={() => toggleStep(d.id, i, steps.length)}
                              className="flex items-start gap-3 w-full text-left group"
                            >
                              <div className={`size-5 rounded-full border-2 grid place-items-center shrink-0 mt-0.5 transition-colors ${stepChecks[i] ? "bg-primary border-primary" : "border-border group-hover:border-primary/60"}`}>
                                {stepChecks[i] && <CheckCircle2 className="size-3 text-white" />}
                              </div>
                              <span className={`text-sm leading-snug ${stepChecks[i] ? "line-through text-muted-foreground" : "text-foreground/80"}`}>
                                <strong className="text-muted-foreground text-[11px] mr-1">Step {i + 1}.</strong> {step}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      ))}

      {visibleGroups.every(g => g.items.length === 0) && (
        <div className="text-center py-16 text-muted-foreground">
          <Bug className="size-12 mx-auto mb-3 text-muted-foreground opacity-20" />
          <p className="text-sm">No disease records found for your assigned zones.</p>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* Manager: Write Recommendation Dialog                            */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <Dialog open={recommendOpen} onOpenChange={o => !o && setRecommendOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="size-4 text-blue-600" />
              Write Treatment Recommendation
            </DialogTitle>
          </DialogHeader>
          {recommendTarget && (
            <div className="space-y-4">
              {/* Disease summary */}
              <div className="bg-muted border border-border rounded-lg p-3 text-sm">
                <div className="font-semibold text-foreground">{DISEASE_LABELS[recommendTarget.type]}</div>
                <div className="text-muted-foreground text-xs mt-0.5">
                  Bed {recommendTarget.bedId} · Severity {recommendTarget.severity}% · Reported {new Date(recommendTarget.reportedAt).toLocaleDateString("en", { month: "short", day: "numeric" })}
                </div>
              </div>

              {/* Recommendation textarea */}
              <div>
                <label className="text-xs font-semibold text-foreground/80 block mb-1.5">
                  Treatment Recommendation <span className="text-red-500">*</span>
                </label>
                <Textarea
                  value={recommendation}
                  onChange={e => setRecommendation(e.target.value)}
                  placeholder="Describe exact treatment: chemicals, doses, application method, timing…"
                  rows={5}
                  className="text-sm resize-none"
                />
                <p className="text-[11px] text-muted-foreground mt-1">This will be sent to the assigned supervisor via SMS and Telegram.</p>
              </div>

              {/* Protocol steps preview */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="text-[11px] font-semibold text-blue-800 mb-1.5">📋 Standard Protocol ({DISEASE_TREATMENT_STEPS[recommendTarget.type].length} steps)</div>
                <div className="space-y-1">
                  {DISEASE_TREATMENT_STEPS[recommendTarget.type].slice(0, 3).map((s, i) => (
                    <div key={i} className="text-[11px] text-blue-700">Step {i + 1}: {s}</div>
                  ))}
                  {DISEASE_TREATMENT_STEPS[recommendTarget.type].length > 3 && (
                    <div className="text-[11px] text-blue-500">+{DISEASE_TREATMENT_STEPS[recommendTarget.type].length - 3} more steps…</div>
                  )}
                </div>
              </div>

              {/* Require image proof toggle */}
              <button
                type="button"
                onClick={() => setRequireImage(p => !p)}
                className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left ${requireImage ? "border-purple-500 bg-purple-50" : "border-border bg-card hover:border-border/60"}`}
              >
                <div className={`size-5 rounded border-2 grid place-items-center shrink-0 transition-colors ${requireImage ? "bg-purple-500 border-purple-500" : "border-border"}`}>
                  {requireImage && <CheckCircle2 className="size-3 text-white" />}
                </div>
                <div>
                  <div className={`text-xs font-semibold ${requireImage ? "text-purple-800" : "text-foreground/80"}`}>Require photo proof from supervisor</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">Supervisor must upload a photo when confirming treatment</div>
                </div>
                <ImageIcon className={`size-4 ml-auto shrink-0 ${requireImage ? "text-purple-500" : "text-muted-foreground/40"}`} />
              </button>

              <Button
                className="w-full bg-blue-600 hover:bg-blue-700 gap-2"
                disabled={!recommendation.trim()}
                onClick={sendRecommendation}
              >
                <Send className="size-4" /> Send Recommendation to Supervisor
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* Supervisor: Confirm Treatment Dialog                            */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <Dialog open={confirmOpen} onOpenChange={o => !o && setConfirmOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-600" />
              Confirm Treatment Applied
            </DialogTitle>
          </DialogHeader>
          {confirmTarget && (
            <div className="space-y-4">
              {/* Disease summary */}
              <div className="bg-muted border border-border rounded-lg p-3 text-sm">
                <div className="font-semibold text-foreground">{DISEASE_LABELS[confirmTarget.type]}</div>
                <div className="text-muted-foreground text-xs mt-0.5">
                  Bed {confirmTarget.bedId} · Severity {confirmTarget.severity}%
                </div>
              </div>

              {/* Manager's recommendation */}
              {confirmTarget.managerRecommendation && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <ShieldCheck className="size-3.5 text-amber-600" />
                    <span className="text-xs font-semibold text-amber-800">Manager's Instructions</span>
                  </div>
                  <p className="text-xs text-amber-700 leading-relaxed">{confirmTarget.managerRecommendation}</p>
                </div>
              )}

              {/* Treatment steps checklist */}
              <div>
                <div className="text-xs font-semibold text-foreground/80 mb-2">Treatment Protocol Checklist</div>
                <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                  {(confirmTarget.treatmentSteps ?? DISEASE_TREATMENT_STEPS[confirmTarget.type]).map((step, i) => {
                    const checks = checkedSteps[confirmTarget.id] ?? Array((confirmTarget.treatmentSteps ?? DISEASE_TREATMENT_STEPS[confirmTarget.type]).length).fill(false);
                    return (
                      <button
                        key={i}
                        onClick={() => toggleStep(confirmTarget.id, i, (confirmTarget.treatmentSteps ?? DISEASE_TREATMENT_STEPS[confirmTarget.type]).length)}
                        className="flex items-start gap-3 w-full text-left group"
                      >
                        <div className={`size-5 rounded-full border-2 grid place-items-center shrink-0 mt-0.5 transition-colors ${checks[i] ? "bg-primary border-primary" : "border-border group-hover:border-primary/60"}`}>
                          {checks[i] && <CheckCircle2 className="size-3 text-white" />}
                        </div>
                        <span className={`text-xs leading-snug ${checks[i] ? "line-through text-muted-foreground" : "text-foreground/80"}`}>
                          <strong className="text-muted-foreground text-[10px] mr-1">Step {i + 1}.</strong> {step}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Supervisor note */}
              <div>
                <label className="text-xs font-semibold text-foreground/80 block mb-1.5">
                  Treatment Note <span className="text-red-500">*</span>
                </label>
                <Textarea
                  value={treatmentNote}
                  onChange={e => setTreatmentNote(e.target.value)}
                  placeholder="Describe what was applied, quantities used, and any observations…"
                  rows={3}
                  className="text-sm resize-none"
                />
              </div>

              {/* Photo proof upload */}
              <div>
                <label className={`text-xs font-semibold block mb-1.5 ${confirmTarget.requiresImageProof ? "text-purple-700" : "text-foreground/80"}`}>
                  Photo Proof {confirmTarget.requiresImageProof ? <span className="text-red-500">* (Required by manager)</span> : "(Optional)"}
                </label>
                <input
                  ref={proofInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleProofUpload}
                />
                {proofImage ? (
                  <div className="relative rounded-lg overflow-hidden border border-border">
                    <img src={proofImage} alt="Proof" className="w-full max-h-40 object-cover" />
                    <div className="absolute top-2 right-2 flex gap-1">
                      <button
                        onClick={() => setPreviewUrl(proofImage)}
                        className="size-7 rounded-full bg-black/60 text-white grid place-items-center hover:bg-black/80"
                      >
                        <Eye className="size-3.5" />
                      </button>
                      <button
                        onClick={() => { setProofImage(null); setProofImageName(""); }}
                        className="size-7 rounded-full bg-black/60 text-white grid place-items-center hover:bg-black/80"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                    <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[10px] px-2 py-1 truncate">
                      {proofImageName}
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => proofInputRef.current?.click()}
                    className={`w-full flex flex-col items-center gap-2 p-4 rounded-lg border-2 border-dashed transition-colors ${confirmTarget.requiresImageProof ? "border-purple-300 bg-purple-50 hover:bg-purple-100" : "border-border bg-muted hover:bg-accent"}`}
                  >
                    <Upload className={`size-5 ${confirmTarget.requiresImageProof ? "text-purple-400" : "text-muted-foreground"}`} />
                    <div className="text-xs text-muted-foreground">
                      <span className={`font-semibold ${confirmTarget.requiresImageProof ? "text-purple-600" : "text-foreground/70"}`}>Click to upload</span> or take photo
                    </div>
                    <div className="text-[10px] text-muted-foreground">JPG, PNG, HEIC — max 10 MB</div>
                  </button>
                )}
              </div>

              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-700 gap-2"
                disabled={!treatmentNote || (confirmTarget.requiresImageProof && !proofImage)}
                onClick={submitTreatment}
              >
                <CheckCircle2 className="size-4" /> Confirm & Save Treatment Record
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* Flow 5: Manager reviews supervisor proof before resolving        */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <Dialog open={!!proofReviewTarget} onOpenChange={o => !o && setProofReviewTarget(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="size-4 text-purple-600" />
              Review Supervisor Proof Before Resolving
            </DialogTitle>
          </DialogHeader>
          {proofReviewTarget && (
            <div className="space-y-4">
              <div className="bg-muted border border-border rounded-lg p-3 text-sm">
                <div className="font-semibold text-foreground">{DISEASE_LABELS[proofReviewTarget.type]}</div>
                <div className="text-muted-foreground text-xs mt-0.5">Bed {proofReviewTarget.bedId} · Severity {proofReviewTarget.severity}%</div>
              </div>
              {proofReviewTarget.treatmentNote && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800 italic">
                  "{proofReviewTarget.treatmentNote}"
                </div>
              )}
              <div>
                <div className="text-xs font-semibold text-foreground/80 mb-2">Supervisor's Proof Photo</div>
                <img src={proofReviewTarget.proofImageUrl} alt="Treatment proof" className="w-full rounded-lg border border-border max-h-64 object-cover" />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setProofReviewTarget(null)}>Cancel</Button>
                <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700 gap-2"
                  onClick={() => confirmResolve(proofReviewTarget.id)}>
                  <CheckCircle2 className="size-4" /> Confirm Resolved
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Image preview lightbox ──────────────────────────────────────── */}
      {previewUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPreviewUrl(null)}
        >
          <div className="relative max-w-2xl w-full" onClick={e => e.stopPropagation()}>
            <img src={previewUrl} alt="Proof" className="w-full rounded-xl shadow-2xl" />
            <button
              onClick={() => setPreviewUrl(null)}
              className="absolute top-3 right-3 size-8 rounded-full bg-black/60 text-white grid place-items-center hover:bg-black/80"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
