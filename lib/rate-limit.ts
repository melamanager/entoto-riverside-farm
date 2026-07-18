// Lightweight in-memory sliding-window rate limiter. The app runs as a single
// container, so a process-local map is sufficient; it caps brute-force attempts
// without a Redis dependency.

type Hit = { count: number; resetAt: number };
const buckets = new Map<string, Hit>();

// prevent unbounded growth
let lastSweep = 0;
function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [k, v] of buckets) if (v.resetAt < now) buckets.delete(k);
}

export function rateLimit(id: string, limit: number, windowMs: number): { ok: boolean; retryAfterMs: number } {
  const now = Date.now();
  sweep(now);
  const b = buckets.get(id);
  if (!b || b.resetAt < now) {
    buckets.set(id, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterMs: 0 };
  }
  if (b.count >= limit) return { ok: false, retryAfterMs: b.resetAt - now };
  b.count += 1;
  return { ok: true, retryAfterMs: 0 };
}
