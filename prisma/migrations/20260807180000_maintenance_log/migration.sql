-- Bed / farm upkeep that was actually done, logged by whoever did it.
--
-- Until now the only maintenance action was "assign task", which needs a
-- manager present to assign it. Supervisors are the ones on the farm, so they
-- can now record the work directly. Assigned tasks are unchanged.

CREATE TABLE "MaintenanceLog" (
    "id"         TEXT NOT NULL,
    "date"       TEXT NOT NULL,
    "activities" JSONB NOT NULL DEFAULT '[]',
    "valveIds"   JSONB NOT NULL DEFAULT '[]',
    "bedsCount"  INTEGER,
    "note"       TEXT,
    "recordedBy" TEXT NOT NULL,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaintenanceLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MaintenanceLog_date_idx" ON "MaintenanceLog"("date");

ALTER TABLE "MaintenanceLog" ADD CONSTRAINT "MaintenanceLog_recordedBy_fkey"
    FOREIGN KEY ("recordedBy") REFERENCES "Farmer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
