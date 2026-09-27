-- Packing follows the sub-group, and disease-affected fruit gets its own number.
--
-- One batch draws from one sub-group, so linking the batch to the group makes
-- "how much did this group sell" exact — PackagingRecord already carries
-- orderId, so the chain group -> batch -> order is complete.
--
-- diseasedKg is separate from rejectedKg on purpose. "Bruised in handling" and
-- "grey mould" are both rejects but point at completely different problems:
-- one is the packing, the other is the bed.

ALTER TABLE "PackagingRecord" ADD COLUMN "groupId" TEXT;
ALTER TABLE "PackagingRecord" ADD COLUMN "diseasedKg" DECIMAL(10,2) NOT NULL DEFAULT 0;

CREATE INDEX "PackagingRecord_groupId_packedDate_idx" ON "PackagingRecord"("groupId", "packedDate");

ALTER TABLE "PackagingRecord" ADD CONSTRAINT "PackagingRecord_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "BedGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
