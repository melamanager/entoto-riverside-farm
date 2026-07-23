import { prisma } from "@/lib/prisma";
import { getWeather, calcDiseaseRisks } from "@/lib/weather";
import { complianceForRange } from "@/lib/compliance";
import { todayAddis } from "@/lib/dates";

// Builds a compact, role-aware snapshot of the current farm state for the AI
// assistant. Managers see financials; supervisors do not.
export async function buildFarmContext(role: "manager" | "supervisor" | "farmer"): Promise<string> {
  const today = todayAddis();
  const from14 = new Date(`${today}T00:00:00Z`);
  from14.setUTCDate(from14.getUTCDate() - 13);
  const from14Str = from14.toISOString().split("T")[0];
  const weekAgo = new Date(`${today}T00:00:00Z`);
  weekAgo.setUTCDate(weekAgo.getUTCDate() - 6);
  const weekAgoStr = weekAgo.toISOString().split("T")[0];

  const [
    beds, valves, farmers, diseases, harvests, attendanceToday,
    stock, orders, fertToday, irrigationWeek, tasksOpen, compliance, weather, plantings,
  ] = await Promise.all([
    prisma.bed.findMany({ select: { id: true, valveId: true, variety: true, stage: true, health: true, lengthM: true } }),
    prisma.valve.findMany({ select: { id: true, name: true, irrigationSchedule: true } }),
    prisma.farmer.findMany({ select: { id: true, name: true, role: true } }),
    prisma.diseaseReport.findMany({
      where: { status: { not: "resolved" } },
      select: { bedId: true, type: true, severity: true, status: true, treatmentApplied: true, managerRecommendation: true },
      orderBy: { severity: "desc" },
    }),
    prisma.harvestRecord.findMany({ where: { date: { gte: from14Str } }, select: { bedId: true, date: true, kg: true, qualityGrade: true } }),
    prisma.attendanceRecord.findMany({ where: { date: today }, include: { farmer: { select: { name: true, role: true } } } }),
    prisma.stockItem.findMany({ select: { name: true, currentQty: true, reorderLevel: true, unit: true } }),
    prisma.customerOrder.findMany({ select: { customerName: true, quantityKg: true, deliveryDate: true, deliveryStatus: true, paymentStatus: true, totalAmount: true, advancePaid: true } }),
    prisma.fertigationRecord.findMany({ where: { applicationDate: today }, select: { fertilizerType: true, status: true, valveId: true } }),
    prisma.irrigationLog.findMany({ where: { date: { gte: weekAgoStr } }, select: { valveId: true, date: true, status: true } }),
    prisma.task.findMany({ where: { status: { not: "done" } }, select: { title: true, priority: true, dueDate: true, category: true, assignee: { select: { name: true } } } }),
    complianceForRange(today, today),
    getWeather().catch(() => null),
    prisma.plantingRecord.findMany({
      where: { status: { in: ["planned", "planted", "growing"] } },
      select: { bedId: true, variety: true, status: true, plannedDate: true, expectedHarvestDate: true, seedSource: true },
    }),
  ]);

  const isManager = role === "manager";
  const L: string[] = [];
  L.push(`FARM: Entoto Riverside Farm, strawberry farm, Entoto Mountain, Addis Ababa, Ethiopia (2800 m altitude). Today: ${today} (Africa/Addis_Ababa).`);

  // Weather
  if (weather) {
    const risks = calcDiseaseRisks(weather).filter(r => r.risk !== "Low");
    L.push(`WEATHER: ${weather.tempC}°C, ${weather.humidity}% humidity, ${weather.condition} (${weather.source}). ${risks.length ? "Elevated disease risk: " + risks.map(r => `${r.name} (${r.risk})`).join(", ") + "." : "Weather-driven disease risk low."}`);
  }

  // Beds
  const byStage: Record<string, number> = {};
  beds.forEach(b => { byStage[b.stage] = (byStage[b.stage] ?? 0) + 1; });
  const infected = beds.filter(b => b.health === "infected").map(b => b.id);
  const warning = beds.filter(b => b.health === "warning").map(b => b.id);
  const readyBeds = beds.filter(b => b.stage === "ripening" || b.stage === "harvest").map(b => `${b.id}(${b.variety})`);
  L.push(`BEDS: ${beds.length} total across ${valves.length} valves. Stages: ${Object.entries(byStage).map(([s, n]) => `${n} ${s}`).join(", ")}. Health: ${beds.filter(b => b.health === "healthy").length} healthy, ${warning.length} warning${warning.length ? " (" + warning.join(", ") + ")" : ""}, ${infected.length} infected${infected.length ? " (" + infected.join(", ") + ")" : ""}.`);
  if (readyBeds.length) L.push(`HARVEST-READY BEDS (ripening/harvest stage): ${readyBeds.join(", ")}.`);

  // Planting pipeline
  const toPlant = plantings.filter(p => p.status === "planned");
  const overduePlant = toPlant.filter(p => p.plannedDate <= today);
  const growing = plantings.filter(p => p.status !== "planned");
  const dueHarvest = growing.filter(p => p.expectedHarvestDate <= today);
  const soonHarvest = growing.filter(p => p.expectedHarvestDate > today).sort((a, b) => a.expectedHarvestDate.localeCompare(b.expectedHarvestDate)).slice(0, 5);
  if (plantings.length) {
    L.push(`PLANTING PIPELINE: ${toPlant.length} planned (${overduePlant.length} due/overdue to plant now${overduePlant.length ? ": " + overduePlant.slice(0, 6).map(p => `${p.bedId} ${p.variety}`).join(", ") : ""}), ${growing.length} in the ground.${dueHarvest.length ? ` ${dueHarvest.length} at/past expected harvest: ${dueHarvest.slice(0, 6).map(p => `${p.bedId}(${p.variety})`).join(", ")}.` : ""}${soonHarvest.length ? ` Next harvest windows: ${soonHarvest.map(p => `${p.bedId} ${p.variety} ~${p.expectedHarvestDate}`).join(", ")}.` : ""}`);
  }

  // Diseases
  if (diseases.length) {
    L.push(`ACTIVE DISEASES (${diseases.length}): ` + diseases.map(d =>
      `${d.bedId} ${d.type.replace(/_/g, " ")} sev ${d.severity}% [${d.status}${d.treatmentApplied ? ", treated" : ", untreated"}]`).join("; ") + ".");
  } else {
    L.push("ACTIVE DISEASES: none — all reports resolved.");
  }

  // Harvest
  const totalKg14 = harvests.reduce((s, h) => s + Number(h.kg), 0);
  const todayKg = harvests.filter(h => h.date === today).reduce((s, h) => s + Number(h.kg), 0);
  const bedKg: Record<string, number> = {};
  harvests.forEach(h => { bedKg[h.bedId] = (bedKg[h.bedId] ?? 0) + Number(h.kg); });
  const topBeds = Object.entries(bedKg).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([b, kg]) => `${b} (${kg.toFixed(1)}kg)`);
  L.push(`HARVEST: ${totalKg14.toFixed(1)} kg over last 14 days, ${todayKg.toFixed(1)} kg today. Top beds: ${topBeds.join(", ") || "none yet"}.`);

  // Attendance today
  const present = attendanceToday.filter(a => a.status === "present" || a.status === "late").length;
  const totalStaff = farmers.filter(f => f.role !== "manager").length;
  const absentToday = attendanceToday.filter(a => a.status === "absent").map(a => a.farmer.name);
  L.push(`ATTENDANCE TODAY: ${attendanceToday.length}/${totalStaff} marked, ${present} present.${absentToday.length ? " Absent: " + absentToday.join(", ") + "." : ""}`);

  // Compliance (supervisors who have not recorded routines today)
  const missing = compliance.filter(c => !c.recorded && !c.acknowledged).map(c => c.name);
  if (missing.length) L.push(`ROUTINE COMPLIANCE: supervisor(s) with NO routines recorded today (won't count as worked unless acknowledged): ${missing.join(", ")}.`);

  // Watering this week
  const wateredDays = new Set(irrigationWeek.filter(l => l.status !== "skipped").map(l => `${l.valveId}|${l.date}`)).size;
  L.push(`WATERING: ${wateredDays} valve-sessions logged in the last 7 days across ${valves.length} valves. Schedules: ${valves.map(v => `${v.name} ${v.irrigationSchedule}`).join("; ")}.`);

  // Fertigation due today
  const fertDue = fertToday.filter(f => f.status === "scheduled");
  if (fertDue.length) L.push(`FERTIGATION DUE TODAY: ${fertDue.map(f => `${f.fertilizerType} on ${valves.find(v => v.id === f.valveId)?.name ?? f.valveId}`).join(", ")}.`);

  // Stock
  const lowStock = stock.filter(s => Number(s.currentQty) <= Number(s.reorderLevel));
  if (lowStock.length) {
    L.push(`LOW STOCK: ` + lowStock.map(s => `${s.name} ${Number(s.currentQty)}${s.unit} (reorder at ${Number(s.reorderLevel)})`).join(", ") + ".");
  }

  // Open tasks
  if (tasksOpen.length) {
    const high = tasksOpen.filter(t => t.priority === "high");
    L.push(`OPEN TASKS: ${tasksOpen.length} not done${high.length ? `, ${high.length} high-priority: ` + high.slice(0, 5).map(t => `"${t.title}" → ${t.assignee.name} (due ${t.dueDate})`).join("; ") : ""}.`);
  }

  // Orders / financials — manager only
  const pendingDeliveries = orders.filter(o => o.deliveryStatus === "pending");
  const overdue = pendingDeliveries.filter(o => o.deliveryDate < today);
  if (isManager) {
    const revenue = orders.reduce((s, o) => s + Number(o.totalAmount), 0);
    const collected = orders.reduce((s, o) => s + (o.paymentStatus === "paid" ? Number(o.totalAmount) : Number(o.advancePaid)), 0);
    L.push(`ORDERS: ${orders.length} total, ${pendingDeliveries.length} pending delivery${overdue.length ? `, ${overdue.length} OVERDUE (${overdue.map(o => o.customerName).join(", ")})` : ""}. Revenue ${revenue.toLocaleString()} ETB, collected ${collected.toLocaleString()} ETB, outstanding ${(revenue - collected).toLocaleString()} ETB.`);
  } else {
    L.push(`ORDERS: ${pendingDeliveries.length} pending delivery${overdue.length ? `, ${overdue.length} overdue` : ""}. (Financial figures are manager-only.)`);
  }

  return L.join("\n");
}
