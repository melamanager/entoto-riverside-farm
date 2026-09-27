"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Layers, Plus, Pencil, Trash2, User, QrCode, History, Droplets } from "lucide-react";
import { toast } from "sonner";
import type { Valve, Bed, BedGroup } from "@/lib/types";
import { useAuth } from "@/lib/auth";
import { useReference } from "@/lib/reference";

type Detail = BedGroup & {
  valve: { id: string; name: string; color: string };
  beds: Bed[];
  assignments: { id: string; farmerId: string; fromDate: string; toDate: string | null; farmer: { id: string; name: string } }[];
};

const EMPTY = { valveId: "", name: "", nameAm: "", code: "", note: "", bedIds: [] as string[], ownerId: "" };

/** "A-BED-01".."A-BED-04" → "Beds 1–4" */
function rangeLabel(bedIds: string[]): string {
  if (bedIds.length === 0) return "no beds";
  const nums = bedIds.map(id => Number((id.match(/(\d+)\s*$/) ?? [])[1])).filter(Number.isFinite).sort((a, b) => a - b);
  if (nums.length !== bedIds.length) return `${bedIds.length} beds`;
  const contiguous = nums.every((n, i) => i === 0 || n === nums[i - 1] + 1);
  if (contiguous && nums.length > 1) return `Beds ${nums[0]}–${nums[nums.length - 1]}`;
  return nums.length === 1 ? `Bed ${nums[0]}` : `Beds ${nums.join(", ")}`;
}

