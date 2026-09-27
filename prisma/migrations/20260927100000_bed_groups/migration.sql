-- Sub-groups of beds under a valve — "Valve A · Beds 1-4".
--
-- The unit one worker is responsible for, the unit a QR stake identifies, and
-- the unit harvest / packaging / maintenance will roll up to.
--
-- Bed.groupId is nullable: beds outside any group keep working exactly as
-- before, so this can be adopted valve by valve.

CREATE TABLE "BedGroup" (
    "id"        TEXT NOT NULL,
    "valveId"   TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "nameAm"    TEXT,
    "code"      TEXT NOT NULL,
    "note"      TEXT,
    "active"    BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BedGroup_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BedGroup_code_key" ON "BedGroup"("code");
CREATE INDEX "BedGroup_valveId_idx" ON "BedGroup"("valveId");

ALTER TABLE "BedGroup" ADD CONSTRAINT "BedGroup_valveId_fkey"
    FOREIGN KEY ("valveId") REFERENCES "Valve"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Who was accountable for a group, and when. Work records still snapshot who
-- actually did the job; this answers who was responsible on a given date,
-- including for work that never got done.
CREATE TABLE "GroupAssignment" (
    "id"         TEXT NOT NULL,
    "groupId"    TEXT NOT NULL,
    "farmerId"   TEXT NOT NULL,
    "fromDate"   TEXT NOT NULL,
    "toDate"     TEXT,
    "assignedBy" TEXT NOT NULL,
    "note"       TEXT,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupAssignment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GroupAssignment_groupId_fromDate_idx" ON "GroupAssignment"("groupId", "fromDate");

ALTER TABLE "GroupAssignment" ADD CONSTRAINT "GroupAssignment_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "BedGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GroupAssignment" ADD CONSTRAINT "GroupAssignment_farmerId_fkey"
    FOREIGN KEY ("farmerId") REFERENCES "Farmer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Bed" ADD COLUMN "groupId" TEXT;
ALTER TABLE "Bed" ADD CONSTRAINT "Bed_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "BedGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
