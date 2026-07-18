"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import type { Farmer, Valve, Bed } from "@/lib/types";

// Shared, cached reference data (farmers, valves, beds) — the slow-changing
// lookups almost every page needs. Fetched once per session and deduped so
// navigating between pages doesn't refetch the same three tables repeatedly.

type Ref = { farmers: Farmer[]; valves: Valve[]; beds: Bed[]; loaded: boolean; refresh: () => Promise<void> };

const ReferenceCtx = createContext<Ref | null>(null);
const TTL_MS = 60_000;

export function ReferenceProvider({ children }: { children: React.ReactNode }) {
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [valves, setValves] = useState<Valve[]>([]);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [loaded, setLoaded] = useState(false);
  const fetchedAt = useRef(0);
  const inflight = useRef<Promise<void> | null>(null);

  const load = useCallback(async (force = false) => {
    if (!force && Date.now() - fetchedAt.current < TTL_MS && loaded) return;
    if (inflight.current) return inflight.current;
    const p = (async () => {
      try {
        const [f, v, b] = await Promise.all([
          fetch("/api/farmers").then(r => r.ok ? r.json() : []),
          fetch("/api/valves").then(r => r.ok ? r.json() : []),
          fetch("/api/beds").then(r => r.ok ? r.json() : []),
        ]);
        setFarmers(f); setValves(v); setBeds(b);
        fetchedAt.current = Date.now();
        setLoaded(true);
      } finally {
        inflight.current = null;
      }
    })();
    inflight.current = p;
    return p;
  }, [loaded]);

  const refresh = useCallback(() => load(true), [load]);

  // trigger the first load lazily via a ref-effect the hook drives
  const value: Ref & { _load: (force?: boolean) => Promise<void> } = { farmers, valves, beds, loaded, refresh, _load: load };
  return <ReferenceCtx.Provider value={value}>{children}</ReferenceCtx.Provider>;
}

// useReference() returns the shared reference data and kicks off the (deduped,
// TTL-cached) load on first use.
export function useReference(): Ref {
  const ctx = useContext(ReferenceCtx) as (Ref & { _load?: (force?: boolean) => Promise<void> }) | null;
  if (!ctx) throw new Error("useReference must be used within ReferenceProvider");
  const started = useRef(false);
  if (!started.current && !ctx.loaded) {
    started.current = true;
    ctx._load?.();
  }
  return ctx;
}
