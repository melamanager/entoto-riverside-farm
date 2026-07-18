import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { todayAddis } from "@/lib/dates";
import { complianceForRange, countedDaySet } from "@/lib/compliance";
import { getFarmConfig } from "@/lib/config";

function isoDate(d: Date) {
  return d.toISOString().split("T")[0];
}

// Weekly report: store/warehouse movements + expenses + sales income,
// and per-worker overtime for payroll.
export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // weekly report exposes expenses, sales income and wages — manager only
  if ((session.user as { role: string }).role !== "manager") {
    return NextResponse.json({ error: "Manager access required" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  // start = Monday of the requested week (defaults to current week)
  let start = searchParams.get("start");
  if (!start) {
    const now = new Date(`${todayAddis()}T00:00:00.000Z`);
    const day = now.getUTCDay() === 0 ? 7 : now.getUTCDay();
    now.setUTCDate(now.getUTCDate() - (day - 1));
    start = isoDate(now);
  }
  const endDate = new Date(`${start}T00:00:00.000Z`);
  endDate.setUTCDate(endDate.getUTCDate() + 6);
  const end = isoDate(endDate);

  const [stockTxns, expenses, orders, harvests, attendance, payrollRecords, irrigationLogs] = await Promise.all([
    prisma.stockTransaction.findMany({
      where: { date: { gte: start, lte: end } },
      include: { item: { select: { name: true, unit: true, costPerUnit: true, category: true } } },
      orderBy: { date: "asc" },
    }),
    prisma.expense.findMany({ where: { date: { gte: start, lte: end } } }),
    prisma.customerOrder.findMany({ where: { orderDate: { gte: start, lte: end } } }),
    prisma.harvestRecord.findMany({ where: { date: { gte: start, lte: end } }, select: { kg: true } }),
    prisma.attendanceRecord.findMany({
      where: { date: { gte: start, lte: end } },
      include: { farmer: { select: { id: true, name: true, avatar: true, role: true } } },
    }),
    prisma.payrollRecord.findMany({ orderBy: { month: "desc" }, include: { farmer: { select: { id: true } } } }),
    prisma.irrigationLog.findMany({ where: { date: { gte: start, lte: end } } }),
  ]);

  // ── Store/warehouse summary ────────────────────────────────────────────────
  const txnValue = (t: (typeof stockTxns)[number]) => Number(t.quantity) * Number(t.item.costPerUnit);
  const byType = (type: string) => stockTxns.filter((t) => t.type === type);
  const movementRows = stockTxns.map((t) => ({
    id: t.id,
    date: t.date,
    type: t.type,
    item: t.item.name,
    category: t.item.category,
    quantity: Number(t.quantity),
    unit: t.item.unit,
    valueETB: txnValue(t),
  }));

  const expensesByCategory: Record<string, number> = {};
  for (const e of expenses) {
    expensesByCategory[e.category] = (expensesByCategory[e.category] ?? 0) + Number(e.amountETB);
  }

  const salesETB = orders.reduce((s, o) => s + Number(o.totalAmount), 0);
  const expensesETB = expenses.reduce((s, e) => s + Number(e.amountETB), 0);
  const stockOutETB = [...byType("stock_out"), ...byType("waste")].reduce((s, t) => s + txnValue(t), 0);
  const stockInETB = byType("stock_in").reduce((s, t) => s + txnValue(t), 0);

  // ── Overtime / payroll summary ─────────────────────────────────────────────
  // latest known daily wage per farmer (most recent payroll record), config fallback
  const cfg = await getFarmConfig();
  const wageByFarmer = new Map<string, number>();
  for (const p of payrollRecords) {
    if (!wageByFarmer.has(p.farmerId)) wageByFarmer.set(p.farmerId, Number(p.dailyWage));
  }
  const DEFAULT_DAILY_WAGE = cfg.defaultDailyWage;

  // Business rule: a supervisor's day with no routine records does not count as
  // worked unless a manager acknowledged it.
  const compliance = await complianceForRange(start, end);
  const counted = countedDaySet(compliance);
  const today = todayAddis();

  const perWorker = new Map<
    string,
    { farmerId: string; name: string; avatar: string; daysWorked: number; hoursWorked: number; overtimeHours: number; missedDays: number }
  >();
  for (const a of attendance) {
    if (a.farmer.role === "manager") continue;
    const row = perWorker.get(a.farmerId) ?? {
      farmerId: a.farmerId,
      name: a.farmer.name,
      avatar: a.farmer.avatar,
      daysWorked: 0,
      hoursWorked: 0,
      overtimeHours: 0,
      missedDays: 0,
    };
    const worked = a.status === "present" || a.status === "late";
    // supervisors only get credit for days with routine records (or manager ack);
    // today stays counted until the day is over
    const supervisorUncounted =
      a.farmer.role === "supervisor" && a.date < today && !counted.has(`${a.farmerId}|${a.date}`);
    if (worked && supervisorUncounted) {
      row.missedDays += 1;
    } else if (worked) {
      row.daysWorked += 1;
      row.hoursWorked += a.hoursWorked ?? 0;
      row.overtimeHours += a.overtimeHours ?? 0;
    }
    perWorker.set(a.farmerId, row);
  }

  const overtimeRows = Array.from(perWorker.values()).map((w) => {
    const dailyWage = wageByFarmer.get(w.farmerId) ?? DEFAULT_DAILY_WAGE;
    const overtimePay = Math.round(w.overtimeHours * (dailyWage / cfg.workdayHours) * cfg.overtimeMultiplier * 100) / 100;
    return { ...w, dailyWage, overtimePay };
  });

  return NextResponse.json({
    start,
    end,
    store: {
      inCount: byType("stock_in").length,
      outCount: byType("stock_out").length,
      wasteCount: byType("waste").length,
      adjustmentCount: byType("adjustment").length,
      inValueETB: stockInETB,
      outValueETB: stockOutETB,
      movements: movementRows,
    },
    expenses: {
      totalETB: expensesETB,
      byCategory: expensesByCategory,
      count: expenses.length,
    },
    sales: {
      orders: orders.length,
      totalETB: salesETB,
      totalKg: orders.reduce((s, o) => s + Number(o.quantityKg), 0),
      paidETB: orders.filter((o) => o.paymentStatus === "paid").reduce((s, o) => s + Number(o.totalAmount), 0),
    },
    harvest: {
      totalKg: harvests.reduce((s, h) => s + Number(h.kg), 0),
    },
    watering: {
      sessions: irrigationLogs.length,
      skipped: irrigationLogs.filter((l) => l.status === "skipped").length,
    },
    // stock-in value is reported separately (store.inValueETB): purchases are
    // normally also logged as Expenses, so adding both would double-count spend
    net: {
      incomeETB: salesETB,
      spendETB: expensesETB,
      balanceETB: salesETB - expensesETB,
    },
    overtime: {
      totalHours: overtimeRows.reduce((s, w) => s + w.overtimeHours, 0),
      totalPayETB: overtimeRows.reduce((s, w) => s + w.overtimePay, 0),
      workers: overtimeRows.sort((a, b) => b.overtimeHours - a.overtimeHours),
    },
  });
}
