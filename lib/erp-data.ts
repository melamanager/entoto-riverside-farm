import type {
  PlantingRecord, WorkerAssignment, FertigationRecord,
  PackagingRecord, CustomerOrder, PayrollRecord,
} from "./erp-types";

// ─── Planting Schedule ───────────────────────────────────────────────────────
export const PLANTING_RECORDS: PlantingRecord[] = [
  { id: "pl-001", bedId: "A-BED-01", valveId: "valve-a", variety: "Festival", plannedDate: "2026-01-10", actualDate: "2026-01-12", expectedHarvestDate: "2026-04-20", ageInDays: 125, seedsPerMeter: 8, seedSource: "Nakuru Horticulture KE", status: "harvested", createdBy: "f-008" },
  { id: "pl-002", bedId: "A-BED-02", valveId: "valve-a", variety: "Chandler", plannedDate: "2026-01-10", actualDate: "2026-01-13", expectedHarvestDate: "2026-04-25", ageInDays: 124, seedsPerMeter: 8, seedSource: "Nakuru Horticulture KE", status: "harvested", createdBy: "f-008" },
  { id: "pl-003", bedId: "A-BED-03", valveId: "valve-a", variety: "Festival", plannedDate: "2026-02-01", actualDate: "2026-02-03", expectedHarvestDate: "2026-05-15", ageInDays: 103, seedsPerMeter: 8, seedSource: "Nakuru Horticulture KE", status: "growing", createdBy: "f-008" },
  { id: "pl-004", bedId: "A-BED-04", valveId: "valve-a", variety: "Albion",   plannedDate: "2026-02-15", actualDate: "2026-02-16", expectedHarvestDate: "2026-05-28", ageInDays: 90, seedsPerMeter: 7, seedSource: "Ethiopian Horticulture", status: "growing", createdBy: "f-008" },
  { id: "pl-005", bedId: "B-BED-01", valveId: "valve-b", variety: "Chandler", plannedDate: "2026-01-20", actualDate: "2026-01-22", expectedHarvestDate: "2026-05-01", ageInDays: 115, seedsPerMeter: 8, seedSource: "Nakuru Horticulture KE", status: "growing", createdBy: "f-008" },
  { id: "pl-006", bedId: "B-BED-02", valveId: "valve-b", variety: "Festival", plannedDate: "2026-01-20", actualDate: "2026-01-21", expectedHarvestDate: "2026-04-30", ageInDays: 116, seedsPerMeter: 8, seedSource: "Nakuru Horticulture KE", status: "growing", notes: "Slight botrytis detected — monitoring", createdBy: "f-008" },
  { id: "pl-007", bedId: "B-BED-03", valveId: "valve-b", variety: "Seascape", plannedDate: "2026-02-20", actualDate: "2026-02-22", expectedHarvestDate: "2026-06-05", ageInDays: 84, seedsPerMeter: 8, seedSource: "Ethiopian Horticulture", status: "growing", createdBy: "f-008" },
  { id: "pl-008", bedId: "B-BED-04", valveId: "valve-b", variety: "Albion",   plannedDate: "2026-03-01", actualDate: "2026-03-02", expectedHarvestDate: "2026-06-10", ageInDays: 75, seedsPerMeter: 7, seedSource: "Ethiopian Horticulture", status: "growing", createdBy: "f-008" },
  { id: "pl-009", bedId: "C-BED-01", valveId: "valve-c", variety: "Festival", plannedDate: "2026-03-10", actualDate: "2026-03-12", expectedHarvestDate: "2026-06-20", ageInDays: 66, seedsPerMeter: 8, seedSource: "Nakuru Horticulture KE", status: "growing", createdBy: "f-008" },
  { id: "pl-010", bedId: "C-BED-02", valveId: "valve-c", variety: "Chandler", plannedDate: "2026-03-10", actualDate: "2026-03-11", expectedHarvestDate: "2026-06-22", ageInDays: 67, seedsPerMeter: 8, seedSource: "Nakuru Horticulture KE", status: "growing", createdBy: "f-008" },
  { id: "pl-011", bedId: "C-BED-03", valveId: "valve-c", variety: "Seascape", plannedDate: "2026-04-01", expectedHarvestDate: "2026-07-10", ageInDays: 46, seedsPerMeter: 8, seedSource: "Ethiopian Horticulture", status: "planned", createdBy: "f-008" },
  { id: "pl-012", bedId: "C-BED-04", valveId: "valve-c", variety: "Albion",   plannedDate: "2026-04-05", expectedHarvestDate: "2026-07-15", ageInDays: 42, seedsPerMeter: 7, seedSource: "Ethiopian Horticulture", status: "planned", createdBy: "f-008" },
];

