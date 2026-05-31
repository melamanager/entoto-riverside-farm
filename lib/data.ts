import type {
  AttendanceRecord,
  Bed,
  CameraAlert,
  DiseaseReport,
  Expense,
  Farmer,
  HarvestRecord,
  IrrigationEvent,
  Notification,
  SoilReading,
  TankLevel,
  Task,
  Valve,
  ValveState,
  WeatherCurrent,
  WeatherPoint,
} from "./types";
import { DISEASE_TREATMENT_STEPS, DISEASE_TREATMENTS } from "./types";

// ============================================================================
// ENTOTO RIVERSIDE FARM — SEED DATA (in-memory, swap with real DB)
// ============================================================================

export const FARM = {
  id: "entoto-riverside",
  name: "ENTOTO Riverside Farm",
  location: "Entoto Mountain, Addis Ababa, Ethiopia",
  altitudeM: 2800,
  totalAreaHa: 4.2,
  established: "2025-09-01",
  owner: "Entoto Agro PLC",
};

export const FARMERS: Farmer[] = [
  { id: "f-001", name: "Abebe Kebede",    phone: "+251-91-122-3344", avatar: "AK", role: "farmer",     performanceScore: 92, attendanceRate: 98, joinedDate: "2025-09-15", assignedValves: ["valve-a"], nationalId: "ETH-2341-A", emergencyContact: "+251-91-999-0011" },
  { id: "f-002", name: "Tigist Haile",    phone: "+251-91-133-4455", avatar: "TH", role: "farmer",     performanceScore: 88, attendanceRate: 95, joinedDate: "2025-10-01", assignedValves: ["valve-a"], nationalId: "ETH-2342-B", emergencyContact: "+251-91-999-0022" },
  { id: "f-003", name: "Mulugeta Tesfaye",phone: "+251-91-144-5566", avatar: "MT", role: "farmer",     performanceScore: 85, attendanceRate: 92, joinedDate: "2025-10-10", assignedValves: ["valve-b"], nationalId: "ETH-2343-C", emergencyContact: "+251-91-999-0033" },
  { id: "f-004", name: "Hanna Solomon",   phone: "+251-91-155-6677", avatar: "HS", role: "farmer",     performanceScore: 95, attendanceRate: 99, joinedDate: "2025-09-20", assignedValves: ["valve-b"], nationalId: "ETH-2344-D", emergencyContact: "+251-91-999-0044" },
  { id: "f-005", name: "Dawit Bekele",    phone: "+251-91-166-7788", avatar: "DB", role: "farmer",     performanceScore: 78, attendanceRate: 88, joinedDate: "2025-11-01", assignedValves: ["valve-c"], nationalId: "ETH-2345-E", emergencyContact: "+251-91-999-0055" },
  { id: "f-006", name: "Selam Girma",     phone: "+251-91-177-8899", avatar: "SG", role: "supervisor", performanceScore: 94, attendanceRate: 97, joinedDate: "2025-09-01", assignedValves: ["valve-a","valve-b"], nationalId: "ETH-2346-F" },
  { id: "f-007", name: "Yonas Alemu",     phone: "+251-91-188-9900", avatar: "YA", role: "supervisor", performanceScore: 90, attendanceRate: 96, joinedDate: "2025-09-05", assignedValves: ["valve-c"], nationalId: "ETH-2347-G" },
  { id: "f-008", name: "Nuredin Hassen",   phone: "+251-91-199-0011", avatar: "NH", role: "manager",    performanceScore: 96, attendanceRate: 100, joinedDate: "2025-09-01", assignedValves: ["valve-a","valve-b","valve-c"], nationalId: "ETH-2348-H" },
];

export const VALVES: Valve[] = [
  { id: "valve-a", name: "Valve A", color: "#10b981", irrigationSchedule: "06:00 & 17:00 — 25 min", supervisorId: "f-006", x: 40, y: 60, width: 260, height: 180 },
  { id: "valve-b", name: "Valve B", color: "#3b82f6", irrigationSchedule: "06:30 & 17:30 — 25 min", supervisorId: "f-006", x: 320, y: 60, width: 260, height: 180 },
  { id: "valve-c", name: "Valve C", color: "#a855f7", irrigationSchedule: "07:00 & 18:00 — 30 min", supervisorId: "f-007", x: 600, y: 60, width: 260, height: 180 },
];

