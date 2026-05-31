"use client";

import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";

export function BedQR({ bedId }: { bedId: string }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    setUrl(`${window.location.origin}/scan/${bedId}`);
  }, [bedId]);
  return (
    <div className="bg-card p-3 rounded-lg border border-border inline-flex flex-col items-center gap-1">
      {url ? <QRCodeSVG value={url} size={120} bgColor="#ffffff" fgColor="#0f172a" level="M" /> : <div className="size-[120px] bg-muted animate-pulse rounded" />}
      <div className="text-[10px] text-muted-foreground font-mono">{bedId}</div>
    </div>
  );
}
