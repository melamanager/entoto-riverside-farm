// ─────────────────────────────────────────────────────────────────────────────
// ERP Types — Strawberry Farm Management System
// ─────────────────────────────────────────────────────────────────────────────

export type PlantingStatus = "planned" | "planted" | "growing" | "harvested" | "failed";
export type ActivityType = "irrigation_check" | "disease_inspection" | "harvesting" | "cleaning" | "pruning" | "fertilizing" | "packaging" | "general";
export type Shift = "morning" | "afternoon" | "full_day";
export type AssignmentStatus = "assigned" | "in_progress" | "completed";
export type ApplicationMethod = "drip" | "foliar" | "soil_drench";
export type FertigationStatus = "scheduled" | "applied" | "skipped";
export type PackageSize = "250g" | "500g" | "1kg" | "2kg" | "bulk";
export type PackagingStatus = "in_progress" | "packed" | "dispatched";
export type CustomerType = "hotel" | "supermarket" | "restaurant" | "direct" | "export";
export type PaymentStatus = "pending" | "partial" | "paid" | "overdue";
export type DeliveryStatus = "pending" | "in_transit" | "delivered" | "cancelled";
export type PayrollStatus = "pending" | "processed" | "paid";

export interface PlantingRecord {
  id: string;
  bedId: string;
  valveId: string;
  variety: string;
  plannedDate: string;
  actualDate?: string;
  expectedHarvestDate: string;
  ageInDays: number;
  seedsPerMeter: number;
  seedSource: string;
  status: PlantingStatus;
  notes?: string;
  createdBy: string;
}

export interface WorkerAssignment {
  id: string;
  farmerId: string;
  valveId?: string;
  bedId?: string;
  activity: ActivityType;
  supervisorId: string;
  date: string;
  shift: Shift;
  hoursExpected: number;
  hoursActual?: number;
  status: AssignmentStatus;
  notes?: string;
}

export interface FertigationRecord {
  id: string;
  valveId: string;
  bedId?: string;
  fertilizerType: string;
  activeIngredient: string;
  dosageGPerL: number;
  waterVolumeLiters: number;
  applicationDate: string;
  nextScheduleDate: string;
  responsibleWorkerId: string;
  applicationMethod: ApplicationMethod;
  status: FertigationStatus;
  cost: number; // ETB
  notes?: string;
}

export interface PackagingRecord {
  id: string;
  batchNumber: string;
  harvestDate: string;
  packedDate: string;
  valveId: string;
  harvestedKg: number;
  gradedKg: number;
  packedKg: number;
  rejectedKg: number;
  packageSize: PackageSize;
  packageCount: number;
  gradeAPct: number;
  gradeBPct: number;
  packedBy: string;
  status: PackagingStatus;
}

export interface CustomerOrder {
  id: string;
  customerName: string;
  customerType: CustomerType;
  orderDate: string;
  deliveryDate: string;
  quantityKg: number;
  pricePerKg: number;
  totalAmount: number;
  advancePaid: number;
  paymentStatus: PaymentStatus;
  deliveryStatus: DeliveryStatus;
  variety?: string;
  phone?: string;
  notes?: string;
}

export interface PayrollRecord {
  id: string;
  farmerId: string;
  month: string; // YYYY-MM
  daysWorked: number;
  dailyWage: number;
  basePay: number;
  overtimeHours: number;
  overtimePay: number;
  bonus: number;
  deductions: number;
  netPay: number;
  paymentStatus: PayrollStatus;
  paidDate?: string;
}

// ─── Label maps ──────────────────────────────────────────────────────────────
export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  irrigation_check:   "Irrigation Check",
  disease_inspection: "Disease Inspection",
  harvesting:         "Harvesting",
  cleaning:           "Cleaning",
  pruning:            "Pruning",
  fertilizing:        "Fertilizing",
  packaging:          "Packaging",
  general:            "General",
};

export const ACTIVITY_ICONS: Record<ActivityType, string> = {
  irrigation_check:   "💧",
  disease_inspection: "🔍",
  harvesting:         "🍓",
  cleaning:           "🧹",
  pruning:            "✂️",
  fertilizing:        "🧪",
  packaging:          "📦",
  general:            "📋",
};

export const CUSTOMER_TYPE_LABELS: Record<CustomerType, string> = {
  hotel:        "Hotel",
  supermarket:  "Supermarket",
  restaurant:   "Restaurant",
  direct:       "Direct / Market",
  export:       "Export",
};
