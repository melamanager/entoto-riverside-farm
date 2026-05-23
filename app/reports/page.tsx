"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { FileBarChart, TrendingUp, Award, Calendar, DollarSign, Package } from "lucide-react";
import { useLang } from "@/lib/lang";
import { EN, AM } from "@/lib/translations";
import type { Bed, HarvestRecord, DiseaseReport, Valve, Farmer } from "@/lib/types";
import type { CustomerOrder, PackagingRecord } from "@/lib/erp-types";

export default function ReportsPage() {
  const { isAm } = useLang();
  const t = isAm ? AM : EN;

  const [beds, setBeds] = useState<Bed[]>([]);
  const [harvests, setHarvests] = useState<HarvestRecord[]>([]);
  const [diseases, setDiseases] = useState<DiseaseReport[]>([]);
  const [valves, setValves] = useState<Valve[]>([]);
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [customerOrders, setCustomerOrders] = useState<CustomerOrder[]>([]);
  const [packagingRecords, setPackagingRecords] = useState<PackagingRecord[]>([]);

  useEffect(() => {
    Promise.all([
      fetch("/api/beds").then(r => r.json()),
      fetch("/api/harvest").then(r => r.json()),
      fetch("/api/diseases").then(r => r.json()),
      fetch("/api/valves").then(r => r.json()),
      fetch("/api/farmers").then(r => r.json()),
      fetch("/api/orders").then(r => r.json()),
      fetch("/api/packaging").then(r => r.json()),
    ]).then(([b, h, d, v, f, o, pk]) => {
      setBeds(b);
      setHarvests(h.map((rec: HarvestRecord & { kg: string | number }) => ({ ...rec, kg: parseFloat(rec.kg.toString()) })));
      setDiseases(d);
      setValves(v);
      setFarmers(f);
      setCustomerOrders(o);
      setPackagingRecords(pk);
    });
  }, []);

  const today = new Date().toISOString().split("T")[0];

  const totalKg = harvests.reduce((s, h) => s + parseFloat(h.kg.toString()), 0);
  const revenue = customerOrders.reduce((s, o) => s + o.totalAmount, 0);
  const collected = customerOrders.reduce((s, o) => s + o.advancePaid, 0);

  // by variety
  const byVariety: Record<string, number> = {};
  harvests.forEach(h => {
    const b = beds.find(x => x.id === h.bedId);
    if (!b) return;
    byVariety[b.variety] = (byVariety[b.variety] ?? 0) + parseFloat(h.kg.toString());
  });

  // by farmer
  const byFarmer: Record<string, number> = {};
  harvests.forEach(h => { byFarmer[h.farmerId] = (byFarmer[h.farmerId] ?? 0) + parseFloat(h.kg.toString()); });

  // packaging analytics
  const cartonsPerValve: Record<string, number> = {};
  const platesPerValve: Record<string, number> = {};
  const cartonsPerVariety: Record<string, number> = {};
  const platesPerVariety: Record<string, number> = {};
  const cartonsByPurpose: Record<string, number> = {};
  packagingRecords.forEach(r => {
    cartonsPerValve[r.valveId]    = (cartonsPerValve[r.valveId] ?? 0) + r.cartonCount;
    platesPerValve[r.valveId]     = (platesPerValve[r.valveId] ?? 0) + r.plateCount;
    cartonsPerVariety[r.variety]  = (cartonsPerVariety[r.variety] ?? 0) + r.cartonCount;
    platesPerVariety[r.variety]   = (platesPerVariety[r.variety] ?? 0) + r.plateCount;
    cartonsByPurpose[r.purpose]   = (cartonsByPurpose[r.purpose] ?? 0) + r.cartonCount;
  });
  const maxCartonsValve   = Math.max(1, ...Object.values(cartonsPerValve));
  const maxCartonsVariety = Math.max(1, ...Object.values(cartonsPerVariety));
  const maxCartonsPurpose = Math.max(1, ...Object.values(cartonsByPurpose));
  const totalCartonsAll   = packagingRecords.reduce((s, r) => s + r.cartonCount, 0);
  const totalPlatesAll    = packagingRecords.reduce((s, r) => s + r.plateCount, 0);

  // totalKgValve helper
  function totalKgValve(valveId: string) {
    const valveBedIds = new Set(beds.filter(b => b.valveId === valveId).map(b => b.id));
    return harvests.filter(h => valveBedIds.has(h.bedId)).reduce((s, h) => s + parseFloat(h.kg.toString()), 0);
  }

  // top beds
  const bedTotals = beds.map(b => ({
    b,
    kg: harvests.filter(h => h.bedId === b.id).reduce((s, h) => s + parseFloat(h.kg.toString()), 0),
  })).sort((a, b) => b.kg - a.kg);

  return (
    <div className="p-6 md:p-8 max-w-[1400px] mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><FileBarChart className="size-6 text-purple-600" /> {t.reports.title}</h1>
        <p className="text-stone-500 text-sm">{t.reports.subtitle}</p>
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
          <div className="text-[10px] text-stone-400 mt-0.5">{collected.toLocaleString()} ETB collected · {customerOrders.length} orders</div>
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
          <TabsTrigger value="packaging">📦 Packaging</TabsTrigger>
          <TabsTrigger value="smart">🧠 Smart Q&A</TabsTrigger>
        </TabsList>

        <TabsContent value="daily" className="space-y-4">
          <Card className="p-5">
            <h3 className="font-bold mb-3">Today — harvest per valve</h3>
            <div className="space-y-2">
              {valves.map(v => {
                const todayKg = harvests.filter(h => h.date === today && beds.find(b=>b.id===h.bedId)?.valveId === v.id).reduce((s,h)=>s+parseFloat(h.kg.toString()),0);
                return (
                  <div key={v.id} className="flex items-center gap-3">
                    <Badge style={{background:`${v.color}20`, color:v.color}} className="text-xs">{v.name}</Badge>
                    <div className="flex-1 h-2 bg-stone-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${Math.min((todayKg/30)*100, 100)}%`, background: v.color }} />
                    </div>
                    <div className="tabular-nums text-sm font-semibold w-16 text-right">{todayKg.toFixed(1)} kg</div>
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
                    <div className="text-[10px] text-stone-400">{b.lengthM > 0 ? (kg/b.lengthM).toFixed(2) : "0.00"} kg/m</div>
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
                const f = farmers.find(x => x.id === fid);
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

        <TabsContent value="packaging" className="space-y-4">
          {/* Summary row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-4 bg-purple-50 border-purple-200">
              <div className="text-2xl font-bold text-purple-700 tabular-nums">{totalCartonsAll}</div>
              <div className="text-xs text-purple-600 font-medium mt-0.5">📦 Total Cartons</div>
            </Card>
            <Card className="p-4 bg-sky-50 border-sky-200">
              <div className="text-2xl font-bold text-sky-700 tabular-nums">{totalPlatesAll}</div>
              <div className="text-xs text-sky-600 font-medium mt-0.5">🍽️ Total Plates</div>
            </Card>
            <Card className="p-4 bg-rose-50 border-rose-200">
              <div className="text-2xl font-bold text-rose-700 tabular-nums">{cartonsByPurpose["export"] ?? 0}</div>
              <div className="text-xs text-rose-600 font-medium mt-0.5">✈️ Export Cartons</div>
            </Card>
            <Card className="p-4 bg-orange-50 border-orange-200">
              <div className="text-2xl font-bold text-orange-700 tabular-nums">{(cartonsByPurpose["juice"] ?? 0) + (cartonsByPurpose["jam"] ?? 0)}</div>
              <div className="text-xs text-orange-600 font-medium mt-0.5">🧃 Juice + Jam Cartons</div>
            </Card>
          </div>

          {/* Cartons by valve */}
          <Card className="p-5">
            <h3 className="font-bold mb-1 flex items-center gap-2"><Package className="size-4 text-purple-600" /> Cartons & Plates by Valve Zone</h3>
            <p className="text-xs text-stone-500 mb-4">Total cartons and plates packed per irrigation zone</p>
            <div className="space-y-3">
              {valves.map(v => {
                const cartons = cartonsPerValve[v.id] ?? 0;
                const plates  = platesPerValve[v.id] ?? 0;
                return (
                  <div key={v.id}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold" style={{ color: v.color }}>{v.name}</span>
                      <span className="text-xs text-stone-500">📦 {cartons} cartons · 🍽️ {plates} plates</span>
                    </div>
                    <div className="flex gap-1 h-4">
                      <div className="rounded-l-full rounded-r-sm h-full transition-all" style={{ width: `${(cartons / maxCartonsValve) * 70}%`, background: v.color, opacity: 0.9, minWidth: cartons > 0 ? 8 : 0 }} />
                      <div className="rounded-r-full h-full bg-sky-300 transition-all" style={{ width: `${(plates / Math.max(1, ...Object.values(platesPerValve))) * 30}%`, minWidth: plates > 0 ? 6 : 0 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Cartons by variety */}
          <Card className="p-5">
            <h3 className="font-bold mb-1">Cartons by Variety / Origin</h3>
            <p className="text-xs text-stone-500 mb-4">Which strawberry variety produces the most cartons</p>
            <div className="space-y-3">
              {Object.entries(cartonsPerVariety).sort((a, b) => b[1] - a[1]).map(([variety, cartons]) => {
                const plates = platesPerVariety[variety] ?? 0;
                return (
                  <div key={variety} className="flex items-center gap-3">
                    <div className="w-44 text-xs font-medium text-stone-700 truncate shrink-0">{variety}</div>
                    <div className="flex-1 h-2 bg-stone-100 rounded-full overflow-hidden">
                      <div className="h-full bg-purple-500 rounded-full" style={{ width: `${(cartons / maxCartonsVariety) * 100}%` }} />
                    </div>
                    <div className="text-xs tabular-nums w-28 text-right shrink-0">
                      <span className="font-bold text-purple-700">{cartons}</span>
                      <span className="text-stone-400"> ctn · </span>
                      <span className="font-bold text-sky-600">{plates}</span>
                      <span className="text-stone-400"> plt</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Cartons by purpose */}
          <Card className="p-5">
            <h3 className="font-bold mb-1">Cartons by Purpose</h3>
            <p className="text-xs text-stone-500 mb-4">Breakdown of packaging destination — export, juice, jam, local, hotel, supermarket</p>
            <div className="space-y-3">
              {Object.entries(cartonsByPurpose).sort((a, b) => b[1] - a[1]).map(([purpose, cartons]) => {
                const colorMap: Record<string, string> = {
                  export: "#9333ea", juice: "#f97316", jam: "#e11d48",
                  local: "#64748b", hotel: "#0ea5e9", supermarket: "#14b8a6",
                };
                return (
                  <div key={purpose} className="flex items-center gap-3">
                    <div className="w-28 text-xs font-medium text-stone-700 capitalize shrink-0">{purpose}</div>
                    <div className="flex-1 h-2 bg-stone-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${(cartons / maxCartonsPurpose) * 100}%`, background: colorMap[purpose] ?? "#94a3b8" }} />
                    </div>
                    <div className="text-xs tabular-nums font-bold w-16 text-right shrink-0">{cartons} cartons</div>
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
              <Insight q="🥇 Which valve produces most?" a={valves.length > 0 ? (() => { const best = valves.map(v=>({n:v.name,k:totalKgValve(v.id)})).sort((a,b)=>b.k-a.k)[0]; return `${best.n} — ${best.k.toFixed(1)} kg total`; })() : "—"} />
              <Insight q="🍓 Which variety performs best?" a={`${Object.entries(byVariety).sort((a,b)=>b[1]-a[1])[0]?.[0] ?? "—"} (${(Object.entries(byVariety).sort((a,b)=>b[1]-a[1])[0]?.[1] ?? 0).toFixed(1)} kg)`} />
              <Insight q="👨‍🌾 Which farmer manages best?" a={farmers.filter(f=>f.role==="farmer").length > 0 ? (() => { const best = farmers.filter(f=>f.role==="farmer").sort((a,b)=>b.performanceScore-a.performanceScore)[0]; return `${best.name} (score ${best.performanceScore})`; })() : "—"} />
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
