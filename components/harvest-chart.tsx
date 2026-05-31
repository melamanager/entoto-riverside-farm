"use client";

import { useState } from "react";

interface Props {
  data: Array<{ date: string; kg: number }>;
}

const W = 600;
const H = 200;
const PAD = { top: 16, right: 16, bottom: 32, left: 42 };
const CW = W - PAD.left - PAD.right;
const CH = H - PAD.top - PAD.bottom;

function smoothPath(pts: { x: number; y: number }[]) {
  if (pts.length < 2) return "";
  let d = `M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1], c = pts[i];
    const dx = (c.x - p.x) / 2.8;
    d += ` C ${(p.x + dx).toFixed(1)},${p.y.toFixed(1)} ${(c.x - dx).toFixed(1)},${c.y.toFixed(1)} ${c.x.toFixed(1)},${c.y.toFixed(1)}`;
  }
  return d;
}

export function HarvestChart({ data }: Props) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const maxKg = Math.max(...data.map(d => d.kg), 1);
  const xOf = (i: number) => PAD.left + (data.length < 2 ? CW / 2 : (i / (data.length - 1)) * CW);
  const yOf = (kg: number) => PAD.top + CH - (kg / maxKg) * CH;

  const pts = data.map((d, i) => ({ x: xOf(i), y: yOf(d.kg), ...d }));
  const line = smoothPath(pts);
  const area = pts.length > 0
    ? `${line} L ${pts[pts.length - 1].x.toFixed(1)},${(PAD.top + CH).toFixed(1)} L ${pts[0].x.toFixed(1)},${(PAD.top + CH).toFixed(1)} Z`
    : "";

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(t => ({
    y: PAD.top + CH * (1 - t),
    label: Math.round(maxKg * t).toString(),
  }));

  const hov = hoverIdx !== null ? pts[hoverIdx] : null;
  const tooltipX = hov ? (hov.x > W * 0.65 ? hov.x - 86 : hov.x + 12) : 0;
  const tooltipY = hov ? Math.max(PAD.top + 2, hov.y - 36) : 0;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height={H}
      style={{ display: "block", overflow: "visible" }}
      onMouseLeave={() => setHoverIdx(null)}
    >
      <defs>
        <linearGradient id="hcFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#dc2626" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#dc2626" stopOpacity="0.01" />
        </linearGradient>
        <linearGradient id="hcLine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#f87171" />
          <stop offset="100%" stopColor="#b91c1c" />
        </linearGradient>
      </defs>

      {/* Y grid + labels */}
      {yTicks.map(t => (
        <g key={t.y}>
          <line x1={PAD.left} y1={t.y} x2={W - PAD.right} y2={t.y}
            stroke="#f1f5f9" strokeWidth="1" />
          <text x={PAD.left - 6} y={t.y + 3.5}
            textAnchor="end" fontSize="9.5" fill="#94a3b8" fontFamily="system-ui">
            {t.label}
          </text>
        </g>
      ))}
      {/* unit */}
      <text x={PAD.left - 6} y={PAD.top - 4}
        textAnchor="end" fontSize="8.5" fill="#cbd5e1" fontFamily="system-ui">kg</text>

      {/* X labels — every ~3rd point */}
      {pts.map((p, i) => {
        if (i % 3 !== 0 && i !== pts.length - 1) return null;
        return (
          <text key={i} x={p.x} y={PAD.top + CH + 22}
            textAnchor="middle" fontSize="9.5" fill="#94a3b8" fontFamily="system-ui">
            {p.date}
          </text>
        );
      })}

      {/* Area + line */}
      <path d={area} fill="url(#hcFill)" />
      <path d={line} fill="none" stroke="url(#hcLine)" strokeWidth="2.2"
        strokeLinejoin="round" strokeLinecap="round" />

      {/* Zero-day dots (days with harvest > 0 as subtle circles) */}
      {pts.map((p, i) => p.kg > 0 && (
        <circle key={i} cx={p.x} cy={p.y} r="2.2"
          fill="#dc2626" opacity={hoverIdx === i ? 0 : 0.45} />
      ))}

      {/* Hover interaction strips */}
      {pts.map((p, i) => {
        const x0 = i === 0 ? PAD.left : (pts[i - 1].x + p.x) / 2;
        const x1 = i === pts.length - 1 ? W - PAD.right : (p.x + pts[i + 1].x) / 2;
        return (
          <rect key={i} x={x0} y={PAD.top} width={x1 - x0} height={CH}
            fill="transparent"
            onMouseEnter={() => setHoverIdx(i)}
            style={{ cursor: "crosshair" }} />
        );
      })}

      {/* Hover visual */}
      {hov && (
        <>
          <line x1={hov.x} y1={PAD.top} x2={hov.x} y2={PAD.top + CH}
            stroke="#dc2626" strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
          <circle cx={hov.x} cy={hov.y} r="6" fill="#dc2626" opacity="0.15" />
          <circle cx={hov.x} cy={hov.y} r="4" fill="#dc2626" />
          <circle cx={hov.x} cy={hov.y} r="2" fill="white" />

          {/* Tooltip box */}
          <g>
            <rect x={tooltipX} y={tooltipY} width="82" height="38"
              rx="7" fill="#0f172a" opacity="0.94" />
            <text x={tooltipX + 41} y={tooltipY + 14}
              textAnchor="middle" fontSize="9.5" fill="#94a3b8" fontFamily="system-ui">
              {hov.date}
            </text>
            <text x={tooltipX + 41} y={tooltipY + 29}
              textAnchor="middle" fontSize="13" fontWeight="700" fill="white" fontFamily="system-ui">
              {hov.kg.toFixed(1)} kg
            </text>
          </g>
        </>
      )}
    </svg>
  );
}
