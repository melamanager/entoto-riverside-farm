import type { Bed, HarvestRecord, DiseaseReport, GrowthStage } from "@/lib/types";

interface Props {
  beds: Bed[];
  harvests: HarvestRecord[];
  diseases: DiseaseReport[];
}

const FLAG: Record<string, string> = {
  USA: "🇺🇸", Australia: "🇦🇺", Ethiopia: "🇪🇹",
  Kenya: "🇰🇪", Netherlands: "🇳🇱", Spain: "🇪🇸", Israel: "🇮🇱",
  Japan: "🇯🇵", India: "🇮🇳", France: "🇫🇷",
};

const PALETTE = [
  {
    bar: "#10b981", glow: "rgba(16,185,129,0.12)",
    text: "#065f46", muted: "#d1fae5",
    badge: "bg-emerald-100 text-emerald-700 border-emerald-200",
    rank: "from-emerald-500 to-teal-600",
    stage: "#10b981",
  },
  {
    bar: "#3b82f6", glow: "rgba(59,130,246,0.12)",
    text: "#1e40af", muted: "#dbeafe",
    badge: "bg-blue-100 text-blue-700 border-blue-200",
    rank: "from-blue-500 to-indigo-600",
    stage: "#3b82f6",
  },
  {
    bar: "#a855f7", glow: "rgba(168,85,247,0.12)",
    text: "#6b21a8", muted: "#f3e8ff",
    badge: "bg-purple-100 text-purple-700 border-purple-200",
    rank: "from-purple-500 to-pink-600",
    stage: "#a855f7",
  },
  {
    bar: "#f59e0b", glow: "rgba(245,158,11,0.12)",
    text: "#78350f", muted: "#fef3c7",
    badge: "bg-amber-100 text-amber-700 border-amber-200",
    rank: "from-amber-500 to-orange-600",
    stage: "#f59e0b",
  },
];

const STAGE_ORDER: GrowthStage[] = ["planted", "vegetative", "flowering", "fruiting", "ripening", "harvest"];
const STAGE_COLOR: Record<GrowthStage, string> = {
  planted:    "#94a3b8",
  vegetative: "#22c55e",
  flowering:  "#ec4899",
  fruiting:   "#f59e0b",
  ripening:   "#f97316",
  harvest:    "#10b981",
};

function flag(origin: string) {
  const c = origin.split(" — ")[0].split(",")[0].trim();
  return FLAG[c] ?? "🌍";
}
function region(origin: string) {
  const p = origin.split(" — ");
  return p[1] ?? p[0];
}
function countryOf(origin: string) {
  return origin.split(" — ")[0];
}
function compositeScore(yieldPct: number, healthScore: number, gradeAPct: number) {
  return Math.round(yieldPct * 50 + healthScore * 0.3 + gradeAPct * 0.2);
}
function scoreTier(score: number): { label: string; color: string } {
  if (score >= 80) return { label: "Elite",    color: "#059669" };
  if (score >= 65) return { label: "Strong",   color: "#2563eb" };
  if (score >= 50) return { label: "Average",  color: "#d97706" };
  return               { label: "Weak",     color: "#dc2626" };
}

