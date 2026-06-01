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
  infectedLengthM?: number;
  suggestedTreatment: string;
  treatmentSteps: string[];
  treatmentApplied: boolean;
  treatmentAppliedAt?: string;
  treatmentAppliedBy?: string;
  treatmentNote?: string;
  managerNotified: boolean;
  notifiedAt?: string;
  notificationChannels: Array<"telegram" | "sms">;
  managerRecommendation?: string;
  requiresImageProof?: boolean;
  proofImageUrl?: string;
}

export interface ProgressNote {
  by: string;
  note: string;
  at: string;
}

export interface TaskWorkerAssignment {
  farmerId: string;
  shift: "morning" | "afternoon" | "full_day";
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
  requiresImageProof?: boolean;
  proofImageUrl?: string;
  workerAssignments?: TaskWorkerAssignment[];
  requiresFollowUp?: boolean;
  followUpDueDate?: string;
  managerNote?: string;
  overdueNotifiedAt?: string;
  progressNotes?: ProgressNote[];
  parentTaskId?: string;
  children?: Task[];
  completionNote?: string;
  reviewedBy?: string;
  reviewedAt?: string;
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

// ── IoT / Sensor types ───────────────────────────────────────────────────────

export type ValveMode = "auto" | "manual";

export interface ValveState {
  valveId: string;
  isOpen: boolean;
  mode: ValveMode;
  flowRateLph: number;
  pressureBar: number;
  openedAt?: string;
  closedAt?: string;
  totalLitersToday: number;
  nextScheduledEvent: string;
}

export interface SoilReading {
  bedId: string;
  moisturePct: number;
  tempC: number;
  ecMsCm: number;
  ph: number;
  recordedAt: string;
  status: "optimal" | "warning" | "critical";
}

export interface TankLevel {
  id: string;
  name: string;
  capacityL: number;
  currentL: number;
  fillRateLph: number;
  lastRefillAt: string;
  status: "ok" | "low" | "critical";
}

export interface CameraAlert {
  id: string;
  bedId: string;
  cameraId: string;
  alertType: "disease" | "pest" | "ripeness" | "anomaly";
  label: string;
  confidence: number;
  detectedAt: string;
  status: "new" | "reviewed" | "actioned";
  bgGradient: string;
  description: string;
}

export interface WeatherPoint {
  time: string;
  tempC: number;
  humidityPct: number;
  windKph: number;
  rainfallMm: number;
  solarWm2: number;
}

export interface WeatherCurrent {
  tempC: number;
  feelsLikeC: number;
  humidityPct: number;
  windKph: number;
  windDeg: number;
  windLabel: string;
  rainfallMm24h: number;
  solarWm2: number;
  dewPointC: number;
  uvIndex: number;
  pressureHpa: number;
  condition: string;
}

export interface IrrigationEvent {
  id: string;
  valveId: string;
  action: "open" | "close";
  mode: ValveMode;
  triggeredBy: string;
  timestamp: string;
  durationMinutes?: number;
  totalLiters?: number;
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

export const GROWTH_STAGE_LABELS: Record<GrowthStage, string> = {
  planted:    "Planted",
  vegetative: "Vegetative",
  flowering:  "Flowering",
  fruiting:   "Fruiting",
  ripening:   "Ripening",
  harvest:    "Harvest-ready",
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
    "Squeeze 3 tbsp fresh lemon juice (ye-lomi) into 1 L water — add a drop of cooking oil and a drop of liquid soap to help it stick to leaves",
    "Label the bed and spray at dusk — coat both tops and undersides of leaves thoroughly",
    "Prune and bag all visibly infected leaves — do not compost near the farm",
    "Apply milk spray (40% milk : 60% water) the following morning as a complement",
    "Repeat every 7 days for 3 cycles and monitor for new growth",
    "Record treatment date and inputs used in the system",
  ],
  root_rot: [
    "Suspend irrigation on affected beds for 24–48 hours immediately",
    "Brew double-strength coffee — let cool, dilute 1:4 with water, pour 2 L per bed as root zone drench (natural antifungal, boosts soil microbiome)",
    "Work coarse coffee husk (ye-buna koret) into top 5 cm of soil to improve drainage",
    "Remove plants with >60% root damage and compost away from the farm",
    "Steep 1 kg mature compost in 10 L water for 24 h — strain and apply as foliar spray (1:10) to boost remaining plant immunity",
    "Monitor soil moisture daily — resume irrigation only when below 70%",
  ],
  gray_mold: [
    "Remove all infected flowers, fruit and leaves into sealed bags immediately",
    "Blend 1 whole garlic bulb + juice of 1 lemon in 500 mL water — strain through cloth, dilute 1:5 — spray entire plant at dusk",
    "Follow up with garlic extract (6 cloves per 500 mL water, strained, diluted 1:10) every 3 days",
    "Brew strong ginger tea (5 slices per 500 mL boiling water) — cool, dilute 1:5 — spray on fruit clusters every 2 days",
    "Prune inner leaves to improve air circulation — keep relative humidity below 85%",
    "Harvest any ripe fruit immediately to reduce fungal entry points",
  ],
  leaf_spot: [
    "Remove and destroy all spotted leaves — do not compost near the farm",
    "Steep 100 g wood ash (ye-enqubet) in 1 L water for 24 h — strain well through cloth before using",
    "Spray wood ash tea on all plants, covering both leaf surfaces — apply at dusk",
    "Dust base of plants with dry wood ash (ye-enqubet) — deters fungal spore spread",
    "Switch to drip irrigation only — avoid wetting leaves and fruit",
    "Repeat every 10 days until infection clears completely",
  ],
  nitrogen_deficiency: [
    "Check soil pH first — if below 5.8, apply wood ash (100 g/m²) to unlock nitrogen availability",
    "Steep mature compost in water (1:10 ratio) for 24 h — apply 2 L per bed as soil drench",
    "Work spent coffee grounds (ye-buna gofer) into top 5 cm of soil — free nitrogen + improves soil microbiome",
    "Prepare banana peel tea: soak 4 peels in 5 L water for 48 h, dilute 1:4 — apply weekly",
    "Apply worm castings drench (500 g in 10 L water) — repeat weekly until leaves green up",
    "Monitor leaf colour change over 5–7 days and adjust input dosing as needed",
  ],
};

export const DISEASE_TREATMENTS: Record<DiseaseType, string> = {
  powdery_mildew: "Spray lemon juice (3 tbsp/L + drop of oil) at dusk every 7 days. Complement with milk spray each morning. Prune infected leaves.",
  root_rot: "Suspend irrigation 24–48h. Drench with double-strength coffee diluted 1:4. Add coffee husk for drainage. Remove badly damaged plants.",
  gray_mold: "Remove all infected material immediately. Spray garlic-lemon blend at dusk + garlic extract every 3 days + ginger tea every 2 days. Prune for airflow.",
  leaf_spot: "Remove all spotted leaves. Spray wood ash tea (100g ash steeped in 1L water 24h). Dust base with dry wood ash. Switch to drip only.",
  nitrogen_deficiency: "Fix pH first if below 5.8 (wood ash). Apply compost tea drench + coffee grounds into soil. Feed banana peel tea weekly. Worm castings drench monthly.",
};
