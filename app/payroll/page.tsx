"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DollarSign, CheckCircle2, Clock, Download, Users, Calculator, Plus } from "lucide-react";
import { toast } from "sonner";
import type { PayrollRecord, PayrollStatus } from "@/lib/erp-types";
import type { AttendanceRecord, Farmer } from "@/lib/types";
import { useLang } from "@/lib/lang";
import { EN, AM } from "@/lib/translations";

const STATUS_STYLE: Record<PayrollStatus, string> = {
  paid:      "bg-primary/15 text-primary border-primary/30",
  processed: "bg-blue-100 text-blue-700 border-blue-200",
  pending:   "bg-amber-100 text-amber-700 border-amber-200",
};

function parsePayrollRecord(raw: Record<string, unknown>): PayrollRecord {
  return {
    ...raw,
    dailyWage:    parseFloat((raw.dailyWage as { toString(): string }).toString()),
    basePay:      parseFloat((raw.basePay as { toString(): string }).toString()),
    overtimePay:  parseFloat((raw.overtimePay as { toString(): string }).toString()),
    bonus:        parseFloat((raw.bonus as { toString(): string }).toString()),
    deductions:   parseFloat((raw.deductions as { toString(): string }).toString()),
    netPay:       parseFloat((raw.netPay as { toString(): string }).toString()),
  } as PayrollRecord;
}

