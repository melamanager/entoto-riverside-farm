"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, CheckCircle2, AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function QRScanner() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<unknown>(null);
  const [status, setStatus] = useState<"idle" | "scanning" | "success" | "error">("idle");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string>("");

  async function startScanner() {
    setStatus("scanning");
    setResult(null);
    setError("");
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode("qr-reader");
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText: string) => {
          setResult(decodedText);
          setStatus("success");
          scanner.stop().catch(() => {});
          // Extract bed ID from URL and navigate
          try {
            const url = new URL(decodedText);
            const pathParts = url.pathname.split("/");
            const bedIdx = pathParts.indexOf("beds");
            const scanIdx = pathParts.indexOf("scan");
            const idx = bedIdx !== -1 ? bedIdx : scanIdx;
            if (idx !== -1 && pathParts[idx + 1]) {
              setTimeout(() => router.push(`/beds/${pathParts[idx + 1]}`), 1200);
            }
          } catch {
            // Not a URL — show raw result
          }
        },
        () => {}
      );
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Could not access camera");
    }
  }

  async function stopScanner() {
    if (scannerRef.current) {
      try {
        // @ts-expect-error dynamic import type
        await scannerRef.current.stop();
      } catch {}
    }
    setStatus("idle");
  }

  useEffect(() => () => { stopScanner(); }, []);

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        id="qr-reader"
        ref={containerRef}
        className={`w-full max-w-xs rounded-xl overflow-hidden border-2 ${
          status === "scanning" ? "border-primary" : "border-border"
        } bg-black`}
        style={{ minHeight: 280 }}
      />

      {status === "idle" && (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <div className="size-16 rounded-2xl bg-muted grid place-items-center">
            <Camera className="size-8 text-muted-foreground" />
          </div>
          <div>
            <div className="font-semibold text-foreground">Scan a Bed QR Code</div>
            <div className="text-xs text-muted-foreground mt-1">Point your camera at any bed QR sticker to open its profile instantly</div>
          </div>
          <Button onClick={startScanner} className="bg-primary hover:bg-primary/90 gap-2 mt-2">
            <Camera className="size-4" /> Open Camera
          </Button>
        </div>
      )}

      {status === "scanning" && (
        <div className="flex items-center justify-between w-full max-w-xs">
          <div className="text-sm text-primary font-medium flex items-center gap-2">
            <span className="size-2 rounded-full bg-primary animate-pulse" />
            Scanning…
          </div>
          <Button size="sm" variant="outline" onClick={stopScanner}><X className="size-3.5" /> Stop</Button>
        </div>
      )}

      {status === "success" && (
        <div className="flex items-center gap-2 bg-primary/10 border border-primary/30 rounded-lg px-4 py-3 w-full max-w-xs">
          <CheckCircle2 className="size-5 text-primary shrink-0" />
          <div>
            <div className="text-sm font-semibold text-primary">QR Detected!</div>
            <div className="text-[11px] text-primary/70 truncate">{result}</div>
            <div className="text-[11px] text-primary/70 mt-0.5">Redirecting to bed profile…</div>
          </div>
        </div>
      )}

      {status === "error" && (
        <div className="flex flex-col items-center gap-2 w-full max-w-xs">
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 w-full">
            <AlertCircle className="size-4 text-red-600 shrink-0" />
            <div className="text-xs text-red-700">{error || "Camera access denied. Please allow camera permissions."}</div>
          </div>
          <Button size="sm" variant="outline" onClick={startScanner}>Try Again</Button>
        </div>
      )}
    </div>
  );
}
