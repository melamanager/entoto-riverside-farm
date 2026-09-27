-- Harvest rolls up to the sub-group, and field waste becomes a real number.
--
-- groupId is a SNAPSHOT taken when the pick is logged, not a lookup through
-- the bed: re-grouping beds for a new season must not rewrite which group last
-- season's picking belonged to. Existing rows stay NULL — they were picked
-- before groups existed, and pretending otherwise would invent history.
--
-- wasteKg is FIELD waste (rotten, damaged, overripe, left behind), which is
-- what says something about the picking. Pack-house rejects already live on
-- PackagingRecord and mean something different.

ALTER TABLE "HarvestRecord" ADD COLUMN "groupId" TEXT;
ALTER TABLE "HarvestRecord" ADD COLUMN "wasteKg" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "HarvestRecord" ADD COLUMN "wasteReason" TEXT;

CREATE INDEX "HarvestRecord_groupId_date_idx" ON "HarvestRecord"("groupId", "date");

ALTER TABLE "HarvestRecord" ADD CONSTRAINT "HarvestRecord_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "BedGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
