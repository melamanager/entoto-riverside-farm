-- Several images per disease report, so the same problem can be shown from
-- different angles and the AI can reason across all of them at once.
--
-- They live in their own table rather than as more columns on DiseaseReport:
-- image bytes then cannot be pulled into a list query by an `include`, which
-- is what made /api/diseases several MB per report.

CREATE TYPE "DiseasePhotoKind" AS ENUM ('symptom', 'proof');

CREATE TABLE "DiseasePhoto" (
    "id"        TEXT NOT NULL,
    "reportId"  TEXT NOT NULL,
    "kind"      "DiseasePhotoKind" NOT NULL DEFAULT 'symptom',
    "data"      TEXT NOT NULL,
    "angle"     TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiseasePhoto_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DiseasePhoto_reportId_kind_idx" ON "DiseasePhoto"("reportId", "kind");

ALTER TABLE "DiseasePhoto" ADD CONSTRAINT "DiseasePhoto_reportId_fkey"
    FOREIGN KEY ("reportId") REFERENCES "DiseaseReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Carry the existing single images across so nothing already captured is lost.
-- The original columns are left in place and keep working.
INSERT INTO "DiseasePhoto" ("id", "reportId", "kind", "data", "angle", "createdBy", "createdAt")
SELECT gen_random_uuid()::text, "id", 'symptom', "photo", NULL, "reportedBy", "reportedAt"
  FROM "DiseaseReport"
 WHERE "photo" IS NOT NULL;

INSERT INTO "DiseasePhoto" ("id", "reportId", "kind", "data", "angle", "createdBy", "createdAt")
SELECT gen_random_uuid()::text, "id", 'proof', "proofImageUrl", NULL, "treatmentAppliedBy", COALESCE("treatmentAppliedAt", CURRENT_TIMESTAMP)
  FROM "DiseaseReport"
 WHERE "proofImageUrl" IS NOT NULL;
