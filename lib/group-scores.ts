import { prisma } from "@/lib/prisma";

/**
 * Sub-group scorecard.
 *
 * The whole point of grouping was to answer two questions that look alike but
 * are not: is this STRETCH OF BEDS performing, and is the PERSON on it
 * performing? Keeping the group's own totals apart from the people who worked
 * it is what lets you tell those apart — a poor week on Sub-Group A might be
 * the picker, or it might be the beds, and only the two side by side will say.
 *
 * Everything here reads group ids that were SNAPSHOTTED onto each record when
 * it was logged, so re-grouping beds never rewrites the past.
 */

export interface GroupScore {
  groupId: string;
  code: string;
  name: string;
  nameAm: string | null;
  valveId: string;
  valveName: string;
  bedCount: number;
  /** who is accountable right now */
  owner: { id: string; name: string } | null;

  pickedKg: number;
  fieldWasteKg: number;
  /** field waste as a share of everything picked, including the waste */
  fieldWastePct: number | null;
  gradeAPct: number | null;

  packedKg: number;
  rejectedKg: number;
  diseasedKg: number;
  /** disease as a share of what was rejected at packing */
  diseaseShareOfRejectPct: number | null;

  soldETB: number;
  orders: number;

  openDiseaseReports: number;
  maintenanceLogs: number;

  /** who actually did the picking here, and how much each brought in */
  pickers: { id: string; name: string; kg: number; wasteKg: number; hours: number; kgPerHour: number | null }[];
}

export interface WorkerScore {
  farmerId: string;
  name: string;
  /** groups they are accountable for right now */
  ownsGroups: string[];
  pickedKg: number;
  wasteKg: number;
  wastePct: number | null;
  hoursWorked: number;
  /** the number that makes pickers comparable regardless of days worked */
  kgPerHour: number | null;
  daysWorked: number;
}

const n = (v: unknown) => Number(v ?? 0);
const pct = (part: number, whole: number) =>
  whole > 0 ? Math.round((part / whole) * 1000) / 10 : null;
const r2 = (v: number) => Math.round(v * 100) / 100;

/**
 * Build the scorecard for every group, plus a per-worker view, over a date
 * range (inclusive, YYYY-MM-DD).
 */
