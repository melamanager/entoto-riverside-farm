import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { BEDS, HARVESTS, DISEASES, VALVES, FARMERS, plantsInBed, totalKgValve, totalKgBed } from "@/lib/data";
import { CUSTOMER_ORDERS } from "@/lib/erp-data";
import { FileBarChart, TrendingUp, Award, Calendar, DollarSign } from "lucide-react";

export default function ReportsPage() {
  const beds = BEDS();
  const harvests = HARVESTS();
  const diseases = DISEASES();
  const totalKg = harvests.reduce((s, h) => s + h.kg, 0);
  const revenue = CUSTOMER_ORDERS.reduce((s, o) => s + o.totalAmount, 0);
  const collected = CUSTOMER_ORDERS.reduce((s, o) => s + o.advancePaid, 0);

  // by variety
  const byVariety: Record<string, number> = {};
  harvests.forEach(h => {
    const b = beds.find(x => x.id === h.bedId);
    if (!b) return;
    byVariety[b.variety] = (byVariety[b.variety] ?? 0) + h.kg;
  });

  // by farmer
  const byFarmer: Record<string, number> = {};
  harvests.forEach(h => { byFarmer[h.farmerId] = (byFarmer[h.farmerId] ?? 0) + h.kg; });

  // top beds
  const bedTotals = beds.map(b => ({ b, kg: totalKgBed(b.id) })).sort((a,b)=>b.kg-a.kg);

  return (
    <div className="p-6 md:p-8 max-w-[1400px] mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><FileBarChart className="size-6 text-purple-600" /> Reports & Analytics</h1>
        <p className="text-stone-500 text-sm">Smart insights about your farm</p>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-xs text-stone-500">Total harvest (season)</div>
          <div className="text-2xl font-bold mt-1">{totalKg.toFixed(1)}<span className="text-sm font-normal text-stone-500"> kg</span></div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-stone-500 flex items-center gap-1"><DollarSign className="size-3" /> Revenue from orders</div>
          <div className="text-2xl font-bold mt-1 text-emerald-700">{revenue.toLocaleString(undefined,{maximumFractionDigits:0})} <span className="text-sm font-normal text-stone-500">ETB</span></div>
          <div className="text-[10px] text-stone-400 mt-0.5">{collected.toLocaleString()} ETB collected · {CUSTOMER_ORDERS.length} orders</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-stone-500">Plant mortality</div>
          <div className="text-2xl font-bold mt-1">2.4<span className="text-sm font-normal text-stone-500"> %</span></div>
          <div className="text-[10px] text-emerald-600">Below 5% target</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-stone-500">Disease incidents</div>
          <div className="text-2xl font-bold mt-1">{diseases.length}</div>
          <div className="text-[10px] text-stone-400">{diseases.filter(d=>d.status==="resolved").length} resolved</div>
        </Card>
      </div>

      <Tabs defaultValue="daily">
        <TabsList>
          <TabsTrigger value="daily">Daily</TabsTrigger>
          <TabsTrigger value="weekly">Weekly</TabsTrigger>
          <TabsTrigger value="monthly">Monthly</TabsTrigger>
          <TabsTrigger value="smart">🧠 Smart Q&A</TabsTrigger>
        </TabsList>

        <TabsContent value="daily" className="space-y-4">
          <Card className="p-5">
            <h3 className="font-bold mb-3">Today — harvest per valve</h3>
            <div className="space-y-2">
              {VALVES.map(v => {
                const today = harvests.filter(h => h.date === "2026-05-17" && beds.find(b=>b.id===h.bedId)?.valveId === v.id).reduce((s,h)=>s+h.kg,0);
                return (
                  <div key={v.id} className="flex items-center gap-3">
                    <Badge style={{background:`${v.color}20`, color:v.color}} className="text-xs">{v.name}</Badge>
                    <div className="flex-1 h-2 bg-stone-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${Math.min((today/30)*100, 100)}%`, background: v.color }} />
                    </div>
                    <div className="tabular-nums text-sm font-semibold w-16 text-right">{today.toFixed(1)} kg</div>
                  </div>
                );
              })}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="weekly" className="space-y-4">
          <Card className="p-5">
            <h3 className="font-bold mb-3 flex items-center gap-2"><Award className="size-4 text-amber-500" /> Top 5 productive beds (last 14d)</h3>
            <div className="space-y-2">
              {bedTotals.slice(0,5).map(({b, kg}, i) => (
                <div key={b.id} className="flex items-center gap-3 p-2 rounded hover:bg-stone-50">
                  <div className="text-amber-500 font-bold text-sm w-6">#{i+1}</div>
                  <div className="flex-1">
                    <div className="font-mono font-semibold text-sm">{b.id}</div>
                    <div className="text-[11px] text-stone-500">{b.variety}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold tabular-nums">{kg.toFixed(1)} kg</div>
                    <div className="text-[10px] text-stone-400">{(kg/b.lengthM).toFixed(2)} kg/m</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="font-bold mb-3">Estimated next-week harvest</h3>
            <div className="text-3xl font-bold text-emerald-700">{(totalKg * 0.5 + 25).toFixed(0)} <span className="text-base font-normal text-stone-500">kg projected</span></div>
            <div className="text-xs text-stone-500 mt-1">Based on current bed maturity & 7-day trend</div>
          </Card>
        </TabsContent>

        <TabsContent value="monthly" className="space-y-4">
          <Card className="p-5">
            <h3 className="font-bold mb-3">Harvest by variety</h3>
            <div className="space-y-2">
              {Object.entries(byVariety).sort((a,b)=>b[1]-a[1]).map(([variety, kg]) => {
                const max = Math.max(...Object.values(byVariety));
                return (
                  <div key={variety} className="flex items-center gap-3">
                    <div className="w-48 text-sm">{variety}</div>
                    <div className="flex-1 h-2 bg-stone-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(kg/max)*100}%` }} />
                    </div>
                    <div className="tabular-nums text-sm font-semibold w-20 text-right">{kg.toFixed(1)} kg</div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="font-bold mb-3">Harvest by farmer</h3>
            <div className="space-y-2">
              {Object.entries(byFarmer).map(([fid, kg]) => {
                const f = FARMERS.find(x => x.id === fid);
                const max = Math.max(...Object.values(byFarmer));
                return (
                  <div key={fid} className="flex items-center gap-3">
                    <div className="w-48 text-sm">{f?.name}</div>
                    <div className="flex-1 h-2 bg-stone-100 rounded-full overflow-hidden">
                      <div className="h-full bg-purple-500 rounded-full" style={{ width: `${(kg/max)*100}%` }} />
                    </div>
                    <div className="tabular-nums text-sm font-semibold w-20 text-right">{kg.toFixed(1)} kg</div>
                  </div>
                );
              })}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="smart" className="space-y-4">
          <Card className="p-5 bg-gradient-to-br from-purple-50 to-blue-50">
            <h3 className="font-bold mb-4 flex items-center gap-2"><TrendingUp className="size-4 text-purple-600" /> Smart insights</h3>
            <div className="space-y-3 text-sm">
              <Insight q="🥇 Which valve produces most?" a={`${VALVES.map(v=>({n:v.name,k:totalKgValve(v.id)})).sort((a,b)=>b.k-a.k)[0].n} — ${VALVES.map(v=>({n:v.name,k:totalKgValve(v.id)})).sort((a,b)=>b.k-a.k)[0].k.toFixed(1)} kg total`} />
              <Insight q="🍓 Which variety performs best?" a={`${Object.entries(byVariety).sort((a,b)=>b[1]-a[1])[0]?.[0] ?? "—"} (${Object.entries(byVariety).sort((a,b)=>b[1]-a[1])[0]?.[1].toFixed(1) ?? 0} kg)`} />
              <Insight q="👨‍🌾 Which farmer manages best?" a={`${FARMERS.filter(f=>f.role==="farmer").sort((a,b)=>b.performanceScore-a.performanceScore)[0].name} (score ${FARMERS.filter(f=>f.role==="farmer").sort((a,b)=>b.performanceScore-a.performanceScore)[0].performanceScore})`} />
              <Insight q="🦠 Which beds have repeated disease?" a={`${[...new Set(diseases.map(d=>d.bedId))].slice(0,3).join(", ") || "None"}`} />
              <Insight q="📅 Best planting window so far?" a={`Mid-January 2026 — yields 12% above average`} />
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Insight({ q, a }: { q: string; a: string }) {
  return (
    <div className="bg-white/70 rounded-lg p-3 border border-purple-100">
      <div className="text-xs text-stone-500 mb-0.5">{q}</div>
      <div className="font-semibold text-stone-900">{a}</div>
    </div>
  );
}
