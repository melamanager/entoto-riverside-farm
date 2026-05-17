import { cn } from "@/lib/utils";

interface ValveIconProps {
  className?: string;
  size?: number;
}

/**
 * Custom valve icon — pipe arch with handwheel, matching the farm's visual style.
 * Multi-colour (green pipe, cyan caps, blue wheel); ignores text-colour utilities
 * but honours size utilities via className (w-* / h-* / size-*).
 */
export function ValveIcon({ className, size }: ValveIconProps) {
  const px = size ?? 24;
  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 80 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Valve"
      className={cn("inline-block shrink-0", className)}
    >
      {/* ── Pipe body (arch / ∩ shape) ─────────────────────────────── */}
      {/* Left leg */}
      <rect x="6" y="34" width="16" height="22" rx="5" fill="#82C97A" stroke="#5BA051" strokeWidth="1.5" />
      {/* Right leg */}
      <rect x="58" y="34" width="16" height="22" rx="5" fill="#82C97A" stroke="#5BA051" strokeWidth="1.5" />
      {/* Horizontal connector */}
      <rect x="4" y="26" width="72" height="16" rx="8" fill="#82C97A" stroke="#5BA051" strokeWidth="1.5" />

      {/* ── Cyan pipe-end caps ──────────────────────────────────────── */}
      {/* Left cap */}
      <rect x="4" y="49" width="18" height="9" rx="3.5" fill="#45D4D4" stroke="#2EB8B8" strokeWidth="1.2" />
      {/* Right cap */}
      <rect x="58" y="49" width="18" height="9" rx="3.5" fill="#45D4D4" stroke="#2EB8B8" strokeWidth="1.2" />

      {/* ── Valve stem (connects pipe to wheel) ────────────────────── */}
      <rect x="36" y="14" width="8" height="14" rx="3" fill="#82C97A" stroke="#5BA051" strokeWidth="1.5" />

      {/* ── Handwheel ──────────────────────────────────────────────── */}
      {/* Wheel outer rim */}
      <circle cx="40" cy="11" r="11" fill="#4A7DC4" stroke="#2B5CA8" strokeWidth="2.5" />
      {/* Wheel face (lighter inner disc) */}
      <circle cx="40" cy="11" r="7.5" fill="#6B9FD4" />
      {/* Wheel spokes — cross + diagonals like a ship/gate wheel */}
      <line x1="40" y1="2"  x2="40" y2="20" stroke="#2B5CA8" strokeWidth="2"   strokeLinecap="round" />
      <line x1="29" y1="11" x2="51" y2="11" stroke="#2B5CA8" strokeWidth="2"   strokeLinecap="round" />
      <line x1="32.2" y1="3.2"  x2="47.8" y2="18.8" stroke="#2B5CA8" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="47.8" y1="3.2"  x2="32.2" y2="18.8" stroke="#2B5CA8" strokeWidth="1.5" strokeLinecap="round" />
      {/* Centre hub */}
      <circle cx="40" cy="11" r="3.2" fill="#2B5CA8" stroke="#1A3E7A" strokeWidth="1" />

      {/* ── Pipe highlight (subtle gloss strip) ────────────────────── */}
      <rect x="8"  y="28" width="64" height="5" rx="2.5" fill="white" opacity="0.18" />
      <rect x="8"  y="36" width="12" height="4"  rx="2"   fill="white" opacity="0.14" />
      <rect x="60" y="36" width="12" height="4"  rx="2"   fill="white" opacity="0.14" />
    </svg>
  );
}