const VARIETIES = [
  { variety: "California Albion",      origin: "USA — California" },
  { variety: "Australian San Andreas", origin: "Australia — Victoria" },
  { variety: "Camarosa",               origin: "USA — California" },
  { variety: "Festival",               origin: "USA — Florida" },
  { variety: "Monterey",               origin: "USA — California" },
];

const healthPattern: Array<"healthy" | "warning" | "infected"> = [
  "healthy","healthy","warning","healthy","healthy","infected","healthy","warning",
  "healthy","healthy","healthy","warning","infected","healthy","healthy",
  "healthy","warning","healthy","healthy","healthy","healthy",
];

let _beds: Bed[] | null = null;
export function BEDS(): Bed[] {
  if (!_beds) {
    _beds = [];
    const config = [
      { valveId: "valve-a", count: 8, farmers: ["f-001","f-002"], baseLen: 40 },
      { valveId: "valve-b", count: 7, farmers: ["f-003","f-004"], baseLen: 35 },
      { valveId: "valve-c", count: 6, farmers: ["f-005"],          baseLen: 30 },
    ];
    let idx = 0;
    config.forEach(({ valveId, count, farmers, baseLen }) => {
      const letter = valveId.split("-")[1].toUpperCase();
      for (let i = 0; i < count; i++) {
        const variety = VARIETIES[i % VARIETIES.length];
        const lengthM = baseLen - (i % 3) * 5 + (i % 2 ? 5 : 0);
        const stage = (["vegetative","flowering","fruiting","ripening","harvest"] as const)[i % 5];
        _beds!.push({
          id: `${letter}-BED-${String(i + 1).padStart(2,"0")}`,
          valveId,
          lengthM,
          plantsPerMeter: 8,
          variety: variety.variety,
          origin: variety.origin,
          plantedDate: new Date(2026, 0, 15 + i * 3).toISOString().split("T")[0],
          stage,
          health: healthPattern[idx] ?? "healthy",
          farmerId: farmers[i % farmers.length],
          row: Math.floor(i / 4),
          col: i % 4,
        });
        idx++;
      }
    });
  }
  return _beds;
}

export function plantsInBed(bed: Bed): number { return bed.lengthM * bed.plantsPerMeter; }

let _harvests: HarvestRecord[] | null = null;
export function HARVESTS(): HarvestRecord[] {
  if (!_harvests) {
    _harvests = [];
    const today = new Date("2026-05-17");
    const beds = BEDS();
    let hid = 1;
    beds.forEach((bed, bi) => {
      if (!["fruiting","ripening","harvest"].includes(bed.stage)) return;
      for (let d = 13; d >= 0; d--) {
        if ((bi + d) % 3 !== 0) continue;
        const date = new Date(today);
        date.setDate(date.getDate() - d);
        const baseYield = bed.lengthM * 0.35;
        const variation = ((bi * 7 + d * 3) % 10) / 10;
        const kg = Math.round((baseYield + variation * 5) * 10) / 10;
        const hm = bed.health === "infected" ? 0.5 : bed.health === "warning" ? 0.8 : 1;
        _harvests!.push({
          id: `h-${String(hid++).padStart(4,"0")}`,
          bedId: bed.id,
          date: date.toISOString().split("T")[0],
          kg: Math.round(kg * hm * 10) / 10,
          farmerId: bed.farmerId,
          qualityGrade: bed.health === "healthy" ? "A" : bed.health === "warning" ? "B" : "C",
        });
      }
    });
  }
  return _harvests;
}

