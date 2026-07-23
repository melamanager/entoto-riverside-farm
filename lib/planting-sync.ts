import { prisma } from "@/lib/prisma";
import { liveStage } from "@/lib/planting";
import { todayAddis } from "@/lib/dates";

// Close the Bed loop: make the Bed reflect its planting. The app has two record
// of what's in a bed — PlantingRecord and the Bed's own plantedDate/variety/
// stage that map, dashboard and origin stats read — and they used to drift.
// Called after any planting create/update so Planting becomes the source of
// truth and the rest of the app stays in sync.
export async function syncBedFromPlanting(plantingId: string): Promise<void> {
  const p = await prisma.plantingRecord.findUnique({ where: { id: plantingId } });
  if (!p) return;

  // planned = nothing in the ground yet; failed = don't rewrite the bed.
  if (p.status === "planned" || p.status === "failed") return;

  const data: { plantedDate?: string; variety?: string; stage?: string } = { variety: p.variety };
  if (p.actualDate) data.plantedDate = p.actualDate;
  data.stage = p.status === "harvested" ? "harvest" : liveStage(p, todayAddis());

  await prisma.bed.update({ where: { id: p.bedId }, data: data as never }).catch(() => {
    /* bed missing — planting references a bed id that isn't there; ignore */
  });
}
