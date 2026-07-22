-- Personal recurring AI jobs managed from the Telegram agent
CREATE TABLE "ScheduledJob" (
    "id" TEXT NOT NULL,
    "farmerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "timeHHMM" TEXT NOT NULL,
    "daysOfWeek" JSONB NOT NULL DEFAULT '[0,1,2,3,4,5,6]',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastRunDate" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduledJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ScheduledJob_active_idx" ON "ScheduledJob"("active");

ALTER TABLE "ScheduledJob" ADD CONSTRAINT "ScheduledJob_farmerId_fkey"
    FOREIGN KEY ("farmerId") REFERENCES "Farmer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