let _diseases: DiseaseReport[] | null = null;
export function DISEASES(): DiseaseReport[] {
  if (!_diseases) {
    _diseases = [];
    const beds = BEDS();
    let did = 1;
    beds.filter(b => b.health === "infected").forEach((bed, i) => {
      const types = ["powdery_mildew","gray_mold","leaf_spot","root_rot"] as const;
      const type = types[i % types.length];
      _diseases!.push({
        id: `d-${String(did++).padStart(4,"0")}`,
        bedId: bed.id,
        type,
        severity: 25 + (i * 17) % 60,
        reportedAt: new Date(Date.now() - (i + 1) * 86400000).toISOString(),
        reportedBy: "f-006",
        status: i === 0 ? "treating" : "notified",
        suggestedTreatment: DISEASE_TREATMENTS[type],
        treatmentSteps: DISEASE_TREATMENT_STEPS[type],
        treatmentApplied: i === 0,
        treatmentAppliedAt: i === 0 ? new Date(Date.now() - 43200000).toISOString() : undefined,
        treatmentAppliedBy: i === 0 ? "f-001" : undefined,
        treatmentNote: i === 0 ? "Full spray applied. Replicated on secondary plants." : undefined,
        managerNotified: true,
        notifiedAt: new Date(Date.now() - (i + 1) * 86400000 + 300000).toISOString(),
        notificationChannels: ["telegram", "sms"],
        aiConfidence: 78 + (i * 5) % 20,
      });
    });
    beds.filter(b => b.health === "warning").slice(0, 2).forEach((bed, i) => {
      const type = "nitrogen_deficiency" as const;
      _diseases!.push({
        id: `d-${String(did++).padStart(4,"0")}`,
        bedId: bed.id,
        type,
        severity: 15 + i * 8,
        reportedAt: new Date(Date.now() - (i + 3) * 86400000).toISOString(),
        reportedBy: "f-007",
        status: "open",
        suggestedTreatment: DISEASE_TREATMENTS[type],
        treatmentSteps: DISEASE_TREATMENT_STEPS[type],
        treatmentApplied: false,
        managerNotified: false,
        notificationChannels: [],
        aiConfidence: 82,
      });
    });
  }
  return _diseases;
}

// ---- Attendance ----
let _attendance: AttendanceRecord[] | null = null;
export function ATTENDANCE(): AttendanceRecord[] {
  if (!_attendance) {
    _attendance = [];
    const farmers = FARMERS.filter(f => f.role !== "manager");
    const statuses: Array<"present"|"absent"|"late"|"leave"> = ["present","present","present","present","late","present","present","absent","present","present","present","present","late","present"];
    let aid = 1;
    for (let d = 13; d >= 0; d--) {
      const date = new Date("2026-05-17");
      date.setDate(date.getDate() - d);
      const ds = date.toISOString().split("T")[0];
      farmers.forEach((f, fi) => {
        const st = statuses[(fi + d) % statuses.length];
        const checkIn = st === "present" ? "06:00" : st === "late" ? "07:30" : undefined;
        const checkOut = (st === "present" || st === "late") ? "17:00" : undefined;
        const hours = st === "present" ? 10 : st === "late" ? 8.5 : st === "leave" ? 0 : 0;
        _attendance!.push({
          id: `a-${String(aid++).padStart(4,"0")}`,
          farmerId: f.id,
          date: ds,
          status: st,
          checkInTime: checkIn,
          checkOutTime: checkOut,
          hoursWorked: hours,
          recordedBy: "f-006",
        });
      });
    }
  }
  return _attendance;
}

