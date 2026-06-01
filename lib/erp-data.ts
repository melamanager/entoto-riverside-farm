import type {
  PlantingRecord, WorkerAssignment, FertigationRecord,
  PackagingRecord, CustomerOrder, PayrollRecord, PackagingPurpose,
  StockItem, StockTransaction, FollowUp,
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
  { id: "pk-001", batchNumber: "PKG-2026-051", harvestDate: "2026-05-17", packedDate: "2026-05-17", valveId: "valve-a", variety: "Festival",               harvestedKg: 28.5, gradedKg: 26.2, packedKg: 24.0, rejectedKg: 2.3, packageSize: "500g", packageCount: 48, cartonCount: 4, plateCount: 0, lostKg: 2.2, purpose: "export",       gradeAPct: 78, gradeBPct: 22, packedBy: "f-004", status: "packed",      orderId: "ord-008" },
  { id: "pk-002", batchNumber: "PKG-2026-052", harvestDate: "2026-05-17", packedDate: "2026-05-17", valveId: "valve-b", variety: "California Albion",       harvestedKg: 19.2, gradedKg: 17.5, packedKg: 16.0, rejectedKg: 1.7, packageSize: "1kg",  packageCount: 16, cartonCount: 2, plateCount: 4, lostKg: 1.5, purpose: "hotel",        gradeAPct: 72, gradeBPct: 28, packedBy: "f-004", status: "dispatched",  orderId: "ord-001" },
  { id: "pk-003", batchNumber: "PKG-2026-050", harvestDate: "2026-05-16", packedDate: "2026-05-16", valveId: "valve-a", variety: "Festival",               harvestedKg: 31.0, gradedKg: 28.5, packedKg: 26.0, rejectedKg: 2.5, packageSize: "500g", packageCount: 52, cartonCount: 5, plateCount: 2, lostKg: 2.5, purpose: "export",       gradeAPct: 81, gradeBPct: 19, packedBy: "f-004", status: "dispatched",  orderId: "ord-008" },
  { id: "pk-004", batchNumber: "PKG-2026-049", harvestDate: "2026-05-16", packedDate: "2026-05-16", valveId: "valve-c", variety: "Monterey",               harvestedKg: 14.8, gradedKg: 13.2, packedKg: 12.0, rejectedKg: 1.6, packageSize: "250g", packageCount: 48, cartonCount: 0, plateCount: 8, lostKg: 1.2, purpose: "local",        gradeAPct: 75, gradeBPct: 25, packedBy: "f-004", status: "dispatched",  orderId: "ord-004" },
  { id: "pk-005", batchNumber: "PKG-2026-048", harvestDate: "2026-05-15", packedDate: "2026-05-15", valveId: "valve-a", variety: "California Albion",       harvestedKg: 33.0, gradedKg: 30.0, packedKg: 27.5, rejectedKg: 3.0, packageSize: "1kg",  packageCount: 27, cartonCount: 3, plateCount: 0, lostKg: 2.5, purpose: "supermarket",  gradeAPct: 80, gradeBPct: 20, packedBy: "f-004", status: "dispatched",  orderId: "ord-002" },
  { id: "pk-006", batchNumber: "PKG-2026-047", harvestDate: "2026-05-15", packedDate: "2026-05-15", valveId: "valve-b", variety: "Australian San Andreas",  harvestedKg: 22.5, gradedKg: 20.0, packedKg: 18.5, rejectedKg: 2.5, packageSize: "500g", packageCount: 37, cartonCount: 2, plateCount: 5, lostKg: 1.5, purpose: "juice",        gradeAPct: 76, gradeBPct: 24, packedBy: "f-004", status: "dispatched" },
  { id: "pk-007", batchNumber: "PKG-2026-046", harvestDate: "2026-05-14", packedDate: "2026-05-14", valveId: "valve-a", variety: "Camarosa",               harvestedKg: 29.0, gradedKg: 26.5, packedKg: 24.5, rejectedKg: 2.5, packageSize: "bulk", packageCount: 1,  cartonCount: 0, plateCount: 0, lostKg: 2.0, purpose: "jam",          gradeAPct: 65, gradeBPct: 35, packedBy: "f-004", status: "dispatched" },
  { id: "pk-008", batchNumber: "PKG-2026-053", harvestDate: "2026-05-17", packedDate: "2026-05-17", valveId: "valve-c", variety: "Monterey",               harvestedKg: 11.0, gradedKg: 10.0, packedKg:  0.0, rejectedKg: 1.0, packageSize: "250g", packageCount: 0,  cartonCount: 0, plateCount: 0, lostKg: 0.0, purpose: "local",        gradeAPct: 80, gradeBPct: 20, packedBy: "f-004", status: "in_progress", orderId: "ord-001" },
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

// ─── Stock / Inventory ────────────────────────────────────────────────────────
// currentQty reflects stock after known fertigation & packaging usage this month
export const STOCK_ITEMS: StockItem[] = [
  // Fertilizers
  { id: "si-001", name: "NPK 20-20-20", category: "fertilizer", unit: "kg", currentQty: 23.25, reorderLevel: 5, maxCapacity: 50, costPerUnit: 128, supplier: "Agri Supply Addis", lastRestockedDate: "2026-05-01", notes: "Balanced weekly feed" },
  { id: "si-002", name: "Calcium Nitrate", category: "fertilizer", unit: "kg", currentQty: 14.47, reorderLevel: 4, maxCapacity: 30, costPerUnit: 110, supplier: "Agri Supply Addis", lastRestockedDate: "2026-05-01", notes: "Improves fruit firmness" },
  { id: "si-003", name: "Potassium Sulfate (K₂SO₄)", category: "fertilizer", unit: "kg", currentQty: 10.7, reorderLevel: 3, maxCapacity: 25, costPerUnit: 225, supplier: "Ethiopian Agro Chem", lastRestockedDate: "2026-04-25", notes: "Pre-harvest sweetness boost" },
  { id: "si-004", name: "Humic Acid", category: "fertilizer", unit: "kg", currentQty: 7.6, reorderLevel: 2, maxCapacity: 20, costPerUnit: 450, supplier: "Ethiopian Agro Chem", lastRestockedDate: "2026-04-28", notes: "Soil conditioner — improves nutrient uptake" },
  { id: "si-005", name: "Iron Chelate (EDTA-Fe 13%)", category: "fertilizer", unit: "kg", currentQty: 1.82, reorderLevel: 1, maxCapacity: 5, costPerUnit: 3544, supplier: "Specialty Fert KE", lastRestockedDate: "2026-04-10", notes: "Treats leaf yellowing. Store below 25°C." },
  { id: "si-006", name: "Magnesium Sulfate (Epsom)", category: "fertilizer", unit: "kg", currentQty: 5.4, reorderLevel: 2, maxCapacity: 15, costPerUnit: 94, supplier: "Agri Supply Addis", lastRestockedDate: "2026-04-25" },
  // Pesticides / Fungicides
  { id: "si-007", name: "Kumulus DF (Sulfur 80%)", category: "pesticide", unit: "kg", currentQty: 2.5, reorderLevel: 0.5, maxCapacity: 10, costPerUnit: 340, supplier: "Bayer Ethiopia", lastRestockedDate: "2026-04-20", notes: "Controls powdery mildew" },
  { id: "si-008", name: "Switch 62.5 WG (Botryticide)", category: "pesticide", unit: "kg", currentQty: 0.28, reorderLevel: 0.5, maxCapacity: 2, costPerUnit: 8800, supplier: "Syngenta Ethiopia", lastRestockedDate: "2026-03-15", notes: "⚠ BELOW REORDER — place order now. Controls gray mold." },
  { id: "si-009", name: "Kocide 3000 (Copper Hydroxide)", category: "pesticide", unit: "kg", currentQty: 1.5, reorderLevel: 0.4, maxCapacity: 5, costPerUnit: 620, supplier: "Bayer Ethiopia", lastRestockedDate: "2026-04-20", notes: "Controls leaf spot & bacterial diseases" },
  // Packaging
  { id: "si-010", name: "500g Punnets (PET clear)", category: "packaging", unit: "piece", currentQty: 164, reorderLevel: 50, maxCapacity: 500, costPerUnit: 5, supplier: "Addis Packaging Ltd", lastRestockedDate: "2026-05-10" },
  { id: "si-011", name: "1kg Export Cartons", category: "packaging", unit: "piece", currentQty: 22, reorderLevel: 20, maxCapacity: 100, costPerUnit: 28, supplier: "Addis Packaging Ltd", lastRestockedDate: "2026-05-10", notes: "For Dubai export — reorder urgently" },
  { id: "si-012", name: "250g Clamshells", category: "packaging", unit: "piece", currentQty: 200, reorderLevel: 40, maxCapacity: 400, costPerUnit: 4, supplier: "Addis Packaging Ltd", lastRestockedDate: "2026-05-10" },
  // Tools / Equipment
  { id: "si-013", name: "Plastic Mulch Film (100m roll)", category: "tool", unit: "roll", currentQty: 2, reorderLevel: 1, maxCapacity: 10, costPerUnit: 2800, supplier: "Drip Irrigation ET", lastRestockedDate: "2026-02-01" },
  { id: "si-014", name: "Drip Tape (100m roll, 16mm)", category: "tool", unit: "roll", currentQty: 3, reorderLevel: 1, maxCapacity: 10, costPerUnit: 1200, supplier: "Drip Irrigation ET", lastRestockedDate: "2026-02-01" },
  // Seeds
  { id: "si-015", name: "Festival Strawberry Runners", category: "seed", unit: "piece", currentQty: 250, reorderLevel: 100, maxCapacity: 2000, costPerUnit: 12, supplier: "Nakuru Horticulture KE", lastRestockedDate: "2026-04-05", notes: "For planned beds C-BED-03 & C-BED-04" },
];

export const STOCK_TRANSACTIONS: StockTransaction[] = [
  // Stock-in (restocking events)
  { id: "st-001", itemId: "si-001", type: "stock_in", quantity: 25,    date: "2026-05-01", referenceType: "manual", performedBy: "f-008", notes: "Monthly restock" },
  { id: "st-002", itemId: "si-002", type: "stock_in", quantity: 15,    date: "2026-05-01", referenceType: "manual", performedBy: "f-008", notes: "Monthly restock" },
  { id: "st-003", itemId: "si-003", type: "stock_in", quantity: 12,    date: "2026-04-25", referenceType: "manual", performedBy: "f-008" },
  { id: "st-004", itemId: "si-010", type: "stock_in", quantity: 500,   date: "2026-05-10", referenceType: "manual", performedBy: "f-008", notes: "Restocked from Addis Packaging" },
  { id: "st-005", itemId: "si-011", type: "stock_in", quantity: 30,    date: "2026-05-10", referenceType: "manual", performedBy: "f-008" },
  // Stock-out from fertigation (dosage g/L × water L / 1000 = kg used)
  { id: "st-006", itemId: "si-001", type: "stock_out", quantity: 1.0,  date: "2026-05-15", referenceType: "fertigation", referenceId: "ft-001", performedBy: "f-001", notes: "NPK to Valve A — 400L × 2.5g/L" },
  { id: "st-007", itemId: "si-002", type: "stock_out", quantity: 0.53, date: "2026-05-14", referenceType: "fertigation", referenceId: "ft-002", performedBy: "f-002", notes: "Ca(NO₃)₂ to Valve B — 350L × 1.5g/L" },
  { id: "st-008", itemId: "si-003", type: "stock_out", quantity: 0.6,  date: "2026-05-13", referenceType: "fertigation", referenceId: "ft-003", performedBy: "f-005", notes: "K₂SO₄ to Valve C — 300L × 2.0g/L" },
  { id: "st-009", itemId: "si-001", type: "stock_out", quantity: 0.75, date: "2026-05-12", referenceType: "fertigation", referenceId: "ft-006", performedBy: "f-005", notes: "NPK to Valve C — 300L × 2.5g/L" },
  { id: "st-010", itemId: "si-006", type: "stock_out", quantity: 0.6,  date: "2026-05-10", referenceType: "fertigation", referenceId: "ft-007", performedBy: "f-001", notes: "MgSO₄ foliar — Valve A 400L × 1.5g/L" },
  // Stock-out from packaging
  { id: "st-011", itemId: "si-010", type: "stock_out", quantity: 164,  date: "2026-05-17", referenceType: "packaging", referenceId: "pk-001", performedBy: "f-004", notes: "500g punnets used across PKG-2026-051/050/048/047" },
  { id: "st-012", itemId: "si-011", type: "stock_out", quantity: 8,    date: "2026-05-16", referenceType: "packaging", referenceId: "pk-002", performedBy: "f-004", notes: "Export cartons for hotel & export batches" },
];

// ─── Follow-ups ───────────────────────────────────────────────────────────────
export const FOLLOW_UPS: FollowUp[] = [
  // Disease follow-ups
  { id: "fu-001", entityType: "disease", entityId: "dis-001", title: "Re-inspect B-BED-02 — check powdery mildew treatment", description: "Kumulus DF was applied 7 days ago. Check if leaves are clear, measure humidity.", dueDate: "2026-05-22", status: "pending", priority: "urgent", assignedTo: "f-006", createdBy: "f-008", bedId: "B-BED-02", valveId: "valve-b" },
  { id: "fu-002", entityType: "disease", entityId: "dis-002", title: "Confirm root rot treatment on A-BED-04", description: "Trichoderma applied 5 days ago. Check soil moisture and root color. Remove any dead plants.", dueDate: "2026-05-17", status: "overdue", priority: "urgent", assignedTo: "f-003", createdBy: "f-008", bedId: "A-BED-04", valveId: "valve-a" },
  { id: "fu-003", entityType: "disease", entityId: "dis-003", title: "Gray mold 2nd spray — C-BED-01", description: "First Switch 62.5 WG spray done. Apply 2nd spray and check humidity below 85%.", dueDate: "2026-05-21", status: "pending", priority: "urgent", assignedTo: "f-007", createdBy: "f-008", bedId: "C-BED-01", valveId: "valve-c" },
  // Planting follow-ups
  { id: "fu-004", entityType: "planting", entityId: "pl-003", title: "Stage check — A-BED-03 Festival (103 days)", description: "Plant is at vegetative stage. Inspect for runner formation, canopy density, any early disease signs.", dueDate: "2026-05-21", status: "pending", priority: "normal", assignedTo: "f-006", createdBy: "f-008", bedId: "A-BED-03", valveId: "valve-a" },
  { id: "fu-005", entityType: "planting", entityId: "pl-011", title: "Prepare C-BED-03 for Seascape planting", description: "Planned planting is overdue. Inspect bed, confirm runner availability, prep plastic mulch.", dueDate: "2026-05-15", status: "overdue", priority: "urgent", assignedTo: "f-007", createdBy: "f-008", bedId: "C-BED-03", valveId: "valve-c" },
  { id: "fu-006", entityType: "planting", entityId: "pl-007", title: "Root establishment check — B-BED-03 Seascape (84 days)", description: "Verify root development and vegetative growth progress.", dueDate: "2026-05-20", status: "pending", priority: "normal", assignedTo: "f-007", createdBy: "f-008", bedId: "B-BED-03", valveId: "valve-b" },
  // Fertigation follow-ups (from nextScheduleDate)
  { id: "fu-007", entityType: "fertigation", entityId: "ft-001", title: "NPK 20-20-20 weekly feed — Valve A", description: "Next scheduled application due. Check stock (si-001) before applying. 400L × 2.5g/L.", dueDate: "2026-05-22", status: "pending", priority: "normal", assignedTo: "f-001", createdBy: "f-008", valveId: "valve-a" },
  { id: "fu-008", entityType: "fertigation", entityId: "ft-002", title: "Calcium Nitrate dose — Valve B fruit firmness", description: "Fruit firmness programme. Next dose due. 350L × 1.5g/L via drip.", dueDate: "2026-05-21", status: "pending", priority: "normal", assignedTo: "f-002", createdBy: "f-008", valveId: "valve-b" },
  { id: "fu-009", entityType: "fertigation", entityId: "ft-003", title: "Potassium Sulfate — Valve C pre-harvest", description: "Sweetness enhancement before harvest. Check stock (si-003) — 300L × 2.0g/L.", dueDate: "2026-05-20", status: "pending", priority: "normal", assignedTo: "f-005", createdBy: "f-008", valveId: "valve-c" },
  // Stock / general follow-ups
  { id: "fu-010", entityType: "general", entityId: "si-008", title: "⚠ URGENT: Restock Switch 62.5 WG (botryticide)", description: "Only 0.28 kg left — below reorder level of 0.5 kg. Gray mold is active. Contact Syngenta Ethiopia immediately.", dueDate: "2026-05-18", status: "overdue", priority: "urgent", assignedTo: "f-008", createdBy: "f-008" },
  { id: "fu-011", entityType: "general", entityId: "si-011", title: "Reorder 1kg Export Cartons", description: "Only 22 pieces left (reorder at 20). Dubai export order needs 100 kg of product. Place order with Addis Packaging.", dueDate: "2026-05-20", status: "pending", priority: "urgent", assignedTo: "f-008", createdBy: "f-008" },
  // Completed examples
  { id: "fu-012", entityType: "disease", entityId: "dis-004", title: "Leaf spot first treatment — A-BED-06", description: "Kocide 3000 applied", dueDate: "2026-05-14", status: "done", priority: "normal", assignedTo: "f-001", createdBy: "f-006", bedId: "A-BED-06", valveId: "valve-a", completedAt: "2026-05-14", completionNote: "Sprayed fully. Switched to drip only, no more overhead watering on this bed." },
  { id: "fu-013", entityType: "planting", entityId: "pl-001", title: "Final harvest check — A-BED-01 Festival", description: "Confirm all plants cleared post-harvest and prepare for next planting cycle.", dueDate: "2026-05-10", status: "done", priority: "low", assignedTo: "f-001", createdBy: "f-008", bedId: "A-BED-01", valveId: "valve-a", completedAt: "2026-05-11", completionNote: "Bed cleared. Old mulch removed. Ready for replanting." },
];
