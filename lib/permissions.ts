// Per-person capabilities. Client-safe (no prisma) so pages can hide actions
// the user can't perform; the API guards are the real enforcement.
//
// Model: `role` is the ACCESS LEVEL and is not freely extendable —
//   manager    → everything
//   supervisor → the day-to-day operational set below
//   farmer     → nothing by default (a plain staff member)
// `Farmer.permissions` then GRANTS extra capabilities to an individual, so a
// manager can let e.g. a driver take attendance without making them a
// supervisor. Grants are additive; they never remove what a role allows.

export type Capability =
  | "attendance"      // record daily attendance
  | "harvest"         // log harvest
  | "watering"        // log irrigation / watering
  | "disease_report"  // file a disease report
  | "tasks_assign"    // create & assign tasks
  | "planting"        // manage planting records
  | "stock"           // record store movements
  | "orders"          // record customer orders / sales
  | "packaging"       // record packaging batches
  | "maintenance";    // log bed / farm maintenance actually done

export const CAPABILITIES: { key: Capability; label: string; hint: string }[] = [
  { key: "attendance",     label: "Take attendance",   hint: "Mark who is present each day" },
  { key: "harvest",        label: "Log harvest",       hint: "Record kg picked per bed" },
  { key: "watering",       label: "Log watering",      hint: "Record irrigation sessions" },
  { key: "disease_report", label: "Report disease",    hint: "File a disease report on a bed" },
  { key: "tasks_assign",   label: "Assign tasks",      hint: "Create and assign work to others" },
  { key: "planting",       label: "Manage planting",   hint: "Add and update planting records" },
  { key: "stock",          label: "Manage store",      hint: "Record stock in/out movements" },
  { key: "orders",         label: "Record sales",      hint: "Create customer orders" },
  { key: "packaging",      label: "Record packaging",  hint: "Log packaging batches" },
  { key: "maintenance",    label: "Log maintenance",   hint: "Record weeding, bed upkeep and repairs that were done" },
];

// What a supervisor can already do without any explicit grant (keeps existing
// behaviour intact — supervisors ran the farm day-to-day before permissions).
export const SUPERVISOR_CAPABILITIES: Capability[] = [
  "attendance", "harvest", "watering", "disease_report",
  "tasks_assign", "planting", "stock", "orders", "packaging", "maintenance",
];

export type PermissionSubject = {
  role?: string | null;
  permissions?: unknown; // Json column — string[] once parsed
};

export function grantedList(subject: PermissionSubject): Capability[] {
  const raw = subject.permissions;
  if (!Array.isArray(raw)) return [];
  const valid = new Set(CAPABILITIES.map((c) => c.key));
  return raw.filter((x): x is Capability => typeof x === "string" && valid.has(x as Capability));
}

export function can(subject: PermissionSubject, cap: Capability): boolean {
  if (subject.role === "manager") return true;
  if (subject.role === "supervisor" && SUPERVISOR_CAPABILITIES.includes(cap)) return true;
  return grantedList(subject).includes(cap);
}

// Every capability the subject effectively has (for display).
export function effectiveCapabilities(subject: PermissionSubject): Capability[] {
  return CAPABILITIES.map((c) => c.key).filter((k) => can(subject, k));
}