export const TASKS: Task[] = [
  { id: "t-001", title: "Apply Kumulus DF to A-BED-06", description: "Mix 2g/L water, spray entire bed evenly including underside of leaves. Wear full PPE.", assignedTo: "f-001", createdBy: "f-008", bedId: "A-BED-06", status: "in_progress", priority: "high", category: "disease", createdAt: "2026-05-16T08:00:00Z", dueDate: "2026-05-17" },
  { id: "t-002", title: "Harvest Grade-A berries — Valve A", description: "Pick all ripe grade-A berries from beds A-04 and A-05. Use clean baskets.", assignedTo: "f-002", createdBy: "f-008", status: "pending", priority: "medium", category: "harvest", createdAt: "2026-05-17T05:30:00Z", dueDate: "2026-05-17" },
  { id: "t-003", title: "Inspect Valve B drip lines", description: "Check pressure and clogging in sections B-BED-03 to B-BED-04. Log PSI readings.", assignedTo: "f-003", createdBy: "f-006", status: "pending", priority: "medium", category: "irrigation", createdAt: "2026-05-17T06:00:00Z", dueDate: "2026-05-18" },
  { id: "t-004", title: "Fertilizer application — Valve C", description: "Apply NPK 19-19-19 at 3kg per bed via drip fertigation.", assignedTo: "f-005", createdBy: "f-007", status: "done", priority: "low", category: "general", createdAt: "2026-05-15T07:00:00Z", dueDate: "2026-05-16", completedAt: "2026-05-16T14:30:00Z", progressNote: "Applied to all 6 beds. Readings logged." },
  { id: "t-005", title: "AI photo inspection of infected beds", description: "Take close-up photos of A-BED-06, B-BED-05 for AI re-analysis and upload to system.", assignedTo: "f-006", createdBy: "f-008", status: "in_progress", priority: "high", category: "disease", createdAt: "2026-05-17T07:00:00Z", dueDate: "2026-05-17" },
  { id: "t-006", title: "Take daily attendance — Valve A+B workers", description: "Record morning attendance for all farmers in Valve A and Valve B zones by 06:30.", assignedTo: "f-006", createdBy: "f-008", status: "done", priority: "medium", category: "general", createdAt: "2026-05-17T06:00:00Z", dueDate: "2026-05-17", completedAt: "2026-05-17T06:28:00Z" },
  { id: "t-007", title: "Treat B-BED-05 root rot — apply Trichoderma", description: "Reduce drip timer by 40%. Mix Trichoderma at 5g/L. Apply 200ml to each root zone.", assignedTo: "f-003", createdBy: "f-006", bedId: "B-BED-05", status: "pending", priority: "high", category: "disease", createdAt: "2026-05-17T08:00:00Z", dueDate: "2026-05-17" },
];

export const NOTIFICATIONS: Notification[] = [
  { id: "n-001", type: "disease", channel: "telegram", message: "🚨 ALERT: A-BED-06 — Powdery Mildew detected (severity 42%). Treatment plan sent to Abebe.", timestamp: "2026-05-17T06:14:00Z", read: false, link: "/diseases" },
  { id: "n-002", type: "harvest", channel: "in-app",  message: "✅ Today's harvest target reached — Valve A: 38.4 kg collected.", timestamp: "2026-05-17T10:30:00Z", read: false, link: "/harvest" },
  { id: "n-003", type: "disease", channel: "sms",     message: "🚨 ALERT: B-BED-05 — Root Rot suspected. Severity 59%. Action required.", timestamp: "2026-05-16T15:22:00Z", read: true, link: "/diseases" },
  { id: "n-004", type: "irrigation", channel: "telegram", message: "💧 Valve C morning irrigation completed — 30 min cycle.", timestamp: "2026-05-17T07:30:00Z", read: true },
  { id: "n-005", type: "task", channel: "in-app",    message: "📋 New high-priority task assigned to Selam Girma: AI photo inspection.", timestamp: "2026-05-17T07:00:00Z", read: false, link: "/tasks" },
  { id: "n-006", type: "disease", channel: "sms",    message: "🚨 ALERT: C-BED-03 — Nitrogen deficiency flagged. Fertigation required.", timestamp: "2026-05-14T09:00:00Z", read: true, link: "/diseases" },
];

