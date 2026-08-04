-- Farm-team feedback batch:
-- 1. field notes on harvest + packaging that reach the manager
-- 2. payment frequency for the accountant
-- 3. per-bed crop so other produce doesn't mix with strawberry records
ALTER TABLE "HarvestRecord" ADD COLUMN "note" TEXT;
ALTER TABLE "PackagingRecord" ADD COLUMN "notes" TEXT;
ALTER TABLE "Farmer" ADD COLUMN "payFrequency" TEXT;
ALTER TABLE "Bed" ADD COLUMN "crop" TEXT NOT NULL DEFAULT 'Strawberry';
