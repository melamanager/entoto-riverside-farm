-- Mark the morning and afternoon sessions independently, so someone can work
-- the morning and be absent after lunch. `status` stays as the derived
-- whole-day summary, so existing reads keep working.
--
-- Nullable: existing rows have no per-session breakdown, and the app falls back
-- to the whole-day `status` for them (see lib/attendance.ts → dayWeight).

ALTER TABLE "AttendanceRecord" ADD COLUMN "morningStatus" "AttendanceStatus";
ALTER TABLE "AttendanceRecord" ADD COLUMN "afternoonStatus" "AttendanceStatus";

-- Backfill: for records already marked, assume both sessions matched the day.
UPDATE "AttendanceRecord"
   SET "morningStatus" = "status",
       "afternoonStatus" = "status"
 WHERE "morningStatus" IS NULL;
