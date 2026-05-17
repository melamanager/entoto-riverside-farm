import { getWeather, calcDiseaseRisks } from "@/lib/weather";
import { Cloud, Droplets, Wind, Sun, AlertTriangle, CheckCircle2, Wifi, WifiOff } from "lucide-react";

const RISK_STYLE = {
  High:   { badge: "bg-red-100 text-red-700 border border-red-200",         dot: "bg-red-500",     bar: "bg-red-500"     },
  Medium: { badge: "bg-amber-100 text-amber-700 border border-amber-200",   dot: "bg-amber-500",   bar: "bg-amber-400"   },
  Low:    { badge: "bg-emerald-100 text-emerald-700 border border-emerald-200", dot: "bg-emerald-500", bar: "bg-emerald-500" },
} as const;

const UV_LABEL = (uv: number) =>
  uv <= 2 ? "Low" : uv <= 5 ? "Moderate" : uv <= 7 ? "High" : "Very High";

export async function WeatherWidget() {
  const weather = await getWeather();
  const risks   = calcDiseaseRisks(weather);
  const highRisks = risks.filter(r => r.risk === "High").length;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden h-full flex flex-col">

      {/* ── Conditions header ───────────────────────────────────────────── */}
      <div className="px-5 py-4 bg-gradient-to-br from-sky-50 via-blue-50 to-white border-b border-slate-100">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
              {weather.source === "live" ? (
                <><Wifi className="size-3 text-emerald-500" /> Live · Addis Ababa</>
              ) : (
                <><WifiOff className="size-3 text-amber-500" /> Simulated · Add Tomorrow.io key</>
              )}
            </div>
            <div className="flex items-end gap-3">
              <span className="text-5xl font-black text-slate-900 tracking-tight">{weather.tempC}°</span>
              <span className="text-4xl leading-none mb-1">{weather.conditionIcon}</span>
            </div>
            <div className="text-sm font-medium text-slate-600 mt-1">{weather.condition}</div>
          </div>

          {/* Side metrics */}
          <div className="space-y-2.5 text-right shrink-0">
            <div className="flex items-center gap-1.5 justify-end">
              <div className="text-right">
                <div className="text-sm font-bold text-slate-800">{weather.humidity}%</div>
                <div className="text-[10px] text-slate-400">humidity</div>
              </div>
              <div className="size-7 rounded-lg bg-blue-100 grid place-items-center">
                <Droplets className="size-3.5 text-blue-600" />
              </div>
            </div>
            <div className="flex items-center gap-1.5 justify-end">
              <div className="text-right">
                <div className="text-sm font-bold text-slate-800">{weather.windKph} km/h</div>
                <div className="text-[10px] text-slate-400">wind</div>
              </div>
              <div className="size-7 rounded-lg bg-slate-100 grid place-items-center">
                <Wind className="size-3.5 text-slate-500" />
              </div>
            </div>
            <div className="flex items-center gap-1.5 justify-end">
              <div className="text-right">
                <div className="text-sm font-bold text-slate-800">UV {weather.uvIndex}</div>
                <div className="text-[10px] text-slate-400">{UV_LABEL(weather.uvIndex)}</div>
              </div>
              <div className="size-7 rounded-lg bg-amber-100 grid place-items-center">
                <Sun className="size-3.5 text-amber-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Precip / rain warning */}
        {weather.precipMmH > 0.5 && (
          <div className="mt-3 flex items-center gap-1.5 text-[11px] text-sky-700 bg-sky-100 border border-sky-200 rounded-lg px-2.5 py-1.5">
            <Cloud className="size-3 shrink-0" />
            Active precipitation: {weather.precipMmH.toFixed(1)} mm/hr — consider irrigation pause
          </div>
        )}

        {/* Updated time */}
        {weather.source === "live" && (
          <div className="mt-2 text-[10px] text-slate-400">
            Updated {new Date(weather.fetchedAt).toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" })}
          </div>
        )}
      </div>

      {/* ── Disease risk section ─────────────────────────────────────────── */}
      <div className="px-5 py-4 flex-1">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">Disease Risk Today</div>
          {highRisks > 0 ? (
            <div className="flex items-center gap-1 text-[11px] text-red-600 font-bold bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
              <AlertTriangle className="size-3" /> {highRisks} High Risk
            </div>
          ) : (
            <div className="flex items-center gap-1 text-[11px] text-emerald-600 font-bold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
              <CheckCircle2 className="size-3" /> All Clear
            </div>
          )}
        </div>

        <div className="space-y-3">
          {risks.map(r => {
            const s = RISK_STYLE[r.risk];
            return (
              <div key={r.name} className="flex items-start gap-3">
                <div className="mt-1 shrink-0">
                  <span className={`inline-block size-2 rounded-full ${s.dot}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className="text-xs font-semibold text-slate-800">{r.name}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${s.badge}`}>{r.risk}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 leading-snug">{r.reason}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Spray advisory */}
        {highRisks > 0 && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
            <div className="text-[11px] font-bold text-amber-800 mb-0.5">⚠️ Spray Advisory</div>
            <div className="text-[10px] text-amber-700 leading-relaxed">
              Current conditions favour disease spread. Inspect all beds today. Manager should issue treatment recommendations via Disease Management.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