// ---- Expenses ----
export const EXPENSES: Expense[] = [
  { id: "exp-001", date: "2026-05-01", category: "chemicals",  description: "Kumulus DF sulphur fungicide (5 kg)",        amountETB: 1250,  paidBy: "f-008", vendor: "Agro Supply Co.",     receiptRef: "AGR-2241" },
  { id: "exp-002", date: "2026-05-02", category: "fuel",        description: "Diesel for water pump — 40 L",              amountETB: 2800,  paidBy: "f-008", vendor: "Total Ethiopia",      receiptRef: "TOT-0551" },
  { id: "exp-003", date: "2026-05-04", category: "packaging",   description: "250g clamshell punnets × 2000",              amountETB: 5400,  paidBy: "f-006", vendor: "PackEthio Ltd.",      receiptRef: "PKE-3312" },
  { id: "exp-004", date: "2026-05-05", category: "chemicals",   description: "Trichoderma harzianum biocontrol (1 kg)",   amountETB: 980,   paidBy: "f-008", vendor: "Agro Supply Co.",     receiptRef: "AGR-2255" },
  { id: "exp-005", date: "2026-05-06", category: "repairs",     description: "Drip-line emitter replacements — Valve B",  amountETB: 760,   paidBy: "f-006", vendor: "IrriTech Ethiopia",   receiptRef: "IRT-0098" },
  { id: "exp-006", date: "2026-05-08", category: "labour",      description: "Casual labour for bed prep — 10 workers",  amountETB: 3200,  paidBy: "f-008", vendor: "Day Labour Pool",     receiptRef: undefined  },
  { id: "exp-007", date: "2026-05-09", category: "seeds",       description: "Albion runner plants × 500",                amountETB: 7500,  paidBy: "f-008", vendor: "California Nursery",  receiptRef: "CAL-4401" },
  { id: "exp-008", date: "2026-05-10", category: "fuel",        description: "Petrol for motorbike deliveries",           amountETB: 650,   paidBy: "f-006", vendor: "Total Ethiopia",      receiptRef: "TOT-0571" },
  { id: "exp-009", date: "2026-05-12", category: "equipment",   description: "Knapsack sprayer (16 L) — replacement",    amountETB: 1800,  paidBy: "f-008", vendor: "FarmTools Addis",    receiptRef: "FTA-0212" },
  { id: "exp-010", date: "2026-05-13", category: "chemicals",   description: "NPK 19-19-19 fertiliser (25 kg)",           amountETB: 2100,  paidBy: "f-008", vendor: "Agro Supply Co.",     receiptRef: "AGR-2280" },
  { id: "exp-011", date: "2026-05-14", category: "packaging",   description: "Cardboard export boxes × 500",              amountETB: 3750,  paidBy: "f-006", vendor: "PackEthio Ltd.",      receiptRef: "PKE-3340" },
  { id: "exp-012", date: "2026-05-15", category: "repairs",     description: "Pump seal replacement & labour",            amountETB: 1450,  paidBy: "f-008", vendor: "AquaService",        receiptRef: "AQS-0077" },
  { id: "exp-013", date: "2026-05-16", category: "fuel",        description: "Diesel for generator — 20 L",               amountETB: 1400,  paidBy: "f-006", vendor: "Total Ethiopia",      receiptRef: "TOT-0589" },
  { id: "exp-014", date: "2026-05-17", category: "other",       description: "Printer ink & admin supplies",              amountETB: 320,   paidBy: "f-008", vendor: "Office Depot AA",     receiptRef: "ODA-0891" },
];

export function addExpense(rec: Omit<Expense, "id">): string {
  const id = `exp-${String(EXPENSES.length + 1).padStart(3, "0")}`;
  EXPENSES.unshift({ ...rec, id });
  return id;
}

export function updateExpense(id: string, patch: Partial<Omit<Expense, "id">>): boolean {
  const idx = EXPENSES.findIndex(e => e.id === id);
  if (idx < 0) return false;
  EXPENSES[idx] = { ...EXPENSES[idx], ...patch };
  return true;
}

export function deleteExpense(id: string): boolean {
  const idx = EXPENSES.findIndex(e => e.id === id);
  if (idx < 0) return false;
  EXPENSES.splice(idx, 1);
  return true;
}

