-- "Nothing to report today" declarations for routine areas
CREATE TABLE "RoutineNilReport" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "declaredBy" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoutineNilReport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RoutineNilReport_date_area_key" ON "RoutineNilReport"("date", "area");

ALTER TABLE "RoutineNilReport" ADD CONSTRAINT "RoutineNilReport_declaredBy_fkey"
    FOREIGN KEY ("declaredBy") REFERENCES "Farmer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
