-- Link a planting to the "plant this bed" task it generates (dedup, mirrors DiseaseReport.taskId)
ALTER TABLE "PlantingRecord" ADD COLUMN "taskId" TEXT;