// ─── Worker Assignments ──────────────────────────────────────────────────────
export const WORKER_ASSIGNMENTS: WorkerAssignment[] = [
  { id: "wa-001", farmerId: "f-001", valveId: "valve-a", bedId: "A-BED-01", activity: "harvesting",         supervisorId: "f-006", date: "2026-05-17", shift: "morning",   hoursExpected: 4, hoursActual: 4.5, status: "completed" },
  { id: "wa-002", farmerId: "f-002", valveId: "valve-a", bedId: "A-BED-02", activity: "harvesting",         supervisorId: "f-006", date: "2026-05-17", shift: "morning",   hoursExpected: 4, hoursActual: 4.0, status: "completed" },
  { id: "wa-003", farmerId: "f-003", valveId: "valve-b", bedId: "B-BED-01", activity: "disease_inspection", supervisorId: "f-006", date: "2026-05-17", shift: "morning",   hoursExpected: 3, status: "in_progress" },
  { id: "wa-004", farmerId: "f-004", valveId: "valve-b", bedId: "B-BED-02", activity: "pruning",            supervisorId: "f-006", date: "2026-05-17", shift: "afternoon", hoursExpected: 4, status: "assigned" },
  { id: "wa-005", farmerId: "f-005", valveId: "valve-c", bedId: "C-BED-01", activity: "fertilizing",        supervisorId: "f-007", date: "2026-05-17", shift: "full_day",  hoursExpected: 8, status: "in_progress" },
  { id: "wa-006", farmerId: "f-001", valveId: "valve-a",                    activity: "irrigation_check",   supervisorId: "f-006", date: "2026-05-16", shift: "morning",   hoursExpected: 2, hoursActual: 2.0, status: "completed" },
  { id: "wa-007", farmerId: "f-002", valveId: "valve-b",                    activity: "cleaning",           supervisorId: "f-006", date: "2026-05-16", shift: "afternoon", hoursExpected: 3, hoursActual: 3.0, status: "completed" },
  { id: "wa-008", farmerId: "f-003", valveId: "valve-c", bedId: "C-BED-02", activity: "harvesting",         supervisorId: "f-007", date: "2026-05-16", shift: "morning",   hoursExpected: 4, hoursActual: 4.5, status: "completed" },
  { id: "wa-009", farmerId: "f-004", valveId: "valve-a", bedId: "A-BED-03", activity: "packaging",          supervisorId: "f-006", date: "2026-05-15", shift: "full_day",  hoursExpected: 8, hoursActual: 7.5, status: "completed" },
  { id: "wa-010", farmerId: "f-005", valveId: "valve-b", bedId: "B-BED-03", activity: "disease_inspection", supervisorId: "f-007", date: "2026-05-15", shift: "morning",   hoursExpected: 3, hoursActual: 3.0, status: "completed", notes: "Found gray mold on lower fruiting clusters" },
];

