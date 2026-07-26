-- Full staff registration: portrait, salary and personal/payment details
ALTER TABLE "Farmer" ADD COLUMN "photo" TEXT;
ALTER TABLE "Farmer" ADD COLUMN "dailyWage" DECIMAL(10,2);
ALTER TABLE "Farmer" ADD COLUMN "address" TEXT;
ALTER TABLE "Farmer" ADD COLUMN "dateOfBirth" TEXT;
ALTER TABLE "Farmer" ADD COLUMN "gender" TEXT;
ALTER TABLE "Farmer" ADD COLUMN "employmentType" TEXT;
ALTER TABLE "Farmer" ADD COLUMN "paymentMethod" TEXT;
ALTER TABLE "Farmer" ADD COLUMN "bankAccount" TEXT;
