"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DollarSign, CheckCircle2, Clock, Download, Users, Calculator } from "lucide-react";
import { toast } from "sonner";
import type { PayrollRecord, PayrollStatus } from "@/lib/erp-types";
import type { AttendanceRecord, Farmer } from "@/lib/types";
import { useLang } from "@/lib/lang";
import { EN, AM } from "@/lib/translations";

const STATUS_STYLE: Record<PayrollStatus, string> = {
  paid:      "bg-emerald-100 text-emerald-700 border-emerald-200",
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

  function processAll() {
    toast.success(`Processing ${pendingCount} payroll records`, {
      description: `Total disbursement: ${totalNetPay.toLocaleString()} ETB`,
    });
  }

  // Flow 7: auto-calculate days & hours from attendance
  function autoCalculate() {
    const allAttendance = attendance;
    const monthPrefix   = selectedMonth; // "2026-05"
    const newOverrides: Record<string, Partial<PayrollRecord>> = { ...overrides };

    records.forEach(rec => {
      const farmerAtt = allAttendance.filter(a =>
        a.farmerId === rec.farmerId && a.date.startsWith(monthPrefix)
      );
      const daysWorked = farmerAtt.filter(a => a.status === "present" || a.status === "late").length;
      const totalHours = farmerAtt.reduce((s, a) => s + (a.hoursWorked ?? 0), 0);
      const overtimeHours = Math.max(0, totalHours - daysWorked * 8);
      const basePay   = daysWorked * rec.dailyWage;
      const overtimePay = Math.round(overtimeHours * (rec.dailyWage / 8) * 1.5);
      const netPay    = basePay + overtimePay + rec.bonus - rec.deductions;
      newOverrides[rec.id] = { daysWorked, overtimeHours, basePay, overtimePay, netPay };
    });
    setOverrides(newOverrides);
    toast.success("Payroll recalculated from attendance records", {
      description: `Based on ${monthPrefix} attendance data`,
    });
  }

  return (
    <div className="p-6 md:p-8 max-w-[1400px] mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="size-5 text-emerald-600" />
            <h1 className="text-2xl font-bold text-slate-900">{t.payroll.title}</h1>
          </div>
          <p className="text-slate-500 text-sm">{t.payroll.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="text-sm border border-slate-200 rounded-md px-3 py-2 bg-white text-slate-700"
          >
            {months.map(m => (
              <option key={m} value={m}>
                {new Date(m + "-01").toLocaleDateString("en", { month: "long", year: "numeric" })}
              </option>
            ))}
          </select>
          <Button variant="outline" size="sm" className="gap-2" onClick={autoCalculate}>
            <Calculator className="size-3.5" /> {t.payroll.autoCalculate}
          </Button>
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="size-3.5" /> {t.payroll.export}
          </Button>
          {pendingCount > 0 && (
            <Button onClick={processAll} size="sm" className="gap-2 bg-emerald-600 hover:bg-emerald-700">
              <CheckCircle2 className="size-3.5" /> {t.payroll.processAll} ({pendingCount})
            </Button>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="p-4 bg-emerald-50 border-emerald-200">
          <div className="text-lg font-bold text-emerald-700 tabular-nums">{(totalNetPay / 1000).toFixed(1)}k</div>
          <div className="text-xs text-emerald-600 font-medium mt-0.5">{t.payroll.netPay}</div>
        </Card>
        <Card className="p-4">
          <div className="text-lg font-bold text-slate-700 tabular-nums">{(totalBasePay / 1000).toFixed(1)}k</div>
          <div className="text-xs text-slate-500 font-medium mt-0.5">{t.payroll.basePay}</div>
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
      <Card className="border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
          <div className="font-semibold text-slate-900">
            {selectedMonth
              ? new Date(selectedMonth + "-01").toLocaleDateString("en", { month: "long", year: "numeric" }) + " Payroll"
              : "Payroll"}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
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
                          <AvatarFallback className="bg-slate-100 text-slate-700 text-[10px] font-bold">{farmer?.avatar}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-semibold text-slate-800 text-sm">{farmer?.name}</div>
                          <div className="text-[10px] text-slate-400 capitalize">{farmer?.role}</div>
                        </div>
                      </div>
                    </td>
                    <td className="tabular-nums text-center">{rec.daysWorked}</td>
                    <td className="tabular-nums text-right text-slate-600">{rec.dailyWage.toLocaleString()}</td>
                    <td className="tabular-nums text-right">{rec.basePay.toLocaleString()}</td>
                    <td className="tabular-nums text-center text-blue-600">{rec.overtimeHours}h</td>
                    <td className="tabular-nums text-right text-blue-600">+{rec.overtimePay.toLocaleString()}</td>
                    <td className="tabular-nums text-right text-amber-600">+{rec.bonus.toLocaleString()}</td>
                    <td className="tabular-nums text-right text-red-600">−{rec.deductions.toLocaleString()}</td>
                    <td className="tabular-nums text-right font-bold text-slate-900 text-base">
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
              <tr className="bg-slate-50 border-t-2 border-slate-200">
                <td colSpan={3} className="px-4 py-3 font-bold text-slate-700">Totals</td>
                <td className="px-4 py-3 tabular-nums text-right font-bold">{totalBasePay.toLocaleString()}</td>
                <td />
                <td className="px-4 py-3 tabular-nums text-right font-bold text-blue-600">+{totalOT.toLocaleString()}</td>
                <td className="px-4 py-3 tabular-nums text-right font-bold text-amber-600">+{totalBonus.toLocaleString()}</td>
                <td className="px-4 py-3 tabular-nums text-right font-bold text-red-600">−{totalDeduct.toLocaleString()}</td>
                <td className="px-4 py-3 tabular-nums text-right font-black text-emerald-700 text-base">{totalNetPay.toLocaleString()}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </div>
  );
}