// ─── Fertigation Records ─────────────────────────────────────────────────────
export const FERTIGATION_RECORDS: FertigationRecord[] = [
  { id: "ft-001", valveId: "valve-a", fertilizerType: "NPK 20-20-20", activeIngredient: "Nitrogen, Phosphorus, Potassium", dosageGPerL: 2.5, waterVolumeLiters: 400, applicationDate: "2026-05-15", nextScheduleDate: "2026-05-22", responsibleWorkerId: "f-001", applicationMethod: "drip", status: "applied", cost: 320, notes: "Weekly balanced feed" },
  { id: "ft-002", valveId: "valve-b", fertilizerType: "Calcium Nitrate", activeIngredient: "Ca(NO3)2 — 15.5% N, 19% Ca", dosageGPerL: 1.5, waterVolumeLiters: 350, applicationDate: "2026-05-14", nextScheduleDate: "2026-05-21", responsibleWorkerId: "f-002", applicationMethod: "drip", status: "applied", cost: 280, notes: "Fruit firmness programme" },
  { id: "ft-003", valveId: "valve-c", fertilizerType: "Potassium Sulfate", activeIngredient: "K2SO4 — 50% K2O", dosageGPerL: 2.0, waterVolumeLiters: 300, applicationDate: "2026-05-13", nextScheduleDate: "2026-05-20", responsibleWorkerId: "f-005", applicationMethod: "drip", status: "applied", cost: 450, notes: "Sweetness enhancement pre-harvest" },
  { id: "ft-004", valveId: "valve-a", fertilizerType: "Humic Acid", activeIngredient: "Leonardite-derived 85% humic + fulvic", dosageGPerL: 1.0, waterVolumeLiters: 400, applicationDate: "2026-05-17", nextScheduleDate: "2026-05-31", responsibleWorkerId: "f-001", applicationMethod: "drip", status: "scheduled", cost: 180 },
  { id: "ft-005", valveId: "valve-b", fertilizerType: "Iron Chelate (EDTA-Fe)", activeIngredient: "Fe-EDTA 13% Fe", dosageGPerL: 0.5, waterVolumeLiters: 350, applicationDate: "2026-05-17", nextScheduleDate: "2026-05-31", responsibleWorkerId: "f-002", applicationMethod: "foliar", status: "scheduled", cost: 620, notes: "Address chlorosis in B-BED-02" },
  { id: "ft-006", valveId: "valve-c", fertilizerType: "NPK 20-20-20", activeIngredient: "Nitrogen, Phosphorus, Potassium", dosageGPerL: 2.5, waterVolumeLiters: 300, applicationDate: "2026-05-12", nextScheduleDate: "2026-05-19", responsibleWorkerId: "f-005", applicationMethod: "drip", status: "applied", cost: 240 },
  { id: "ft-007", valveId: "valve-a", fertilizerType: "Magnesium Sulfate", activeIngredient: "MgSO4 · 7H2O — 9.9% Mg", dosageGPerL: 1.5, waterVolumeLiters: 400, applicationDate: "2026-05-10", nextScheduleDate: "2026-05-24", responsibleWorkerId: "f-001", applicationMethod: "foliar", status: "applied", cost: 150 },
  { id: "ft-008", valveId: "valve-b", fertilizerType: "Potassium Sulfate", activeIngredient: "K2SO4 — 50% K2O", dosageGPerL: 2.0, waterVolumeLiters: 350, applicationDate: "2026-05-17", nextScheduleDate: "2026-05-24", responsibleWorkerId: "f-003", applicationMethod: "drip", status: "scheduled", cost: 380 },
];

