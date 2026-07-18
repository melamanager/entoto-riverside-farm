-- CreateTable
CREATE TABLE "RoutineAck" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "supervisorId" TEXT NOT NULL,
    "ackBy" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoutineAck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RoutineAck_date_supervisorId_key" ON "RoutineAck"("date", "supervisorId");

-- AddForeignKey
ALTER TABLE "RoutineAck" ADD CONSTRAINT "RoutineAck_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "Farmer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutineAck" ADD CONSTRAINT "RoutineAck_ackBy_fkey" FOREIGN KEY ("ackBy") REFERENCES "Farmer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
