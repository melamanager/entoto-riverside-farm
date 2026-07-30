"use client";

import { useState } from "react";
import { Plus, Check, X } from "lucide-react";
import { toast } from "sonner";
import type { OptionKey } from "@/lib/options";
import { refreshOptions } from "@/lib/use-options";

// A <select> backed by one of the manager-editable option lists
// (lib/options.ts → AppSetting "options.<key>"). A manager can add a new entry
// inline — no trip to Settings — so they can register a Driver, or a new seed
// variety, at the moment they need it.
//
// Non-managers just get the plain select.

export function ManagedSelect({
  optionKey, options, value, onChange, canEdit, onOptionsChanged,
  placeholder = "— Select —", allowEmpty = true, className = "",
}: {
  optionKey: OptionKey;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  canEdit: boolean;
  onOptionsChanged?: () => void;
  placeholder?: string;
  allowEmpty?: boolean;
  className?: string;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const base = className || "w-full border border-border rounded-md px-3 py-2 text-sm bg-card";

  async function save() {
    const name = draft.trim();
    if (!name) return;
    if (options.some(o => o.value.toLowerCase() === name.toLowerCase())) {
      toast.error(`"${name}" is already in the list`);
      return;
    }
    setSaving(true);
    const next = [...options.map(o => ({ value: o.value, label: o.label })), { value: name, label: name }];
    const res = await fetch("/api/options", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [optionKey]: next }),
    });
    setSaving(false);
    if (!res.ok) { toast.error("Couldn't save that option"); return; }
    toast.success(`"${name}" added`);
    onChange(name);       // select what they just created
    setDraft("");
    setAdding(false);
    refreshOptions();     // every useOptions consumer picks up the new entry
    onOptionsChanged?.();
  }

  if (adding) {
    return (
      <div className="flex gap-1.5">
        <input
          autoFocus
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter") { e.preventDefault(); save(); }
            if (e.key === "Escape") { setAdding(false); setDraft(""); }
          }}
          placeholder="Type a new name…"
          className={base}
        />
        <button type="button" onClick={save} disabled={saving || !draft.trim()}
          title="Save"
          className="shrink-0 px-2.5 rounded-md bg-primary text-primary-foreground disabled:opacity-40">
          <Check className="size-4" />
        </button>
        <button type="button" onClick={() => { setAdding(false); setDraft(""); }}
          title="Cancel"
          className="shrink-0 px-2.5 rounded-md border border-border text-muted-foreground hover:bg-accent">
          <X className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex gap-1.5">
      <select value={value} onChange={e => onChange(e.target.value)} className={base}>
        {allowEmpty && <option value="">{placeholder}</option>}
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {canEdit && (
        <button type="button" onClick={() => setAdding(true)}
          title="Add a new option to this list"
          className="shrink-0 px-2.5 rounded-md border border-border text-muted-foreground hover:bg-accent hover:text-foreground">
          <Plus className="size-4" />
        </button>
      )}
    </div>
  );
}