export default function BedGroupsPage() {
  const { isManager } = useAuth();
  const { farmers } = useReference();
  const [valves, setValves] = useState<Valve[]>([]);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [groups, setGroups] = useState<BedGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Detail | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const workers = farmers.filter(f => f.role !== "manager" && !f.archivedAt);

  async function load() {
    const [v, b, g] = await Promise.all([
      fetch("/api/valves").then(r => (r.ok ? r.json() : [])),
      fetch("/api/beds").then(r => (r.ok ? r.json() : [])),
      fetch("/api/bed-groups?all=1").then(r => (r.ok ? r.json() : [])),
    ]);
    setValves(v); setBeds(b); setGroups(g); setLoading(false);
  }
  useEffect(() => { load(); }, []);

  /** Beds free to join a group: same valve, not already taken (or already ours). */
  const availableBeds = useMemo(() => {
    const takenElsewhere = new Set(
      groups.filter(g => g.id !== editTarget?.id).flatMap(g => g.bedIds ?? []),
    );
    return beds.filter(b => b.valveId === form.valveId && !takenElsewhere.has(b.id));
  }, [beds, groups, form.valveId, editTarget]);

  function openCreate(valveId?: string) {
    const v = valveId ?? valves[0]?.id ?? "";
    const n = groups.filter(g => g.valveId === v).length + 1;
    const valveLetter = (valves.find(x => x.id === v)?.name ?? "A").replace(/[^A-Za-z]/g, "").slice(-1).toUpperCase();
    setForm({ ...EMPTY, valveId: v, name: `Sub-Group ${n}`, code: `${valveLetter}${n}` });
    setEditTarget(null);
    setCreateOpen(true);
  }

  async function openEdit(id: string) {
    const d: Detail = await fetch(`/api/bed-groups/${id}`).then(r => r.json());
    const owner = d.assignments.find(a => !a.toDate);
    setForm({
      valveId: d.valveId, name: d.name, nameAm: d.nameAm ?? "", code: d.code,
      note: d.note ?? "", bedIds: d.beds.map(b => b.id), ownerId: owner?.farmerId ?? "",
    });
    setEditTarget(d);
    setCreateOpen(true);
  }

  async function save() {
    if (!form.valveId) { toast.error("Choose a valve"); return; }
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    if (!form.code.trim()) { toast.error("A stake code is required"); return; }
    setSaving(true);
    const body = {
      valveId: form.valveId, name: form.name, nameAm: form.nameAm || null,
      code: form.code, note: form.note || null, bedIds: form.bedIds,
      ownerId: form.ownerId || null,
    };
    const res = editTarget
      ? await fetch(`/api/bed-groups/${editTarget.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      : await fetch("/api/bed-groups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setSaving(false);
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      toast.error(e.error ?? "Could not save the group", { description: e.detail });
      return;
    }
    toast.success(editTarget ? `${form.name} updated` : `${form.name} created`);
    setCreateOpen(false);
    setEditTarget(null);
    load();
  }

  async function remove(g: BedGroup) {
    const res = await fetch(`/api/bed-groups/${g.id}`, { method: "DELETE" });
    if (!res.ok) { toast.error("Could not delete the group"); return; }
    toast.success(`${g.name} deleted`, { description: "Its beds are free to regroup. Past records keep the group they were logged under." });
    load();
  }

  if (loading) return <div className="p-8 text-muted-foreground text-sm">Loading…</div>;

  if (!isManager) {
    return (
      <div className="p-8 max-w-md mx-auto text-center">
        <Layers className="size-10 text-muted-foreground/40 mx-auto mb-3" />
        <h1 className="font-bold text-foreground mb-1">Bed Groups</h1>
        <p className="text-sm text-muted-foreground">Only a manager can define the farm&rsquo;s bed groups.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-[1100px] mx-auto space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Layers className="size-5 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Bed Groups</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            The stretch of beds one worker is responsible for. Harvest, packaging and upkeep roll up to these.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/qr-codes">
            <Button variant="outline" size="sm" className="gap-1.5"><QrCode className="size-3.5" /> Print stakes</Button>
          </Link>
          <Button size="sm" className="gap-1.5" onClick={() => openCreate()}>
            <Plus className="size-3.5" /> New group
          </Button>
        </div>
      </div>

      {valves.map(v => {
        const mine = groups.filter(g => g.valveId === v.id);
        const grouped = new Set(mine.flatMap(g => g.bedIds ?? []));
        const loose = beds.filter(b => b.valveId === v.id && !grouped.has(b.id));
        return (
          <Card key={v.id} className="p-4">
            <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-sm" style={{ background: v.color }} />
                <span className="font-bold text-foreground">{v.name}</span>
                <Badge variant="outline" className="text-[10px]">
                  <Droplets className="size-3 mr-1" />{beds.filter(b => b.valveId === v.id).length} beds
                </Badge>
              </div>
              <Button size="sm" variant="outline" className="gap-1 h-7 text-[11px]" onClick={() => openCreate(v.id)}>
                <Plus className="size-3" /> Add group here
              </Button>
            </div>

            <div className="grid gap-2 md:grid-cols-2">
              {mine.map(g => (
                <div key={g.id} className={`border border-border rounded-lg p-3 ${g.active ? "" : "opacity-60"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-sm text-foreground truncate">
                        {g.name}{g.nameAm ? <span className="text-muted-foreground font-normal"> · {g.nameAm}</span> : null}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono font-semibold">{g.code}</span>
                        <span>·</span>
                        <span>{rangeLabel(g.bedIds ?? [])}</span>
                        {!g.active && <Badge variant="outline" className="text-[9px]">inactive</Badge>}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => openEdit(g.id)} title="Edit"
                        className="size-7 rounded-md bg-muted hover:bg-accent grid place-items-center">
                        <Pencil className="size-3 text-muted-foreground" />
                      </button>
                      <button onClick={() => remove(g)} title="Delete"
                        className="size-7 rounded-md bg-muted hover:bg-red-100 grid place-items-center">
                        <Trash2 className="size-3 text-muted-foreground" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-border flex items-center gap-1.5 text-[11px]">
                    <User className="size-3 text-muted-foreground" />
                    {g.owner
                      ? <><span className="font-medium text-foreground">{g.owner.name}</span>
                          <span className="text-muted-foreground">· since {g.ownerSince}</span></>
                      : <span className="text-amber-600 font-medium">Not assigned</span>}
                  </div>
                </div>
              ))}
              {mine.length === 0 && (
                <div className="text-xs text-muted-foreground md:col-span-2 py-2">No sub-groups here yet.</div>
              )}
            </div>

            {loose.length > 0 && (
              <div className="mt-3 pt-3 border-t border-border">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">
                  Not in a group ({loose.length})
                </div>
                <div className="flex flex-wrap gap-1">
                  {loose.map(b => (
                    <span key={b.id} className="text-[10px] font-mono border border-border rounded px-1.5 py-0.5 text-muted-foreground">
                      {b.id}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Card>
        );
      })}

      {/* ── Create / edit ─────────────────────────────────────────────────── */}
      <Dialog open={createOpen} onOpenChange={o => { if (!o) { setCreateOpen(false); setEditTarget(null); } }}>
        <DialogContent className="max-w-lg max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="size-4 text-primary" /> {editTarget ? `Edit ${editTarget.name}` : "New bed group"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Valve">
                <select className={inputCls} value={form.valveId} disabled={!!editTarget}
                  onChange={e => setForm(f => ({ ...f, valveId: e.target.value, bedIds: [] }))}>
                  <option value="">Select…</option>
                  {valves.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </Field>
              <Field label="Stake code" hint="unique farm-wide">
                <input className={inputCls} value={form.code}
                  onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="A1" />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Field label="Name">
                <input className={inputCls} value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Sub-Group A" />
              </Field>
              <Field label="Amharic name" hint="optional">
                <input className={inputCls} value={form.nameAm}
                  onChange={e => setForm(f => ({ ...f, nameAm: e.target.value }))} placeholder="ንዑስ ቡድን ሀ" />
              </Field>
            </div>

            <Field label="Responsible worker" hint="can be changed later; history is kept">
              <select className={inputCls} value={form.ownerId}
                onChange={e => setForm(f => ({ ...f, ownerId: e.target.value }))}>
                <option value="">Not assigned</option>
                {workers.map(w => <option key={w.id} value={w.id}>{w.name}{w.jobTitle ? ` — ${w.jobTitle}` : ""}</option>)}
              </select>
            </Field>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Beds in this group {form.bedIds.length > 0 && <span className="text-foreground font-semibold">({form.bedIds.length})</span>}
                </label>
                {availableBeds.length > 0 && (
                  <button type="button" className="text-[11px] font-semibold text-primary hover:underline"
                    onClick={() => setForm(f => ({ ...f, bedIds: f.bedIds.length === availableBeds.length ? [] : availableBeds.map(b => b.id) }))}>
                    {form.bedIds.length === availableBeds.length ? "Clear" : "Select all free"}
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                {availableBeds.map(b => {
                  const on = form.bedIds.includes(b.id);
                  return (
                    <button key={b.id} type="button"
                      onClick={() => setForm(f => ({ ...f, bedIds: on ? f.bedIds.filter(x => x !== b.id) : [...f.bedIds, b.id] }))}
                      className={`text-[11px] font-mono font-semibold rounded-md border px-2 py-1.5 transition-colors ${
                        on ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:bg-accent"}`}>
                      {b.id}
                    </button>
                  );
                })}
                {form.valveId && availableBeds.length === 0 && (
                  <span className="text-xs text-muted-foreground">Every bed on this valve is already in a group.</span>
                )}
                {!form.valveId && <span className="text-xs text-muted-foreground">Choose a valve first.</span>}
              </div>
            </div>

            <Field label="Note" hint="optional">
              <input className={inputCls} value={form.note}
                onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="Anything worth remembering" />
            </Field>

            {editTarget && editTarget.assignments.length > 0 && (
              <div className="border border-border rounded-lg p-2.5">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5 flex items-center gap-1">
                  <History className="size-3" /> Who was responsible
                </div>
                <div className="space-y-1">
                  {editTarget.assignments.map(a => (
                    <div key={a.id} className="text-[11px] flex items-center justify-between gap-2">
                      <span className="font-medium text-foreground">{a.farmer.name}</span>
                      <span className="text-muted-foreground tabular-nums">
                        {a.fromDate} → {a.toDate ?? "now"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Button className="w-full gap-2" onClick={save} disabled={saving}>
              <Layers className="size-4" /> {saving ? "Saving…" : editTarget ? "Save changes" : "Create group"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const inputCls = "w-full text-sm border border-border rounded-md px-2.5 py-2 bg-card text-foreground outline-none focus:ring-2 focus:ring-ring/40";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground block mb-1">
        {label}{hint && <span className="opacity-70"> · {hint}</span>}
      </label>
      {children}
    </div>
  );
}