// ---- Helpers ----
export function getValve(id: string)       { return VALVES.find(v => v.id === id); }
export function getBed(id: string)         { return BEDS().find(b => b.id === id); }
export function getFarmer(id: string)      { return FARMERS.find(f => f.id === id); }
export function bedsInValve(vid: string)   { return BEDS().filter(b => b.valveId === vid); }
export function harvestsForBed(bid: string){ return HARVESTS().filter(h => h.bedId === bid); }
export function harvestsForValve(vid: string) {
  const ids = new Set(bedsInValve(vid).map(b => b.id));
  return HARVESTS().filter(h => ids.has(h.bedId));
}
export function diseasesForBed(bid: string){ return DISEASES().filter(d => d.bedId === bid); }
export function totalKgValve(vid: string)  { return harvestsForValve(vid).reduce((s,h)=>s+h.kg,0); }
export function totalKgBed(bid: string)    { return harvestsForBed(bid).reduce((s,h)=>s+h.kg,0); }
export function todayKg(date = "2026-05-17"){ return HARVESTS().filter(h=>h.date===date).reduce((s,h)=>s+h.kg,0); }
export function attendanceForDate(date: string){ return ATTENDANCE().filter(a=>a.date===date); }
export function attendanceForFarmer(fid: string){ return ATTENDANCE().filter(a=>a.farmerId===fid); }

// ---- Mutators ----
export function addHarvest(rec: Omit<HarvestRecord,"id">) {
  const list = HARVESTS();
  const id = `h-${String(list.length+1).padStart(4,"0")}`;
  list.unshift({ ...rec, id });
  return id;
}

export function addDiseaseReport(rec: Omit<DiseaseReport,"id">) {
  const list = DISEASES();
  const id = `d-${String(list.length+1).padStart(4,"0")}`;
  const full: DiseaseReport = {
    ...rec,
    id,
    treatmentSteps: rec.treatmentSteps?.length ? rec.treatmentSteps : DISEASE_TREATMENT_STEPS[rec.type] ?? [],
    managerNotified: true,
    notifiedAt: new Date().toISOString(),
    notificationChannels: ["telegram","sms"],
  };
  list.unshift(full);
  const bed = getBed(rec.bedId);
  if (bed) bed.health = "infected";
  NOTIFICATIONS.unshift({
    id: `n-${Date.now()}`,
    type: "disease",
    channel: "telegram",
    message: `🚨 ALERT: ${rec.bedId} — ${rec.type.replace(/_/g," ")} detected (severity ${rec.severity}%). Manager notified via Telegram & SMS.`,
    timestamp: new Date().toISOString(),
    read: false,
    link: "/diseases",
  });
  return id;
}

export function applyTreatment(diseaseId: string, farmerId: string, note: string) {
  const d = DISEASES().find(x => x.id === diseaseId);
  if (!d) return false;
  d.treatmentApplied = true;
  d.status = "treating";
  d.treatmentAppliedAt = new Date().toISOString();
  d.treatmentAppliedBy = farmerId;
  d.treatmentNote = note;
  return true;
}

export function addAttendance(rec: Omit<AttendanceRecord,"id">) {
  const list = ATTENDANCE();
  const id = `a-${String(list.length+1).padStart(4,"0")}`;
  list.unshift({ ...rec, id });
  return id;
}

export function addTask(rec: Omit<Task,"id">) {
  const id = `t-${String(TASKS.length+1).padStart(3,"0")}`;
  TASKS.unshift({ ...rec, id });
  return id;
}

export function updateTaskStatus(taskId: string, status: TaskStatus, note?: string) {
  const t = TASKS.find(x => x.id === taskId);
  if (!t) return false;
  t.status = status;
  if (status === "done") t.completedAt = new Date().toISOString();
  if (note) t.progressNote = note;
  return true;
}
type TaskStatus = "pending" | "in_progress" | "done";

// ============================================================================
// IoT / Sensor data
// ============================================================================

export const VALVE_STATES: ValveState[] = [
  {
    valveId: "valve-a",
    isOpen: true,
    mode: "auto",
    flowRateLph: 1840,
    pressureBar: 2.4,
    openedAt: "2026-05-31T06:00:00",
    totalLitersToday: 1278,
    nextScheduledEvent: "Close at 06:25",
  },
  {
    valveId: "valve-b",
    isOpen: false,
    mode: "auto",
    flowRateLph: 0,
    pressureBar: 2.6,
    closedAt: "2026-05-31T05:55:00",
    totalLitersToday: 940,
    nextScheduledEvent: "Open at 17:30",
  },
  {
    valveId: "valve-c",
    isOpen: true,
    mode: "manual",
    flowRateLph: 1420,
    pressureBar: 2.1,
    openedAt: "2026-05-31T06:05:00",
    totalLitersToday: 610,
    nextScheduledEvent: "Manual override — close manually",
  },
];

