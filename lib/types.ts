export type HealthStatus = "healthy" | "warning" | "infected";
export type GrowthStage = "planted" | "vegetative" | "flowering" | "fruiting" | "ripening" | "harvest";
export type DiseaseType = "powdery_mildew" | "root_rot" | "gray_mold" | "leaf_spot" | "nitrogen_deficiency";
export type DiseaseStatus = "open" | "notified" | "treating" | "resolved";
export type TaskStatus = "pending" | "in_progress" | "done";
export type AttendanceStatus = "present" | "absent" | "late" | "leave";

export interface Farmer {
  id: string;
  name: string;
  phone: string;
  avatar: string;
  role: "farmer" | "supervisor" | "manager";
  performanceScore: number;
  attendanceRate: number;
  joinedDate: string;
  assignedValves: string[];
  nationalId?: string;
  emergencyContact?: string;
}

export interface Valve {
  id: string;
  name: string;
  color: string;
  irrigationSchedule: string;
  supervisorId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Bed {
  id: string;
  valveId: string;
  lengthM: number;
  plantsPerMeter: number;
  variety: string;
  origin: string;
  plantedDate: string;
  stage: GrowthStage;
  health: HealthStatus;
  farmerId: string;
  row: number;
  col: number;
}

export interface HarvestRecord {
  id: string;
  bedId: string;
  date: string;
  kg: number;
  farmerId: string;
  qualityGrade: "A" | "B" | "C";
}

export interface DiseaseReport {
  id: string;
  bedId: string;
  type: DiseaseType;
  severity: number;
  reportedAt: string;
  reportedBy: string;
  status: DiseaseStatus;
  photo?: string;
  aiConfidence?: number;
  suggestedTreatment: string;
  treatmentSteps: string[];
  treatmentApplied: boolean;
  treatmentAppliedAt?: string;
  treatmentAppliedBy?: string;
  treatmentNote?: string;
  managerNotified: boolean;
  notifiedAt?: string;
  notificationChannels: Array<"telegram" | "sms">;
  managerRecommendation?: string;   // manager's written recommendation sent to supervisor
  requiresImageProof?: boolean;     // manager requires supervisor to upload photo proof
  proofImageUrl?: string;           // supervisor's uploaded proof image (data URL)
}

export interface Task {
  id: string;
  title: string;
  description: string;
  assignedTo: string;
  createdBy: string;
  bedId?: string;
  valveId?: string;
  status: TaskStatus;
  priority: "low" | "medium" | "high";
  category: "disease" | "harvest" | "irrigation" | "inspection" | "general";
  createdAt: string;
  dueDate: string;
  completedAt?: string;
  progressNote?: string;
  requiresImageProof?: boolean;     // manager marks task as requiring a completion photo
  proofImageUrl?: string;           // supervisor's uploaded completion photo (data URL)
}

export interface AttendanceRecord {
  id: string;
  farmerId: string;
  date: string;
  status: AttendanceStatus;
  checkInTime?: string;
  checkOutTime?: string;
  hoursWorked?: number;
  recordedBy: string;
  note?: string;
}

export interface Notification {
  id: string;
  type: "disease" | "harvest" | "irrigation" | "task";
  channel: "telegram" | "sms" | "in-app";
  message: string;
  timestamp: string;
  read: boolean;
  link?: string;
}

export type ExpenseCategory = "fuel" | "chemicals" | "seeds" | "labour" | "equipment" | "packaging" | "repairs" | "other";

export interface Expense {
  id: string;
  date: string;
  category: ExpenseCategory;
  description: string;
  amountETB: number;
  paidBy: string;
  vendor?: string;
  receiptRef?: string;
  note?: string;
}

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  fuel:      "Fuel & Transport",
  chemicals: "Chemicals & Pesticides",
  seeds:     "Seeds & Planting",
  labour:    "Labour (External)",
  equipment: "Equipment & Tools",
  packaging: "Packaging Materials",
  repairs:   "Repairs & Maintenance",
  other:     "Other",
};

export const EXPENSE_CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  fuel:      "bg-orange-100 text-orange-700 border-orange-200",
  chemicals: "bg-red-100 text-red-700 border-red-200",
  seeds:     "bg-emerald-100 text-emerald-700 border-emerald-200",
  labour:    "bg-blue-100 text-blue-700 border-blue-200",
  equipment: "bg-purple-100 text-purple-700 border-purple-200",
  packaging: "bg-cyan-100 text-cyan-700 border-cyan-200",
  repairs:   "bg-amber-100 text-amber-700 border-amber-200",
  other:     "bg-slate-100 text-slate-700 border-slate-200",
};

export const DISEASE_LABELS: Record<DiseaseType, string> = {
  powdery_mildew: "Powdery Mildew",
  root_rot: "Root Rot",
  gray_mold: "Gray Mold (Botrytis)",
  leaf_spot: "Leaf Spot",
  nitrogen_deficiency: "Nitrogen Deficiency",
};

export const DISEASE_TREATMENT_STEPS: Record<DiseaseType, string[]> = {
  powdery_mildew: [
    "Mix Kumulus DF at 2g per 1 litre of water",
    "Fill knapsack sprayer and label the bed",
    "Spray entire bed top and underside of leaves",
    "Prune and bag affected lower leaves",
    "Repeat every 7 days for 3 cycles",
    "Record treatment date in system",
  ],
  root_rot: [
    "Reduce irrigation by 40% immediately",
    "Mix Trichoderma harzianum at 5g per 1L water",
    "Apply 200ml per plant at root zone",
    "Remove and burn plants with >60% root damage",
    "Fumigate soil with Basamid at 40g/m²",
    "Monitor soil moisture daily for 2 weeks",
  ],
  gray_mold: [
    "Remove all visibly infected fruit into sealed bags",
    "Mix Switch 62.5 WG at 0.8g per 1L water",
    "Spray all plants focusing on fruit clusters",
    "Improve ventilation — remove dense canopy leaves",
    "Ensure humidity stays below 85%",
    "Repeat spray after 10 days",
  ],
  leaf_spot: [
    "Remove and bag all spotted leaves",
    "Mix Kocide 3000 at 1.5g per 1L water",
    "Spray thoroughly covering all leaf surfaces",
    "Switch to drip irrigation — avoid wetting leaves",
    "Repeat every 10 days until clear",
  ],
  nitrogen_deficiency: [
    "Prepare urea (46-0-0) solution at 5kg per 1000L",
    "Apply via drip fertigation for 30 minutes",
    "Dose: 200ml per meter of bed length",
    "Monitor leaf colour change over 5–7 days",
    "If no improvement, apply foliar spray of 2% urea",
    "Conduct soil test to assess NPK levels",
  ],
};

export const DISEASE_TREATMENTS: Record<DiseaseType, string> = {
  powdery_mildew: "Apply Kumulus DF (sulfur) at 2g/L every 7 days. Prune lower leaves to improve airflow.",
  root_rot: "Reduce irrigation. Apply Trichoderma harzianum to root zone. Remove and burn badly infected plants.",
  gray_mold: "Apply Switch 62.5 WG. Remove infected fruit. Keep humidity below 85%.",
  leaf_spot: "Apply Kocide 3000 (copper hydroxide) at 1.5g/L. Avoid overhead watering.",
  nitrogen_deficiency: "Apply urea (46-0-0) at 5kg/100m via fertigation. Check leaves after 7 days.",
};
