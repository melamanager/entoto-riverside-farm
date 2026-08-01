"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { toast } from "sonner";
import type { OptionKey, SelectOption } from "@/lib/options";
import { refreshOptions } from "@/lib/use-options";

// Full CRUD for one manager-editable list (job titles, varieties, seed sources).
//
// Rename goes through /api/options/rename so the records still holding the old
// value are updated too — a rename that only touched the dropdown would orphan
// every bed/planting/staff member using it.
//
// Delete only removes it from the dropdown; existing records keep their value,
// so we show the usage count and warn before removing something in use.

export function OptionListEditor({
  optionKey, title, description, items, usage, metaField, onChanged,
}: {
  optionKey: OptionKey;
  title: string;
  description: string;
  items: SelectOption[];
  usage: Record<string, number>;
  metaField?: { key: string; label: string; placeholder: string };
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [metaDraft, setMetaDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);

  const input = "w-full border border-border rounded-md px-2.5 py-1.5 text-sm bg-card";

  async function writeList(next: SelectOption[]) {
    const res = await fetch("/api/options", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [optionKey]: next }),
    });
    if (!res.ok) { toast.error("Couldn't save the list"); return false; }
    refreshOptions();
    onChanged();
    return true;
  }

  async function add() {
    const name = draft.trim();
    if (!name) return;
    if (items.some(i => i.value.toLowerCase() === name.toLowerCase())) {
      toast.error(`"${name}" already exists`); return;
    }
    setBusy(true);
    const entry: SelectOption = { value: name, label: name };
    if (metaField && metaDraft.trim()) entry.meta = { [metaField.key]: metaDraft.trim() };
    const ok = await writeList([...items, entry]);
    setBusy(false);
    if (ok) { toast.success(`"${name}" added`); setDraft(""); setMetaDraft(""); setAdding(false); }
  }

  async function saveEdit(original: SelectOption) {
    const name = draft.trim();
    if (!name) return;
    const renamed = name !== original.value;
    if (renamed && items.some(i => i.value.toLowerCase() === name.toLowerCase())) {
      toast.error(`"${name}" already exists`); return;
    }
    setBusy(true);
    // 1) update the list itself (keeps position, updates meta)
    const next = items.map(i => i.value === original.value
      ? { ...i, value: name, label: name, ...(metaField ? { meta: { ...(i.meta ?? {}), [metaField.key]: metaDraft.trim() } } : {}) }
      : i);
    const ok = await writeList(next);
    // 2) carry the rename onto the records that reference it
    if (ok && renamed) {
      const res = await fetch("/api/options/rename", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: optionKey, from: original.value, to: name }),
      });
      const d = await res.json().catch(() => ({}));
      toast.success(d.updated ? `Renamed — ${d.updated} record(s) updated` : "Renamed");
    } else if (ok) {
      toast.success("Saved");
    }
    setBusy(false);
    setEditing(null);
  }

  async function remove(item: SelectOption) {
    const used = usage[item.value] ?? 0;
    const msg = used > 0
      ? `"${item.value}" is used by ${used} record(s). They keep the name, but it disappears from the dropdown. Remove it?`
      : `Remove "${item.value}" from the list?`;
    if (!confirm(msg)) return;
    setBusy(true);
    const ok = await writeList(items.filter(i => i.value !== item.value));
    setBusy(false);
    if (ok) toast.success(`"${item.value}" removed`);
  }

  return (
    <div className="rounded-xl border border-border p-4">
      <div className="flex items-start justify-between gap-3 mb-1">
        <div>
          <h3 className="font-semibold text-sm text-foreground">{title}</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">{description}</p>
        </div>
        <button onClick={() => { setAdding(true); setEditing(null); setDraft(""); setMetaDraft(""); }}
          className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-md border border-border hover:bg-accent">
          <Plus className="size-3.5" /> Add
        </button>
      </div>

      {adding && (
        <div className="mt-3 space-y-1.5 rounded-lg border border-primary/30 bg-primary/5 p-2.5">
          <input autoFocus value={draft} onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !metaField) add(); if (e.key === "Escape") setAdding(false); }}
            placeholder="Name" className={input} />
          {metaField && (
            <input value={metaDraft} onChange={e => setMetaDraft(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") add(); if (e.key === "Escape") setAdding(false); }}
              placeholder={metaField.placeholder} className={input} />
          )}
          <div className="flex gap-1.5">
            <button onClick={add} disabled={busy || !draft.trim()}
              className="text-xs font-semibold px-3 py-1.5 rounded-md bg-primary text-primary-foreground disabled:opacity-40">Save</button>
            <button onClick={() => setAdding(false)}
              className="text-xs font-semibold px-3 py-1.5 rounded-md border border-border hover:bg-accent">Cancel</button>
          </div>
        </div>
      )}

      <div className="mt-3 divide-y divide-border">
        {items.length === 0 && <div className="text-xs text-muted-foreground py-3">Nothing in this list yet.</div>}
        {items.map(item => {
          const used = usage[item.value] ?? 0;
          const isEditing = editing === item.value;
          return (
            <div key={item.value} className="py-2">
              {isEditing ? (
                <div className="space-y-1.5">
                  <input autoFocus value={draft} onChange={e => setDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !metaField) saveEdit(item); if (e.key === "Escape") setEditing(null); }}
                    className={input} />
                  {metaField && (
                    <input value={metaDraft} onChange={e => setMetaDraft(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") saveEdit(item); if (e.key === "Escape") setEditing(null); }}
                      placeholder={metaField.placeholder} className={input} />
                  )}
                  <div className="flex gap-1.5">
                    <button onClick={() => saveEdit(item)} disabled={busy}
                      className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-md bg-primary text-primary-foreground disabled:opacity-40">
                      <Check className="size-3.5" /> Save
                    </button>
                    <button onClick={() => setEditing(null)}
                      className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md border border-border hover:bg-accent">
                      <X className="size-3.5" /> Cancel
                    </button>
                  </div>
                  {used > 0 && (
                    <div className="text-[10px] text-amber-400">
                      Renaming also updates {used} existing record(s).
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-foreground truncate">{item.label}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {metaField && (
                        <>{metaField.label}: {String(item.meta?.[metaField.key] ?? "—")} · </>
                      )}
                      {used > 0 ? `used by ${used}` : "not used yet"}
                    </div>
                  </div>
                  <button title="Rename"
                    onClick={() => { setEditing(item.value); setAdding(false); setDraft(item.value); setMetaDraft(String(item.meta?.[metaField?.key ?? ""] ?? "")); }}
                    className="shrink-0 size-7 grid place-items-center rounded-md border border-border hover:bg-accent">
                    <Pencil className="size-3.5 text-muted-foreground" />
                  </button>
                  <button title="Remove" onClick={() => remove(item)}
                    className="shrink-0 size-7 grid place-items-center rounded-md border border-border hover:bg-red-500/10 hover:border-red-500/40">
                    <Trash2 className="size-3.5 text-red-400" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