// ─── Packaging Records ───────────────────────────────────────────────────────
export const PACKAGING_RECORDS: PackagingRecord[] = [
  { id: "pk-001", batchNumber: "PKG-2026-051",  harvestDate: "2026-05-17", packedDate: "2026-05-17", valveId: "valve-a", harvestedKg: 28.5, gradedKg: 26.2, packedKg: 24.0, rejectedKg: 2.3, packageSize: "500g",  packageCount: 48,  gradeAPct: 78, gradeBPct: 22, packedBy: "f-004", status: "packed" },
  { id: "pk-002", batchNumber: "PKG-2026-052",  harvestDate: "2026-05-17", packedDate: "2026-05-17", valveId: "valve-b", harvestedKg: 19.2, gradedKg: 17.5, packedKg: 16.0, rejectedKg: 1.7, packageSize: "1kg",   packageCount: 16,  gradeAPct: 72, gradeBPct: 28, packedBy: "f-004", status: "dispatched" },
  { id: "pk-003", batchNumber: "PKG-2026-050",  harvestDate: "2026-05-16", packedDate: "2026-05-16", valveId: "valve-a", harvestedKg: 31.0, gradedKg: 28.5, packedKg: 26.0, rejectedKg: 2.5, packageSize: "500g",  packageCount: 52,  gradeAPct: 81, gradeBPct: 19, packedBy: "f-004", status: "dispatched" },
  { id: "pk-004", batchNumber: "PKG-2026-049",  harvestDate: "2026-05-16", packedDate: "2026-05-16", valveId: "valve-c", harvestedKg: 14.8, gradedKg: 13.2, packedKg: 12.0, rejectedKg: 1.6, packageSize: "250g",  packageCount: 48,  gradeAPct: 75, gradeBPct: 25, packedBy: "f-004", status: "dispatched" },
  { id: "pk-005", batchNumber: "PKG-2026-048",  harvestDate: "2026-05-15", packedDate: "2026-05-15", valveId: "valve-a", harvestedKg: 33.0, gradedKg: 30.0, packedKg: 27.5, rejectedKg: 3.0, packageSize: "1kg",   packageCount: 27,  gradeAPct: 80, gradeBPct: 20, packedBy: "f-004", status: "dispatched" },
  { id: "pk-006", batchNumber: "PKG-2026-047",  harvestDate: "2026-05-15", packedDate: "2026-05-15", valveId: "valve-b", harvestedKg: 22.5, gradedKg: 20.0, packedKg: 18.5, rejectedKg: 2.5, packageSize: "500g",  packageCount: 37,  gradeAPct: 76, gradeBPct: 24, packedBy: "f-004", status: "dispatched" },
  { id: "pk-007", batchNumber: "PKG-2026-046",  harvestDate: "2026-05-14", packedDate: "2026-05-14", valveId: "valve-a", harvestedKg: 29.0, gradedKg: 26.5, packedKg: 24.5, rejectedKg: 2.5, packageSize: "bulk",  packageCount: 1,   gradeAPct: 65, gradeBPct: 35, packedBy: "f-004", status: "dispatched", },
  { id: "pk-008", batchNumber: "PKG-2026-053",  harvestDate: "2026-05-17", packedDate: "2026-05-17", valveId: "valve-c", harvestedKg: 11.0, gradedKg: 10.0, packedKg:  0.0, rejectedKg: 1.0, packageSize: "250g",  packageCount: 0,   gradeAPct: 80, gradeBPct: 20, packedBy: "f-004", status: "in_progress" },
];

// ─── Customer Orders ─────────────────────────────────────────────────────────
export const CUSTOMER_ORDERS: CustomerOrder[] = [
  { id: "ord-001", customerName: "Skylight Hotel", customerType: "hotel", orderDate: "2026-05-15", deliveryDate: "2026-05-18", quantityKg: 20, pricePerKg: 180, totalAmount: 3600, advancePaid: 1800, paymentStatus: "partial", deliveryStatus: "pending", variety: "Festival", phone: "+251911234567", notes: "Premium grade only — reject any blemished fruit" },
  { id: "ord-002", customerName: "Edna Mall Supermarket", customerType: "supermarket", orderDate: "2026-05-14", deliveryDate: "2026-05-17", quantityKg: 30, pricePerKg: 140, totalAmount: 4200, advancePaid: 4200, paymentStatus: "paid", deliveryStatus: "delivered", phone: "+251922345678" },
  { id: "ord-003", customerName: "Yod Abyssinia Restaurant", customerType: "restaurant", orderDate: "2026-05-16", deliveryDate: "2026-05-19", quantityKg: 10, pricePerKg: 160, totalAmount: 1600, advancePaid: 800, paymentStatus: "partial", deliveryStatus: "pending", variety: "Chandler", phone: "+251933456789" },
  { id: "ord-004", customerName: "Addis Fruit Market", customerType: "direct", orderDate: "2026-05-17", deliveryDate: "2026-05-17", quantityKg: 15, pricePerKg: 120, totalAmount: 1800, advancePaid: 1800, paymentStatus: "paid", deliveryStatus: "delivered", phone: "+251944567890" },
  { id: "ord-005", customerName: "Radisson Blu Hotel", customerType: "hotel", orderDate: "2026-05-12", deliveryDate: "2026-05-15", quantityKg: 25, pricePerKg: 175, totalAmount: 4375, advancePaid: 4375, paymentStatus: "paid", deliveryStatus: "delivered", variety: "Festival", phone: "+251955678901" },
  { id: "ord-006", customerName: "Bole International Airport Café", customerType: "restaurant", orderDate: "2026-05-17", deliveryDate: "2026-05-20", quantityKg: 8, pricePerKg: 165, totalAmount: 1320, advancePaid: 0, paymentStatus: "pending", deliveryStatus: "pending", phone: "+251966789012" },
  { id: "ord-007", customerName: "Shoa Supermarket Chain", customerType: "supermarket", orderDate: "2026-05-10", deliveryDate: "2026-05-13", quantityKg: 50, pricePerKg: 130, totalAmount: 6500, advancePaid: 6500, paymentStatus: "paid", deliveryStatus: "delivered", phone: "+251977890123" },
  { id: "ord-008", customerName: "Dubai Export — Al Mana Foods", customerType: "export", orderDate: "2026-05-01", deliveryDate: "2026-05-25", quantityKg: 100, pricePerKg: 200, totalAmount: 20000, advancePaid: 10000, paymentStatus: "partial", deliveryStatus: "pending", variety: "Festival", notes: "Export phytosanitary cert required — contact MoA Addis office" },
];

