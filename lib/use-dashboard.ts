"use client";

import { useEffect, useState } from "react";

// One-round-trip dashboard data with warm start: the last payload is kept in
// sessionStorage, so a revisit paints real numbers immediately (instead of
// zeros) while the fresh copy loads in the background. Hydration-safe: the
// cache is only read inside useEffect, never during render.

export type DashboardPayload = {
  farmers: unknown[];
  valves: unknown[];
  beds: unknown[];
  harvests: Array<Record<string, unknown>>;
  tasks: unknown[];
  attendance: unknown[];
  followUps: unknown[];
  diseases: unknown[];
  packagingRecords: unknown[];
};

export function useDashboard(harvestFrom?: string): DashboardPayload | null {
  const [data, setData] = useState<DashboardPayload | null>(null);

  useEffect(() => {
    let alive = true;
    const key = `dash:v1:${harvestFrom ?? "all"}`;
    try {
      const cached = sessionStorage.getItem(key);
      if (cached) setData(JSON.parse(cached));
    } catch { /* corrupt/absent cache — ignore */ }

    fetch(`/api/dashboard${harvestFrom ? `?harvestFrom=${harvestFrom}` : ""}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!alive || !j?.farmers) return;
        setData(j);
        try { sessionStorage.setItem(key, JSON.stringify(j)); } catch { /* quota — fine */ }
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [harvestFrom]);

  return data;
}
