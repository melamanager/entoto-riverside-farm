-- Maintenance can follow the sub-group, not just the whole valve.
--
-- One worker owns a stretch of beds, so "weeded Sub-Group A" is the natural
-- unit. valveIds stays for work that genuinely covers a whole zone.
ALTER TABLE "MaintenanceLog" ADD COLUMN "groupIds" JSONB NOT NULL DEFAULT '[]';
