import { QrSheet } from "@/components/qr-sheet";

/**
 * Server component on purpose: the QR payload has to be the farm's real public
 * address. Building it from window.location would mint stakes pointing at
 * whatever machine happened to print them — localhost included.
 */
export default function QrCodesPage() {
  const baseUrl = process.env.APP_PUBLIC_URL || "https://entoto.melaverse.net";
  return <QrSheet baseUrl={baseUrl.replace(/\/+$/, "")} />;
}
