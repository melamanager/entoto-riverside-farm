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
  // Derived by /api/farmers from real attendance/task records — null when the
  // person has no history yet (so the UI shows "no records" not a fake score).
  performanceScore: number | null;
  attendanceRate: number | null;
  joinedDate: string;
  assignedValves: string[];
  nationalId?: string;
  emergencyContact?: string;
  // full registration
  jobTitle?: string | null;       // Driver, Cleaner, Guard… (manager-managed list)
  permissions?: string[] | unknown; // extra capabilities granted (see lib/permissions.ts)
  photo?: string | null;          // small base64 portrait
  dailyWage?: number | string | null; // ETB/day (Decimal over the wire)
  address?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  employmentType?: string | null; // permanent | casual | seasonal
  paymentMethod?: string | null;  // cash | bank | telebirr
  payFrequency?: string | null;   // daily | weekly | monthly
  bankAccount?: string | null;
  hasLogin?: boolean;             // set by /api/farmers GET
  /** Set when the person left the farm. null/undefined = on the active roster. */
  archivedAt?: string | null;
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
  crop?: string;                  // Strawberry (default) | Orange | … 
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
  note?: string | null;
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
  treatmentProgress?: boolean[];    // persisted checklist: which protocol steps are done
  taskId?: string;                  // the auto-created priority treatment task
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

export interface ProgressNote {
  by: string;   // farmerId
  note: string;
  at: string;   // ISO timestamp
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
  /** Whole-day summary, derived from the two sessions below */
  status: AttendanceStatus;
  /** Morning session (arrival → lunch) */
  morningStatus?: AttendanceStatus;
  /** Afternoon session (back from lunch → end of day) */
  afternoonStatus?: AttendanceStatus;
  /** Morning arrival */
  checkInTime?: string;
  /** Leaves for lunch — 6 o'clock local (12:00) */
  morningCheckOutTime?: string;
  /** Returns from lunch — 7 o'clock local (13:00) */
  afternoonCheckInTime?: string;
  /** End of day */
  checkOutTime?: string;
  hoursWorked?: number;
  overtimeHours?: number;
  recordedBy: string;
  note?: string;
}

export interface Notification {
  id: string;
  type: "disease" | "harvest" | "irrigation" | "task" | "message" | "stock";
  channel: "telegram" | "sms" | "in-app";
  message: string;
  timestamp: string;
  read: boolean;
  link?: string;
  recipientId?: string | null;
  recipientRole?: string | null;
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

// Natural / organic-first treatment protocols — using inputs a smallholder farm
// can make or source locally (milk, baking soda, wood ash, neem, garlic, compost).
// Chemicals are named only as a last-resort escalation if the natural route fails.
export const DISEASE_TREATMENT_STEPS: Record<DiseaseType, string[]> = {
  powdery_mildew: [
    "Prune and bag the worst affected leaves — improve airflow between plants",
    "Make a milk spray: 1 part fresh milk to 9 parts water",
    "Spray the whole bed early morning, tops and undersides of leaves",
    "Repeat every 5–7 days for 3 weeks (also good: 1 tsp baking soda + a few drops soap per 1L)",
    "Water at the roots only — keep the leaves dry",
    "If it keeps spreading after 2 weeks, escalate to sulfur (Kumulus DF 2g/L) and tell the manager",
  ],
  root_rot: [
    "Stop over-watering immediately — let the soil surface dry between waterings",
    "Improve drainage: loosen soil around the bed, add compost so water flows away",
    "Dust a little cinnamon powder on the crown/roots of affected plants (natural antifungal)",
    "Dig out and remove the worst plants (roots brown/soft) — do not compost them",
    "Apply Trichoderma (bio-fungus) to the root zone if available — it fights the rot naturally",
    "Check soil moisture by hand daily for 2 weeks",
  ],
  gray_mold: [
    "Pick off every grey/rotten fruit and leaf into a sealed bag — remove from the field",
    "Open up the canopy: remove crowded leaves so air and sun reach the fruit",
    "Spray a baking-soda mix: 1 tsp baking soda + a few drops soap per 1 litre water",
    "Mulch under plants so fruit doesn't touch wet soil; water in the morning, never evening",
    "Keep humidity down — space plants, avoid overhead watering",
    "If rot continues on many beds, escalate to an approved fungicide and inform the manager",
  ],
  leaf_spot: [
    "Remove and bag all spotted leaves — don't leave them on the ground",
    "Spray neem oil (5ml + a drop of soap per 1L water) over all leaf surfaces",
    "Alternative natural spray: garlic + chili steeped in water, strained",
    "Water at the base with drip only — never wet the leaves",
    "Repeat the neem spray every 7–10 days until new leaves are clean",
    "If spots keep spreading, use an organic copper soap, then chemical copper as last resort",
  ],
  nitrogen_deficiency: [
    "This is hunger, not a disease — feed the plants, don't spray chemicals",
    "Make compost/manure tea: soak well-rotted cow manure or compost in water 3–5 days, strain",
    "Water the diluted tea (light brown, like weak tea) around the roots",
    "Alternative: side-dress with well-rotted manure or a little wood ash worked into the soil",
    "Watch leaf colour improve over 5–7 days",
    "Keep feeding with compost each cycle; only use urea sparingly if growth is very poor",
  ],
};

export const DISEASE_TREATMENTS: Record<DiseaseType, string> = {
  powdery_mildew: "Natural: prune affected leaves for airflow, spray milk (1:9 in water) or baking-soda solution every 5–7 days, water at roots only. Escalate to sulfur only if it keeps spreading.",
  root_rot: "Natural: stop over-watering, improve drainage with compost, dust cinnamon on roots, remove badly rotted plants. Add Trichoderma bio-fungus if available.",
  gray_mold: "Natural: remove all rotten fruit/leaves, open the canopy for airflow, spray baking-soda solution, mulch and water only in the morning. Keep humidity low.",
  leaf_spot: "Natural: remove spotted leaves, spray neem oil (5ml/L) or garlic-chili brew every 7–10 days, drip-water only. Use organic copper soap if it persists.",
  nitrogen_deficiency: "Not a disease — feed the plants: water with compost/manure tea, side-dress with well-rotted manure. Use urea only sparingly if growth stays poor.",
};
