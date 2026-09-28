"use client";

import { useEffect, useState } from "react";
import { FarmMap } from "@/components/farm-map";
import type { Valve, Bed, BedGroup } from "@/lib/types";

export default function MapPage() {
  const [valves, setValves] = useState<Valve[]>([]);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [harvestKgByBed, setHarvestKgByBed] = useState<Record<string, number>>({});
  const [groups, setGroups] = useState<BedGroup[]>([]);

  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    Promise.all([
      fetch("/api/valves").then(r => r.json()),
      fetch("/api/beds").then(r => r.json()),
      fetch(`/api/harvest?date=${today}`).then(r => r.json()),
      fetch("/api/bed-groups").then(r => (r.ok ? r.json() : [])),
    ]).then(([v, b, h, g]) => {
      setValves(v);
      setBeds(b);
      setGroups(g as BedGroup[]);
      const byBed: Record<string, number> = {};
      (h as Array<{ bedId: string; kg: string | number }>).forEach(rec => {
        byBed[rec.bedId] = (byBed[rec.bedId] ?? 0) + parseFloat(rec.kg.toString());
      });
      setHarvestKgByBed(byBed);
    });
  }, []);

  // The redesigned FarmMap owns its header, toolbar, legend and status cards.
  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto">
      <FarmMap valves={valves} beds={beds} harvestKgByBed={harvestKgByBed} groups={groups} />
    </div>
  );
}
