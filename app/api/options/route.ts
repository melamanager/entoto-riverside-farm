import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { normalizeOptions, OPTION_DEFAULTS, type OptionKey, type OptionsMap } from "@/lib/options";

const PREFIX = "options.";
const OPTION_KEYS = Object.keys(OPTION_DEFAULTS) as OptionKey[];

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await prisma.appSetting.findMany({
    where: { key: { startsWith: PREFIX } },
  });
  const byKey = new Map(rows.map(row => [row.key.slice(PREFIX.length), row.value]));
  const out = { ...OPTION_DEFAULTS } as OptionsMap;

  for (const key of OPTION_KEYS) {
    const raw = byKey.get(key);
    if (!raw) continue;
    try {
      out[key] = normalizeOptions(JSON.parse(raw), OPTION_DEFAULTS[key]);
    } catch {
      out[key] = OPTION_DEFAULTS[key];
    }
  }

  return NextResponse.json(out);
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (session?.user?.role !== "manager") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json() as Partial<Record<OptionKey, unknown>>;
  for (const key of OPTION_KEYS) {
    if (!(key in body)) continue;
    const value = normalizeOptions(body[key], OPTION_DEFAULTS[key]);
    await prisma.appSetting.upsert({
      where: { key: `${PREFIX}${key}` },
      update: { value: JSON.stringify(value) },
      create: { key: `${PREFIX}${key}`, value: JSON.stringify(value) },
    });
  }

  return NextResponse.json({ ok: true });
}
