"use client";

import { useState, useEffect, useId } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface Props {
  data: Array<{ date: string; kg: number }>;
}

export function HarvestChart({ data }: Props) {
  const [mounted, setMounted] = useState(false);
  const uid = useId().replace(/:/g, "");
  const gradientId = `harvestG-${uid}`;

  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return <div style={{ height: 220 }} />;

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ef4444" stopOpacity={0.8} />
            <stop offset="100%" stopColor="#ef4444" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7e5e4" />
        <XAxis dataKey="date" fontSize={11} stroke="#78716c" tickLine={false} axisLine={false} />
        <YAxis fontSize={11} stroke="#78716c" tickLine={false} axisLine={false} unit=" kg" />
        <Tooltip
          contentStyle={{ borderRadius: 10, border: "1px solid #e7e5e4", fontSize: 12 }}
          formatter={(v) => [`${Number(v).toFixed(1)} kg`, "Harvest"]}
        />
        <Area type="monotone" dataKey="kg" stroke="#dc2626" strokeWidth={2} fill={`url(#${gradientId})`} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
