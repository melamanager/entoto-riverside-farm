"use client";

import { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Printer, QrCode, Layers, Droplets, Sprout } from "lucide-react";
import type { Valve, Bed, BedGroup } from "@/lib/types";

type Kind = "group" | "valve" | "bed";

/** "A-BED-01".."A-BED-04" → "Beds 1–4"; falls back to a plain list. */
function bedRangeLabel(bedIds: string[]): string {
  if (bedIds.length === 0) return "No beds";
  const nums = bedIds
    .map(id => Number((id.match(/(\d+)\s*$/) ?? [])[1]))
    .filter(n => Number.isFinite(n))
    .sort((a, b) => a - b);
  if (nums.length !== bedIds.length) return bedIds.join(", ");
  const contiguous = nums.every((n, i) => i === 0 || n === nums[i - 1] + 1);
  if (contiguous && nums.length > 1) return `Beds ${nums[0]}–${nums[nums.length - 1]}`;
  if (nums.length === 1) return `Bed ${nums[0]}`;
  return `Beds ${nums.join(", ")}`;
}

type Label = { key: string; url: string; code: string; title: string; titleAm?: string | null; sub: string; tint: string };

/**
 * Printable QR stakes.
 *
 * These get hammered into soil and live outdoors, so: error correction level H
 * (survives ~30% damage — mud, scuffs, a torn corner), a generous quiet zone,
 * and a size you can scan without kneeling down. The URL comes from the
 * server's configured public address, never from window.location — printing
 * from a laptop must not mint stakes pointing at localhost.
 */
