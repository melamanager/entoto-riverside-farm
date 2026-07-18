import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { todayAddis } from "@/lib/dates";

// Aggregated status of every daily routine area for one date.
export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") ?? todayAddis();
  const dayStart = new Date(`${date}T00:00:00.000Z`);
  const dayEnd = new Date(`${date}T23:59:59.999Z`);

  const [
    workers,
    attendance,
    valves,
    irrigationLogs,
    fertigations,
    treatmentsApplied,
    harvests,
    maintenanceTasks,
    orders,
    stockTxns,
  ] = await Promise.all([
    prisma.farmer.findMany({ where: { role: { not: "manager" } }, select: { id: true, name: true, avatar: true } }),
    prisma.attendanceRecord.findMany({ where: { date }, include: { farmer: { select: { name: true, avatar: true } } } }),
    prisma.valve.findMany({ select: { id: true, name: true, color: true, irrigationSchedule: true } }),
    prisma.irrigationLog.findMany({ where: { date }, include: { valve: { select: { name: true } } } }),
    prisma.fertigationRecord.findMany({ where: { applicationDate: date }, include: { valve: { select: { name: true } } } }),
    prisma.diseaseReport.count({ where: { treatmentAppliedAt: { gte: dayStart, lte: dayEnd } } }),
    prisma.harvestRecord.findMany({ where: { date }, select: { kg: true, bedId: true } }),
    prisma.task.findMany({
      where: { category: "maintenance", OR: [{ dueDate: date }, { completedAt: { gte: dayStart, lte: dayEnd } }] },
      select: { id: true, title: true, status: true, assignee: { select: { name: true } } },
    }),
    prisma.customerOrder.findMany({ where: { orderDate: date }, select: { totalAmount: true, advancePaid: true, customerName: true, quantityKg: true } }),
    prisma.stockTransaction.findMany({ where: { date }, include: { item: { select: { name: true, unit: true, costPerUnit: true } } } }),
  ]);

  const present = attendance.filter((a) => a.status === "present" || a.status === "late");
  const wateredValveIds = new Set(irrigationLogs.filter((l) => l.status !== "skipped").map((l) => l.valveId));
  const overtimeRecords = attendance.filter((a) => (a.overtimeHours ?? 0) > 0);

  const stockValue = (txns: typeof stockTxns) =>
    txns.reduce((s, t) => s + Number(t.quantity) * Number(t.item.costPerUnit), 0);
  const stockIn = stockTxns.filter((t) => t.type === "stock_in");
  const stockOut = stockTxns.filter((t) => t.type === "stock_out" || t.type === "waste");

  return NextResponse.json({
    date,
    attendance: {
      marked: attendance.length,
      totalWorkers: workers.length,
      present: present.length,
      absent: attendance.filter((a) => a.status === "absent").length,
      unmarked: workers.filter((w) => !attendance.some((a) => a.farmerId === w.id)).map((w) => w.name),
    },
    watering: {
      valvesWatered: wateredValveIds.size,
      totalValves: valves.length,
      sessions: irrigationLogs.length,
      skipped: irrigationLogs.filter((l) => l.status === "skipped").length,
      waterVolumeL: irrigationLogs.reduce((s, l) => s + (l.waterVolumeL ?? 0), 0),
      valves: valves.map((v) => ({
        id: v.id,
        name: v.name,
        color: v.color,
        schedule: v.irrigationSchedule,
        watered: wateredValveIds.has(v.id),
      })),
    },
    fertigation: {
      applied: fertigations.filter((f) => f.status === "applied").length,
      scheduled: fertigations.filter((f) => f.status === "scheduled").length,
      skipped: fertigations.filter((f) => f.status === "skipped").length,
      treatmentsApplied,
    },
    harvest: {
      records: harvests.length,
      totalKg: harvests.reduce((s, h) => s + Number(h.kg), 0),
      beds: new Set(harvests.map((h) => h.bedId)).size,
    },
    maintenance: {
      total: maintenanceTasks.length,
      done: maintenanceTasks.filter((t) => t.status === "done").length,
      tasks: maintenanceTasks.map((t) => ({ id: t.id, title: t.title, status: t.status, assignee: t.assignee.name })),
    },
    sales: {
      orders: orders.length,
      totalETB: orders.reduce((s, o) => s + Number(o.totalAmount), 0),
      totalKg: orders.reduce((s, o) => s + Number(o.quantityKg), 0),
    },
    stock: {
      inCount: stockIn.length,
      outCount: stockOut.length,
      inValueETB: stockValue(stockIn),
      outValueETB: stockValue(stockOut),
      transactions: stockTxns.map((t) => ({
        id: t.id,
        type: t.type,
        item: t.item.name,
        quantity: Number(t.quantity),
        unit: t.item.unit,
      })),
    },
    overtime: {
      workers: overtimeRecords.length,
      totalHours: overtimeRecords.reduce((s, a) => s + (a.overtimeHours ?? 0), 0),
      records: overtimeRecords.map((a) => ({
        farmerId: a.farmerId,
        name: a.farmer.name,
        hours: a.overtimeHours ?? 0,
      })),
    },
  });
}
