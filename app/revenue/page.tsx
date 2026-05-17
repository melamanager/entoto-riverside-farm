import { Card } from "@/components/ui/card";
import { TrendingUp, DollarSign, ShoppingCart, BarChart3, TrendingDown } from "lucide-react";
import { CUSTOMER_ORDERS, PACKAGING_RECORDS, FERTIGATION_RECORDS, PAYROLL_RECORDS } from "@/lib/erp-data";
import { CUSTOMER_TYPE_LABELS } from "@/lib/erp-types";

export default function RevenuePage() {
  const totalRevenue  = CUSTOMER_ORDERS.reduce((s, o) => s + o.totalAmount, 0);
  const collected     = CUSTOMER_ORDERS.reduce((s, o) => s + o.advancePaid, 0);
  const outstanding   = totalRevenue - collected;

  const fertCost    = FERTIGATION_RECORDS.filter(r => r.status === "applied").reduce((s, r) => s + r.cost, 0);
  const payrollMay  = PAYROLL_RECORDS.filter(r => r.month === "2026-05").reduce((s, r) => s + r.netPay, 0);
  const totalCosts  = fertCost + payrollMay;
  const grossProfit = collected - totalCosts;

  const totalKg = CUSTOMER_ORDERS.reduce((s, o) => s + o.quantityKg, 0);
  const avgPrice = totalKg > 0 ? totalRevenue / totalKg : 0;

  // By customer type
  const byType = CUSTOMER_ORDERS.reduce<Record<string, { revenue: number; kg: number; count: number }>>((acc, o) => {
    if (!acc[o.customerType]) acc[o.customerType] = { revenue: 0, kg: 0, count: 0 };
    acc[o.customerType].revenue += o.totalAmount;
    acc[o.customerType].kg += o.quantityKg;
    acc[o.customerType].count += 1;
    return acc;
  }, {});

  const sortedTypes = Object.entries(byType).sort((a, b) => b[1].revenue - a[1].revenue);
  const maxRevenue = Math.max(...sortedTypes.map(([, v]) => v.revenue));

  // Top customers
  const topCustomers = [...CUSTOMER_ORDERS]
    .sort((a, b) => b.totalAmount - a.totalAmount)
    .slice(0, 5);

  return (
    <div className="p-6 md:p-8 max-w-[1400px] mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="size-5 text-emerald-600" />
            <h1 className="text-2xl font-bold text-slate-900">Revenue</h1>
          </div>
          <p className="text-slate-500 text-sm">Sales performance, profitability & customer breakdown</p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-5 bg-emerald-50 border-emerald-200">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-2xl font-black text-emerald-700 tabular-nums">
                {(totalRevenue / 1000).toFixed(1)}k
              </div>
              <div className="text-xs text-emerald-600 font-semibold mt-0.5">Total Revenue (ETB)</div>
              <div className="text-[10px] text-emerald-500 mt-1">{CUSTOMER_ORDERS.length} orders · {totalKg} kg</div>
            </div>
            <TrendingUp className="size-7 text-emerald-400 shrink-0" />
          </div>
        </Card>
        <Card className="p-5 bg-blue-50 border-blue-200">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-2xl font-black text-blue-700 tabular-nums">
                {(collected / 1000).toFixed(1)}k
              </div>
              <div className="text-xs text-blue-600 font-semibold mt-0.5">Collected (ETB)</div>
              <div className="text-[10px] text-blue-500 mt-1">
                {Math.round((collected / totalRevenue) * 100)}% of total
              </div>
            </div>
            <DollarSign className="size-7 text-blue-400 shrink-0" />
          </div>
        </Card>
        <Card className="p-5 bg-red-50 border-red-200">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-2xl font-black text-red-700 tabular-nums">
                {(outstanding / 1000).toFixed(1)}k
              </div>
              <div className="text-xs text-red-600 font-semibold mt-0.5">Outstanding (ETB)</div>
              <div className="text-[10px] text-red-500 mt-1">
                {Math.round((outstanding / totalRevenue) * 100)}% uncollected
              </div>
            </div>
            <TrendingDown className="size-7 text-red-400 shrink-0" />
          </div>
        </Card>
        <Card className="p-5 bg-amber-50 border-amber-200">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-2xl font-black text-amber-700 tabular-nums">
                {avgPrice.toFixed(0)}
              </div>
              <div className="text-xs text-amber-600 font-semibold mt-0.5">Avg Price / kg (ETB)</div>
              <div className="text-[10px] text-amber-500 mt-1">Across all varieties</div>
            </div>
            <BarChart3 className="size-7 text-amber-400 shrink-0" />
          </div>
        </Card>
      </div>

      {/* P&L */}
      <Card className="p-5 border-slate-200">
        <h3 className="font-semibold text-slate-900 mb-4">Simplified P&L — May 2026</h3>
        <div className="space-y-2">
          {[
            { label: "Revenue Collected", value: collected, color: "text-emerald-700" },
            { label: "Fertigation Inputs", value: -fertCost, color: "text-red-600" },
            { label: "Payroll (May)", value: -payrollMay, color: "text-red-600" },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0 text-sm">
              <span className="text-slate-600">{label}</span>
              <span className={`font-bold tabular-nums ${color}`}>
                {value >= 0 ? "+" : "−"} {Math.abs(value).toLocaleString()} ETB
              </span>
            </div>
          ))}
          <div className="flex items-center justify-between py-3 mt-1 border-t-2 border-slate-300 text-sm font-bold">
            <span className="text-slate-900">Gross Profit</span>
            <span className={`tabular-nums text-base ${grossProfit >= 0 ? "text-emerald-700" : "text-red-700"}`}>
              {grossProfit >= 0 ? "+" : "−"} {Math.abs(grossProfit).toLocaleString()} ETB
            </span>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Revenue by customer type */}
        <Card className="p-5 border-slate-200">
          <h3 className="font-semibold text-slate-900 mb-4">Revenue by Customer Type</h3>
          <div className="space-y-4">
            {sortedTypes.map(([type, data]) => (
              <div key={type}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-slate-700">{CUSTOMER_TYPE_LABELS[type as keyof typeof CUSTOMER_TYPE_LABELS]}</span>
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span>{data.count} orders</span>
                    <span className="font-bold text-slate-800 tabular-nums">{data.revenue.toLocaleString()} ETB</span>
                  </div>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full"
                    style={{ width: `${(data.revenue / maxRevenue) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Top customers */}
        <Card className="p-5 border-slate-200">
          <h3 className="font-semibold text-slate-900 mb-4">Top Customers</h3>
          <div className="space-y-3">
            {topCustomers.map((ord, i) => (
              <div key={ord.id} className="flex items-center gap-3">
                <span className="size-6 rounded-full bg-slate-100 text-slate-600 text-xs font-bold grid place-items-center shrink-0">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-800 truncate">{ord.customerName}</div>
                  <div className="text-[10px] text-slate-400">{ord.quantityKg} kg · {ord.pricePerKg} ETB/kg</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-bold text-slate-800 tabular-nums">{ord.totalAmount.toLocaleString()}</div>
                  <div className="text-[10px] text-slate-400">ETB</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