export async function buildGroupScores(from: string, to: string) {
  const [groups, harvests, packs, orders, diseases, maintenance, attendance] = await Promise.all([
    prisma.bedGroup.findMany({
      include: {
        valve: { select: { id: true, name: true } },
        beds: { select: { id: true } },
        assignments: { where: { toDate: null }, include: { farmer: { select: { id: true, name: true } } } },
      },
      orderBy: [{ valveId: "asc" }, { code: "asc" }],
    }),
    prisma.harvestRecord.findMany({
      where: { date: { gte: from, lte: to }, NOT: { groupId: null } },
      include: { farmer: { select: { id: true, name: true } } },
    }),
    prisma.packagingRecord.findMany({
      where: { packedDate: { gte: from, lte: to }, NOT: { groupId: null } },
      include: { order: { select: { id: true, totalAmount: true } } },
    }),
    prisma.customerOrder.findMany({
      where: { orderDate: { gte: from, lte: to } },
      select: { id: true, totalAmount: true },
    }),
    prisma.diseaseReport.findMany({
      where: { status: { not: "resolved" } },
      select: { bedId: true },
    }),
    prisma.maintenanceLog.findMany({
      where: { date: { gte: from, lte: to } },
      select: { groupIds: true, valveIds: true },
    }),
    prisma.attendanceRecord.findMany({
      where: { date: { gte: from, lte: to } },
      select: { farmerId: true, hoursWorked: true, status: true },
    }),
  ]);
  void orders;

  // hours per person over the window — what makes kg/hour possible
  const hoursByFarmer = new Map<string, number>();
  const daysByFarmer = new Map<string, number>();
  for (const a of attendance) {
    hoursByFarmer.set(a.farmerId, (hoursByFarmer.get(a.farmerId) ?? 0) + n(a.hoursWorked));
    if (a.status === "present" || a.status === "late") {
      daysByFarmer.set(a.farmerId, (daysByFarmer.get(a.farmerId) ?? 0) + 1);
    }
  }

  const openDiseaseByBed = new Map<string, number>();
  for (const d of diseases) openDiseaseByBed.set(d.bedId, (openDiseaseByBed.get(d.bedId) ?? 0) + 1);

  const scores: GroupScore[] = groups.map(g => {
    const bedIds = new Set(g.beds.map(b => b.id));
    const gh = harvests.filter(h => h.groupId === g.id);
    const gp = packs.filter(p => p.groupId === g.id);

    const pickedKg = r2(gh.reduce((s, h) => s + n(h.kg), 0));
    const fieldWasteKg = r2(gh.reduce((s, h) => s + n(h.wasteKg), 0));
    const gradeA = gh.filter(h => h.qualityGrade === "A").reduce((s, h) => s + n(h.kg), 0);

    const packedKg = r2(gp.reduce((s, p) => s + n(p.packedKg), 0));
    const rejectedKg = r2(gp.reduce((s, p) => s + n(p.rejectedKg), 0));
    const diseasedKg = r2(gp.reduce((s, p) => s + n(p.diseasedKg), 0));

    // A batch links to one order, so revenue attributes exactly. Counting each
    // order once keeps two batches on the same order from doubling it.
    const orderIds = new Set(gp.map(p => p.order?.id).filter(Boolean) as string[]);
    const soldETB = r2([...orderIds].reduce((s, id) => {
      const o = gp.find(p => p.order?.id === id)?.order;
      return s + n(o?.totalAmount);
    }, 0));

    // who picked here, and how hard
    const byPicker = new Map<string, { name: string; kg: number; wasteKg: number }>();
    for (const h of gh) {
      const cur = byPicker.get(h.farmerId) ?? { name: h.farmer.name, kg: 0, wasteKg: 0 };
      cur.kg += n(h.kg);
      cur.wasteKg += n(h.wasteKg);
      byPicker.set(h.farmerId, cur);
    }

    const maintenanceLogs = maintenance.filter(m => {
      const gids = (m.groupIds as string[]) ?? [];
      if (gids.includes(g.id)) return true;
      // work logged against the whole valve counts for its groups too
      return ((m.valveIds as string[]) ?? []).includes(g.valveId);
    }).length;

    const open = g.assignments.find(a => !a.toDate);

    return {
      groupId: g.id,
      code: g.code,
      name: g.name,
      nameAm: g.nameAm,
      valveId: g.valveId,
      valveName: g.valve.name,
      bedCount: g.beds.length,
      owner: open ? { id: open.farmer.id, name: open.farmer.name } : null,

      pickedKg,
      fieldWasteKg,
      fieldWastePct: pct(fieldWasteKg, pickedKg + fieldWasteKg),
      gradeAPct: pct(gradeA, pickedKg),

      packedKg,
      rejectedKg,
      diseasedKg,
      diseaseShareOfRejectPct: pct(diseasedKg, rejectedKg),

      soldETB,
      orders: orderIds.size,

      openDiseaseReports: [...bedIds].reduce((s, id) => s + (openDiseaseByBed.get(id) ?? 0), 0),
      maintenanceLogs,

      pickers: [...byPicker.entries()]
        .map(([id, v]) => {
          const hours = r2(hoursByFarmer.get(id) ?? 0);
          return {
            id, name: v.name, kg: r2(v.kg), wasteKg: r2(v.wasteKg), hours,
            kgPerHour: hours > 0 ? Math.round((v.kg / hours) * 100) / 100 : null,
          };
        })
        .sort((a, b) => b.kg - a.kg),
    };
  });

  // ── per worker, across every group they picked in ────────────────────────
  const byWorker = new Map<string, { name: string; kg: number; waste: number }>();
  for (const h of harvests) {
    const cur = byWorker.get(h.farmerId) ?? { name: h.farmer.name, kg: 0, waste: 0 };
    cur.kg += n(h.kg);
    cur.waste += n(h.wasteKg);
    byWorker.set(h.farmerId, cur);
  }
  const ownedBy = new Map<string, string[]>();
  for (const g of groups) {
    const open = g.assignments.find(a => !a.toDate);
    if (open) ownedBy.set(open.farmer.id, [...(ownedBy.get(open.farmer.id) ?? []), g.code]);
  }

  const workers: WorkerScore[] = [...byWorker.entries()].map(([id, v]) => {
    const hours = r2(hoursByFarmer.get(id) ?? 0);
    return {
      farmerId: id,
      name: v.name,
      ownsGroups: ownedBy.get(id) ?? [],
      pickedKg: r2(v.kg),
      wasteKg: r2(v.waste),
      wastePct: pct(v.waste, v.kg + v.waste),
      hoursWorked: hours,
      kgPerHour: hours > 0 ? Math.round((v.kg / hours) * 100) / 100 : null,
      daysWorked: daysByFarmer.get(id) ?? 0,
    };
  }).sort((a, b) => b.pickedKg - a.pickedKg);

  return { from, to, groups: scores, workers };
}
