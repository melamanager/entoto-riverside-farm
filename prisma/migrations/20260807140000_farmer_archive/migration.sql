-- Daily and casual workers leave and often come back. Hard-deleting them is
-- refused (and should be) because their attendance and payroll rows are real
-- history. Archiving takes them off the active roster instead, keeping every
-- related record intact and allowing a restore later.
--
-- NULL = on the active roster.

ALTER TABLE "Farmer" ADD COLUMN "archivedAt" TIMESTAMP(3);
