-- AlterTable
ALTER TABLE "Notification" ADD COLUMN "recipientId" TEXT;
ALTER TABLE "Notification" ADD COLUMN "recipientRole" TEXT;

-- CreateIndex
CREATE INDEX "Notification_recipientId_idx" ON "Notification"("recipientId");
CREATE INDEX "Notification_recipientRole_idx" ON "Notification"("recipientRole");