export function OriginPerformance({ beds, harvests, diseases }: Props) {

  // ── Aggregate ────────────────────────────────────────────────────────────
  const map: Record<string, {
    kg: number; lengthM: number; bedCount: number; plants: number;
    varieties: Set<string>;
    healthy: number; warning: number; infected: number;
    gradeA: number; gradeB: number; gradeC: number;
    harvestEvents: number;
    activeDiseases: number; resolvedDiseases: number; totalSeverity: number;
    stages: Partial<Record<GrowthStage, number>>;
    lastHarvestDate: string;
  }> = {};

  beds.forEach(b => {
    if (!map[b.origin]) map[b.origin] = {
      kg: 0, lengthM: 0, bedCount: 0, plants: 0,
      varieties: new Set(),
      healthy: 0, warning: 0, infected: 0,
      gradeA: 0, gradeB: 0, gradeC: 0, harvestEvents: 0,
      activeDiseases: 0, resolvedDiseases: 0, totalSeverity: 0,
      stages: {}, lastHarvestDate: "",
    };
    const o = map[b.origin];
    o.lengthM  += b.lengthM;
    o.bedCount += 1;
    o.plants   += Math.round(b.lengthM * b.plantsPerMeter);
    o.varieties.add(b.variety);
    o.stages[b.stage] = (o.stages[b.stage] ?? 0) + 1;
    if (b.health === "healthy")       o.healthy++;
    else if (b.health === "warning")  o.warning++;
    else                              o.infected++;
  });

  harvests.forEach(h => {
    const bed = beds.find(b => b.id === h.bedId);
    if (!bed || !map[bed.origin]) return;
    const o = map[bed.origin];
    o.kg += h.kg;
    o.harvestEvents++;
    if (h.qualityGrade === "A")      o.gradeA++;
    else if (h.qualityGrade === "B") o.gradeB++;
    else                             o.gradeC++;
    if (!o.lastHarvestDate || h.date > o.lastHarvestDate) o.lastHarvestDate = h.date;
  });

  diseases.forEach(d => {
    const bed = beds.find(b => b.id === d.bedId);
    if (!bed || !map[bed.origin]) return;
    const o = map[bed.origin];
    if (d.status === "resolved") { o.resolvedDiseases++; }
    else                         { o.activeDiseases++; o.totalSeverity += d.severity; }
  });

  const rows = Object.entries(map).map(([origin, d]) => {
    const kgPerM       = d.lengthM > 0 ? d.kg / d.lengthM : 0;
    const gradeAPct    = d.harvestEvents > 0 ? Math.round((d.gradeA / d.harvestEvents) * 100) : 0;
    const gradeBPct    = d.harvestEvents > 0 ? Math.round((d.gradeB / d.harvestEvents) * 100) : 0;
    const gradeCPct    = d.harvestEvents > 0 ? Math.round((d.gradeC / d.harvestEvents) * 100) : 0;
    const healthScore  = d.bedCount > 0 ? Math.round(((d.healthy + d.warning * 0.5) / d.bedCount) * 100) : 0;
    const consistency  = d.harvestEvents > 0 ? d.kg / d.harvestEvents : 0;
    const gPerPlant    = d.plants > 0 ? (d.kg * 1000) / d.plants : 0;
    const avgSeverity  = d.activeDiseases > 0 ? Math.round(d.totalSeverity / d.activeDiseases) : 0;
    return {
      origin,
      kg: d.kg, lengthM: d.lengthM, bedCount: d.bedCount, plants: d.plants,
      varieties: Array.from(d.varieties),
      healthy: d.healthy, warning: d.warning, infected: d.infected,
      gradeA: d.gradeA, gradeB: d.gradeB, gradeC: d.gradeC,
      harvestEvents: d.harvestEvents,
      activeDiseases: d.activeDiseases, resolvedDiseases: d.resolvedDiseases,
      avgSeverity, totalSeverity: d.totalSeverity,
      stages: d.stages, lastHarvestDate: d.lastHarvestDate,
      kgPerM, gradeAPct, gradeBPct, gradeCPct, healthScore, consistency, gPerPlant,
    };
  }).sort((a, b) => b.kgPerM - a.kgPerM);

  const maxKgPerM  = Math.max(...rows.map(r => r.kgPerM), 0.01);
  const avgKgPerM  = rows.length > 0 ? rows.reduce((s, r) => s + r.kgPerM, 0) / rows.length : 0;
  const totalKg    = rows.reduce((s, r) => s + r.kg, 0);
  const totalBeds  = rows.reduce((s, r) => s + r.bedCount, 0);
  const farmGradeA = harvests.length > 0 ? Math.round((harvests.filter(h => h.qualityGrade === "A").length / harvests.length) * 100) : 0;
  const farmHealth = beds.length > 0 ? Math.round((beds.filter(b => b.health === "healthy").length / beds.length) * 100) : 0;
  const activeDiseaseCount = diseases.filter(d => d.status !== "resolved").length;

  const MEDALS = ["🥇", "🥈", "🥉", ""];

  return (
    <div className="space-y-5">

      {/* ── Farm summary banner ──────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-900 to-slate-800 p-5 shadow-lg">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <div className="text-white font-bold text-base flex items-center gap-2">
              🌍 Seed Origin Intelligence
            </div>
            <div className="text-slate-400 text-xs mt-0.5">
              {rows.length} source regions · {totalBeds} beds · season performance snapshot
            </div>
          </div>
          {rows[0] && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold">
              🥇 Top: {rows[0].origin} &nbsp;·&nbsp; {rows[0].kgPerM.toFixed(2)} kg/m
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Season Yield",    value: `${totalKg.toFixed(0)} kg`, sub: "all origins combined", icon: "🌾" },
            { label: "Best Efficiency", value: rows[0] ? `${rows[0].kgPerM.toFixed(2)} kg/m` : "—", sub: rows[0]?.origin ?? "", icon: "🏆" },
            { label: "Farm Grade A",    value: `${farmGradeA}%`,           sub: `${harvests.length} harvest events`, icon: "⭐" },
            { label: "Active Alerts",   value: activeDiseaseCount > 0 ? `${activeDiseaseCount}` : "Clean", sub: activeDiseaseCount > 0 ? "disease reports" : "no active issues", icon: activeDiseaseCount > 0 ? "⚠️" : "✅" },
          ].map(kpi => (
            <div key={kpi.label} className="bg-white/6 rounded-xl p-3 border border-white/8">
              <div className="text-lg mb-1">{kpi.icon}</div>
              <div className="text-white font-bold text-lg tabular-nums leading-none">{kpi.value}</div>
              <div className="text-slate-400 text-[10px] mt-1 uppercase tracking-wide">{kpi.label}</div>
              <div className="text-slate-500 text-[9px] mt-0.5 truncate">{kpi.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Origin cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {rows.map((r, i) => {
          const pal        = PALETTE[i] ?? PALETTE[PALETTE.length - 1];
          const yieldPct   = maxKgPerM > 0 ? (r.kgPerM / maxKgPerM) * 100 : 0;
          const score      = compositeScore(yieldPct, r.healthScore, r.gradeAPct);
          const tier       = scoreTier(score);
          const deltaVsAvg = avgKgPerM > 0 ? ((r.kgPerM - avgKgPerM) / avgKgPerM) * 100 : 0;
          const sharePct   = totalKg > 0 ? (r.kg / totalKg) * 100 : 0;
          const healthyPct  = r.bedCount > 0 ? (r.healthy  / r.bedCount) * 100 : 0;
          const warningPct  = r.bedCount > 0 ? (r.warning  / r.bedCount) * 100 : 0;
          const infectedPct = r.bedCount > 0 ? (r.infected / r.bedCount) * 100 : 0;
          const gradeBPct   = r.harvestEvents > 0 ? Math.round((r.gradeB / r.harvestEvents) * 100) : 0;
          const gradeCPct   = r.harvestEvents > 0 ? Math.round((r.gradeC / r.harvestEvents) * 100) : 0;

          return (
            <div
              key={r.origin}
              className="rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden"
              style={{ boxShadow: `0 0 0 0 ${pal.bar}` }}
            >
              {/* Top accent strip */}
              <div className="h-1" style={{ background: `linear-gradient(90deg, ${pal.bar}, ${pal.bar}88)` }} />

              <div className="p-5">
                {/* ── Header row ──────────────────────────────────────── */}
                <div className="flex items-start gap-3 mb-5">
                  {/* Rank + score ring */}
                  <div className="relative shrink-0">
                    {/* Composite score ring */}
                    <div style={{
                      width: 56, height: 56, borderRadius: "50%",
                      background: `conic-gradient(from -90deg, ${pal.bar} ${score * 3.6}deg, #e2e8f0 0)`,
                      display: "grid", placeItems: "center",
                      boxShadow: `0 0 12px ${pal.glow}`,
                    }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: "50%",
                        background: "white",
                        display: "grid", placeItems: "center",
                        flexDirection: "column" as const,
                      }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: pal.text, lineHeight: 1 }}>{score}</div>
                        <div style={{ fontSize: 8, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>score</div>
                      </div>
                    </div>
                    {/* Rank badge */}
                    <div
                      className={`absolute -bottom-1.5 -right-1.5 size-6 rounded-full bg-gradient-to-br ${pal.rank} grid place-items-center text-white text-[9px] font-black shadow`}
                    >
                      {i + 1}
                    </div>
                  </div>

                  {/* Origin info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-2xl leading-none">{flag(r.origin)}</span>
                      <div>
                        <div className="font-bold text-slate-900 text-sm leading-none">{countryOf(r.origin)}</div>
                        <div className="text-slate-500 text-xs mt-0.5">{region(r.origin)}</div>
                      </div>
                      <span className="text-base leading-none">{MEDALS[i]}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full border"
                        style={{ color: tier.color, background: `${tier.color}15`, borderColor: `${tier.color}40` }}
                      >
                        {tier.label}
                      </span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${deltaVsAvg >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
                        {deltaVsAvg >= 0 ? "↑" : "↓"} {Math.abs(deltaVsAvg).toFixed(0)}% vs avg
                      </span>
                      <span className="text-[10px] text-slate-400">{sharePct.toFixed(0)}% of farm yield</span>
                    </div>
                  </div>

                  {/* Main KPI */}
                  <div className="text-right shrink-0">
                    <div className="text-2xl font-black tabular-nums" style={{ color: pal.text }}>{r.kgPerM.toFixed(2)}</div>
                    <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">kg / metre</div>
                    <div className="text-xs font-bold text-slate-700 mt-0.5">{r.kg.toFixed(1)} kg total</div>
                  </div>
                </div>

                {/* ── Yield efficiency bar ────────────────────────────── */}
                <div className="mb-4">
                  <div className="flex justify-between text-[10px] mb-1">
                    <span className="text-slate-500 font-medium">Yield efficiency vs best origin</span>
                    <span className="font-bold tabular-nums" style={{ color: pal.text }}>{Math.round(yieldPct)}%</span>
                  </div>
                  <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${yieldPct}%`, background: `linear-gradient(90deg, ${pal.bar}, ${pal.bar}cc)`, transition: "width 0.7s" }}
                    />
                  </div>
                </div>

                {/* ── 6-metric grid ───────────────────────────────────── */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {[
                    { icon: "🌾", label: "Total Yield",  value: `${r.kg.toFixed(1)} kg`,            sub: `${r.harvestEvents} picks` },
                    { icon: "📏", label: "Bed Length",   value: `${r.lengthM} m`,                   sub: `${r.bedCount} beds` },
                    { icon: "🌱", label: "Plants",       value: r.plants.toLocaleString(),           sub: "total" },
                    { icon: "⚖️", label: "Avg per Pick", value: `${r.consistency.toFixed(1)} kg`,   sub: "consistency" },
                    { icon: "🔬", label: "g / Plant",    value: `${r.gPerPlant.toFixed(0)} g`,       sub: "plant efficiency" },
                    { icon: "⭐", label: "Grade A",      value: `${r.gradeAPct}%`,                  sub: "of harvest" },
                  ].map(m => (
                    <div key={m.label} className="rounded-xl p-2.5 text-center" style={{ background: pal.glow, border: `1px solid ${pal.bar}22` }}>
                      <div className="text-base leading-none mb-1">{m.icon}</div>
                      <div className="text-xs font-black tabular-nums" style={{ color: pal.text }}>{m.value}</div>
                      <div className="text-[9px] text-slate-500 mt-0.5 font-medium">{m.label}</div>
                      <div className="text-[9px] text-slate-400">{m.sub}</div>
                    </div>
                  ))}
                </div>

                {/* ── Health bar ──────────────────────────────────────── */}
                <div className="mb-3">
                  <div className="flex justify-between text-[10px] mb-1">
                    <span className="text-slate-500 font-medium">Bed health</span>
                    <span className={`font-bold ${r.healthScore >= 80 ? "text-emerald-600" : r.healthScore >= 60 ? "text-amber-500" : "text-red-500"}`}>
                      {r.healthScore}% healthy score
                    </span>
                  </div>
                  <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden flex">
                    <div style={{ width: `${healthyPct}%`, background: "#10b981" }} className="h-full transition-all" />
                    <div style={{ width: `${warningPct}%`, background: "#f59e0b" }} className="h-full transition-all" />
                    <div style={{ width: `${infectedPct}%`, background: "#ef4444" }} className="h-full transition-all" />
                  </div>
                  <div className="flex items-center gap-4 mt-1.5 text-[9px] text-slate-400">
                    <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-emerald-400 inline-block" />{r.healthy} healthy</span>
                    {r.warning  > 0 && <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-amber-400 inline-block" />{r.warning} warning</span>}
                    {r.infected > 0 && <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-red-400 inline-block" />{r.infected} infected</span>}
                  </div>
                </div>

                {/* ── Grade distribution ──────────────────────────────── */}
                {r.harvestEvents > 0 && (
                  <div className="mb-3">
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className="text-slate-500 font-medium">Harvest grade distribution</span>
                      <span className="text-slate-400">{r.harvestEvents} events</span>
                    </div>
                    <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden flex">
                      <div style={{ width: `${r.gradeAPct}%`, background: "#10b981" }} className="h-full" />
                      <div style={{ width: `${gradeBPct}%`,   background: "#f59e0b" }} className="h-full" />
                      <div style={{ width: `${gradeCPct}%`,   background: "#ef4444" }} className="h-full" />
                    </div>
                    <div className="flex items-center gap-4 mt-1.5 text-[9px]">
                      <span className="flex items-center gap-1 text-emerald-600 font-semibold"><span className="size-2 rounded-sm bg-emerald-400 inline-block" />A {r.gradeAPct}%</span>
                      <span className="flex items-center gap-1 text-amber-500 font-semibold"><span className="size-2 rounded-sm bg-amber-400 inline-block" />B {gradeBPct}%</span>
                      <span className="flex items-center gap-1 text-red-500 font-semibold"><span className="size-2 rounded-sm bg-red-400 inline-block" />C {gradeCPct}%</span>
                    </div>
                  </div>
                )}

                {/* ── Growth stage breakdown ──────────────────────────── */}
                {Object.keys(r.stages).length > 0 && (
                  <div className="mb-3">
                    <div className="text-[10px] text-slate-500 font-medium mb-1.5">Growth stages</div>
                    <div className="flex flex-wrap gap-1.5">
                      {STAGE_ORDER.filter(s => r.stages[s]).map(s => (
                        <span
                          key={s}
                          className="text-[9px] font-semibold px-2 py-0.5 rounded-full text-white"
                          style={{ background: STAGE_COLOR[s] }}
                        >
                          {s} ({r.stages[s]})
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Varieties ───────────────────────────────────────── */}
                <div className="mb-3">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wide font-bold mb-1.5">Varieties</div>
                  <div className="flex flex-wrap gap-1">
                    {r.varieties.map(v => (
                      <span key={v} className={`text-[10px] px-2.5 py-0.5 rounded-full border font-medium ${pal.badge}`}>{v}</span>
                    ))}
                  </div>
                </div>

                {/* ── Last harvest ────────────────────────────────────── */}
                {r.lastHarvestDate && (
                  <div className="text-[10px] text-slate-400 mb-2">
                    Last harvest: <span className="text-slate-600 font-semibold">{new Date(r.lastHarvestDate).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })}</span>
                  </div>
                )}

                {/* ── Disease status footer ───────────────────────────── */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  {r.activeDiseases > 0 ? (
                    <div className="flex items-center gap-2">
                      <span className="size-2 rounded-full bg-red-400 animate-pulse inline-block" />
                      <span className="text-[10px] text-red-600 font-semibold">
                        {r.activeDiseases} active disease{r.activeDiseases > 1 ? "s" : ""}
                        {r.avgSeverity > 0 && ` · severity ${r.avgSeverity}/10`}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 font-semibold">
                      <span className="size-2 rounded-full bg-emerald-400 inline-block" />
                      Disease-free
                    </div>
                  )}
                  {r.resolvedDiseases > 0 && (
                    <span className="text-[9px] text-slate-400">{r.resolvedDiseases} resolved</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Ranked comparison table ──────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="text-xs font-bold text-slate-700 uppercase tracking-wide">Origin Comparison — All Metrics</div>
          <span className="text-[10px] text-slate-400 font-medium">Sorted by yield efficiency</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100">
                {["Rank", "Origin", "Score", "kg/m", "vs Avg", "Total kg", "Share", "Grade A", "Health", "Consistency", "Disease"].map(h => (
                  <th key={h} className="px-3 py-2 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const pal       = PALETTE[i] ?? PALETTE[PALETTE.length - 1];
                const yieldPct  = maxKgPerM > 0 ? (r.kgPerM / maxKgPerM) * 100 : 0;
                const score     = compositeScore(yieldPct, r.healthScore, r.gradeAPct);
                const delta     = avgKgPerM > 0 ? ((r.kgPerM - avgKgPerM) / avgKgPerM) * 100 : 0;
                const sharePct  = totalKg > 0 ? (r.kg / totalKg) * 100 : 0;
                return (
                  <tr key={r.origin} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="px-3 py-2.5">
                      <div className={`size-6 rounded-lg bg-gradient-to-br ${pal.rank} grid place-items-center text-white font-black text-[10px]`}>{i + 1}</div>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span>{flag(r.origin)}</span>
                        <div>
                          <div className="font-semibold text-slate-800">{countryOf(r.origin)}</div>
                          <div className="text-[9px] text-slate-400">{region(r.origin)}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-black text-slate-800">{score}</span>
                        <span className="text-[9px] font-semibold" style={{ color: scoreTier(score).color }}>/{scoreTier(score).label}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="font-bold tabular-nums" style={{ color: pal.text }}>{r.kgPerM.toFixed(2)}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`font-semibold ${delta >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                        {delta >= 0 ? "↑" : "↓"}{Math.abs(delta).toFixed(0)}%
                      </span>
                    </td>
                    <td className="px-3 py-2.5 tabular-nums font-medium text-slate-700">{r.kg.toFixed(1)}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${sharePct}%`, background: pal.bar }} />
                        </div>
                        <span className="text-[10px] text-slate-500 tabular-nums">{sharePct.toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`font-bold ${r.gradeAPct >= 70 ? "text-emerald-600" : r.gradeAPct >= 50 ? "text-amber-500" : "text-red-500"}`}>
                        {r.gradeAPct}%
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`font-bold ${r.healthScore >= 80 ? "text-emerald-600" : r.healthScore >= 60 ? "text-amber-500" : "text-red-500"}`}>
                        {r.healthScore}%
                      </span>
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-slate-600">{r.consistency.toFixed(1)} kg</td>
                    <td className="px-3 py-2.5">
                      {r.activeDiseases > 0
                        ? <span className="text-red-500 font-semibold flex items-center gap-1"><span className="size-1.5 rounded-full bg-red-400 animate-pulse inline-block" />{r.activeDiseases}</span>
                        : <span className="text-emerald-500 font-semibold">✓ None</span>
                      }
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Yield share bar ──────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
        <div className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-3">Yield Share — Season Total</div>
        <div className="space-y-2.5">
          {rows.map((r, i) => {
            const pal = PALETTE[i] ?? PALETTE[PALETTE.length - 1];
            const pct = totalKg > 0 ? (r.kg / totalKg) * 100 : 0;
            return (
              <div key={r.origin} className="flex items-center gap-3">
                <div className="flex items-center gap-2 w-40 shrink-0">
                  <span>{flag(r.origin)}</span>
                  <span className="text-xs text-slate-700 font-semibold truncate">{r.origin}</span>
                </div>
                <div className="flex-1 h-3 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full flex items-center justify-end pr-1.5 transition-all duration-700"
                    style={{ width: `${pct}%`, background: pal.bar }}
                  >
                    {pct > 10 && <span className="text-[9px] text-white font-black">{pct.toFixed(0)}%</span>}
                  </div>
                </div>
                <div className="w-20 text-right shrink-0">
                  <span className="text-xs font-bold tabular-nums text-slate-800">{r.kg.toFixed(1)} kg</span>
                </div>
                <div className="w-16 text-right shrink-0 hidden md:block">
                  <span className="text-[10px] text-slate-400 tabular-nums">{r.kgPerM.toFixed(2)} kg/m</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