// ─── Payroll Records ─────────────────────────────────────────────────────────
export const PAYROLL_RECORDS: PayrollRecord[] = [
  // May 2026
  { id: "pay-001", farmerId: "f-001", month: "2026-05", daysWorked: 22, dailyWage: 550, basePay: 12100, overtimeHours: 6, overtimePay: 825, bonus: 500, deductions: 605, netPay: 12820, paymentStatus: "pending" },
  { id: "pay-002", farmerId: "f-002", month: "2026-05", daysWorked: 21, dailyWage: 550, basePay: 11550, overtimeHours: 4, overtimePay: 550, bonus: 0, deductions: 578, netPay: 11522, paymentStatus: "pending" },
  { id: "pay-003", farmerId: "f-003", month: "2026-05", daysWorked: 20, dailyWage: 550, basePay: 11000, overtimeHours: 2, overtimePay: 275, bonus: 300, deductions: 554, netPay: 11021, paymentStatus: "pending" },
  { id: "pay-004", farmerId: "f-004", month: "2026-05", daysWorked: 22, dailyWage: 580, basePay: 12760, overtimeHours: 8, overtimePay: 1160, bonus: 800, deductions: 736, netPay: 13984, paymentStatus: "pending" },
  { id: "pay-005", farmerId: "f-005", month: "2026-05", daysWorked: 21, dailyWage: 550, basePay: 11550, overtimeHours: 3, overtimePay: 413, bonus: 0, deductions: 598, netPay: 11365, paymentStatus: "pending" },
  { id: "pay-006", farmerId: "f-006", month: "2026-05", daysWorked: 26, dailyWage: 920, basePay: 23920, overtimeHours: 5, overtimePay: 1150, bonus: 1500, deductions: 2629, netPay: 23941, paymentStatus: "pending" },
  { id: "pay-007", farmerId: "f-007", month: "2026-05", daysWorked: 25, dailyWage: 880, basePay: 22000, overtimeHours: 4, overtimePay: 880, bonus: 1000, deductions: 2394, netPay: 21486, paymentStatus: "pending" },
  { id: "pay-008", farmerId: "f-008", month: "2026-05", daysWorked: 26, dailyWage: 1800, basePay: 46800, overtimeHours: 0, overtimePay: 0, bonus: 3000, deductions: 6588, netPay: 43212, paymentStatus: "pending" },
  // April 2026
  { id: "pay-009",  farmerId: "f-001", month: "2026-04", daysWorked: 25, dailyWage: 550, basePay: 13750, overtimeHours: 4, overtimePay: 550, bonus: 200, deductions: 719, netPay: 13781, paymentStatus: "paid", paidDate: "2026-04-30" },
  { id: "pay-010", farmerId: "f-002", month: "2026-04", daysWorked: 24, dailyWage: 550, basePay: 13200, overtimeHours: 2, overtimePay: 275, bonus: 0, deductions: 664, netPay: 12811, paymentStatus: "paid", paidDate: "2026-04-30" },
  { id: "pay-011", farmerId: "f-003", month: "2026-04", daysWorked: 23, dailyWage: 550, basePay: 12650, overtimeHours: 0, overtimePay: 0, bonus: 0, deductions: 633, netPay: 12017, paymentStatus: "paid", paidDate: "2026-04-30" },
  { id: "pay-012", farmerId: "f-006", month: "2026-04", daysWorked: 26, dailyWage: 920, basePay: 23920, overtimeHours: 6, overtimePay: 1380, bonus: 1000, deductions: 2630, netPay: 23670, paymentStatus: "paid", paidDate: "2026-04-30" },
];
