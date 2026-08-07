-- Split the farm day into two sessions around the lunch break.
--   checkInTime          → morning arrival
--   morningCheckOutTime  → leaves for lunch (≈12:00)
--   afternoonCheckInTime → returns from lunch (≈13:00)
--   checkOutTime         → end of day
-- Both columns are nullable so existing single-session records stay valid.

ALTER TABLE "AttendanceRecord" ADD COLUMN "morningCheckOutTime" TEXT;
ALTER TABLE "AttendanceRecord" ADD COLUMN "afternoonCheckInTime" TEXT;
