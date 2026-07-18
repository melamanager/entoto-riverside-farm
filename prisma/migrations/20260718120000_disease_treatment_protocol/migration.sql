-- AlterTable
ALTER TABLE "DiseaseReport" ADD COLUMN "treatmentProgress" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "DiseaseReport" ADD COLUMN "taskId" TEXT;
