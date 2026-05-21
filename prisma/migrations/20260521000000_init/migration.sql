Loaded Prisma config from prisma.config.ts.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "FarmerRole" AS ENUM ('farmer', 'supervisor', 'manager');

-- CreateEnum
CREATE TYPE "HealthStatus" AS ENUM ('healthy', 'warning', 'infected');

-- CreateEnum
CREATE TYPE "GrowthStage" AS ENUM ('planted', 'vegetative', 'flowering', 'fruiting', 'ripening', 'harvest');

-- CreateEnum
CREATE TYPE "DiseaseType" AS ENUM ('powdery_mildew', 'root_rot', 'gray_mold', 'leaf_spot', 'nitrogen_deficiency');

-- CreateEnum
CREATE TYPE "DiseaseStatus" AS ENUM ('open', 'notified', 'treating', 'resolved');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('pending', 'in_progress', 'done');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('low', 'medium', 'high');

-- CreateEnum
CREATE TYPE "TaskCategory" AS ENUM ('disease', 'harvest', 'irrigation', 'inspection', 'general');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('present', 'absent', 'late', 'leave');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('disease', 'harvest', 'irrigation', 'task');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('telegram', 'sms', 'in_app');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('fuel', 'chemicals', 'seeds', 'labour', 'equipment', 'packaging', 'repairs', 'other');

-- CreateEnum
CREATE TYPE "PlantingStatus" AS ENUM ('planned', 'planted', 'growing', 'harvested', 'failed');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('irrigation_check', 'disease_inspection', 'harvesting', 'cleaning', 'pruning', 'fertilizing', 'packaging', 'general');

-- CreateEnum
CREATE TYPE "ShiftType" AS ENUM ('morning', 'afternoon', 'full_day');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('assigned', 'in_progress', 'completed');

-- CreateEnum
CREATE TYPE "ApplicationMethod" AS ENUM ('drip', 'foliar', 'soil_drench');

-- CreateEnum
CREATE TYPE "FertigationStatus" AS ENUM ('scheduled', 'applied', 'skipped');

-- CreateEnum
CREATE TYPE "PackageSize" AS ENUM ('250g', '500g', '1kg', '2kg', 'bulk');

-- CreateEnum
CREATE TYPE "PackagingStatus" AS ENUM ('in_progress', 'packed', 'dispatched');

-- CreateEnum
CREATE TYPE "PackagingPurpose" AS ENUM ('export', 'juice', 'jam', 'local', 'hotel', 'supermarket');

-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('hotel', 'supermarket', 'restaurant', 'direct', 'export');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'partial', 'paid', 'overdue');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('pending', 'in_transit', 'delivered', 'cancelled');

-- CreateEnum
CREATE TYPE "PayrollStatus" AS ENUM ('pending', 'processed', 'paid');

-- CreateEnum
CREATE TYPE "StockCategory" AS ENUM ('fertilizer', 'pesticide', 'packaging', 'tool', 'seed', 'other');

-- CreateEnum
CREATE TYPE "StockUnit" AS ENUM ('kg', 'L', 'g', 'ml', 'piece', 'box', 'bag', 'roll');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('stock_in', 'stock_out', 'adjustment', 'waste');

-- CreateEnum
CREATE TYPE "FollowUpEntityType" AS ENUM ('disease', 'planting', 'fertigation', 'task', 'general');

-- CreateEnum
CREATE TYPE "FollowUpStatus" AS ENUM ('pending', 'done', 'overdue');

