import { prisma } from "@/lib/prisma";
import { CONFIG_DEFAULTS, CONFIG_KEYS, NUM_KEYS, STR_KEYS, BOOL_KEYS, TIME_RE, type FarmConfig } from "@/lib/config";

// server-side: read the live config (falls back to defaults on any error)
export async function getFarmConfig(): Promise<FarmConfig> {
  try {
    const rows = await prisma.appSetting.findMany({ where: { key: { in: CONFIG_KEYS } } });
    const map = new Map(rows.map((r) => [r.key, r.value]));
    const cfg: FarmConfig = { ...CONFIG_DEFAULTS };
    if (map.has("farm_name")) cfg.farmName = map.get("farm_name")!;
    for (const [k, field] of Object.entries(NUM_KEYS)) {
      const v = map.get(k);
      if (v != null && Number.isFinite(Number(v))) (cfg[field] as number) = Number(v);
    }
    // times are only accepted in "HH:MM"; anything else falls back to the default
    for (const [k, field] of Object.entries(STR_KEYS)) {
      const v = map.get(k);
      if (v != null && TIME_RE.test(v)) (cfg[field] as string) = v;
    }
    for (const [k, field] of Object.entries(BOOL_KEYS)) {
      const v = map.get(k);
      if (v != null) (cfg[field] as boolean) = v === "true" || v === "1";
    }
    return cfg;
  } catch {
    return { ...CONFIG_DEFAULTS };
  }
}