export default function PayrollPage() {
  const { isAm } = useLang();
  const t = isAm ? AM : EN;
  const [allRecords, setAllRecords] = useState<PayrollRecord[]>([]);
  const [farmers, setFarmers]       = useState<Farmer[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [cfg, setCfg] = useState({ workdayHours: 8, overtimeMultiplier: 1.5 });
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [overrides, setOverrides] = useState<Record<string, Partial<PayrollRecord>>>({});

  useEffect(() => {
    fetch("/api/payroll").then(r => r.json()).then((data: Record<string, unknown>[]) => {
      const parsed = data.map(parsePayrollRecord);
      setAllRecords(parsed);
      const months = [...new Set(parsed.map(r => r.month))].sort().reverse();
      if (months.length > 0) setSelectedMonth(months[0]);
    });
    fetch("/api/farmers").then(r => r.json()).then(setFarmers);
    fetch("/api/attendance").then(r => r.json()).then(setAttendance);
    fetch("/api/config").then(r => r.ok ? r.json() : null).then(c => c && setCfg({ workdayHours: c.workdayHours ?? 8, overtimeMultiplier: c.overtimeMultiplier ?? 1.5 }));
  }, []);

  const months = [...new Set(allRecords.map(r => r.month))].sort().reverse();
  const baseRecords = allRecords.filter(r => r.month === selectedMonth);
  const records = baseRecords.map(r => ({ ...r, ...overrides[r.id] }));

  const totalNetPay   = records.reduce((s, r) => s + r.netPay, 0);
  const totalBasePay  = records.reduce((s, r) => s + r.basePay, 0);
  const totalBonus    = records.reduce((s, r) => s + r.bonus, 0);
  const totalOT       = records.reduce((s, r) => s + r.overtimePay, 0);
  const totalDeduct   = records.reduce((s, r) => s + r.deductions, 0);
  const pendingCount  = records.filter(r => r.paymentStatus === "pending").length;

  async function processAll() {
    // persist any auto-calculated overrides and mark pending records processed
    const updated: PayrollRecord[] = [];
    let failures = 0;
    for (const rec of records) {
      const patch: Partial<PayrollRecord> = {
        ...overrides[rec.id],
        ...(rec.paymentStatus === "pending" ? { paymentStatus: "processed" as PayrollStatus } : {}),
      };
      if (Object.keys(patch).length === 0) continue;
      const res = await fetch(`/api/payroll/${rec.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (res.ok) updated.push(parsePayrollRecord(await res.json() as Record<string, unknown>));
      else failures += 1;
    }
    if (updated.length > 0) {
      setAllRecords(prev => prev.map(r => updated.find(u => u.id === r.id) ?? r));
      setOverrides({});
    }
    if (failures > 0) {
      toast.error(`${failures} record(s) failed to save`, { description: `${updated.length} saved. Retry to process the rest.` });
    } else {
      toast.success(`Processed ${updated.length} payroll records`, {
        description: `Total disbursement: ${totalNetPay.toLocaleString()} ETB`,
      });
    }
  }

  function exportCsv() {
    if (records.length === 0) { toast.error("Nothing to export for this month"); return; }
    const header = "Month,Staff,Days,Daily Wage,Base Pay,OT Hours,OT Pay,Bonus,Deductions,Net Pay,Status";
    const rows = records.map(r => {
      const name = farmers.find(f => f.id === r.farmerId)?.name ?? r.farmerId;
      return [r.month, name, r.daysWorked, r.dailyWage, r.basePay, r.overtimeHours, r.overtimePay, r.bonus, r.deductions, r.netPay, r.paymentStatus].join(",");
    });
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `payroll-${selectedMonth}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // Flow 7: auto-calculate days & hours from attendance
  async function autoCalculate() {
    const allAttendance = attendance;
    const monthPrefix   = selectedMonth; // "2026-05"
    const newOverrides: Record<string, Partial<PayrollRecord>> = { ...overrides };

    // supervisor rule: a day with no routine records only counts if manager-acknowledged
    const [yy, mm] = monthPrefix.split("-").map(Number);
    const lastDay = new Date(yy, mm, 0).getDate();
    const comp: { rows?: { supervisorId: string; date: string; recorded: boolean; acknowledged: boolean }[] } =
      await fetch(`/api/routines/compliance?from=${monthPrefix}-01&to=${monthPrefix}-${String(lastDay).padStart(2, "0")}`)
        .then(r => r.ok ? r.json() : {});
    const counted = new Set((comp.rows ?? []).filter(r => r.recorded || r.acknowledged).map(r => `${r.supervisorId}|${r.date}`));
    const todayStr = new Date().toLocaleDateString("en-CA");
    let excludedDays = 0;

    records.forEach(rec => {
      const isSupervisor = farmers.find(f => f.id === rec.farmerId)?.role === "supervisor";
      const farmerAtt = allAttendance.filter(a => {
        if (a.farmerId !== rec.farmerId || !a.date.startsWith(monthPrefix)) return false;
        if (isSupervisor && a.date < todayStr && !counted.has(`${rec.farmerId}|${a.date}`)) {
          if (a.status === "present" || a.status === "late") excludedDays += 1;
          return false;
        }
        return true;
      });
      const daysWorked = farmerAtt.filter(a => a.status === "present" || a.status === "late").length;
      const totalHours = farmerAtt.reduce((s, a) => s + (a.hoursWorked ?? 0), 0);
      // prefer explicitly recorded daily overtime (Daily Routines page); fall back to derived estimate
      const recordedOT = farmerAtt.reduce((s, a) => s + (a.overtimeHours ?? 0), 0);
      const overtimeHours = recordedOT > 0 ? recordedOT : Math.max(0, totalHours - daysWorked * cfg.workdayHours);
      const basePay   = daysWorked * rec.dailyWage;
      const overtimePay = Math.round(overtimeHours * (rec.dailyWage / cfg.workdayHours) * cfg.overtimeMultiplier);
      const netPay    = basePay + overtimePay + rec.bonus - rec.deductions;
      newOverrides[rec.id] = { daysWorked, overtimeHours, basePay, overtimePay, netPay };
    });
    setOverrides(newOverrides);
    toast.success("Payroll recalculated from attendance records", {
      description: excludedDays > 0
        ? `${excludedDays} supervisor day(s) excluded — no routines recorded and not acknowledged. Review & Process All to save.`
        : `Based on ${monthPrefix} attendance. Review, then Process All to save.`,
      duration: 6000,
    });
  }

  // Start a new payroll month: creates a record for every non-manager staff
  // member, carrying each person's latest known daily wage
  async function startMonth() {
    const month = new Date().toLocaleDateString("en-CA").slice(0, 7);
    if (allRecords.some(r => r.month === month)) {
      setSelectedMonth(month);
      toast.info(`${month} already exists`);
      return;
    }
    const wageOf = (fid: string) => {
      const prev = allRecords.filter(r => r.farmerId === fid).sort((a, b) => b.month.localeCompare(a.month))[0];
      return prev ? prev.dailyWage : 400;
    };
    const staff = farmers.filter(f => f.role !== "manager");
    const created: PayrollRecord[] = [];
    for (const f of staff) {
      const res = await fetch("/api/payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          farmerId: f.id, month, daysWorked: 0, dailyWage: wageOf(f.id),
          basePay: 0, overtimeHours: 0, overtimePay: 0, bonus: 0, deductions: 0, netPay: 0,
        }),
      });
      if (res.ok) created.push(parsePayrollRecord(await res.json() as Record<string, unknown>));
    }
    if (created.length === 0) { toast.error("Failed to start the month"); return; }
    setAllRecords(prev => [...prev, ...created]);
    setSelectedMonth(month);
    toast.success(`Started ${month} payroll for ${created.length} staff`, {
      description: "Now: 1) Auto-calculate from attendance  2) Review  3) Process All",
      duration: 6000,
    });
  }

  return (
    <div className="p-6 md:p-8 max-w-[1400px] mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="size-5 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">{t.payroll.title}</h1>
          </div>
          <p className="text-muted-foreground text-sm">{t.payroll.subtitle}</p>
          <p className="text-[11px] text-muted-foreground mt-1">Monthly flow: <b>1)</b> Start month → <b>2)</b> Auto-calculate from attendance → <b>3)</b> Review → <b>4)</b> Process All. Supervisor days without routine records are excluded unless acknowledged.</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="text-sm border border-border rounded-md px-3 py-2 bg-card text-foreground"
          >
            {months.map(m => (
              <option key={m} value={m}>
                {new Date(m + "-01").toLocaleDateString("en", { month: "long", year: "numeric" })}
              </option>
            ))}
          </select>
          {!months.includes(new Date().toLocaleDateString("en-CA").slice(0, 7)) && (
            <Button size="sm" className="gap-2 bg-primary hover:bg-primary/90" onClick={startMonth}>
              <Plus className="size-3.5" /> Start {new Date().toLocaleDateString("en", { month: "long" })} payroll
            </Button>
          )}
          <Button variant="outline" size="sm" className="gap-2" onClick={autoCalculate}>
            <Calculator className="size-3.5" /> {t.payroll.autoCalculate}
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={exportCsv}>
            <Download className="size-3.5" /> {t.payroll.export}
          </Button>
          {pendingCount > 0 && (
            <Button onClick={processAll} size="sm" className="gap-2 bg-primary hover:bg-primary/90">
              <CheckCircle2 className="size-3.5" /> {t.payroll.processAll} ({pendingCount})
            </Button>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="p-4 bg-primary/10 border-primary/30">
          <div className="text-lg font-bold text-primary tabular-nums">{(totalNetPay / 1000).toFixed(1)}k</div>
          <div className="text-xs text-primary font-medium mt-0.5">{t.payroll.netPay}</div>
        </Card>
        <Card className="p-4">
          <div className="text-lg font-bold text-foreground tabular-nums">{(totalBasePay / 1000).toFixed(1)}k</div>
          <div className="text-xs text-muted-foreground font-medium mt-0.5">{t.payroll.basePay}</div>
        </Card>
        <Card className="p-4">
          <div className="text-lg font-bold text-blue-700 tabular-nums">{(totalOT / 1000).toFixed(1)}k</div>
          <div className="text-xs text-blue-600 font-medium mt-0.5">{t.payroll.overtime}</div>
        </Card>
        <Card className="p-4">
          <div className="text-lg font-bold text-amber-700 tabular-nums">{(totalBonus / 1000).toFixed(1)}k</div>
          <div className="text-xs text-amber-600 font-medium mt-0.5">{t.payroll.bonuses}</div>
        </Card>
        <Card className="p-4 bg-red-50 border-red-200">
          <div className="text-lg font-bold text-red-700 tabular-nums">−{(totalDeduct / 1000).toFixed(1)}k</div>
          <div className="text-xs text-red-600 font-medium mt-0.5">{t.payroll.deductions}</div>
        </Card>
      </div>

      {/* Table */}
      <Card className="border border-border shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
          <div className="font-semibold text-foreground">
            {selectedMonth
              ? new Date(selectedMonth + "-01").toLocaleDateString("en", { month: "long", year: "numeric" }) + " Payroll"
              : "Payroll"}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users className="size-3.5" />
            <span>{records.length} {t.payroll.employees}</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full pro-table">
            <thead>
              <tr>
                <th>{t.common.farmer}</th>
                <th className="text-center">{t.payroll.days}</th>
                <th className="text-right">{t.payroll.dailyRate}</th>
                <th className="text-right">{t.payroll.basePay}</th>
                <th className="text-center">OT h</th>
                <th className="text-right">OT Pay</th>
                <th className="text-right">{t.payroll.bonuses}</th>
                <th className="text-right">{t.payroll.deductions}</th>
                <th className="text-right">{t.payroll.netPay}</th>
                <th>{t.common.status}</th>
              </tr>
            </thead>
            <tbody>
              {records.map(rec => {
                const farmer = farmers.find(f => f.id === rec.farmerId);
                return (
                  <tr key={rec.id}>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <Avatar className="size-8">
                          <AvatarFallback className="bg-muted text-muted-foreground text-[10px] font-bold">{farmer?.avatar}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-semibold text-foreground text-sm">{farmer?.name}</div>
                          <div className="text-[10px] text-muted-foreground capitalize">{farmer?.role}</div>
                        </div>
                      </div>
                    </td>
                    <td className="tabular-nums text-center">{rec.daysWorked}</td>
                    <td className="tabular-nums text-right text-muted-foreground">{rec.dailyWage.toLocaleString()}</td>
                    <td className="tabular-nums text-right">{rec.basePay.toLocaleString()}</td>
                    <td className="tabular-nums text-center text-blue-600">{rec.overtimeHours}h</td>
                    <td className="tabular-nums text-right text-blue-600">+{rec.overtimePay.toLocaleString()}</td>
                    <td className="tabular-nums text-right text-amber-600">+{rec.bonus.toLocaleString()}</td>
                    <td className="tabular-nums text-right text-red-600">−{rec.deductions.toLocaleString()}</td>
                    <td className="tabular-nums text-right font-bold text-foreground text-base">
                      {rec.netPay.toLocaleString()}
                    </td>
                    <td>
                      <Badge className={`text-[10px] capitalize ${STATUS_STYLE[rec.paymentStatus]}`}>
                        {rec.paymentStatus}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-muted border-t-2 border-border">
                <td colSpan={3} className="px-4 py-3 font-bold text-foreground">Totals</td>
                <td className="px-4 py-3 tabular-nums text-right font-bold">{totalBasePay.toLocaleString()}</td>
                <td />
                <td className="px-4 py-3 tabular-nums text-right font-bold text-blue-600">+{totalOT.toLocaleString()}</td>
                <td className="px-4 py-3 tabular-nums text-right font-bold text-amber-600">+{totalBonus.toLocaleString()}</td>
                <td className="px-4 py-3 tabular-nums text-right font-bold text-red-600">−{totalDeduct.toLocaleString()}</td>
                <td className="px-4 py-3 tabular-nums text-right font-black text-primary text-base">{totalNetPay.toLocaleString()}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </div>
  );
}
