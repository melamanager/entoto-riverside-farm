-- CreateEnum
CREATE TYPE "IrrigationStatus" AS ENUM ('done', 'partial', 'skipped');

-- CreateEnum
CREATE TYPE "DailyNoteType" AS ENUM ('instruction', 'report', 'issue', 'note');

-- AlterEnum
ALTER TYPE "TaskCategory" ADD VALUE 'maintenance';

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'message';

-- AlterTable
ALTER TABLE "AttendanceRecord" ADD COLUMN "overtimeHours" DOUBLE PRECISION DEFAULT 0;

-- CreateTable
CREATE TABLE "IrrigationLog" (
    "id" TEXT NOT NULL,
    "valveId" TEXT NOT NULL,
    "bedId" TEXT,
    "date" TEXT NOT NULL,
    "startTime" TEXT,
    "durationMin" DOUBLE PRECISION,
    "waterVolumeL" DOUBLE PRECISION,
    "status" "IrrigationStatus" NOT NULL DEFAULT 'done',
    "notes" TEXT,
    "recordedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IrrigationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IrrigationLog_date_idx" ON "IrrigationLog"("date");

-- AddForeignKey
ALTER TABLE "IrrigationLog" ADD CONSTRAINT "IrrigationLog_valveId_fkey" FOREIGN KEY ("valveId") REFERENCES "Valve"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IrrigationLog" ADD CONSTRAINT "IrrigationLog_bedId_fkey" FOREIGN KEY ("bedId") REFERENCES "Bed"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IrrigationLog" ADD CONSTRAINT "IrrigationLog_recordedBy_fkey" FOREIGN KEY ("recordedBy") REFERENCES "Farmer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "DailyNote" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "type" "DailyNoteType" NOT NULL DEFAULT 'note',
    "body" TEXT NOT NULL,
    "valveId" TEXT,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "readBy" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyNote_date_idx" ON "DailyNote"("date");

-- AddForeignKey
ALTER TABLE "DailyNote" ADD CONSTRAINT "DailyNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Farmer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyNote" ADD CONSTRAINT "DailyNote_valveId_fkey" FOREIGN KEY ("valveId") REFERENCES "Valve"("id") ON DELETE SET NULL ON UPDATE CASCADE;
