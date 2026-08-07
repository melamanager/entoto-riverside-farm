"use client";

import { useMemo, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { Space_Grotesk, Space_Mono } from "next/font/google";
import type { Bed, Valve, GrowthStage, HealthStatus } from "@/lib/types";
import { useIsMobile } from "@/lib/use-mobile";

// Redesigned Farm Bed Map (from the "Farm bed map redesign" Claude Design
// project). Two layouts — aerial 2D field lanes and an iso 3D field — toggled
// live, plus Health/Yield/Stage recolouring, search, valve/crop filters, a bed
// detail drawer, clickable status cards, and bulk flagged-bed selection. Wired
// to the app's real beds/valves/harvest; "Assign task" creates a real task.
// `embed` renders a compact version (dashboard) without the toolbar/footer.

const grotesk = Space_Grotesk({ subsets: ["latin"], weight: ["400", "500", "600", "700"], display: "swap" });
const mono = Space_Mono({ subsets: ["latin"], weight: ["400", "700"], display: "swap" });

type ValveWithSup = Valve & { supervisorId?: string };
type Props = { valves: ValveWithSup[]; beds: Bed[]; harvestKgByBed: Record<string, number>; embed?: boolean };

const HEALTH: Record<HealthStatus, { c: string; l: string }> = {
  healthy: { c: "#35c46f", l: "Healthy" },
  warning: { c: "#f5a623", l: "Warning" },
  infected: { c: "#e5484d", l: "Infected" },
};
const STAGE: Record<GrowthStage, { c: string; l: string }> = {
  planted: { c: "#86efac", l: "Planted" },
  vegetative: { c: "#34d399", l: "Vegetative" },
  flowering: { c: "#a78bfa", l: "Flowering" },
  fruiting: { c: "#fbbf24", l: "Fruiting" },
  ripening: { c: "#fb7185", l: "Ripening" },
  harvest: { c: "#fb7185", l: "Harvest" },
};
const READY: Record<GrowthStage, number> = { planted: 8, vegetative: 28, flowering: 48, fruiting: 72, ripening: 90, harvest: 98 };
const RULER_MAX = 45;

function mix(a: string, b: string, t: number) {
  const p = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const [r1, g1, b1] = p(a), [r2, g2, b2] = p(b);
  const m = (x: number, y: number) => Math.round(x + (y - x) * t).toString(16).padStart(2, "0");
  return "#" + m(r1, r2) + m(g1, g2) + m(b1, b2);
}
function yieldColor(v: number) {
  return v >= 85 ? "#fb7185" : v >= 65 ? "#fbbf24" : v >= 40 ? "#84cc16" : v >= 15 ? "#4d7c5a" : "#3a4a3a";
}

type Mode = "health" | "yield" | "stage";
type View = "2d" | "3d";

export function FarmMap({ valves, beds, harvestKgByBed, embed = false }: Props) {
  const router = useRouter();
  const isMobile = useIsMobile();
  const [mode, setMode] = useState<Mode>("health");
  const [view, setView] = useState<View>("2d");
  // On a phone the filter row costs most of the first screen, so it is folded
  // away behind a toggle that shows how many filters are on.
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [valveF, setValveF] = useState<string[]>([]);
  const [cropF, setCropF] = useState<string[]>([]);
  const [statusF, setStatusF] = useState<HealthStatus[]>([]);
  const [readyF, setReadyF] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2600);
  };
  const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const bedColor = (b: Bed) =>
    mode === "health" ? HEALTH[b.health].c : mode === "stage" ? STAGE[b.stage].c : yieldColor(READY[b.stage]);
  const metricText = (b: Bed) =>
    mode === "health" ? HEALTH[b.health].l : mode === "stage" ? STAGE[b.stage].l : `${READY[b.stage]}% ready`;

  const isDim = (b: Bed) => {
    const q = query.trim().toLowerCase();
    if (q && !`${b.id} ${b.variety} ${b.crop ?? ""} ${b.valveId}`.toLowerCase().includes(q)) return true;
    if (valveF.length && !valveF.includes(b.valveId)) return true;
    if (cropF.length && !cropF.includes(b.crop ?? "Strawberry")) return true;
    if (statusF.length && !statusF.includes(b.health)) return true;
    if (readyF && b.stage !== "ripening" && b.stage !== "harvest") return true;
    return false;
  };

  const crops = useMemo(() => [...new Set(beds.map((b) => b.crop ?? "Strawberry"))], [beds]);
  const flagged = useMemo(() => beds.filter((b) => b.health !== "healthy"), [beds]);
  const supByValve = useMemo(() => Object.fromEntries(valves.map((v) => [v.id, v.supervisorId])), [valves]);

  // ── real action: create an inspection/treatment task for one or more beds ─
  async function assignTask(bedIds: string[]) {
    const first = beds.find((b) => b.id === bedIds[0]);
    if (!first) return;
    const assignee = supByValve[first.valveId];
    if (!assignee) { showToast("No supervisor set for this valve"); return; }
    const anyInfected = beds.some((b) => bedIds.includes(b.id) && b.health === "infected");
    const title = bedIds.length === 1
      ? `Inspect ${first.id} — ${first.variety}`
      : `Treat ${bedIds.length} flagged beds: ${bedIds.join(", ")}`;
    const res = await fetch("/api/tasks", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title, assignedTo: assignee, bedId: bedIds.length === 1 ? first.id : undefined, valveId: first.valveId,
        category: anyInfected ? "disease" : "inspection", priority: anyInfected ? "high" : "medium",
        description: `Raised from the farm map. ${bedIds.length === 1 ? `Bed ${first.id} (${first.variety}).` : `Beds: ${bedIds.join(", ")}.`}`,
      }),
    });
    if (!res.ok) { showToast("Couldn't create the task"); return; }
    showToast(bedIds.length === 1 ? `Task assigned for ${first.id}` : `Treatment task assigned to ${bedIds.length} beds`);
    setPicked([]);
  }

  const grouped = valves.map((v) => {
    const vb = beds.filter((b) => b.valveId === v.id).sort((a, b) => a.id.localeCompare(b.id));
    const ready = vb.filter((b) => b.stage === "ripening" || b.stage === "harvest").length;
    return { valve: v, beds: vb, ready };
  });

  const cnt = (h: HealthStatus) => beds.filter((b) => b.health === h).length;
  const readyCount = beds.filter((b) => b.stage === "ripening" || b.stage === "harvest").length;
  const selBed = sel ? beds.find((b) => b.id === sel) : null;
  const selValve = selBed ? valves.find((v) => v.id === selBed.valveId) : null;

  const chipStyle = (active: boolean) => active
    ? { background: "rgba(199,240,77,.14)", borderColor: "rgba(199,240,77,.4)", color: "#c7f04d" }
    : { background: "#0b0f09", borderColor: "rgba(180,200,160,.14)", color: "#93a68c" };

  const legendItems = mode === "health"
    ? [{ c: "#35c46f", l: "Healthy" }, { c: "#f5a623", l: "Warning" }, { c: "#e5484d", l: "Infected" }]
    : mode === "stage"
      ? [STAGE.vegetative, STAGE.flowering, STAGE.fruiting, STAGE.ripening].map((x) => ({ c: x.c, l: x.l }))
      : [{ c: "#3a4a3a", l: "Early" }, { c: "#84cc16", l: "Growing" }, { c: "#fbbf24", l: "Filling" }, { c: "#fb7185", l: "Ready" }];

  const modeBtns: { key: Mode; label: string; emoji: string }[] = [
    { key: "health", label: "Health", emoji: "🌿" },
    { key: "yield", label: "Yield", emoji: "🌾" },
    { key: "stage", label: "Stage", emoji: "🌸" },
  ];

  const summary = [
    { key: "healthy" as const, emoji: "🌿", label: "Healthy", count: cnt("healthy"), sub: "Routine inspection", color: "#35c46f", active: statusF.includes("healthy"), onClick: () => setStatusF((f) => toggle(f, "healthy")) },
    { key: "warning" as const, emoji: "⚠️", label: "Warning", count: cnt("warning"), sub: "Monitor this week", color: "#f5a623", active: statusF.includes("warning"), onClick: () => setStatusF((f) => toggle(f, "warning")) },
    { key: "infected" as const, emoji: "🦠", label: "Infected", count: cnt("infected"), sub: "Treat immediately", color: "#e5484d", active: statusF.includes("infected"), onClick: () => setStatusF((f) => toggle(f, "infected")) },
    { key: "ready" as const, emoji: "🍓", label: "Ready", count: readyCount, sub: "Harvest now", color: "#fb7185", active: readyF, onClick: () => setReadyF((r) => !r) },
  ];

  const segBtn = (active: boolean): CSSProperties => ({
    cursor: "pointer", border: "none", fontFamily: "inherit",
    fontSize: isMobile ? 12 : 13, fontWeight: 600,
    // taller tap target on touch, tighter horizontally so all five fit
    padding: isMobile ? "9px 10px" : "8px 13px",
    borderRadius: 9, transition: "all .15s", whiteSpace: "nowrap",
    color: active ? "#0e130c" : "#b7c7ad", background: active ? "#c7f04d" : "transparent",
  });

  const activeFilters =
    valveF.length + cropF.length + statusF.length + (readyF ? 1 : 0) + (query.trim() ? 1 : 0);
  const showFilters = !isMobile || filtersOpen;

  // The iso 3D field is a desktop view. At phone width you get a handful of
  // 40 m beds at a steep angle with unreadable labels, and CSS 3D reserves the
  // untransformed height so the field sinks below a screen of dead space.
  // The 2D aerial view shows the same data better, so it is authoritative here.
  const effectiveView: View = isMobile ? "2d" : view;

  return (
    <div className={grotesk.className} style={{ width: "100%", color: "#e7f0e2", background: "#0e130c", border: "1px solid rgba(180,200,160,.12)", borderRadius: 18, overflow: "hidden", boxShadow: "0 24px 60px -20px rgba(0,0,0,.6)" }}>
      <style>{`
        @keyframes fm-drawer{from{transform:translateX(24px);opacity:0}to{transform:translateX(0);opacity:1}}
        @keyframes fm-sheet{from{transform:translateY(100%)}to{transform:translateY(0)}}
        @keyframes fm-toast{from{transform:translateY(10px);opacity:0}to{transform:translateY(0);opacity:1}}
        @keyframes fm-pulse{0%,100%{box-shadow:0 0 0 0 rgba(229,72,77,.55)}50%{box-shadow:0 0 0 6px rgba(229,72,77,0)}}
        .fm-scroll::-webkit-scrollbar{width:8px;height:8px}
        .fm-scroll::-webkit-scrollbar-thumb{background:rgba(180,200,160,.18);border-radius:8px}
      `}</style>

      {/* ── Header: title · 2D/3D · Health/Yield/Stage ──────────────────── */}
      <div style={{ padding: embed ? "12px 14px" : isMobile ? "13px 13px 11px" : "18px 22px 14px", background: "linear-gradient(180deg,#131a10,#0e130c)", borderBottom: "1px solid rgba(180,200,160,.10)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: embed ? "flex-end" : "space-between", gap: isMobile ? 10 : 16, flexWrap: "wrap" }}>
          {!embed && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: isMobile ? 17 : 20, fontWeight: 700 }}>Farm Map</span>
                <span style={{ ...mono.style, fontSize: 10.5, color: "#0e130c", background: "#c7f04d", padding: "3px 8px", borderRadius: 999, fontWeight: 700 }}>{effectiveView === "2d" ? "Aerial field" : "3D field"}</span>
              </div>
              {!isMobile && (
                <div style={{ marginTop: 5, fontSize: 12.5, color: "#93a68c", ...mono.style }}>Entoto Mountain · Addis Ababa · 2800 m · 4.2 ha</div>
              )}
            </div>
          )}
          <div style={{ display: "flex", gap: isMobile ? 6 : 10, flexWrap: "wrap", width: isMobile && !embed ? "100%" : undefined }}>
            {/* 3D is desktop-only — see effectiveView above */}
            {!isMobile && (
              <div style={{ display: "flex", gap: 6, background: "#0b0f09", border: "1px solid rgba(180,200,160,.12)", padding: 4, borderRadius: 12 }}>
                <button onClick={() => setView("2d")} style={segBtn(view === "2d")}>🗺 2D</button>
                <button onClick={() => setView("3d")} style={segBtn(view === "3d")}>🧊 3D</button>
              </div>
            )}
            <div style={{ display: "flex", gap: 6, background: "#0b0f09", border: "1px solid rgba(180,200,160,.12)", padding: 4, borderRadius: 12, flex: isMobile ? 1 : undefined, justifyContent: "center" }}>
              {modeBtns.map((m) => (
                <button key={m.key} onClick={() => setMode(m.key)} style={{ display: "flex", alignItems: "center", gap: isMobile ? 3 : 6, ...segBtn(mode === m.key) }}>
                  <span style={{ fontSize: 14 }}>{m.emoji}</span>{isMobile ? "" : m.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Mobile: fold the filter row away behind a toggle */}
        {!embed && isMobile && (
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button
              onClick={() => setFiltersOpen((o) => !o)}
              style={{ flex: 1, cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 600, padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(180,200,160,.16)", background: "#0b0f09", color: activeFilters ? "#c7f04d" : "#b7c7ad" }}
            >
              ⌕ Search &amp; filters{activeFilters ? ` · ${activeFilters}` : ""} {filtersOpen ? "▲" : "▼"}
            </button>
            <button
              onClick={() => setPicked(flagged.map((b) => b.id))}
              style={{ cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 600, padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(245,166,35,.35)", color: "#f5c15a", background: "rgba(245,166,35,.10)", whiteSpace: "nowrap" }}
            >
              ⚑ {flagged.length}
            </button>
          </div>
        )}

        {!embed && showFilters && (
          <div style={{ display: "flex", alignItems: isMobile ? "stretch" : "center", flexDirection: isMobile ? "column" : "row", gap: 10, flexWrap: "wrap", marginTop: isMobile ? 10 : 14 }}>
            <div style={{ position: "relative", flex: 1, minWidth: 190 }}>
              <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#6f8168", fontSize: 13 }}>⌕</span>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search bed, crop, valve…"
                style={{ width: "100%", boxSizing: "border-box", background: "#0b0f09", border: "1px solid rgba(180,200,160,.14)", borderRadius: 10, padding: "9px 12px 9px 30px", color: "#e7f0e2", fontFamily: "inherit", fontSize: 13, outline: "none" }} />
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {valves.map((v) => {
                const s = chipStyle(valveF.includes(v.id));
                return <button key={v.id} onClick={() => setValveF((f) => toggle(f, v.id))} style={{ cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600, padding: "7px 11px", borderRadius: 9, border: `1px solid ${s.borderColor}`, color: s.color, background: s.background }}>{v.name}</button>;
              })}
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {crops.map((c) => {
                const s = chipStyle(cropF.includes(c));
                return <button key={c} onClick={() => setCropF((f) => toggle(f, c))} style={{ cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 500, padding: "7px 10px", borderRadius: 9, border: `1px solid ${s.borderColor}`, color: s.color, background: s.background }}>{c}</button>;
              })}
            </div>
            {!isMobile && (
              <button onClick={() => setPicked(flagged.map((b) => b.id))} style={{ marginLeft: "auto", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600, padding: "7px 12px", borderRadius: 9, border: "1px solid rgba(245,166,35,.35)", color: "#f5c15a", background: "rgba(245,166,35,.10)" }}>⚑ Select flagged ({flagged.length})</button>
            )}
          </div>
        )}
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div style={{ position: "relative" }}>
        {/* On a phone the 2D list grows naturally so the page scrolls once — a
            nested scroll box inside a scrolling page is a trap on touch.
            The 3D field still needs a bounded viewport: CSS 3D reserves the
            UNtransformed height, so an unbounded container leaves a screen of
            dead space above the foreshortened field. */}
        <div
          className="fm-scroll"
          style={{
            padding: isMobile ? 10 : 16,
            maxHeight: embed ? 460 : isMobile ? undefined : 660,
            overflow: isMobile ? "visible" : "auto",
          }}
        >

          {effectiveView === "2d" ? (
            <div style={{ position: "relative", padding: isMobile ? "14px 10px 8px" : "22px 24px 10px", background: "#181008", backgroundImage: "radial-gradient(rgba(255,255,255,.028) 1px, transparent 1px)", backgroundSize: "20px 20px", borderRadius: 14, border: "1px solid rgba(180,200,160,.09)" }}>
              <Compass mobile={isMobile} />
              {grouped.map(({ valve, beds: vb, ready }) => (
                <div key={valve.id} style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 0 8px 2px" }}>
                    <span style={{ width: 9, height: 9, borderRadius: 2, background: valve.color }} />
                    <span style={{ fontWeight: 700, color: valve.color, fontSize: 13 }}>{valve.name}</span>
                    <span style={{ ...mono.style, fontSize: 11, color: "#8a9a82" }}>{vb.length} beds · {ready} ready</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                    {vb.map((b) => {
                      const color = bedColor(b), dim = isDim(b), pick = picked.includes(b.id);
                      const plants = Math.round(b.lengthM * b.plantsPerMeter);
                      return (
                        <div key={b.id} onClick={() => setSel(b.id)} style={{ display: "flex", alignItems: "center", gap: isMobile ? 8 : 10, opacity: dim ? 0.16 : 1, cursor: "pointer", minWidth: 0 }}>
                          {/* nowrap + enough width for "A-BED-01" at this size,
                              otherwise the id wraps and doubles the row height */}
                          <span style={{ flex: "none", width: isMobile ? 54 : 52, ...mono.style, fontSize: isMobile ? 10.5 : 12, fontWeight: 700, color: "#b7c7ad", whiteSpace: "nowrap" }}>{b.id}</span>
                          {/* Mobile: the bar takes the room the fixed meta column used to
                              eat, and the meta text moves inside it — no more overflow. */}
                          <div style={{ position: "relative", height: isMobile ? 40 : 32, flex: isMobile ? 1 : undefined, width: isMobile ? undefined : `${Math.max(21, Math.round((b.lengthM / RULER_MAX) * 100))}%`, minWidth: isMobile ? 0 : 96, borderRadius: 7, background: mix(color, "#181008", 0.82), borderLeft: `5px solid ${color}`, overflow: "hidden", boxShadow: "0 2px 8px -3px rgba(0,0,0,.5)" }}>
                            <div style={{ position: "absolute", inset: 0, backgroundImage: "repeating-linear-gradient(90deg, rgba(255,255,255,.05) 0 2px, transparent 2px 15px)" }} />
                            {mode === "yield" && <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${READY[b.stage]}%`, background: `linear-gradient(90deg, ${color}44, ${color}14)` }} />}
                            {isMobile ? (
                              <div style={{ position: "absolute", inset: 0, padding: "0 8px 0 9px", display: "flex", flexDirection: "column", justifyContent: "center", gap: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 11, color: "#e7f0e2", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.variety}</div>
                                <div style={{ ...mono.style, fontSize: 9.5, color: "#a9baa1", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.lengthM}m · {plants.toLocaleString()} pl · {metricText(b)}</div>
                              </div>
                            ) : (
                              <>
                                <div style={{ position: "absolute", left: 10, top: 0, bottom: 0, display: "flex", alignItems: "center", fontSize: 11, color: "#e7f0e2", fontWeight: 500 }}>{b.variety}</div>
                                <div style={{ position: "absolute", right: 9, top: 0, bottom: 0, display: "flex", alignItems: "center", ...mono.style, fontSize: 11, color: "#cdd9c4" }}>{b.lengthM}m</div>
                              </>
                            )}
                            {b.health !== "healthy" && <div style={{ position: "absolute", right: isMobile ? 8 : 52, top: "50%", transform: "translateY(-50%)", width: 18, height: 18, borderRadius: "50%", background: color, color: "#fff", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", animation: "fm-pulse 2s infinite" }}>{b.health === "infected" ? "!" : "⚠"}</div>}
                          </div>
                          {!isMobile && (
                            <div style={{ flex: "none", width: 160, fontSize: 11.5, color: "#93a68c", ...mono.style }}>{plants.toLocaleString()} pl · {metricText(b)}</div>
                          )}
                          {!embed && <PickBox picked={pick} onToggle={(e) => { e.stopPropagation(); setPicked((p) => toggle(p, b.id)); }} big={isMobile} />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              {/* The ruler only means anything while bar length is proportional to
                  bed size. On mobile the bars are equal width so the labels fit, so
                  the scale is dropped and each bed states its own length instead. */}
              {!isMobile && (
                <div style={{ display: "flex", justifyContent: "space-between", margin: "6px 24px 0 70px", ...mono.style, fontSize: 10.5, color: "#7d8f75", borderTop: "1px dashed rgba(180,200,160,.16)", paddingTop: 5 }}>
                  <span>0m</span><span>10m</span><span>20m</span><span>30m</span><span>40m</span><span>45m</span>
                </div>
              )}
            </div>
          ) : (
            <div style={{ perspective: isMobile ? "1100px" : "1500px", perspectiveOrigin: isMobile ? "50% 50%" : "50% 22%", padding: isMobile ? "10px 6px 16px" : "26px 10px 56px", background: "#181008", backgroundImage: "radial-gradient(rgba(255,255,255,.028) 1px, transparent 1px)", backgroundSize: "20px 20px", borderRadius: 14, border: "1px solid rgba(180,200,160,.09)", overflow: "hidden" }}>
              <Compass mobile={isMobile} />
              {/* A shallower tilt keeps the beds readable on a small screen */}
              <div style={{ transform: isMobile ? "rotateX(46deg) rotateZ(-3deg)" : "rotateX(55deg) rotateZ(-4deg)", transformStyle: "preserve-3d", width: isMobile ? "94%" : "86%", margin: isMobile ? "14px auto 0" : "20px auto 0" }}>
                {grouped.map(({ valve, beds: vb, ready }) => (
                  <div key={valve.id} style={{ marginBottom: isMobile ? 18 : 30, transformStyle: "preserve-3d", position: "relative" }}>
                    <div style={{ position: "absolute", left: 0, top: -26, transform: "rotateZ(4deg) rotateX(-55deg)", transformOrigin: "left bottom", fontWeight: 700, color: valve.color, fontSize: 14, whiteSpace: "nowrap", textShadow: "0 2px 8px rgba(0,0,0,.6)" }}>{valve.name} <span style={{ ...mono.style, fontSize: 11, color: "#a9baa1", fontWeight: 400 }}>{vb.length} beds · {ready} ready</span></div>
                    <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 13 : 20, transformStyle: "preserve-3d" }}>
                      {vb.map((b) => {
                        const color = bedColor(b), dim = isDim(b), dark = mix(color, "#000000", 0.52);
                        return (
                          <div key={b.id} onClick={() => setSel(b.id)} style={{ position: "relative", height: 34, width: `${Math.max(21, Math.round((b.lengthM / RULER_MAX) * 100))}%`, minWidth: 120, opacity: dim ? 0.16 : 1, transformStyle: "preserve-3d", cursor: "pointer" }}>
                            <div style={{ position: "absolute", left: 0, right: 0, top: "100%", height: 18, background: dark, transformOrigin: "top center", transform: "rotateX(-90deg)", borderRadius: "0 0 3px 3px" }} />
                            <div style={{ position: "absolute", inset: 0, borderRadius: 6, background: color, borderLeft: `5px solid ${dark}`, boxShadow: "0 22px 28px -12px rgba(0,0,0,.75)", overflow: "hidden" }}>
                              <div style={{ position: "absolute", inset: 0, backgroundImage: "repeating-linear-gradient(90deg, rgba(0,0,0,.10) 0 2px, transparent 2px 14px)" }} />
                              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(255,255,255,.18), rgba(0,0,0,.10))" }} />
                            </div>
                            <div style={{ position: "absolute", left: 8, top: 2, transform: "rotateZ(4deg) rotateX(-55deg)", transformOrigin: "left top", ...mono.style, fontSize: 11, fontWeight: 700, color: "#fff", whiteSpace: "nowrap", textShadow: "0 2px 5px rgba(0,0,0,.7)", pointerEvents: "none" }}>{b.id} · {b.variety}</div>
                            {b.health !== "healthy" && <div style={{ position: "absolute", right: 6, top: -30, transform: "rotateZ(4deg) rotateX(-55deg)", transformOrigin: "center bottom", width: 22, height: 22, borderRadius: "50%", background: color, color: "#fff", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 12px rgba(0,0,0,.5)" }}>{b.health === "infected" ? "!" : "⚠"}</div>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Detail drawer ────────────────────────────────────────────── */}
        {/* Backdrop — only on the mobile bottom sheet, so a tap anywhere closes it */}
        {selBed && isMobile && (
          <div onClick={() => setSel(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", backdropFilter: "blur(2px)", zIndex: 45 }} />
        )}

        {selBed && (
          <div
            className="fm-scroll"
            style={isMobile
              // Bottom sheet, matching the app's existing mobile "more" menu.
              // Fixed above the mobile nav bar so its actions stay reachable.
              ? { position: "fixed", left: 0, right: 0, bottom: 0, maxHeight: "82vh", background: "#10160d", borderTop: "1px solid rgba(180,200,160,.14)", borderRadius: "22px 22px 0 0", boxShadow: "0 -20px 50px -20px rgba(0,0,0,.8)", animation: "fm-sheet .24s ease", overflow: "auto", zIndex: 50, overscrollBehavior: "contain" }
              : { position: "absolute", top: 0, right: 0, bottom: 0, width: 320, maxWidth: "88%", background: "#10160d", borderLeft: "1px solid rgba(180,200,160,.14)", boxShadow: "-20px 0 50px -20px rgba(0,0,0,.7)", animation: "fm-drawer .22s ease", overflow: "auto", zIndex: 5 }}
          >
            {isMobile && (
              <div style={{ position: "sticky", top: 0, padding: "9px 0 4px", background: "#10160d", zIndex: 1 }}>
                <div style={{ width: 38, height: 4, borderRadius: 999, background: "rgba(180,200,160,.3)", margin: "0 auto" }} />
              </div>
            )}
            <div style={{ padding: isMobile ? "6px 16px calc(18px + env(safe-area-inset-bottom))" : "18px 18px 22px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                <div>
                  <div style={{ ...mono.style, fontSize: 22, fontWeight: 700 }}>{selBed.id}</div>
                  <div style={{ fontSize: 12.5, color: "#93a68c", marginTop: 2 }}>{selBed.variety} · {selValve?.name}</div>
                </div>
                <button onClick={() => setSel(null)} style={{ cursor: "pointer", border: "1px solid rgba(180,200,160,.16)", background: "#0b0f09", color: "#b7c7ad", width: 30, height: 30, borderRadius: 9, fontSize: 15 }}>✕</button>
              </div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 12, padding: "6px 11px", borderRadius: 999, background: `${HEALTH[selBed.health].c}22`, color: HEALTH[selBed.health].c, fontSize: 12.5, fontWeight: 600 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: HEALTH[selBed.health].c }} />{HEALTH[selBed.health].l}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, marginTop: 16 }}>
                {[
                  { label: "Stage", value: STAGE[selBed.stage].l, color: STAGE[selBed.stage].c },
                  { label: "Bed size", value: `${selBed.lengthM} m`, color: "#e7f0e2" },
                  { label: "Plants", value: Math.round(selBed.lengthM * selBed.plantsPerMeter).toLocaleString(), color: "#e7f0e2" },
                  { label: "Harvest today", value: `${(harvestKgByBed[selBed.id] ?? 0).toFixed(1)} kg`, color: (harvestKgByBed[selBed.id] ?? 0) > 0 ? "#c7f04d" : "#e7f0e2" },
                ].map((s) => (
                  <div key={s.label} style={{ background: "#0b0f09", border: "1px solid rgba(180,200,160,.10)", borderRadius: 11, padding: "11px 12px" }}>
                    <div style={{ fontSize: 10.5, color: "#7d8f75", textTransform: "uppercase", letterSpacing: ".05em" }}>{s.label}</div>
                    <div style={{ ...mono.style, fontSize: 16, fontWeight: 700, color: s.color, marginTop: 3 }}>{s.value}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "#93a68c", marginBottom: 5 }}><span>Harvest readiness</span><span style={{ ...mono.style, color: "#e7f0e2" }}>{READY[selBed.stage]}%</span></div>
                <div style={{ height: 8, borderRadius: 999, background: "#0b0f09", overflow: "hidden" }}><div style={{ height: "100%", width: `${READY[selBed.stage]}%`, background: "linear-gradient(90deg,#84cc16,#fb7185)", borderRadius: 999 }} /></div>
              </div>
              <div style={{ marginTop: 16, background: "#0b0f09", border: "1px solid rgba(180,200,160,.10)", borderRadius: 11, padding: "11px 12px" }}>
                <div style={{ fontSize: 10.5, color: "#7d8f75", textTransform: "uppercase", letterSpacing: ".05em" }}>Seed origin</div>
                <div style={{ fontSize: 13, marginTop: 4 }}>{selBed.origin}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
                <button onClick={() => assignTask([selBed.id])} style={{ cursor: "pointer", border: "none", background: "#c7f04d", color: "#0e130c", fontFamily: "inherit", fontWeight: 700, fontSize: 13, padding: 11, borderRadius: 10 }}>Assign task</button>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => router.push("/routines")} style={{ flex: 1, cursor: "pointer", border: "1px solid rgba(180,200,160,.16)", background: "#0b0f09", color: "#e7f0e2", fontFamily: "inherit", fontWeight: 600, fontSize: 12.5, padding: 10, borderRadius: 10 }}>Log watering</button>
                  <button onClick={() => router.push("/diseases")} style={{ flex: 1, cursor: "pointer", border: "1px solid rgba(180,200,160,.16)", background: "#0b0f09", color: "#e7f0e2", fontFamily: "inherit", fontWeight: 600, fontSize: 12.5, padding: 10, borderRadius: 10 }}>Manage disease</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Footer: legend + status cards (full only) ────────────────────── */}
      {!embed && (
        <div style={{ padding: isMobile ? "12px 13px 16px" : "14px 22px 18px", borderTop: "1px solid rgba(180,200,160,.10)", background: "#0c1109" }}>
          <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 10 : 14, flexWrap: "wrap", marginBottom: isMobile ? 11 : 14 }}>
            <span style={{ fontSize: 11, color: "#7d8f75", textTransform: "uppercase", letterSpacing: ".06em", fontWeight: 600 }}>{mode === "health" ? "Health" : mode === "yield" ? "Yield" : "Growth stage"}</span>
            {legendItems.map((l) => (
              <span key={l.l} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "#b7c7ad" }}><span style={{ width: 11, height: 11, borderRadius: 3, background: l.c }} />{l.l}</span>
            ))}
            {!isMobile && <span style={{ marginLeft: "auto", ...mono.style, fontSize: 10.5, color: "#6f8168" }}>bar length = bed size · left edge = valve</span>}
          </div>
          {/* 4 across is unreadable at 360px — 2 across on a phone */}
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(4,1fr)", gap: isMobile ? 8 : 10 }}>
            {summary.map((c) => (
              <button key={c.key} onClick={c.onClick} style={{ textAlign: "left", cursor: "pointer", background: c.active ? `${c.color}1e` : "#111710", border: `1px solid ${c.active ? c.color + "66" : "rgba(180,200,160,.10)"}`, borderRadius: 13, padding: isMobile ? "11px 12px" : "13px 14px", transition: "all .15s" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}><span style={{ ...mono.style, fontSize: isMobile ? 21 : 24, fontWeight: 700, color: c.color }}>{c.count}</span><span style={{ fontSize: 11, color: "#93a68c" }}>beds</span></div>
                <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 600, marginTop: 3, color: "#e7f0e2" }}><span>{c.emoji}</span>{c.label}</div>
                <div style={{ fontSize: 11, color: "#7d8f75", marginTop: 2 }}>{c.sub}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Bulk bar (full only) ─────────────────────────────────────────── */}
      {!embed && picked.length > 0 && (
        /* On mobile this floats above the app's bottom nav so it is never hidden */
        <div style={isMobile
          ? { position: "fixed", left: 8, right: 8, bottom: "calc(68px + env(safe-area-inset-bottom))", display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: "#151d0f", border: "1px solid rgba(199,240,77,.3)", borderRadius: 14, boxShadow: "0 12px 30px -8px rgba(0,0,0,.7)", animation: "fm-toast .2s ease", zIndex: 44 }
          : { position: "sticky", bottom: 0, display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", background: "#151d0f", borderTop: "1px solid rgba(199,240,77,.25)", animation: "fm-toast .2s ease" }}>
          <span style={{ ...mono.style, fontSize: 13, fontWeight: 700, color: "#c7f04d", whiteSpace: "nowrap" }}>{picked.length} bed{picked.length === 1 ? "" : "s"}</span>
          <button onClick={() => assignTask(picked)} style={{ flex: isMobile ? 1 : undefined, cursor: "pointer", border: "none", background: "#c7f04d", color: "#0e130c", fontFamily: "inherit", fontWeight: 700, fontSize: 13, padding: isMobile ? "10px 12px" : "9px 15px", borderRadius: 9 }}>Assign {isMobile ? "task" : "treatment task"}</button>
          <button onClick={() => setPicked([])} style={{ cursor: "pointer", border: "1px solid rgba(180,200,160,.18)", background: "transparent", color: "#b7c7ad", fontFamily: "inherit", fontWeight: 600, fontSize: 13, padding: isMobile ? "10px 12px" : "9px 14px", borderRadius: 9 }}>Clear</button>
        </div>
      )}

      {/* ── Toast ────────────────────────────────────────────────────────── */}
      {toast && (
        <div style={isMobile
          ? { position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: "calc(76px + env(safe-area-inset-bottom))", maxWidth: "88vw", background: "#0b0f09", border: "1px solid rgba(199,240,77,.35)", color: "#e7f0e2", padding: "11px 16px", borderRadius: 11, fontSize: 13, fontWeight: 600, textAlign: "center", boxShadow: "0 14px 34px -12px rgba(0,0,0,.7)", animation: "fm-toast .2s ease", zIndex: 60 }
          : { position: "absolute", left: "50%", transform: "translateX(-50%)", bottom: 22, background: "#0b0f09", border: "1px solid rgba(199,240,77,.35)", color: "#e7f0e2", padding: "11px 18px", borderRadius: 11, fontSize: 13, fontWeight: 600, boxShadow: "0 14px 34px -12px rgba(0,0,0,.7)", animation: "fm-toast .2s ease", zIndex: 20 }}>✓ {toast}</div>
      )}
    </div>
  );
}

function Compass({ mobile }: { mobile?: boolean }) {
  // Smaller and tucked in on phones so it does not sit on top of a bed row.
  const s = mobile ? 32 : 46;
  return (
    <div style={{ position: "absolute", top: mobile ? 8 : 16, right: mobile ? 8 : 18, zIndex: 3, width: s, height: s, borderRadius: "50%", background: "radial-gradient(circle at 50% 35%,#1d2733,#0b0f14)", border: "1px solid rgba(180,200,160,.18)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1, opacity: mobile ? 0.85 : 1 }}>
      <span style={{ width: 0, height: 0, borderLeft: mobile ? "4px solid transparent" : "5px solid transparent", borderRight: mobile ? "4px solid transparent" : "5px solid transparent", borderBottom: `${mobile ? 7 : 9}px solid #e7f0e2` }} />
      <span style={{ fontFamily: "'Space Mono',monospace", fontSize: mobile ? 8 : 10, fontWeight: 700, color: "#e7f0e2" }}>N</span>
    </div>
  );
}

function PickBox({ picked, onToggle, big }: { picked: boolean; onToggle: (e: MouseEvent) => void; big?: boolean }) {
  // `big` widens the touch target on phones — 20px is below the ~44px minimum.
  const s = big ? 30 : 20;
  return (
    <div onClick={onToggle} style={{ flex: "none", width: s, height: s, borderRadius: big ? 8 : 6, border: `1px solid ${picked ? "#c7f04d" : "rgba(180,200,160,.3)"}`, background: picked ? "#c7f04d" : "transparent", color: "#0e130c", fontSize: big ? 15 : 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>{picked ? "✓" : ""}</div>
  );
}