export function SOIL_READINGS(): SoilReading[] {
  const beds = BEDS();
  return beds.map((bed, i) => {
    const moist = [72, 68, 81, 55, 88, 43, 74, 66, 79, 82, 61, 70, 48, 75, 83, 67, 77, 53, 85, 69, 71][i % 21];
    const temp  = [18.4, 17.9, 19.1, 18.7, 17.5, 19.8, 18.2, 18.9, 17.6, 19.3, 18.1, 17.8, 19.5, 18.6, 17.4, 19.0, 18.3, 19.7, 17.7, 18.8, 19.2][i % 21];
    const ec    = [1.8, 2.1, 1.6, 2.4, 1.9, 2.7, 1.7, 2.0, 1.5, 2.2, 1.8, 2.3, 2.6, 1.9, 1.6, 2.0, 1.7, 2.5, 1.8, 2.1, 1.6][i % 21];
    const ph    = [6.2, 6.4, 6.1, 5.9, 6.3, 5.7, 6.5, 6.2, 6.0, 6.4, 6.1, 6.3, 5.8, 6.2, 6.5, 6.1, 6.3, 5.9, 6.4, 6.2, 6.0][i % 21];
    const status: SoilReading["status"] = moist < 50 || ec > 2.5 || ph < 5.8 ? "warning"
      : moist < 40 || ec > 3.0 ? "critical" : "optimal";
    return {
      bedId: bed.id,
      moisturePct: moist,
      tempC: temp,
      ecMsCm: ec,
      ph,
      recordedAt: "2026-05-31T06:12:00",
      status,
    };
  });
}

export const TANK_LEVELS: TankLevel[] = [
  {
    id: "tank-main",
    name: "Main Reservoir",
    capacityL: 50000,
    currentL: 36200,
    fillRateLph: -2100,
    lastRefillAt: "2026-05-30T07:00:00",
    status: "ok",
  },
  {
    id: "tank-aux",
    name: "Auxiliary Tank",
    capacityL: 15000,
    currentL: 5800,
    fillRateLph: 0,
    lastRefillAt: "2026-05-28T14:00:00",
    status: "low",
  },
];

export const CAMERA_ALERTS: CameraAlert[] = [
  {
    id: "ca-001",
    bedId: "A-BED-06",
    cameraId: "cam-a2",
    alertType: "disease",
    label: "Powdery Mildew",
    confidence: 0.94,
    detectedAt: "2026-05-31T05:48:22",
    status: "new",
    bgGradient: "from-red-900/60 to-red-700/40",
    description: "White powdery coating detected on 3 leaves. Confidence 94%. Recommend sulfur spray within 24h.",
  },
  {
    id: "ca-002",
    bedId: "B-BED-04",
    cameraId: "cam-b1",
    alertType: "ripeness",
    label: "Harvest-Ready Berries",
    confidence: 0.88,
    detectedAt: "2026-05-31T05:31:10",
    status: "reviewed",
    bgGradient: "from-emerald-900/60 to-emerald-700/40",
    description: "88% of fruit cluster shows optimal red coloration and brix index consistent with peak ripeness.",
  },
  {
    id: "ca-003",
    bedId: "C-BED-02",
    cameraId: "cam-c1",
    alertType: "pest",
    label: "Spider Mite Infestation",
    confidence: 0.79,
    detectedAt: "2026-05-31T04:57:45",
    status: "actioned",
    bgGradient: "from-amber-900/60 to-amber-700/40",
    description: "Fine webbing and stippling on underside of leaves. Low-moderate density. Abamectin treatment assigned.",
  },
  {
    id: "ca-004",
    bedId: "A-BED-13",
    cameraId: "cam-a3",
    alertType: "disease",
    label: "Gray Mold (Botrytis)",
    confidence: 0.91,
    detectedAt: "2026-05-31T04:22:18",
    status: "new",
    bgGradient: "from-slate-700/60 to-slate-600/40",
    description: "Gray sporulation mass on 2 fruit. High humidity micro-climate detected. Remove infected fruit immediately.",
  },
  {
    id: "ca-005",
    bedId: "B-BED-07",
    cameraId: "cam-b2",
    alertType: "anomaly",
    label: "Unusual Leaf Curl",
    confidence: 0.72,
    detectedAt: "2026-05-31T03:55:00",
    status: "reviewed",
    bgGradient: "from-purple-900/60 to-purple-700/40",
    description: "Upward leaf curling observed across 6 plants. May indicate heat stress or broad mite presence. Inspect manually.",
  },
  {
    id: "ca-006",
    bedId: "A-BED-03",
    cameraId: "cam-a1",
    alertType: "ripeness",
    label: "Early Ripening",
    confidence: 0.83,
    detectedAt: "2026-05-31T02:10:00",
    status: "actioned",
    bgGradient: "from-pink-900/60 to-rose-700/40",
    description: "Partial red coloration — 70% surface coverage. Schedule harvest within 48h for peak quality.",
  },
];

