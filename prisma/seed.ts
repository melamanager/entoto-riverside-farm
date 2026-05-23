import { PrismaClient, Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

// ─── Seed data (replicated from lib/data.ts + lib/erp-data.ts) ───────────────

const VARIETIES = [
  { variety: "California Albion", origin: "USA — California" },
  { variety: "Australian San Andreas", origin: "Australia — Victoria" },
  { variety: "Camarosa", origin: "USA — California" },
  { variety: "Festival", origin: "USA — Florida" },
  { variety: "Monterey", origin: "USA — California" },
];

const healthPattern: Array<"healthy" | "warning" | "infected"> = [
  "healthy","healthy","warning","healthy","healthy","infected","healthy","warning",
  "healthy","healthy","healthy","warning","infected","healthy","healthy",
  "healthy","warning","healthy","healthy","healthy","healthy",
];

const DISEASE_TREATMENTS: Record<string, string> = {
  powdery_mildew: "Apply Kumulus DF (sulfur) at 2g/L every 7 days. Prune lower leaves to improve airflow.",
  root_rot: "Reduce irrigation. Apply Trichoderma harzianum to root zone. Remove and burn badly infected plants.",
  gray_mold: "Apply Switch 62.5 WG. Remove infected fruit. Keep humidity below 85%.",
  leaf_spot: "Apply Kocide 3000 (copper hydroxide) at 1.5g/L. Avoid overhead watering.",
  nitrogen_deficiency: "Apply urea (46-0-0) at 5kg/100m via fertigation. Check leaves after 7 days.",
};

const DISEASE_TREATMENT_STEPS: Record<string, string[]> = {
  powdery_mildew: ["Mix Kumulus DF at 2g per 1 litre of water","Fill knapsack sprayer and label the bed","Spray entire bed top and underside of leaves","Prune and bag affected lower leaves","Repeat every 7 days for 3 cycles","Record treatment date in system"],
  root_rot: ["Reduce irrigation by 40% immediately","Mix Trichoderma harzianum at 5g per 1L water","Apply 200ml per plant at root zone","Remove and burn plants with >60% root damage","Fumigate soil with Basamid at 40g/m²","Monitor soil moisture daily for 2 weeks"],
  gray_mold: ["Remove all visibly infected fruit into sealed bags","Mix Switch 62.5 WG at 0.8g per 1L water","Spray all plants focusing on fruit clusters","Improve ventilation — remove dense canopy leaves","Ensure humidity stays below 85%","Repeat spray after 10 days"],
  leaf_spot: ["Remove and bag all spotted leaves","Mix Kocide 3000 at 1.5g per 1L water","Spray thoroughly covering all leaf surfaces","Switch to drip irrigation — avoid wetting leaves","Repeat every 10 days until clear"],
  nitrogen_deficiency: ["Prepare urea (46-0-0) solution at 5kg per 1000L","Apply via drip fertigation for 30 minutes","Dose: 200ml per meter of bed length","Monitor leaf colour change over 5–7 days","If no improvement, apply foliar spray of 2% urea","Conduct soil test to assess NPK levels"],
};

// PackageSize string → Prisma enum mapping
type PkgSize = "p250g" | "p500g" | "p1kg" | "p2kg" | "bulk";
function toPackageSize(s: string): PkgSize {
  const map: Record<string, PkgSize> = {
    "250g": "p250g", "500g": "p500g", "1kg": "p1kg", "2kg": "p2kg", "bulk": "bulk",
  };
  return map[s] ?? "bulk";
}

async function main() {
  const connectionString = process.env.DATABASE_URL!;
  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  console.log("Seeding database...");

  // ── 1. Farmers ──────────────────────────────────────────────────────────────
  const farmers = [
    { id: "f-001", name: "Abebe Kebede",     phone: "+251-91-122-3344", avatar: "AK", role: "farmer" as const,     performanceScore: 92, attendanceRate: 98,  joinedDate: "2025-09-15", assignedValves: ["valve-a"] as Prisma.InputJsonValue,                nationalId: "ETH-2341-A", emergencyContact: "+251-91-999-0011" },
    { id: "f-002", name: "Tigist Haile",     phone: "+251-91-133-4455", avatar: "TH", role: "farmer" as const,     performanceScore: 88, attendanceRate: 95,  joinedDate: "2025-10-01", assignedValves: ["valve-a"] as Prisma.InputJsonValue,                nationalId: "ETH-2342-B", emergencyContact: "+251-91-999-0022" },
    { id: "f-003", name: "Mulugeta Tesfaye", phone: "+251-91-144-5566", avatar: "MT", role: "farmer" as const,     performanceScore: 85, attendanceRate: 92,  joinedDate: "2025-10-10", assignedValves: ["valve-b"] as Prisma.InputJsonValue,                nationalId: "ETH-2343-C", emergencyContact: "+251-91-999-0033" },
    { id: "f-004", name: "Hanna Solomon",    phone: "+251-91-155-6677", avatar: "HS", role: "farmer" as const,     performanceScore: 95, attendanceRate: 99,  joinedDate: "2025-09-20", assignedValves: ["valve-b"] as Prisma.InputJsonValue,                nationalId: "ETH-2344-D", emergencyContact: "+251-91-999-0044" },
    { id: "f-005", name: "Dawit Bekele",     phone: "+251-91-166-7788", avatar: "DB", role: "farmer" as const,     performanceScore: 78, attendanceRate: 88,  joinedDate: "2025-11-01", assignedValves: ["valve-c"] as Prisma.InputJsonValue,                nationalId: "ETH-2345-E", emergencyContact: "+251-91-999-0055" },
    { id: "f-006", name: "Selam Girma",      phone: "+251-91-177-8899", avatar: "SG", role: "supervisor" as const, performanceScore: 94, attendanceRate: 97,  joinedDate: "2025-09-01", assignedValves: ["valve-a","valve-b"] as Prisma.InputJsonValue,      nationalId: "ETH-2346-F" },
    { id: "f-007", name: "Yonas Alemu",      phone: "+251-91-188-9900", avatar: "YA", role: "supervisor" as const, performanceScore: 90, attendanceRate: 96,  joinedDate: "2025-09-05", assignedValves: ["valve-c"] as Prisma.InputJsonValue,                nationalId: "ETH-2347-G" },
    { id: "f-008", name: "Nuredin Hassen",   phone: "+251-91-199-0011", avatar: "NH", role: "manager" as const,    performanceScore: 96, attendanceRate: 100, joinedDate: "2025-09-01", assignedValves: ["valve-a","valve-b","valve-c"] as Prisma.InputJsonValue, nationalId: "ETH-2348-H" },
  ];

  for (const f of farmers) {
    await prisma.farmer.upsert({ where: { id: f.id }, update: f, create: f });
  }
  console.log("  ✓ Farmers");

  // ── 2. Users (auth) ─────────────────────────────────────────────────────────
  const authUsers = [
    { farmerId: "f-008", password: "manager2026",  email: "manager@entoto.farm" },
    { farmerId: "f-006", password: "supervisor01", email: "selam@entoto.farm" },
    { farmerId: "f-007", password: "supervisor02", email: "yonas@entoto.farm" },
  ];

  for (const u of authUsers) {
    const hash = await bcrypt.hash(u.password, 12);
    await prisma.user.upsert({
      where: { farmerId: u.farmerId },
      update: { passwordHash: hash, email: u.email },
      create: { farmerId: u.farmerId, email: u.email, passwordHash: hash },
    });
  }
  console.log("  ✓ Users (auth)");

  // ── 3. Valves ────────────────────────────────────────────────────────────────
  const valves = [
    { id: "valve-a", name: "Valve A", color: "#10b981", irrigationSchedule: "06:00 & 17:00 — 25 min", supervisorId: "f-006", x: 40, y: 60, width: 260, height: 180 },
    { id: "valve-b", name: "Valve B", color: "#3b82f6", irrigationSchedule: "06:30 & 17:30 — 25 min", supervisorId: "f-006", x: 320, y: 60, width: 260, height: 180 },
    { id: "valve-c", name: "Valve C", color: "#a855f7", irrigationSchedule: "07:00 & 18:00 — 30 min", supervisorId: "f-007", x: 600, y: 60, width: 260, height: 180 },
  ];

  for (const v of valves) {
    await prisma.valve.upsert({ where: { id: v.id }, update: v, create: v });
  }
  console.log("  ✓ Valves");

  // ── 4. Beds ──────────────────────────────────────────────────────────────────
  const bedConfig = [
    { valveId: "valve-a", count: 8, farmers: ["f-001","f-002"], baseLen: 40 },
    { valveId: "valve-b", count: 7, farmers: ["f-003","f-004"], baseLen: 35 },
    { valveId: "valve-c", count: 6, farmers: ["f-005"],          baseLen: 30 },
  ];

  let idx = 0;
  const stages = ["vegetative","flowering","fruiting","ripening","harvest"] as const;

  for (const { valveId, count, farmers: bedFarmers, baseLen } of bedConfig) {
    const letter = valveId.split("-")[1].toUpperCase();
    for (let i = 0; i < count; i++) {
      const variety = VARIETIES[i % VARIETIES.length];
      const lengthM = baseLen - (i % 3) * 5 + (i % 2 ? 5 : 0);
      const stage = stages[i % 5];
      const bed = {
        id: `${letter}-BED-${String(i + 1).padStart(2, "0")}`,
        valveId,
        lengthM,
        plantsPerMeter: 8,
        variety: variety.variety,
        origin: variety.origin,
        plantedDate: new Date(2026, 0, 15 + i * 3).toISOString().split("T")[0],
        stage,
        health: healthPattern[idx] ?? ("healthy" as const),
        farmerId: bedFarmers[i % bedFarmers.length],
        row: Math.floor(i / 4),
        col: i % 4,
      };
      await prisma.bed.upsert({ where: { id: bed.id }, update: bed, create: bed });
      idx++;
    }
  }
  console.log("  ✓ Beds");

  // ── 5. Harvest records ───────────────────────────────────────────────────────
  const beds = await prisma.bed.findMany();
  const today = new Date("2026-05-17");
  let hid = 1;
  const harvestEntries: Parameters<typeof prisma.harvestRecord.upsert>[0][] = [];

  for (const [bi, bed] of beds.entries()) {
    if (!["fruiting","ripening","harvest"].includes(bed.stage)) continue;
    for (let d = 13; d >= 0; d--) {
      if ((bi + d) % 3 !== 0) continue;
      const date = new Date(today);
      date.setDate(date.getDate() - d);
      const baseYield = bed.lengthM * 0.35;
      const variation = ((bi * 7 + d * 3) % 10) / 10;
      const kg = Math.round((baseYield + variation * 5) * 10) / 10;
      const hm = bed.health === "infected" ? 0.5 : bed.health === "warning" ? 0.8 : 1;
      const finalKg = new Prisma.Decimal(Math.round(kg * hm * 10) / 10);
      const id = `h-${String(hid++).padStart(4, "0")}`;
      const rec = {
        id,
        bedId: bed.id,
        date: date.toISOString().split("T")[0],
        kg: finalKg,
        farmerId: bed.farmerId,
        qualityGrade: bed.health === "healthy" ? "A" : bed.health === "warning" ? "B" : "C",
      };
      harvestEntries.push({ where: { id }, update: rec, create: rec });
    }
  }
  for (const entry of harvestEntries) {
    await prisma.harvestRecord.upsert(entry);
  }
  console.log(`  ✓ Harvest records (${harvestEntries.length})`);

  // ── 6. Disease reports ───────────────────────────────────────────────────────
  const infectedBeds = beds.filter(b => b.health === "infected");
  const warningBeds = beds.filter(b => b.health === "warning").slice(0, 2);
  const diseaseTypes = ["powdery_mildew","gray_mold","leaf_spot","root_rot"] as const;

  let did = 1;
  for (const [i, bed] of infectedBeds.entries()) {
    const type = diseaseTypes[i % diseaseTypes.length];
    const id = `d-${String(did++).padStart(4, "0")}`;
    const rec = {
      id,
      bedId: bed.id,
      type,
      severity: 25 + (i * 17) % 60,
      reportedAt: new Date(Date.now() - (i + 1) * 86400000),
      reportedBy: "f-006",
      status: (i === 0 ? "treating" : "notified") as "treating" | "notified",
      suggestedTreatment: DISEASE_TREATMENTS[type],
      treatmentSteps: DISEASE_TREATMENT_STEPS[type] as Prisma.InputJsonValue,
      treatmentApplied: i === 0,
      treatmentAppliedAt: i === 0 ? new Date(Date.now() - 43200000) : null,
      treatmentAppliedBy: i === 0 ? "f-001" : null,
      treatmentNote: i === 0 ? "Full spray applied. Replicated on secondary plants." : null,
      managerNotified: true,
      notifiedAt: new Date(Date.now() - (i + 1) * 86400000 + 300000),
      notificationChannels: ["telegram", "sms"] as Prisma.InputJsonValue,
      aiConfidence: 78 + (i * 5) % 20,
    };
    await prisma.diseaseReport.upsert({ where: { id }, update: rec, create: rec });
  }
  for (const [i, bed] of warningBeds.entries()) {
    const type = "nitrogen_deficiency" as const;
    const id = `d-${String(did++).padStart(4, "0")}`;
    const rec = {
      id,
      bedId: bed.id,
      type,
      severity: 15 + i * 8,
      reportedAt: new Date(Date.now() - (i + 3) * 86400000),
      reportedBy: "f-007",
      status: "open" as const,
      suggestedTreatment: DISEASE_TREATMENTS[type],
      treatmentSteps: DISEASE_TREATMENT_STEPS[type] as Prisma.InputJsonValue,
      treatmentApplied: false,
      managerNotified: false,
      notificationChannels: [] as Prisma.InputJsonValue,
      aiConfidence: 82,
    };
    await prisma.diseaseReport.upsert({ where: { id }, update: rec, create: rec });
  }
  console.log("  ✓ Disease reports");

  // ── 7. Tasks ─────────────────────────────────────────────────────────────────
  const tasks = [
    { id: "t-001", title: "Apply Kumulus DF to A-BED-06", description: "Mix 2g/L water, spray entire bed evenly including underside of leaves. Wear full PPE.", assignedTo: "f-001", createdBy: "f-008", bedId: "A-BED-06", status: "in_progress" as const, priority: "high" as const, category: "disease" as const, createdAt: new Date("2026-05-16T08:00:00Z"), dueDate: "2026-05-17" },
    { id: "t-002", title: "Harvest Grade-A berries — Valve A", description: "Pick all ripe grade-A berries from beds A-04 and A-05. Use clean baskets.", assignedTo: "f-002", createdBy: "f-008", status: "pending" as const, priority: "medium" as const, category: "harvest" as const, createdAt: new Date("2026-05-17T05:30:00Z"), dueDate: "2026-05-17" },
    { id: "t-003", title: "Inspect Valve B drip lines", description: "Check pressure and clogging in sections B-BED-03 to B-BED-04. Log PSI readings.", assignedTo: "f-003", createdBy: "f-006", status: "pending" as const, priority: "medium" as const, category: "irrigation" as const, createdAt: new Date("2026-05-17T06:00:00Z"), dueDate: "2026-05-18" },
    { id: "t-004", title: "Fertilizer application — Valve C", description: "Apply NPK 19-19-19 at 3kg per bed via drip fertigation.", assignedTo: "f-005", createdBy: "f-007", status: "done" as const, priority: "low" as const, category: "general" as const, createdAt: new Date("2026-05-15T07:00:00Z"), dueDate: "2026-05-16", completedAt: new Date("2026-05-16T14:30:00Z"), progressNote: "Applied to all 6 beds. Readings logged." },
    { id: "t-005", title: "AI photo inspection of infected beds", description: "Take close-up photos of A-BED-06, B-BED-05 for AI re-analysis and upload to system.", assignedTo: "f-006", createdBy: "f-008", status: "in_progress" as const, priority: "high" as const, category: "disease" as const, createdAt: new Date("2026-05-17T07:00:00Z"), dueDate: "2026-05-17" },
    { id: "t-006", title: "Take daily attendance — Valve A+B workers", description: "Record morning attendance for all farmers in Valve A and Valve B zones by 06:30.", assignedTo: "f-006", createdBy: "f-008", status: "done" as const, priority: "medium" as const, category: "general" as const, createdAt: new Date("2026-05-17T06:00:00Z"), dueDate: "2026-05-17", completedAt: new Date("2026-05-17T06:28:00Z") },
    { id: "t-007", title: "Treat B-BED-05 root rot — apply Trichoderma", description: "Reduce drip timer by 40%. Mix Trichoderma at 5g/L. Apply 200ml to each root zone.", assignedTo: "f-003", createdBy: "f-006", bedId: "B-BED-05", status: "pending" as const, priority: "high" as const, category: "disease" as const, createdAt: new Date("2026-05-17T08:00:00Z"), dueDate: "2026-05-17" },
  ];

  for (const t of tasks) {
    await prisma.task.upsert({ where: { id: t.id }, update: t, create: t });
  }
  console.log("  ✓ Tasks");

  // ── 8. Attendance ────────────────────────────────────────────────────────────
  const nonManagerFarmers = farmers.filter(f => f.role !== "manager");
  const statuses = ["present","present","present","present","late","present","present","absent","present","present","present","present","late","present"] as const;
  let aid = 1;

  for (let d = 13; d >= 0; d--) {
    const date = new Date("2026-05-17");
    date.setDate(date.getDate() - d);
    const ds = date.toISOString().split("T")[0];

    for (const [fi, f] of nonManagerFarmers.entries()) {
      const st = statuses[(fi + d) % statuses.length];
      const id = `a-${String(aid++).padStart(4, "0")}`;
      const rec = {
        id,
        farmerId: f.id,
        date: ds,
        status: st,
        checkInTime: st === "present" ? "06:00" : st === "late" ? "07:30" : undefined,
        checkOutTime: (st === "present" || st === "late") ? "17:00" : undefined,
        hoursWorked: st === "present" ? 10 : st === "late" ? 8.5 : 0,
        recordedBy: "f-006",
      };
      await prisma.attendanceRecord.upsert({ where: { farmerId_date: { farmerId: f.id, date: ds } }, update: rec, create: rec });
    }
  }
  console.log("  ✓ Attendance records");

  // ── 9. Notifications ─────────────────────────────────────────────────────────
  const notifications = [
    { id: "n-001", type: "disease" as const,     channel: "telegram" as const, message: "🚨 ALERT: A-BED-06 — Powdery Mildew detected (severity 42%). Treatment plan sent to Abebe.",   timestamp: new Date("2026-05-17T06:14:00Z"), read: false, link: "/diseases" },
    { id: "n-002", type: "harvest" as const,     channel: "in_app" as const,   message: "✅ Today's harvest target reached — Valve A: 38.4 kg collected.",                              timestamp: new Date("2026-05-17T10:30:00Z"), read: false, link: "/harvest" },
    { id: "n-003", type: "disease" as const,     channel: "sms" as const,      message: "🚨 ALERT: B-BED-05 — Root Rot suspected. Severity 59%. Action required.",                      timestamp: new Date("2026-05-16T15:22:00Z"), read: true,  link: "/diseases" },
    { id: "n-004", type: "irrigation" as const,  channel: "telegram" as const, message: "💧 Valve C morning irrigation completed — 30 min cycle.",                                      timestamp: new Date("2026-05-17T07:30:00Z"), read: true },
    { id: "n-005", type: "task" as const,        channel: "in_app" as const,   message: "📋 New high-priority task assigned to Selam Girma: AI photo inspection.",                     timestamp: new Date("2026-05-17T07:00:00Z"), read: false, link: "/tasks" },
    { id: "n-006", type: "disease" as const,     channel: "sms" as const,      message: "🚨 ALERT: C-BED-03 — Nitrogen deficiency flagged. Fertigation required.",                      timestamp: new Date("2026-05-14T09:00:00Z"), read: true,  link: "/diseases" },
  ];

  for (const n of notifications) {
    await prisma.notification.upsert({ where: { id: n.id }, update: n, create: n });
  }
  console.log("  ✓ Notifications");

  // ── 10. Expenses ─────────────────────────────────────────────────────────────
  const expenses = [
    { id: "exp-001", date: "2026-05-01", category: "chemicals" as const,  description: "Kumulus DF sulphur fungicide (5 kg)",       amountETB: new Prisma.Decimal("1250"), paidBy: "f-008", vendor: "Agro Supply Co.",   receiptRef: "AGR-2241" },
    { id: "exp-002", date: "2026-05-02", category: "fuel" as const,        description: "Diesel for water pump — 40 L",             amountETB: new Prisma.Decimal("2800"), paidBy: "f-008", vendor: "Total Ethiopia",    receiptRef: "TOT-0551" },
    { id: "exp-003", date: "2026-05-04", category: "packaging" as const,   description: "250g clamshell punnets × 2000",            amountETB: new Prisma.Decimal("5400"), paidBy: "f-006", vendor: "PackEthio Ltd.",    receiptRef: "PKE-3312" },
    { id: "exp-004", date: "2026-05-05", category: "chemicals" as const,   description: "Trichoderma harzianum biocontrol (1 kg)",  amountETB: new Prisma.Decimal("980"),  paidBy: "f-008", vendor: "Agro Supply Co.",   receiptRef: "AGR-2255" },
    { id: "exp-005", date: "2026-05-06", category: "repairs" as const,     description: "Drip-line emitter replacements — Valve B", amountETB: new Prisma.Decimal("760"),  paidBy: "f-006", vendor: "IrriTech Ethiopia", receiptRef: "IRT-0098" },
    { id: "exp-006", date: "2026-05-08", category: "labour" as const,      description: "Casual labour for bed prep — 10 workers", amountETB: new Prisma.Decimal("3200"), paidBy: "f-008", vendor: "Day Labour Pool" },
    { id: "exp-007", date: "2026-05-09", category: "seeds" as const,       description: "Albion runner plants × 500",               amountETB: new Prisma.Decimal("7500"), paidBy: "f-008", vendor: "California Nursery", receiptRef: "CAL-4401" },
    { id: "exp-008", date: "2026-05-10", category: "fuel" as const,        description: "Petrol for motorbike deliveries",          amountETB: new Prisma.Decimal("650"),  paidBy: "f-006", vendor: "Total Ethiopia",    receiptRef: "TOT-0571" },
    { id: "exp-009", date: "2026-05-12", category: "equipment" as const,   description: "Knapsack sprayer (16 L) — replacement",   amountETB: new Prisma.Decimal("1800"), paidBy: "f-008", vendor: "FarmTools Addis",  receiptRef: "FTA-0212" },
    { id: "exp-010", date: "2026-05-13", category: "chemicals" as const,   description: "NPK 19-19-19 fertiliser (25 kg)",          amountETB: new Prisma.Decimal("2100"), paidBy: "f-008", vendor: "Agro Supply Co.",   receiptRef: "AGR-2280" },
    { id: "exp-011", date: "2026-05-14", category: "packaging" as const,   description: "Cardboard export boxes × 500",             amountETB: new Prisma.Decimal("3750"), paidBy: "f-006", vendor: "PackEthio Ltd.",    receiptRef: "PKE-3340" },
    { id: "exp-012", date: "2026-05-15", category: "repairs" as const,     description: "Pump seal replacement & labour",           amountETB: new Prisma.Decimal("1450"), paidBy: "f-008", vendor: "AquaService",      receiptRef: "AQS-0077" },
    { id: "exp-013", date: "2026-05-16", category: "fuel" as const,        description: "Diesel for generator — 20 L",              amountETB: new Prisma.Decimal("1400"), paidBy: "f-006", vendor: "Total Ethiopia",    receiptRef: "TOT-0589" },
    { id: "exp-014", date: "2026-05-17", category: "other" as const,       description: "Printer ink & admin supplies",             amountETB: new Prisma.Decimal("320"),  paidBy: "f-008", vendor: "Office Depot AA",   receiptRef: "ODA-0891" },
  ];

  for (const e of expenses) {
    await prisma.expense.upsert({ where: { id: e.id }, update: e, create: e });
  }
  console.log("  ✓ Expenses");

  // ── 11. Planting records ─────────────────────────────────────────────────────
  const plantingRecords = [
    { id: "pl-001", bedId: "A-BED-01", valveId: "valve-a", variety: "Festival",  plannedDate: "2026-01-10", actualDate: "2026-01-12", expectedHarvestDate: "2026-04-20", ageInDays: 125, seedsPerMeter: 8, seedSource: "Nakuru Horticulture KE", status: "harvested" as const, createdBy: "f-008" },
    { id: "pl-002", bedId: "A-BED-02", valveId: "valve-a", variety: "Chandler", plannedDate: "2026-01-10", actualDate: "2026-01-13", expectedHarvestDate: "2026-04-25", ageInDays: 124, seedsPerMeter: 8, seedSource: "Nakuru Horticulture KE", status: "harvested" as const, createdBy: "f-008" },
    { id: "pl-003", bedId: "A-BED-03", valveId: "valve-a", variety: "Festival",  plannedDate: "2026-02-01", actualDate: "2026-02-03", expectedHarvestDate: "2026-05-15", ageInDays: 103, seedsPerMeter: 8, seedSource: "Nakuru Horticulture KE", status: "growing" as const, createdBy: "f-008" },
    { id: "pl-004", bedId: "A-BED-04", valveId: "valve-a", variety: "Albion",   plannedDate: "2026-02-15", actualDate: "2026-02-16", expectedHarvestDate: "2026-05-28", ageInDays: 90,  seedsPerMeter: 7, seedSource: "Ethiopian Horticulture",   status: "growing" as const, createdBy: "f-008" },
    { id: "pl-005", bedId: "B-BED-01", valveId: "valve-b", variety: "Chandler", plannedDate: "2026-01-20", actualDate: "2026-01-22", expectedHarvestDate: "2026-05-01", ageInDays: 115, seedsPerMeter: 8, seedSource: "Nakuru Horticulture KE", status: "growing" as const, createdBy: "f-008" },
    { id: "pl-006", bedId: "B-BED-02", valveId: "valve-b", variety: "Festival",  plannedDate: "2026-01-20", actualDate: "2026-01-21", expectedHarvestDate: "2026-04-30", ageInDays: 116, seedsPerMeter: 8, seedSource: "Nakuru Horticulture KE", status: "growing" as const, notes: "Slight botrytis detected — monitoring", createdBy: "f-008" },
    { id: "pl-007", bedId: "B-BED-03", valveId: "valve-b", variety: "Seascape", plannedDate: "2026-02-20", actualDate: "2026-02-22", expectedHarvestDate: "2026-06-05", ageInDays: 84,  seedsPerMeter: 8, seedSource: "Ethiopian Horticulture",   status: "growing" as const, createdBy: "f-008" },
    { id: "pl-008", bedId: "B-BED-04", valveId: "valve-b", variety: "Albion",   plannedDate: "2026-03-01", actualDate: "2026-03-02", expectedHarvestDate: "2026-06-10", ageInDays: 75,  seedsPerMeter: 7, seedSource: "Ethiopian Horticulture",   status: "growing" as const, createdBy: "f-008" },
    { id: "pl-009", bedId: "C-BED-01", valveId: "valve-c", variety: "Festival",  plannedDate: "2026-03-10", actualDate: "2026-03-12", expectedHarvestDate: "2026-06-20", ageInDays: 66,  seedsPerMeter: 8, seedSource: "Nakuru Horticulture KE", status: "growing" as const, createdBy: "f-008" },
    { id: "pl-010", bedId: "C-BED-02", valveId: "valve-c", variety: "Chandler", plannedDate: "2026-03-10", actualDate: "2026-03-11", expectedHarvestDate: "2026-06-22", ageInDays: 67,  seedsPerMeter: 8, seedSource: "Nakuru Horticulture KE", status: "growing" as const, createdBy: "f-008" },
    { id: "pl-011", bedId: "C-BED-03", valveId: "valve-c", variety: "Seascape", plannedDate: "2026-04-01", expectedHarvestDate: "2026-07-10", ageInDays: 46, seedsPerMeter: 8, seedSource: "Ethiopian Horticulture", status: "planned" as const, createdBy: "f-008" },
    { id: "pl-012", bedId: "C-BED-04", valveId: "valve-c", variety: "Albion",   plannedDate: "2026-04-05", expectedHarvestDate: "2026-07-15", ageInDays: 42, seedsPerMeter: 7, seedSource: "Ethiopian Horticulture", status: "planned" as const, createdBy: "f-008" },
  ];

  for (const p of plantingRecords) {
    await prisma.plantingRecord.upsert({ where: { id: p.id }, update: p, create: p });
  }
  console.log("  ✓ Planting records");

  // ── 12. Worker assignments ────────────────────────────────────────────────────
  const workerAssignments = [
    { id: "wa-001", farmerId: "f-001", valveId: "valve-a", bedId: "A-BED-01", activity: "harvesting" as const,         supervisorId: "f-006", date: "2026-05-17", shift: "morning" as const,    hoursExpected: 4, hoursActual: 4.5, status: "completed" as const },
    { id: "wa-002", farmerId: "f-002", valveId: "valve-a", bedId: "A-BED-02", activity: "harvesting" as const,         supervisorId: "f-006", date: "2026-05-17", shift: "morning" as const,    hoursExpected: 4, hoursActual: 4.0, status: "completed" as const },
    { id: "wa-003", farmerId: "f-003", valveId: "valve-b", bedId: "B-BED-01", activity: "disease_inspection" as const, supervisorId: "f-006", date: "2026-05-17", shift: "morning" as const,    hoursExpected: 3, status: "in_progress" as const },
    { id: "wa-004", farmerId: "f-004", valveId: "valve-b", bedId: "B-BED-02", activity: "pruning" as const,            supervisorId: "f-006", date: "2026-05-17", shift: "afternoon" as const,  hoursExpected: 4, status: "assigned" as const },
    { id: "wa-005", farmerId: "f-005", valveId: "valve-c", bedId: "C-BED-01", activity: "fertilizing" as const,        supervisorId: "f-007", date: "2026-05-17", shift: "full_day" as const,   hoursExpected: 8, status: "in_progress" as const },
    { id: "wa-006", farmerId: "f-001", valveId: "valve-a",                    activity: "irrigation_check" as const,   supervisorId: "f-006", date: "2026-05-16", shift: "morning" as const,    hoursExpected: 2, hoursActual: 2.0, status: "completed" as const },
    { id: "wa-007", farmerId: "f-002", valveId: "valve-b",                    activity: "cleaning" as const,           supervisorId: "f-006", date: "2026-05-16", shift: "afternoon" as const,  hoursExpected: 3, hoursActual: 3.0, status: "completed" as const },
    { id: "wa-008", farmerId: "f-003", valveId: "valve-c", bedId: "C-BED-02", activity: "harvesting" as const,         supervisorId: "f-007", date: "2026-05-16", shift: "morning" as const,    hoursExpected: 4, hoursActual: 4.5, status: "completed" as const },
    { id: "wa-009", farmerId: "f-004", valveId: "valve-a", bedId: "A-BED-03", activity: "packaging" as const,          supervisorId: "f-006", date: "2026-05-15", shift: "full_day" as const,   hoursExpected: 8, hoursActual: 7.5, status: "completed" as const },
    { id: "wa-010", farmerId: "f-005", valveId: "valve-b", bedId: "B-BED-03", activity: "disease_inspection" as const, supervisorId: "f-007", date: "2026-05-15", shift: "morning" as const,    hoursExpected: 3, hoursActual: 3.0, status: "completed" as const, notes: "Found gray mold on lower fruiting clusters" },
  ];

  for (const wa of workerAssignments) {
    await prisma.workerAssignment.upsert({ where: { id: wa.id }, update: wa, create: wa });
  }
  console.log("  ✓ Worker assignments");

  // ── 13. Fertigation records ──────────────────────────────────────────────────
  const fertigationRecords = [
    { id: "ft-001", valveId: "valve-a", fertilizerType: "NPK 20-20-20",                 activeIngredient: "Nitrogen, Phosphorus, Potassium",          dosageGPerL: 2.5, waterVolumeLiters: 400, applicationDate: "2026-05-15", nextScheduleDate: "2026-05-22", responsibleWorkerId: "f-001", applicationMethod: "drip" as const,   status: "applied" as const,    cost: new Prisma.Decimal("320"), notes: "Weekly balanced feed" },
    { id: "ft-002", valveId: "valve-b", fertilizerType: "Calcium Nitrate",              activeIngredient: "Ca(NO3)2 — 15.5% N, 19% Ca",              dosageGPerL: 1.5, waterVolumeLiters: 350, applicationDate: "2026-05-14", nextScheduleDate: "2026-05-21", responsibleWorkerId: "f-002", applicationMethod: "drip" as const,   status: "applied" as const,    cost: new Prisma.Decimal("280"), notes: "Fruit firmness programme" },
    { id: "ft-003", valveId: "valve-c", fertilizerType: "Potassium Sulfate",            activeIngredient: "K2SO4 — 50% K2O",                          dosageGPerL: 2.0, waterVolumeLiters: 300, applicationDate: "2026-05-13", nextScheduleDate: "2026-05-20", responsibleWorkerId: "f-005", applicationMethod: "drip" as const,   status: "applied" as const,    cost: new Prisma.Decimal("450"), notes: "Sweetness enhancement pre-harvest" },
    { id: "ft-004", valveId: "valve-a", fertilizerType: "Humic Acid",                   activeIngredient: "Leonardite-derived 85% humic + fulvic",    dosageGPerL: 1.0, waterVolumeLiters: 400, applicationDate: "2026-05-17", nextScheduleDate: "2026-05-31", responsibleWorkerId: "f-001", applicationMethod: "drip" as const,   status: "scheduled" as const,  cost: new Prisma.Decimal("180") },
    { id: "ft-005", valveId: "valve-b", fertilizerType: "Iron Chelate (EDTA-Fe)",       activeIngredient: "Fe-EDTA 13% Fe",                           dosageGPerL: 0.5, waterVolumeLiters: 350, applicationDate: "2026-05-17", nextScheduleDate: "2026-05-31", responsibleWorkerId: "f-002", applicationMethod: "foliar" as const, status: "scheduled" as const,  cost: new Prisma.Decimal("620"), notes: "Address chlorosis in B-BED-02" },
    { id: "ft-006", valveId: "valve-c", fertilizerType: "NPK 20-20-20",                 activeIngredient: "Nitrogen, Phosphorus, Potassium",          dosageGPerL: 2.5, waterVolumeLiters: 300, applicationDate: "2026-05-12", nextScheduleDate: "2026-05-19", responsibleWorkerId: "f-005", applicationMethod: "drip" as const,   status: "applied" as const,    cost: new Prisma.Decimal("240") },
    { id: "ft-007", valveId: "valve-a", fertilizerType: "Magnesium Sulfate",             activeIngredient: "MgSO4 · 7H2O — 9.9% Mg",                  dosageGPerL: 1.5, waterVolumeLiters: 400, applicationDate: "2026-05-10", nextScheduleDate: "2026-05-24", responsibleWorkerId: "f-001", applicationMethod: "foliar" as const, status: "applied" as const,    cost: new Prisma.Decimal("150") },
    { id: "ft-008", valveId: "valve-b", fertilizerType: "Potassium Sulfate",            activeIngredient: "K2SO4 — 50% K2O",                          dosageGPerL: 2.0, waterVolumeLiters: 350, applicationDate: "2026-05-17", nextScheduleDate: "2026-05-24", responsibleWorkerId: "f-003", applicationMethod: "drip" as const,   status: "scheduled" as const,  cost: new Prisma.Decimal("380") },
  ];

  for (const ft of fertigationRecords) {
    await prisma.fertigationRecord.upsert({ where: { id: ft.id }, update: ft, create: ft });
  }
  console.log("  ✓ Fertigation records");

  // ── 14. Customer orders ──────────────────────────────────────────────────────
  const orders = [
    { id: "ord-001", customerName: "Skylight Hotel",                  customerType: "hotel" as const,        orderDate: "2026-05-15", deliveryDate: "2026-05-18", quantityKg: new Prisma.Decimal("20"),  pricePerKg: new Prisma.Decimal("180"), totalAmount: new Prisma.Decimal("3600"),  advancePaid: new Prisma.Decimal("1800"),  paymentStatus: "partial" as const,   deliveryStatus: "pending" as const,   variety: "Festival",  phone: "+251911234567", notes: "Premium grade only — reject any blemished fruit" },
    { id: "ord-002", customerName: "Edna Mall Supermarket",           customerType: "supermarket" as const,  orderDate: "2026-05-14", deliveryDate: "2026-05-17", quantityKg: new Prisma.Decimal("30"),  pricePerKg: new Prisma.Decimal("140"), totalAmount: new Prisma.Decimal("4200"),  advancePaid: new Prisma.Decimal("4200"),  paymentStatus: "paid" as const,      deliveryStatus: "delivered" as const, phone: "+251922345678" },
    { id: "ord-003", customerName: "Yod Abyssinia Restaurant",        customerType: "restaurant" as const,   orderDate: "2026-05-16", deliveryDate: "2026-05-19", quantityKg: new Prisma.Decimal("10"),  pricePerKg: new Prisma.Decimal("160"), totalAmount: new Prisma.Decimal("1600"),  advancePaid: new Prisma.Decimal("800"),   paymentStatus: "partial" as const,   deliveryStatus: "pending" as const,   variety: "Chandler", phone: "+251933456789" },
    { id: "ord-004", customerName: "Addis Fruit Market",              customerType: "direct" as const,       orderDate: "2026-05-17", deliveryDate: "2026-05-17", quantityKg: new Prisma.Decimal("15"),  pricePerKg: new Prisma.Decimal("120"), totalAmount: new Prisma.Decimal("1800"),  advancePaid: new Prisma.Decimal("1800"),  paymentStatus: "paid" as const,      deliveryStatus: "delivered" as const, phone: "+251944567890" },
    { id: "ord-005", customerName: "Radisson Blu Hotel",              customerType: "hotel" as const,        orderDate: "2026-05-12", deliveryDate: "2026-05-15", quantityKg: new Prisma.Decimal("25"),  pricePerKg: new Prisma.Decimal("175"), totalAmount: new Prisma.Decimal("4375"),  advancePaid: new Prisma.Decimal("4375"),  paymentStatus: "paid" as const,      deliveryStatus: "delivered" as const, variety: "Festival",  phone: "+251955678901" },
    { id: "ord-006", customerName: "Bole International Airport Café", customerType: "restaurant" as const,   orderDate: "2026-05-17", deliveryDate: "2026-05-20", quantityKg: new Prisma.Decimal("8"),   pricePerKg: new Prisma.Decimal("165"), totalAmount: new Prisma.Decimal("1320"),  advancePaid: new Prisma.Decimal("0"),     paymentStatus: "pending" as const,   deliveryStatus: "pending" as const,   phone: "+251966789012" },
    { id: "ord-007", customerName: "Shoa Supermarket Chain",          customerType: "supermarket" as const,  orderDate: "2026-05-10", deliveryDate: "2026-05-13", quantityKg: new Prisma.Decimal("50"),  pricePerKg: new Prisma.Decimal("130"), totalAmount: new Prisma.Decimal("6500"),  advancePaid: new Prisma.Decimal("6500"),  paymentStatus: "paid" as const,      deliveryStatus: "delivered" as const, phone: "+251977890123" },
    { id: "ord-008", customerName: "Dubai Export — Al Mana Foods",    customerType: "export" as const,       orderDate: "2026-05-01", deliveryDate: "2026-05-25", quantityKg: new Prisma.Decimal("100"), pricePerKg: new Prisma.Decimal("200"), totalAmount: new Prisma.Decimal("20000"), advancePaid: new Prisma.Decimal("10000"), paymentStatus: "partial" as const,   deliveryStatus: "pending" as const,   variety: "Festival",  notes: "Export phytosanitary cert required — contact MoA Addis office" },
  ];

  for (const o of orders) {
    await prisma.customerOrder.upsert({ where: { id: o.id }, update: o, create: o });
  }
  console.log("  ✓ Customer orders");

  // ── 15. Packaging records ────────────────────────────────────────────────────
  const packagingRecords = [
    { id: "pk-001", batchNumber: "PKG-2026-051", harvestDate: "2026-05-17", packedDate: "2026-05-17", valveId: "valve-a", variety: "Festival",              harvestedKg: new Prisma.Decimal("28.5"), gradedKg: new Prisma.Decimal("26.2"), packedKg: new Prisma.Decimal("24.0"), rejectedKg: new Prisma.Decimal("2.3"), packageSize: toPackageSize("500g"), packageCount: 48, cartonCount: 4, plateCount: 0, lostKg: new Prisma.Decimal("2.2"), purpose: "export" as const,      gradeAPct: 78, gradeBPct: 22, packedBy: "f-004", status: "packed" as const,      orderId: "ord-008" },
    { id: "pk-002", batchNumber: "PKG-2026-052", harvestDate: "2026-05-17", packedDate: "2026-05-17", valveId: "valve-b", variety: "California Albion",      harvestedKg: new Prisma.Decimal("19.2"), gradedKg: new Prisma.Decimal("17.5"), packedKg: new Prisma.Decimal("16.0"), rejectedKg: new Prisma.Decimal("1.7"), packageSize: toPackageSize("1kg"),  packageCount: 16, cartonCount: 2, plateCount: 4, lostKg: new Prisma.Decimal("1.5"), purpose: "hotel" as const,       gradeAPct: 72, gradeBPct: 28, packedBy: "f-004", status: "dispatched" as const, orderId: "ord-001" },
    { id: "pk-003", batchNumber: "PKG-2026-050", harvestDate: "2026-05-16", packedDate: "2026-05-16", valveId: "valve-a", variety: "Festival",              harvestedKg: new Prisma.Decimal("31.0"), gradedKg: new Prisma.Decimal("28.5"), packedKg: new Prisma.Decimal("26.0"), rejectedKg: new Prisma.Decimal("2.5"), packageSize: toPackageSize("500g"), packageCount: 52, cartonCount: 5, plateCount: 2, lostKg: new Prisma.Decimal("2.5"), purpose: "export" as const,      gradeAPct: 81, gradeBPct: 19, packedBy: "f-004", status: "dispatched" as const, orderId: "ord-008" },
    { id: "pk-004", batchNumber: "PKG-2026-049", harvestDate: "2026-05-16", packedDate: "2026-05-16", valveId: "valve-c", variety: "Monterey",              harvestedKg: new Prisma.Decimal("14.8"), gradedKg: new Prisma.Decimal("13.2"), packedKg: new Prisma.Decimal("12.0"), rejectedKg: new Prisma.Decimal("1.6"), packageSize: toPackageSize("250g"), packageCount: 48, cartonCount: 0, plateCount: 8, lostKg: new Prisma.Decimal("1.2"), purpose: "local" as const,       gradeAPct: 75, gradeBPct: 25, packedBy: "f-004", status: "dispatched" as const, orderId: "ord-004" },
    { id: "pk-005", batchNumber: "PKG-2026-048", harvestDate: "2026-05-15", packedDate: "2026-05-15", valveId: "valve-a", variety: "California Albion",      harvestedKg: new Prisma.Decimal("33.0"), gradedKg: new Prisma.Decimal("30.0"), packedKg: new Prisma.Decimal("27.5"), rejectedKg: new Prisma.Decimal("3.0"), packageSize: toPackageSize("1kg"),  packageCount: 27, cartonCount: 3, plateCount: 0, lostKg: new Prisma.Decimal("2.5"), purpose: "supermarket" as const, gradeAPct: 80, gradeBPct: 20, packedBy: "f-004", status: "dispatched" as const, orderId: "ord-002" },
    { id: "pk-006", batchNumber: "PKG-2026-047", harvestDate: "2026-05-15", packedDate: "2026-05-15", valveId: "valve-b", variety: "Australian San Andreas", harvestedKg: new Prisma.Decimal("22.5"), gradedKg: new Prisma.Decimal("20.0"), packedKg: new Prisma.Decimal("18.5"), rejectedKg: new Prisma.Decimal("2.5"), packageSize: toPackageSize("500g"), packageCount: 37, cartonCount: 2, plateCount: 5, lostKg: new Prisma.Decimal("1.5"), purpose: "juice" as const,       gradeAPct: 76, gradeBPct: 24, packedBy: "f-004", status: "dispatched" as const },
    { id: "pk-007", batchNumber: "PKG-2026-046", harvestDate: "2026-05-14", packedDate: "2026-05-14", valveId: "valve-a", variety: "Camarosa",              harvestedKg: new Prisma.Decimal("29.0"), gradedKg: new Prisma.Decimal("26.5"), packedKg: new Prisma.Decimal("24.5"), rejectedKg: new Prisma.Decimal("2.5"), packageSize: toPackageSize("bulk"), packageCount: 1,  cartonCount: 0, plateCount: 0, lostKg: new Prisma.Decimal("2.0"), purpose: "jam" as const,         gradeAPct: 65, gradeBPct: 35, packedBy: "f-004", status: "dispatched" as const },
    { id: "pk-008", batchNumber: "PKG-2026-053", harvestDate: "2026-05-17", packedDate: "2026-05-17", valveId: "valve-c", variety: "Monterey",              harvestedKg: new Prisma.Decimal("11.0"), gradedKg: new Prisma.Decimal("10.0"), packedKg: new Prisma.Decimal("0.0"),  rejectedKg: new Prisma.Decimal("1.0"), packageSize: toPackageSize("250g"), packageCount: 0,  cartonCount: 0, plateCount: 0, lostKg: new Prisma.Decimal("0.0"), purpose: "local" as const,       gradeAPct: 80, gradeBPct: 20, packedBy: "f-004", status: "in_progress" as const, orderId: "ord-001" },
  ];

  for (const pk of packagingRecords) {
    await prisma.packagingRecord.upsert({ where: { id: pk.id }, update: pk, create: pk });
  }
  console.log("  ✓ Packaging records");

  // ── 16. Payroll records ──────────────────────────────────────────────────────
  const payroll = [
    { id: "pay-001", farmerId: "f-001", month: "2026-05", daysWorked: 22, dailyWage: new Prisma.Decimal("550"),  basePay: new Prisma.Decimal("12100"), overtimeHours: 6, overtimePay: new Prisma.Decimal("825"),  bonus: new Prisma.Decimal("500"),  deductions: new Prisma.Decimal("605"),  netPay: new Prisma.Decimal("12820"), paymentStatus: "pending" as const },
    { id: "pay-002", farmerId: "f-002", month: "2026-05", daysWorked: 21, dailyWage: new Prisma.Decimal("550"),  basePay: new Prisma.Decimal("11550"), overtimeHours: 4, overtimePay: new Prisma.Decimal("550"),  bonus: new Prisma.Decimal("0"),    deductions: new Prisma.Decimal("578"),  netPay: new Prisma.Decimal("11522"), paymentStatus: "pending" as const },
    { id: "pay-003", farmerId: "f-003", month: "2026-05", daysWorked: 20, dailyWage: new Prisma.Decimal("550"),  basePay: new Prisma.Decimal("11000"), overtimeHours: 2, overtimePay: new Prisma.Decimal("275"),  bonus: new Prisma.Decimal("300"),  deductions: new Prisma.Decimal("554"),  netPay: new Prisma.Decimal("11021"), paymentStatus: "pending" as const },
    { id: "pay-004", farmerId: "f-004", month: "2026-05", daysWorked: 22, dailyWage: new Prisma.Decimal("580"),  basePay: new Prisma.Decimal("12760"), overtimeHours: 8, overtimePay: new Prisma.Decimal("1160"), bonus: new Prisma.Decimal("800"),  deductions: new Prisma.Decimal("736"),  netPay: new Prisma.Decimal("13984"), paymentStatus: "pending" as const },
    { id: "pay-005", farmerId: "f-005", month: "2026-05", daysWorked: 21, dailyWage: new Prisma.Decimal("550"),  basePay: new Prisma.Decimal("11550"), overtimeHours: 3, overtimePay: new Prisma.Decimal("413"),  bonus: new Prisma.Decimal("0"),    deductions: new Prisma.Decimal("598"),  netPay: new Prisma.Decimal("11365"), paymentStatus: "pending" as const },
    { id: "pay-006", farmerId: "f-006", month: "2026-05", daysWorked: 26, dailyWage: new Prisma.Decimal("920"),  basePay: new Prisma.Decimal("23920"), overtimeHours: 5, overtimePay: new Prisma.Decimal("1150"), bonus: new Prisma.Decimal("1500"), deductions: new Prisma.Decimal("2629"), netPay: new Prisma.Decimal("23941"), paymentStatus: "pending" as const },
    { id: "pay-007", farmerId: "f-007", month: "2026-05", daysWorked: 25, dailyWage: new Prisma.Decimal("880"),  basePay: new Prisma.Decimal("22000"), overtimeHours: 4, overtimePay: new Prisma.Decimal("880"),  bonus: new Prisma.Decimal("1000"), deductions: new Prisma.Decimal("2394"), netPay: new Prisma.Decimal("21486"), paymentStatus: "pending" as const },
    { id: "pay-008", farmerId: "f-008", month: "2026-05", daysWorked: 26, dailyWage: new Prisma.Decimal("1800"), basePay: new Prisma.Decimal("46800"), overtimeHours: 0, overtimePay: new Prisma.Decimal("0"),    bonus: new Prisma.Decimal("3000"), deductions: new Prisma.Decimal("6588"), netPay: new Prisma.Decimal("43212"), paymentStatus: "pending" as const },
    { id: "pay-009", farmerId: "f-001", month: "2026-04", daysWorked: 25, dailyWage: new Prisma.Decimal("550"),  basePay: new Prisma.Decimal("13750"), overtimeHours: 4, overtimePay: new Prisma.Decimal("550"),  bonus: new Prisma.Decimal("200"),  deductions: new Prisma.Decimal("719"),  netPay: new Prisma.Decimal("13781"), paymentStatus: "paid" as const, paidDate: "2026-04-30" },
    { id: "pay-010", farmerId: "f-002", month: "2026-04", daysWorked: 24, dailyWage: new Prisma.Decimal("550"),  basePay: new Prisma.Decimal("13200"), overtimeHours: 2, overtimePay: new Prisma.Decimal("275"),  bonus: new Prisma.Decimal("0"),    deductions: new Prisma.Decimal("664"),  netPay: new Prisma.Decimal("12811"), paymentStatus: "paid" as const, paidDate: "2026-04-30" },
    { id: "pay-011", farmerId: "f-003", month: "2026-04", daysWorked: 23, dailyWage: new Prisma.Decimal("550"),  basePay: new Prisma.Decimal("12650"), overtimeHours: 0, overtimePay: new Prisma.Decimal("0"),    bonus: new Prisma.Decimal("0"),    deductions: new Prisma.Decimal("633"),  netPay: new Prisma.Decimal("12017"), paymentStatus: "paid" as const, paidDate: "2026-04-30" },
    { id: "pay-012", farmerId: "f-006", month: "2026-04", daysWorked: 26, dailyWage: new Prisma.Decimal("920"),  basePay: new Prisma.Decimal("23920"), overtimeHours: 6, overtimePay: new Prisma.Decimal("1380"), bonus: new Prisma.Decimal("1000"), deductions: new Prisma.Decimal("2630"), netPay: new Prisma.Decimal("23670"), paymentStatus: "paid" as const, paidDate: "2026-04-30" },
  ];

  for (const p of payroll) {
    await prisma.payrollRecord.upsert({ where: { farmerId_month: { farmerId: p.farmerId, month: p.month } }, update: p, create: p });
  }
  console.log("  ✓ Payroll records");

  // ── 17. Stock items ──────────────────────────────────────────────────────────
  const stockItems = [
    { id: "si-001", name: "NPK 20-20-20",                   category: "fertilizer" as const, unit: "kg" as const,    currentQty: new Prisma.Decimal("23.25"), reorderLevel: new Prisma.Decimal("5"),   maxCapacity: new Prisma.Decimal("50"),  costPerUnit: new Prisma.Decimal("128"),  supplier: "Agri Supply Addis",     lastRestockedDate: "2026-05-01", notes: "Balanced weekly feed" },
    { id: "si-002", name: "Calcium Nitrate",                 category: "fertilizer" as const, unit: "kg" as const,    currentQty: new Prisma.Decimal("14.47"), reorderLevel: new Prisma.Decimal("4"),   maxCapacity: new Prisma.Decimal("30"),  costPerUnit: new Prisma.Decimal("110"),  supplier: "Agri Supply Addis",     lastRestockedDate: "2026-05-01", notes: "Improves fruit firmness" },
    { id: "si-003", name: "Potassium Sulfate (K₂SO₄)",      category: "fertilizer" as const, unit: "kg" as const,    currentQty: new Prisma.Decimal("10.7"),  reorderLevel: new Prisma.Decimal("3"),   maxCapacity: new Prisma.Decimal("25"),  costPerUnit: new Prisma.Decimal("225"),  supplier: "Ethiopian Agro Chem",   lastRestockedDate: "2026-04-25", notes: "Pre-harvest sweetness boost" },
    { id: "si-004", name: "Humic Acid",                      category: "fertilizer" as const, unit: "kg" as const,    currentQty: new Prisma.Decimal("7.6"),   reorderLevel: new Prisma.Decimal("2"),   maxCapacity: new Prisma.Decimal("20"),  costPerUnit: new Prisma.Decimal("450"),  supplier: "Ethiopian Agro Chem",   lastRestockedDate: "2026-04-28", notes: "Soil conditioner — improves nutrient uptake" },
    { id: "si-005", name: "Iron Chelate (EDTA-Fe 13%)",      category: "fertilizer" as const, unit: "kg" as const,    currentQty: new Prisma.Decimal("1.82"),  reorderLevel: new Prisma.Decimal("1"),   maxCapacity: new Prisma.Decimal("5"),   costPerUnit: new Prisma.Decimal("3544"), supplier: "Specialty Fert KE",     lastRestockedDate: "2026-04-10", notes: "Treats leaf yellowing. Store below 25°C." },
    { id: "si-006", name: "Magnesium Sulfate (Epsom)",       category: "fertilizer" as const, unit: "kg" as const,    currentQty: new Prisma.Decimal("5.4"),   reorderLevel: new Prisma.Decimal("2"),   maxCapacity: new Prisma.Decimal("15"),  costPerUnit: new Prisma.Decimal("94"),   supplier: "Agri Supply Addis",     lastRestockedDate: "2026-04-25" },
    { id: "si-007", name: "Kumulus DF (Sulfur 80%)",         category: "pesticide" as const,  unit: "kg" as const,    currentQty: new Prisma.Decimal("2.5"),   reorderLevel: new Prisma.Decimal("0.5"), maxCapacity: new Prisma.Decimal("10"),  costPerUnit: new Prisma.Decimal("340"),  supplier: "Bayer Ethiopia",        lastRestockedDate: "2026-04-20", notes: "Controls powdery mildew" },
    { id: "si-008", name: "Switch 62.5 WG (Botryticide)",    category: "pesticide" as const,  unit: "kg" as const,    currentQty: new Prisma.Decimal("0.28"),  reorderLevel: new Prisma.Decimal("0.5"), maxCapacity: new Prisma.Decimal("2"),   costPerUnit: new Prisma.Decimal("8800"), supplier: "Syngenta Ethiopia",     lastRestockedDate: "2026-03-15", notes: "⚠ BELOW REORDER — place order now. Controls gray mold." },
    { id: "si-009", name: "Kocide 3000 (Copper Hydroxide)",  category: "pesticide" as const,  unit: "kg" as const,    currentQty: new Prisma.Decimal("1.5"),   reorderLevel: new Prisma.Decimal("0.4"), maxCapacity: new Prisma.Decimal("5"),   costPerUnit: new Prisma.Decimal("620"),  supplier: "Bayer Ethiopia",        lastRestockedDate: "2026-04-20", notes: "Controls leaf spot & bacterial diseases" },
    { id: "si-010", name: "500g Punnets (PET clear)",         category: "packaging" as const,  unit: "piece" as const, currentQty: new Prisma.Decimal("164"),    reorderLevel: new Prisma.Decimal("50"),  maxCapacity: new Prisma.Decimal("500"), costPerUnit: new Prisma.Decimal("5"),    supplier: "Addis Packaging Ltd",   lastRestockedDate: "2026-05-10" },
    { id: "si-011", name: "1kg Export Cartons",               category: "packaging" as const,  unit: "piece" as const, currentQty: new Prisma.Decimal("22"),     reorderLevel: new Prisma.Decimal("20"),  maxCapacity: new Prisma.Decimal("100"), costPerUnit: new Prisma.Decimal("28"),   supplier: "Addis Packaging Ltd",   lastRestockedDate: "2026-05-10", notes: "For Dubai export — reorder urgently" },
    { id: "si-012", name: "250g Clamshells",                  category: "packaging" as const,  unit: "piece" as const, currentQty: new Prisma.Decimal("200"),    reorderLevel: new Prisma.Decimal("40"),  maxCapacity: new Prisma.Decimal("400"), costPerUnit: new Prisma.Decimal("4"),    supplier: "Addis Packaging Ltd",   lastRestockedDate: "2026-05-10" },
    { id: "si-013", name: "Plastic Mulch Film (100m roll)",   category: "tool" as const,       unit: "roll" as const,  currentQty: new Prisma.Decimal("2"),     reorderLevel: new Prisma.Decimal("1"),   maxCapacity: new Prisma.Decimal("10"),  costPerUnit: new Prisma.Decimal("2800"), supplier: "Drip Irrigation ET",    lastRestockedDate: "2026-02-01" },
    { id: "si-014", name: "Drip Tape (100m roll, 16mm)",      category: "tool" as const,       unit: "roll" as const,  currentQty: new Prisma.Decimal("3"),     reorderLevel: new Prisma.Decimal("1"),   maxCapacity: new Prisma.Decimal("10"),  costPerUnit: new Prisma.Decimal("1200"), supplier: "Drip Irrigation ET",    lastRestockedDate: "2026-02-01" },
    { id: "si-015", name: "Festival Strawberry Runners",      category: "seed" as const,       unit: "piece" as const, currentQty: new Prisma.Decimal("250"),    reorderLevel: new Prisma.Decimal("100"), maxCapacity: new Prisma.Decimal("2000"),costPerUnit: new Prisma.Decimal("12"),   supplier: "Nakuru Horticulture KE",lastRestockedDate: "2026-04-05", notes: "For planned beds C-BED-03 & C-BED-04" },
  ];

  for (const si of stockItems) {
    await prisma.stockItem.upsert({ where: { id: si.id }, update: si, create: si });
  }
  console.log("  ✓ Stock items");

  // ── 18. Stock transactions ────────────────────────────────────────────────────
  const stockTransactions = [
    { id: "st-001", itemId: "si-001", type: "stock_in" as const,  quantity: new Prisma.Decimal("25"),   date: "2026-05-01", referenceType: "manual",      performedBy: "f-008", notes: "Monthly restock" },
    { id: "st-002", itemId: "si-002", type: "stock_in" as const,  quantity: new Prisma.Decimal("15"),   date: "2026-05-01", referenceType: "manual",      performedBy: "f-008", notes: "Monthly restock" },
    { id: "st-003", itemId: "si-003", type: "stock_in" as const,  quantity: new Prisma.Decimal("12"),   date: "2026-04-25", referenceType: "manual",      performedBy: "f-008" },
    { id: "st-004", itemId: "si-010", type: "stock_in" as const,  quantity: new Prisma.Decimal("500"),  date: "2026-05-10", referenceType: "manual",      performedBy: "f-008", notes: "Restocked from Addis Packaging" },
    { id: "st-005", itemId: "si-011", type: "stock_in" as const,  quantity: new Prisma.Decimal("30"),   date: "2026-05-10", referenceType: "manual",      performedBy: "f-008" },
    { id: "st-006", itemId: "si-001", type: "stock_out" as const, quantity: new Prisma.Decimal("1.0"),  date: "2026-05-15", referenceType: "fertigation", referenceId: "ft-001", performedBy: "f-001", notes: "NPK to Valve A — 400L × 2.5g/L" },
    { id: "st-007", itemId: "si-002", type: "stock_out" as const, quantity: new Prisma.Decimal("0.53"), date: "2026-05-14", referenceType: "fertigation", referenceId: "ft-002", performedBy: "f-002", notes: "Ca(NO₃)₂ to Valve B — 350L × 1.5g/L" },
    { id: "st-008", itemId: "si-003", type: "stock_out" as const, quantity: new Prisma.Decimal("0.6"),  date: "2026-05-13", referenceType: "fertigation", referenceId: "ft-003", performedBy: "f-005", notes: "K₂SO₄ to Valve C — 300L × 2.0g/L" },
    { id: "st-009", itemId: "si-001", type: "stock_out" as const, quantity: new Prisma.Decimal("0.75"), date: "2026-05-12", referenceType: "fertigation", referenceId: "ft-006", performedBy: "f-005", notes: "NPK to Valve C — 300L × 2.5g/L" },
    { id: "st-010", itemId: "si-006", type: "stock_out" as const, quantity: new Prisma.Decimal("0.6"),  date: "2026-05-10", referenceType: "fertigation", referenceId: "ft-007", performedBy: "f-001", notes: "MgSO₄ foliar — Valve A 400L × 1.5g/L" },
    { id: "st-011", itemId: "si-010", type: "stock_out" as const, quantity: new Prisma.Decimal("164"),  date: "2026-05-17", referenceType: "packaging",   referenceId: "pk-001", performedBy: "f-004", notes: "500g punnets used across PKG batches" },
    { id: "st-012", itemId: "si-011", type: "stock_out" as const, quantity: new Prisma.Decimal("8"),    date: "2026-05-16", referenceType: "packaging",   referenceId: "pk-002", performedBy: "f-004", notes: "Export cartons for hotel & export batches" },
  ];

  for (const st of stockTransactions) {
    await prisma.stockTransaction.upsert({ where: { id: st.id }, update: st, create: st });
  }
  console.log("  ✓ Stock transactions");

  // ── 19. Follow-ups ────────────────────────────────────────────────────────────
  const followUps = [
    { id: "fu-001", entityType: "disease" as const,    entityId: "dis-001", title: "Re-inspect B-BED-02 — check powdery mildew treatment",  description: "Kumulus DF was applied 7 days ago. Check if leaves are clear, measure humidity.", dueDate: "2026-05-22", status: "pending" as const,  priority: "urgent" as const, assignedTo: "f-006", createdBy: "f-008", bedId: "B-BED-02", valveId: "valve-b" },
    { id: "fu-002", entityType: "disease" as const,    entityId: "dis-002", title: "Confirm root rot treatment on A-BED-04",                 description: "Trichoderma applied 5 days ago. Check soil moisture and root color. Remove any dead plants.", dueDate: "2026-05-17", status: "overdue" as const,  priority: "urgent" as const, assignedTo: "f-003", createdBy: "f-008", bedId: "A-BED-04", valveId: "valve-a" },
    { id: "fu-003", entityType: "disease" as const,    entityId: "dis-003", title: "Gray mold 2nd spray — C-BED-01",                         description: "First Switch 62.5 WG spray done. Apply 2nd spray and check humidity below 85%.", dueDate: "2026-05-21", status: "pending" as const,  priority: "urgent" as const, assignedTo: "f-007", createdBy: "f-008", bedId: "C-BED-01", valveId: "valve-c" },
    { id: "fu-004", entityType: "planting" as const,   entityId: "pl-003",  title: "Stage check — A-BED-03 Festival (103 days)",             description: "Plant is at vegetative stage. Inspect for runner formation, canopy density, any early disease signs.", dueDate: "2026-05-21", status: "pending" as const, priority: "normal" as const, assignedTo: "f-006", createdBy: "f-008", bedId: "A-BED-03", valveId: "valve-a" },
    { id: "fu-005", entityType: "planting" as const,   entityId: "pl-011",  title: "Prepare C-BED-03 for Seascape planting",                 description: "Planned planting is overdue. Inspect bed, confirm runner availability, prep plastic mulch.", dueDate: "2026-05-15", status: "overdue" as const,  priority: "urgent" as const, assignedTo: "f-007", createdBy: "f-008", bedId: "C-BED-03", valveId: "valve-c" },
    { id: "fu-006", entityType: "planting" as const,   entityId: "pl-007",  title: "Root establishment check — B-BED-03 Seascape (84 days)", description: "Verify root development and vegetative growth progress.", dueDate: "2026-05-20", status: "pending" as const, priority: "normal" as const, assignedTo: "f-007", createdBy: "f-008", bedId: "B-BED-03", valveId: "valve-b" },
    { id: "fu-007", entityType: "fertigation" as const,entityId: "ft-001",  title: "NPK 20-20-20 weekly feed — Valve A",                     description: "Next scheduled application due. Check stock (si-001) before applying. 400L × 2.5g/L.", dueDate: "2026-05-22", status: "pending" as const, priority: "normal" as const, assignedTo: "f-001", createdBy: "f-008", valveId: "valve-a" },
    { id: "fu-008", entityType: "fertigation" as const,entityId: "ft-002",  title: "Calcium Nitrate dose — Valve B fruit firmness",           description: "Fruit firmness programme. Next dose due. 350L × 1.5g/L via drip.", dueDate: "2026-05-21", status: "pending" as const, priority: "normal" as const, assignedTo: "f-002", createdBy: "f-008", valveId: "valve-b" },
    { id: "fu-009", entityType: "fertigation" as const,entityId: "ft-003",  title: "Potassium Sulfate — Valve C pre-harvest",                 description: "Sweetness enhancement before harvest. Check stock (si-003) — 300L × 2.0g/L.", dueDate: "2026-05-20", status: "pending" as const, priority: "normal" as const, assignedTo: "f-005", createdBy: "f-008", valveId: "valve-c" },
    { id: "fu-010", entityType: "general" as const,    entityId: "si-008",  title: "⚠ URGENT: Restock Switch 62.5 WG (botryticide)",        description: "Only 0.28 kg left — below reorder level of 0.5 kg. Gray mold is active. Contact Syngenta Ethiopia immediately.", dueDate: "2026-05-18", status: "overdue" as const, priority: "urgent" as const, assignedTo: "f-008", createdBy: "f-008" },
    { id: "fu-011", entityType: "general" as const,    entityId: "si-011",  title: "Reorder 1kg Export Cartons",                              description: "Only 22 pieces left (reorder at 20). Dubai export order needs 100 kg of product. Place order with Addis Packaging.", dueDate: "2026-05-20", status: "pending" as const, priority: "urgent" as const, assignedTo: "f-008", createdBy: "f-008" },
    { id: "fu-012", entityType: "disease" as const,    entityId: "dis-004", title: "Leaf spot first treatment — A-BED-06",                   description: "Kocide 3000 applied", dueDate: "2026-05-14", status: "done" as const, priority: "normal" as const, assignedTo: "f-001", createdBy: "f-006", bedId: "A-BED-06", valveId: "valve-a", completedAt: "2026-05-14", completionNote: "Sprayed fully. Switched to drip only, no more overhead watering on this bed." },
    { id: "fu-013", entityType: "planting" as const,   entityId: "pl-001",  title: "Final harvest check — A-BED-01 Festival",                 description: "Confirm all plants cleared post-harvest and prepare for next planting cycle.", dueDate: "2026-05-10", status: "done" as const, priority: "low" as const, assignedTo: "f-001", createdBy: "f-008", bedId: "A-BED-01", valveId: "valve-a", completedAt: "2026-05-11", completionNote: "Bed cleared. Old mulch removed. Ready for replanting." },
  ];

  for (const fu of followUps) {
    await prisma.followUp.upsert({ where: { id: fu.id }, update: fu, create: fu });
  }
  console.log("  ✓ Follow-ups");

  // ── 20. App Settings (notification tokens) ───────────────────────────────────
  const defaultSettings = [
    { key: "sms_token",        value: process.env.SMS_ETHIOPIA_TOKEN    ?? "" },
    { key: "sms_base_url",     value: process.env.SMS_ETHIOPIA_BASE_URL ?? "https://api.smsethiopia.com/api/sms/send" },
    { key: "sms_enabled",      value: "true" },
    { key: "telegram_token",   value: process.env.TELEGRAM_BOT_TOKEN    ?? "" },
    { key: "telegram_chat_id", value: process.env.TELEGRAM_CHAT_ID      ?? "" },
    { key: "telegram_enabled", value: "true" },
    { key: "weather_api_key",  value: process.env.TOMORROW_IO_API_KEY   ?? "" },
  ];
  for (const s of defaultSettings) {
    await prisma.appSetting.upsert({
      where:  { key: s.key },
      update: {},          // don't overwrite values already configured via UI
      create: s,
    });
  }
  console.log("  ✓ App settings");

  console.log("\n✅ Seed complete!");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
