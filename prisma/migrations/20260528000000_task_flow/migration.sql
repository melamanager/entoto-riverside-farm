-- AlterTable
ALTER TABLE "Task" ADD COLUMN "completionNote" TEXT;
ALTER TABLE "Task" ADD COLUMN "parentTaskId" TEXT;
ALTER TABLE "Task" ADD COLUMN "progressNotes" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "Task" ADD COLUMN "reviewedAt" TIMESTAMP(3);
ALTER TABLE "Task" ADD COLUMN "reviewedBy" TEXT;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_parentTaskId_fkey" FOREIGN KEY ("parentTaskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