-- CreateEnum
CREATE TYPE "FollowUpPriority" AS ENUM ('low', 'normal', 'urgent');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "farmerId" TEXT NOT NULL,
    "email" TEXT,
    "passwordHash" TEXT NOT NULL,
    "lastLogin" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Farmer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "avatar" TEXT NOT NULL,
    "role" "FarmerRole" NOT NULL,
    "performanceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "attendanceRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "joinedDate" TEXT NOT NULL,
    "assignedValves" JSONB NOT NULL DEFAULT '[]',
    "nationalId" TEXT,
    "emergencyContact" TEXT,

    CONSTRAINT "Farmer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Valve" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "irrigationSchedule" TEXT NOT NULL,
    "supervisorId" TEXT NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "width" DOUBLE PRECISION NOT NULL,
    "height" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "Valve_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bed" (
    "id" TEXT NOT NULL,
    "valveId" TEXT NOT NULL,
    "lengthM" DOUBLE PRECISION NOT NULL,
    "plantsPerMeter" DOUBLE PRECISION NOT NULL,
    "variety" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "plantedDate" TEXT NOT NULL,
    "stage" "GrowthStage" NOT NULL,
    "health" "HealthStatus" NOT NULL DEFAULT 'healthy',
    "farmerId" TEXT NOT NULL,
    "row" INTEGER NOT NULL,
    "col" INTEGER NOT NULL,

    CONSTRAINT "Bed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HarvestRecord" (
    "id" TEXT NOT NULL,
    "bedId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "kg" DECIMAL(10,2) NOT NULL,
    "farmerId" TEXT NOT NULL,
    "qualityGrade" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HarvestRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiseaseReport" (
    "id" TEXT NOT NULL,
    "bedId" TEXT NOT NULL,
    "type" "DiseaseType" NOT NULL,
    "severity" INTEGER NOT NULL,
    "reportedAt" TIMESTAMP(3) NOT NULL,
    "reportedBy" TEXT NOT NULL,
    "status" "DiseaseStatus" NOT NULL DEFAULT 'open',
    "photo" TEXT,
    "aiConfidence" DOUBLE PRECISION,
    "infectedLengthM" DOUBLE PRECISION,
    "suggestedTreatment" TEXT NOT NULL,
    "treatmentSteps" JSONB NOT NULL DEFAULT '[]',
    "treatmentApplied" BOOLEAN NOT NULL DEFAULT false,
    "treatmentAppliedAt" TIMESTAMP(3),
    "treatmentAppliedBy" TEXT,
    "treatmentNote" TEXT,
    "managerNotified" BOOLEAN NOT NULL DEFAULT false,
    "notifiedAt" TIMESTAMP(3),
    "notificationChannels" JSONB NOT NULL DEFAULT '[]',
    "managerRecommendation" TEXT,
    "requiresImageProof" BOOLEAN,
    "proofImageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiseaseReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "assignedTo" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "bedId" TEXT,
    "valveId" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'pending',
    "priority" "TaskPriority" NOT NULL DEFAULT 'medium',
    "category" "TaskCategory" NOT NULL DEFAULT 'general',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "progressNote" TEXT,
    "requiresImageProof" BOOLEAN,
    "proofImageUrl" TEXT,
    "workerAssignments" JSONB NOT NULL DEFAULT '[]',
    "requiresFollowUp" BOOLEAN,
    "followUpDueDate" TEXT,
    "managerNote" TEXT,
    "overdueNotifiedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceRecord" (
    "id" TEXT NOT NULL,
    "farmerId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "checkInTime" TEXT,
    "checkOutTime" TEXT,
    "hoursWorked" DOUBLE PRECISION,
    "recordedBy" TEXT NOT NULL,
    "note" TEXT,
    "bedId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "message" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "link" TEXT,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "amountETB" DECIMAL(12,2) NOT NULL,
    "paidBy" TEXT NOT NULL,
    "vendor" TEXT,
    "receiptRef" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlantingRecord" (
    "id" TEXT NOT NULL,
    "bedId" TEXT NOT NULL,
    "valveId" TEXT NOT NULL,
    "variety" TEXT NOT NULL,
    "plannedDate" TEXT NOT NULL,
    "actualDate" TEXT,
    "expectedHarvestDate" TEXT NOT NULL,
    "ageInDays" INTEGER NOT NULL,
    "seedsPerMeter" DOUBLE PRECISION NOT NULL,
    "seedSource" TEXT NOT NULL,
    "status" "PlantingStatus" NOT NULL DEFAULT 'planned',
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlantingRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerAssignment" (
    "id" TEXT NOT NULL,
    "farmerId" TEXT NOT NULL,
    "valveId" TEXT,
    "bedId" TEXT,
    "activity" "ActivityType" NOT NULL,
    "supervisorId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "shift" "ShiftType" NOT NULL,
    "hoursExpected" DOUBLE PRECISION NOT NULL,
    "hoursActual" DOUBLE PRECISION,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'assigned',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkerAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FertigationRecord" (
    "id" TEXT NOT NULL,
    "valveId" TEXT NOT NULL,
    "bedId" TEXT,
    "fertilizerType" TEXT NOT NULL,
    "activeIngredient" TEXT NOT NULL,
    "dosageGPerL" DOUBLE PRECISION NOT NULL,
    "waterVolumeLiters" DOUBLE PRECISION NOT NULL,
    "applicationDate" TEXT NOT NULL,
    "nextScheduleDate" TEXT NOT NULL,
    "responsibleWorkerId" TEXT NOT NULL,
    "applicationMethod" "ApplicationMethod" NOT NULL,
    "status" "FertigationStatus" NOT NULL DEFAULT 'scheduled',
    "cost" DECIMAL(10,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FertigationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackagingRecord" (
    "id" TEXT NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "harvestDate" TEXT NOT NULL,
    "packedDate" TEXT NOT NULL,
    "valveId" TEXT NOT NULL,
    "variety" TEXT NOT NULL,
    "harvestedKg" DECIMAL(10,2) NOT NULL,
    "gradedKg" DECIMAL(10,2) NOT NULL,
    "packedKg" DECIMAL(10,2) NOT NULL,
    "rejectedKg" DECIMAL(10,2) NOT NULL,
    "packageSize" "PackageSize" NOT NULL,
    "packageCount" INTEGER NOT NULL,
    "cartonCount" INTEGER NOT NULL,
    "plateCount" INTEGER NOT NULL,
    "lostKg" DECIMAL(10,2) NOT NULL,
    "purpose" "PackagingPurpose" NOT NULL,
    "gradeAPct" DOUBLE PRECISION NOT NULL,
    "gradeBPct" DOUBLE PRECISION NOT NULL,
    "packedBy" TEXT NOT NULL,
    "status" "PackagingStatus" NOT NULL DEFAULT 'in_progress',
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PackagingRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerOrder" (
    "id" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerType" "CustomerType" NOT NULL,
    "orderDate" TEXT NOT NULL,
    "deliveryDate" TEXT NOT NULL,
    "quantityKg" DECIMAL(10,2) NOT NULL,
    "pricePerKg" DECIMAL(10,2) NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "advancePaid" DECIMAL(12,2) NOT NULL,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "deliveryStatus" "DeliveryStatus" NOT NULL DEFAULT 'pending',
    "variety" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollRecord" (
    "id" TEXT NOT NULL,
    "farmerId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "daysWorked" INTEGER NOT NULL,
    "dailyWage" DECIMAL(10,2) NOT NULL,
    "basePay" DECIMAL(12,2) NOT NULL,
    "overtimeHours" DOUBLE PRECISION NOT NULL,
    "overtimePay" DECIMAL(10,2) NOT NULL,
    "bonus" DECIMAL(10,2) NOT NULL,
    "deductions" DECIMAL(10,2) NOT NULL,
    "netPay" DECIMAL(12,2) NOT NULL,
    "paymentStatus" "PayrollStatus" NOT NULL DEFAULT 'pending',
    "paidDate" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "StockCategory" NOT NULL,
    "unit" "StockUnit" NOT NULL,
    "currentQty" DECIMAL(12,3) NOT NULL,
    "reorderLevel" DECIMAL(10,3) NOT NULL,
    "maxCapacity" DECIMAL(12,3) NOT NULL,
    "costPerUnit" DECIMAL(10,2) NOT NULL,
    "supplier" TEXT,
    "lastRestockedDate" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockTransaction" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "date" TEXT NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "performedBy" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FollowUp" (
    "id" TEXT NOT NULL,
    "entityType" "FollowUpEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" TEXT NOT NULL,
    "status" "FollowUpStatus" NOT NULL DEFAULT 'pending',
    "priority" "FollowUpPriority" NOT NULL DEFAULT 'normal',
    "assignedTo" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "completedAt" TEXT,
    "completionNote" TEXT,
    "bedId" TEXT,
    "valveId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_farmerId_key" ON "User"("farmerId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceRecord_farmerId_date_key" ON "AttendanceRecord"("farmerId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "PackagingRecord_batchNumber_key" ON "PackagingRecord"("batchNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRecord_farmerId_month_key" ON "PayrollRecord"("farmerId", "month");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "Farmer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Valve" ADD CONSTRAINT "Valve_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "Farmer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bed" ADD CONSTRAINT "Bed_valveId_fkey" FOREIGN KEY ("valveId") REFERENCES "Valve"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bed" ADD CONSTRAINT "Bed_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "Farmer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HarvestRecord" ADD CONSTRAINT "HarvestRecord_bedId_fkey" FOREIGN KEY ("bedId") REFERENCES "Bed"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HarvestRecord" ADD CONSTRAINT "HarvestRecord_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "Farmer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiseaseReport" ADD CONSTRAINT "DiseaseReport_bedId_fkey" FOREIGN KEY ("bedId") REFERENCES "Bed"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiseaseReport" ADD CONSTRAINT "DiseaseReport_reportedBy_fkey" FOREIGN KEY ("reportedBy") REFERENCES "Farmer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiseaseReport" ADD CONSTRAINT "DiseaseReport_treatmentAppliedBy_fkey" FOREIGN KEY ("treatmentAppliedBy") REFERENCES "Farmer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES "Farmer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "Farmer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_bedId_fkey" FOREIGN KEY ("bedId") REFERENCES "Bed"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "Farmer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_recordedBy_fkey" FOREIGN KEY ("recordedBy") REFERENCES "Farmer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_bedId_fkey" FOREIGN KEY ("bedId") REFERENCES "Bed"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_paidBy_fkey" FOREIGN KEY ("paidBy") REFERENCES "Farmer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlantingRecord" ADD CONSTRAINT "PlantingRecord_bedId_fkey" FOREIGN KEY ("bedId") REFERENCES "Bed"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlantingRecord" ADD CONSTRAINT "PlantingRecord_valveId_fkey" FOREIGN KEY ("valveId") REFERENCES "Valve"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlantingRecord" ADD CONSTRAINT "PlantingRecord_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "Farmer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerAssignment" ADD CONSTRAINT "WorkerAssignment_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "Farmer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerAssignment" ADD CONSTRAINT "WorkerAssignment_valveId_fkey" FOREIGN KEY ("valveId") REFERENCES "Valve"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerAssignment" ADD CONSTRAINT "WorkerAssignment_bedId_fkey" FOREIGN KEY ("bedId") REFERENCES "Bed"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerAssignment" ADD CONSTRAINT "WorkerAssignment_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "Farmer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FertigationRecord" ADD CONSTRAINT "FertigationRecord_valveId_fkey" FOREIGN KEY ("valveId") REFERENCES "Valve"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FertigationRecord" ADD CONSTRAINT "FertigationRecord_bedId_fkey" FOREIGN KEY ("bedId") REFERENCES "Bed"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FertigationRecord" ADD CONSTRAINT "FertigationRecord_responsibleWorkerId_fkey" FOREIGN KEY ("responsibleWorkerId") REFERENCES "Farmer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackagingRecord" ADD CONSTRAINT "PackagingRecord_valveId_fkey" FOREIGN KEY ("valveId") REFERENCES "Valve"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackagingRecord" ADD CONSTRAINT "PackagingRecord_packedBy_fkey" FOREIGN KEY ("packedBy") REFERENCES "Farmer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackagingRecord" ADD CONSTRAINT "PackagingRecord_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "CustomerOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRecord" ADD CONSTRAINT "PayrollRecord_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "Farmer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransaction" ADD CONSTRAINT "StockTransaction_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "StockItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransaction" ADD CONSTRAINT "StockTransaction_performedBy_fkey" FOREIGN KEY ("performedBy") REFERENCES "Farmer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES "Farmer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "Farmer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_bedId_fkey" FOREIGN KEY ("bedId") REFERENCES "Bed"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_valveId_fkey" FOREIGN KEY ("valveId") REFERENCES "Valve"("id") ON DELETE SET NULL ON UPDATE CASCADE;

