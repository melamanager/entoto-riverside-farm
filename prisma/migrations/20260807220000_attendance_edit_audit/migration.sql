-- Who corrected an already-recorded day, and when.
--
-- Only a manager may change a past date (enforced in the API). recordedBy keeps
-- naming whoever originally took the register, so a correction is traceable
-- rather than silently overwriting the original author.

ALTER TABLE "AttendanceRecord" ADD COLUMN "editedBy" TEXT;
ALTER TABLE "AttendanceRecord" ADD COLUMN "editedAt" TIMESTAMP(3);
