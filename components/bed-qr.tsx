"use client";

import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";

export function BedQR({ bedId }: { bedId: string }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    setUrl(`${window.location.origin}/scan/${bedId}`);
  }, [bedId]);
  return (
    <div className="bg-white p-3 rounded-lg border inline-flex flex-col items-center gap-1">
      {url ? <QRCodeSVG value={url} size={120} bgColor="#ffffff" fgColor="#0f172a" level="M" /> : <div className="size-[120px] bg-stone-100 animate-pulse rounded" />}
      <div className="text-[10px] text-stone-500 font-mono">{bedId}</div>
    </div>
  );
}
