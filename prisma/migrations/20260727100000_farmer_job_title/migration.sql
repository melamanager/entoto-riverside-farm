-- Job title (Driver, Cleaner, Guard…) — a manager-managed label, separate from
-- `role`, which stays the access level that drives permissions.
ALTER TABLE "Farmer" ADD COLUMN "jobTitle" TEXT;

-- Extra capabilities a manager grants to an individual (e.g. let a driver take
-- attendance). Additive on top of whatever their role already allows.
ALTER TABLE "Farmer" ADD COLUMN "permissions" JSONB NOT NULL DEFAULT '[]';
