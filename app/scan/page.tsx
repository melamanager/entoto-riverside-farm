import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BedQR } from "@/components/bed-qr";
import { QRScanner } from "@/components/qr-scanner";
import { BEDS, getValve } from "@/lib/data";
import { QrCode, Camera, Printer, Sprout } from "lucide-react";

export default function ScanPage() {
  const beds = BEDS();
  return (
    <div className="p-6 md:p-8 max-w-[1400px] mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <QrCode className="size-5 text-slate-700" />
            <h1 className="text-2xl font-bold text-slate-900">QR Codes & Scanner</h1>
          </div>
          <p className="text-slate-500 text-sm">Print QR stickers for every bed · Scan any sticker on your phone to open the bed instantly</p>
        </div>
      </div>

      <Tabs defaultValue="print">
        <TabsList className="bg-slate-100">
          <TabsTrigger value="print" className="gap-2"><Printer className="size-3.5"/>Print QR Stickers</TabsTrigger>
          <TabsTrigger value="scan" className="gap-2"><Camera className="size-3.5"/>Scan QR Code</TabsTrigger>
        </TabsList>

        <TabsContent value="scan" className="mt-6">
          <Card className="p-6 max-w-md mx-auto border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Camera className="size-4 text-emerald-600"/>
              <h3 className="font-semibold text-slate-800">QR Scanner</h3>
              <Badge variant="outline" className="text-[10px] ml-auto">Mobile-optimised</Badge>
            </div>
            <QRScanner />
          </Card>
        </TabsContent>

        <TabsContent value="print" className="mt-6">
          {/* Print instructions */}
          <Card className="p-4 mb-5 bg-slate-50 border border-slate-200">
            <div className="flex items-start gap-3">
              <Printer className="size-4 text-slate-500 mt-0.5 shrink-0"/>
              <div className="text-xs text-slate-600">
                <strong className="text-slate-800">How to print:</strong> Press <kbd className="bg-white border border-slate-300 rounded px-1 py-0.5 font-mono text-[10px]">Ctrl+P</kbd> (Windows) or <kbd className="bg-white border border-slate-300 rounded px-1 py-0.5 font-mono text-[10px]">⌘+P</kbd> (Mac). Set paper size to A4. The sidebar and navigation will be hidden automatically in print mode. Cut out each QR and attach to the bed marker post.
              </div>
            </div>
          </Card>

          {/* Group by valve */}
          {["valve-a","valve-b","valve-c"].map(vid => {
            const valve = getValve(vid)!;
            const vBeds = beds.filter(b => b.valveId === vid);
            return (
              <div key={vid} className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className="size-3 rounded-full" style={{background:valve.color}}/>
                  <h3 className="font-semibold text-slate-800">{valve.name}</h3>
                  <Badge variant="outline" className="text-[10px]">{vBeds.length} beds</Badge>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 qr-grid">
                  {vBeds.map(b => {
                    const healthColor = b.health==="healthy"?"border-emerald-200":b.health==="warning"?"border-amber-200":"border-red-200";
                    return (
                      <div key={b.id} className={`flex flex-col items-center text-center p-3 bg-white rounded-xl border-2 hover:shadow-md transition-shadow ${healthColor}`}>
                        <BedQR bedId={b.id} />
                        <div className="mt-2 font-mono text-xs font-bold text-slate-800">{b.id}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5 leading-tight">{b.variety.split(" ").slice(0,2).join(" ")}</div>
                        <div className="text-[9px] text-slate-400">{b.lengthM}m · {b.lengthM*8} plants</div>
                        <div className="mt-1.5">
                          <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${
                            b.health==="healthy"?"bg-emerald-100 text-emerald-700":b.health==="warning"?"bg-amber-100 text-amber-700":"bg-red-100 text-red-700"
                          }`}>{b.health}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </TabsContent>
      </Tabs>
    </div>
  );
}
