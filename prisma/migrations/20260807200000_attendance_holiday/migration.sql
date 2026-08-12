-- "Holiday" attendance: Sundays and public holidays, when the farm is closed.
--
-- Without it the only honest options were to leave the day unrecorded (which
-- looks the same as forgetting to take attendance) or to mark everyone absent
-- (which is wrong, and drags their attendance rate down for a day they were
-- never expected).
--
-- Holiday is not worked and not absent: it is excluded from the attendance
-- denominator entirely, so it costs nobody anything.
--
-- Note: Postgres allows ADD VALUE inside a transaction from v12, provided the
-- new value is not USED in the same transaction — so nothing here writes it.

ALTER TYPE "AttendanceStatus" ADD VALUE IF NOT EXISTS 'holiday';
