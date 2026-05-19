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
export type PackagingPurpose = "export" | "juice" | "jam" | "local" | "hotel" | "supermarket";
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
  variety: string;
  harvestedKg: number;
  gradedKg: number;
  packedKg: number;
  rejectedKg: number;
  packageSize: PackageSize;
  packageCount: number;
  cartonCount: number;
  plateCount: number;
  lostKg: number;
  purpose: PackagingPurpose;
  gradeAPct: number;
  gradeBPct: number;
  packedBy: string;
  status: PackagingStatus;
  orderId?: string;
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

// ─── Stock / Inventory Management ────────────────────────────────────────────
export type StockCategory = "fertilizer" | "pesticide" | "packaging" | "tool" | "seed" | "other";
export type StockUnit = "kg" | "L" | "g" | "ml" | "piece" | "box" | "bag" | "roll";
export type TransactionType = "stock_in" | "stock_out" | "adjustment" | "waste";

export interface StockItem {
  id: string;
  name: string;
  category: StockCategory;
  unit: StockUnit;
  currentQty: number;
  reorderLevel: number;   // warn when stock falls below this
  maxCapacity: number;
  costPerUnit: number;    // ETB per unit
  supplier?: string;
  lastRestockedDate?: string;
  notes?: string;
}

export interface StockTransaction {
  id: string;
  itemId: string;
  type: TransactionType;
  quantity: number;
  date: string;
  referenceType?: "fertigation" | "packaging" | "disease" | "manual";
  referenceId?: string;
  performedBy: string;
  notes?: string;
}

// ─── Follow-up System ─────────────────────────────────────────────────────────
export type FollowUpEntityType = "disease" | "planting" | "fertigation" | "task" | "general";
export type FollowUpStatus = "pending" | "done" | "overdue";
export type FollowUpPriority = "low" | "normal" | "urgent";

export interface FollowUp {
  id: string;
  entityType: FollowUpEntityType;
  entityId: string;
  title: string;
  description?: string;
  dueDate: string;
  status: FollowUpStatus;
  priority: FollowUpPriority;
  assignedTo: string;   // farmerId
  createdBy: string;
  completedAt?: string;
  completionNote?: string;
  bedId?: string;
  valveId?: string;
}

// ─── Label maps ──────────────────────────────────────────────────────────────
export const STOCK_CATEGORY_LABELS: Record<StockCategory, string> = {
  fertilizer: "Fertilizer",
  pesticide:  "Pesticide / Fungicide",
  packaging:  "Packaging Material",
  tool:       "Tool / Equipment",
  seed:       "Seeds / Runners",
  other:      "Other",
};

export const STOCK_CATEGORY_ICONS: Record<StockCategory, string> = {
  fertilizer: "🧪",
  pesticide:  "🛡️",
  packaging:  "📦",
  tool:       "🔧",
  seed:       "🌱",
  other:      "📋",
};

export const FOLLOW_UP_ENTITY_LABELS: Record<FollowUpEntityType, string> = {
  disease:    "Disease Treatment",
  planting:   "Planting",
  fertigation:"Nutrient Application",
  task:       "Task",
  general:    "General",
};

export const FOLLOW_UP_ENTITY_ICONS: Record<FollowUpEntityType, string> = {
  disease:    "🐛",
  planting:   "🌱",
  fertigation:"💧",
  task:       "✅",
  general:    "📋",
};