export const IRRIGATION_EVENTS: IrrigationEvent[] = [
  { id: "ie-001", valveId: "valve-a", action: "open",  mode: "auto",   triggeredBy: "schedule", timestamp: "2026-05-31T06:00:00" },
  { id: "ie-002", valveId: "valve-b", action: "open",  mode: "auto",   triggeredBy: "schedule", timestamp: "2026-05-31T05:30:00" },
  { id: "ie-003", valveId: "valve-b", action: "close", mode: "auto",   triggeredBy: "schedule", timestamp: "2026-05-31T05:55:00", durationMinutes: 25, totalLiters: 940 },
  { id: "ie-004", valveId: "valve-c", action: "open",  mode: "manual", triggeredBy: "f-006",    timestamp: "2026-05-31T06:05:00" },
  { id: "ie-005", valveId: "valve-a", action: "open",  mode: "auto",   triggeredBy: "schedule", timestamp: "2026-05-30T17:00:00" },
  { id: "ie-006", valveId: "valve-a", action: "close", mode: "auto",   triggeredBy: "schedule", timestamp: "2026-05-30T17:25:00", durationMinutes: 25, totalLiters: 767 },
  { id: "ie-007", valveId: "valve-b", action: "open",  mode: "auto",   triggeredBy: "schedule", timestamp: "2026-05-30T17:30:00" },
  { id: "ie-008", valveId: "valve-b", action: "close", mode: "auto",   triggeredBy: "schedule", timestamp: "2026-05-30T17:55:00", durationMinutes: 25, totalLiters: 920 },
];

export const WEATHER_HISTORY: WeatherPoint[] = Array.from({ length: 24 }, (_, i) => {
  const hour = (i * 1);
  const base = hour < 6 ? 12 : hour < 12 ? 12 + (hour - 6) * 1.2 : hour < 15 ? 19.2 - (hour - 12) * 0.3 : 18 - (hour - 15) * 0.5;
  const solar = hour < 6 || hour > 18 ? 0 : Math.round(Math.sin(((hour - 6) / 12) * Math.PI) * 580 + 20);
  return {
    time: `${String(hour).padStart(2, "0")}:00`,
    tempC: Math.round((base + Math.sin(i * 0.7) * 0.5) * 10) / 10,
    humidityPct: Math.round(85 - (base - 12) * 1.8 + Math.sin(i * 0.5) * 3),
    windKph: Math.round(4 + Math.sin(i * 0.9) * 3 + (hour > 9 && hour < 16 ? 4 : 0)),
    rainfallMm: hour === 3 ? 1.2 : hour === 4 ? 0.6 : 0,
    solarWm2: solar,
  };
});

export const WEATHER_CURRENT: WeatherCurrent = {
  tempC: 16.8,
  feelsLikeC: 14.3,
  humidityPct: 72,
  windKph: 11,
  windDeg: 245,
  windLabel: "WSW",
  rainfallMm24h: 1.8,
  solarWm2: 312,
  dewPointC: 11.9,
  uvIndex: 4,
  pressureHpa: 776,
  condition: "Partly Cloudy",
};