export function QrSheet({ baseUrl }: { baseUrl: string }) {
  const [kind, setKind] = useState<Kind>("group");
  const [perRow, setPerRow] = useState<2 | 3>(2);
  const [valves, setValves] = useState<Valve[]>([]);
  const [groups, setGroups] = useState<BedGroup[]>([]);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/valves").then(r => (r.ok ? r.json() : [])),
      fetch("/api/bed-groups").then(r => (r.ok ? r.json() : [])),
      fetch("/api/beds").then(r => (r.ok ? r.json() : [])),
    ]).then(([v, g, b]) => {
      setValves(v as Valve[]);
      setGroups(g as BedGroup[]);
      setBeds(b as Bed[]);
      setLoaded(true);
    });
  }, []);

  const labels: Label[] = useMemo(() => {
    if (kind === "valve") {
      return valves.map(v => ({
        key: v.id,
        url: `${baseUrl}/scan/valve/${v.id}`,
        code: v.name.replace(/\s+/g, "").toUpperCase(),
        title: v.name,
        sub: `${beds.filter(b => b.valveId === v.id).length} beds · whole zone`,
        tint: v.color,
      }));
    }
    if (kind === "bed") {
      return beds.map(b => ({
        key: b.id,
        url: `${baseUrl}/scan/${b.id}`,
        code: b.id,
        title: b.id,
        sub: `${b.variety} · ${valves.find(v => v.id === b.valveId)?.name ?? ""}`,
        tint: valves.find(v => v.id === b.valveId)?.color ?? "#64748b",
      }));
    }
    return groups.map(g => ({
      key: g.id,
      url: `${baseUrl}/scan/group/${g.id}`,
      code: g.code,
      title: g.name,
      titleAm: g.nameAm,
      sub: `${valves.find(v => v.id === g.valveId)?.name ?? ""} · ${bedRangeLabel(g.bedIds ?? [])}`,
      tint: valves.find(v => v.id === g.valveId)?.color ?? "#64748b",
    }));
  }, [kind, valves, groups, beds, baseUrl]);

  // default to everything selected whenever the kind changes
  useEffect(() => { setPicked(new Set(labels.map(l => l.key))); }, [kind, labels.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const selected = labels.filter(l => picked.has(l.key));
  const qrPx = perRow === 2 ? 220 : 150;

  const toggle = (k: string) =>
    setPicked(prev => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n; });

  return (
    <div className="p-6 md:p-8 max-w-[1100px] mx-auto space-y-5">
      <style>{`
        @media print {
          @page { size: A4; margin: 12mm; }
          .qr-stakes { grid-template-columns: repeat(var(--per-row), 1fr) !important; }
          .qr-stake  { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>

      <div className="no-print">
        <div className="flex items-center gap-2 mb-1">
          <QrCode className="size-5 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">QR Stakes</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          Print, laminate, and attach to the stake. Codes use the highest error correction,
          so they still scan when muddy or scuffed.
        </p>
      </div>

      <Card className="p-4 no-print space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-lg border border-border overflow-hidden">
            {([
              { k: "group" as const, label: "Sub-groups", Icon: Layers },
              { k: "valve" as const, label: "Valves", Icon: Droplets },
              { k: "bed" as const, label: "Single beds", Icon: Sprout },
            ]).map(({ k, label, Icon }) => (
              <button key={k} onClick={() => setKind(k)}
                className={`px-3 py-1.5 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors ${
                  kind === k ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-accent"}`}>
                <Icon className="size-3.5" /> {label}
              </button>
            ))}
          </div>

          <div className="inline-flex rounded-lg border border-border overflow-hidden">
            {([2, 3] as const).map(n => (
              <button key={n} onClick={() => setPerRow(n)}
                className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                  perRow === n ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-accent"}`}>
                {n === 2 ? "Large (2 per row)" : "Medium (3 per row)"}
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-muted-foreground tabular-nums">{selected.length} selected</span>
            <Button size="sm" variant="outline" onClick={() => setPicked(new Set(labels.map(l => l.key)))}>All</Button>
            <Button size="sm" variant="outline" onClick={() => setPicked(new Set())}>None</Button>
            <Button size="sm" className="gap-1.5" onClick={() => window.print()} disabled={selected.length === 0}>
              <Printer className="size-3.5" /> Print
            </Button>
          </div>
        </div>

        {loaded && labels.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1 border-t border-border">
            {labels.map(l => (
              <button key={l.key} onClick={() => toggle(l.key)}
                className={`text-[11px] font-medium rounded-md border px-2 py-1 transition-colors ${
                  picked.has(l.key) ? "bg-primary/10 border-primary/40 text-primary" : "bg-card border-border text-muted-foreground"}`}>
                {l.code}
              </button>
            ))}
          </div>
        )}

        {loaded && labels.length === 0 && (
          <p className="text-sm text-muted-foreground pt-1 border-t border-border">
            {kind === "group"
              ? "No sub-groups defined yet — create them on the Bed Groups page first."
              : "Nothing to print here yet."}
          </p>
        )}
      </Card>

      {/* The sheet itself */}
      {/* On screen the sheet reflows to fit the device; `perRow` is a decision
          about the printed A4 page, applied in the @media print block above. */}
      <div
        className="qr-stakes grid gap-4"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", ["--per-row" as string]: perRow }}
      >
        {selected.map(l => (
          <div key={l.key}
            className="qr-stake border-2 border-slate-800 rounded-xl p-4 flex flex-col items-center gap-2 bg-white text-slate-900">
            <div className="w-full flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: l.tint }}>
                {l.sub.split(" · ")[0]}
              </span>
              <span className="font-mono text-sm font-black">{l.code}</span>
            </div>

            {/* level H keeps it readable with a third of the code damaged */}
            <QRCodeSVG value={l.url} size={qrPx} level="H" marginSize={2} bgColor="#ffffff" fgColor="#0f172a"
              style={{ width: "100%", height: "auto", maxWidth: qrPx }} />

            <div className="text-center leading-tight">
              <div className={`font-black ${perRow === 2 ? "text-xl" : "text-base"}`}>{l.title}</div>
              {l.titleAm && <div className={`font-bold ${perRow === 2 ? "text-lg" : "text-sm"}`}>{l.titleAm}</div>}
              <div className={`text-slate-600 ${perRow === 2 ? "text-sm" : "text-xs"} mt-0.5`}>{l.sub}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
