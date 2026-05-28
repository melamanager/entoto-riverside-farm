import {
  ACTIVITY_ICONS,
  ACTIVITY_LABELS,
  CUSTOMER_TYPE_LABELS,
  FOLLOW_UP_ENTITY_ICONS,
  FOLLOW_UP_ENTITY_LABELS,
  STOCK_CATEGORY_ICONS,
  STOCK_CATEGORY_LABELS,
} from "@/lib/erp-types";
import {
  DISEASE_LABELS,
  EXPENSE_CATEGORY_LABELS,
  GROWTH_STAGE_LABELS,
} from "@/lib/types";

export type SelectOption = {
  value: string;
  label: string;
  icon?: string;
  color?: string;
  meta?: Record<string, string | number | boolean | null>;
};

export const OPTION_DEFAULTS = {
  varieties: [
    { value: "California Albion", label: "California Albion", meta: { origin: "USA - California" } },
    { value: "Australian San Andreas", label: "Australian San Andreas", meta: { origin: "Australia - Victoria" } },
    { value: "Camarosa", label: "Camarosa", meta: { origin: "USA - California" } },
    { value: "Festival", label: "Festival", meta: { origin: "USA - Florida" } },
    { value: "Monterey", label: "Monterey", meta: { origin: "USA - California" } },
  ],
  growthStages: Object.entries(GROWTH_STAGE_LABELS).map(([value, label]) => ({ value, label })),
  healthStatuses: [
    { value: "healthy", label: "Healthy" },
    { value: "warning", label: "Warning" },
    { value: "infected", label: "Infected" },
  ],
  valveColors: [
    "#10b981", "#3b82f6", "#a855f7", "#f59e0b",
    "#ef4444", "#ec4899", "#14b8a6", "#f97316",
  ].map(color => ({ value: color, label: color, color })),
  farmerRoles: [
    { value: "farmer", label: "Field Worker" },
    { value: "supervisor", label: "Supervisor" },
    { value: "manager", label: "Manager" },
  ],
  expenseCategories: Object.entries(EXPENSE_CATEGORY_LABELS).map(([value, label]) => ({ value, label })),
  seedSources: [
    "Nakuru Horticulture KE",
    "Ethiopian Horticulture",
    "Holland Horticulture",
    "Local Nursery",
  ].map(value => ({ value, label: value })),
  plantingStatuses: ["planned", "planted", "growing", "harvested", "failed"].map(value => ({ value, label: value })),
  fertilizers: [
    { value: "Calcium Nitrate", label: "Calcium Nitrate", meta: { activeIngredient: "Ca(NO3)2" } },
    { value: "Potassium Nitrate", label: "Potassium Nitrate", meta: { activeIngredient: "KNO3" } },
    { value: "Mono Potassium Phosphate", label: "Mono Potassium Phosphate", meta: { activeIngredient: "KH2PO4" } },
    { value: "Magnesium Sulfate", label: "Magnesium Sulfate", meta: { activeIngredient: "MgSO4" } },
    { value: "NPK 19-19-19", label: "NPK 19-19-19", meta: { activeIngredient: "NPK" } },
  ],
  applicationMethods: ["drip", "foliar", "soil_drench"].map(value => ({ value, label: value })),
  fertigationStatuses: ["scheduled", "applied", "skipped"].map(value => ({ value, label: value })),
  packageSizes: ["250g", "500g", "1kg", "2kg", "bulk"].map(value => ({ value, label: value })),
  packagingPurposes: ["export", "juice", "jam", "local", "hotel", "supermarket"].map(value => ({ value, label: value })),
  packagingStatuses: ["in_progress", "packed", "dispatched"].map(value => ({ value, label: value })),
  customerTypes: Object.entries(CUSTOMER_TYPE_LABELS).map(([value, label]) => ({ value, label })),
  paymentStatuses: ["pending", "partial", "paid", "overdue"].map(value => ({ value, label: value })),
  deliveryStatuses: ["pending", "in_transit", "delivered", "cancelled"].map(value => ({ value, label: value })),
  attendanceStatuses: [
    { value: "present", label: "Present", color: "bg-emerald-500" },
    { value: "late", label: "Late", color: "bg-amber-500" },
    { value: "absent", label: "Absent", color: "bg-red-500" },
    { value: "leave", label: "Leave", color: "bg-slate-400" },
  ],
  stockCategories: Object.entries(STOCK_CATEGORY_LABELS).map(([value, label]) => ({
    value,
    label,
    icon: STOCK_CATEGORY_ICONS[value as keyof typeof STOCK_CATEGORY_ICONS],
  })),
  stockUnits: ["kg", "L", "g", "ml", "piece", "box", "bag", "roll"].map(value => ({ value, label: value })),
  stockTransactionTypes: ["stock_in", "stock_out", "adjustment", "waste"].map(value => ({ value, label: value })),
  taskPriorities: ["low", "medium", "high"].map(value => ({ value, label: value })),
  taskCategories: ["disease", "harvest", "irrigation", "inspection", "general"].map(value => ({ value, label: value })),
  assignmentActivities: Object.entries(ACTIVITY_LABELS).map(([value, label]) => ({
    value,
    label,
    icon: ACTIVITY_ICONS[value as keyof typeof ACTIVITY_ICONS],
  })),
  shifts: [
    { value: "morning", label: "Morning" },
    { value: "afternoon", label: "Afternoon" },
    { value: "full_day", label: "Full Day" },
  ],
  assignmentStatuses: ["assigned", "in_progress", "completed"].map(value => ({ value, label: value })),
  followUpEntityTypes: Object.entries(FOLLOW_UP_ENTITY_LABELS).map(([value, label]) => ({
    value,
    label,
    icon: FOLLOW_UP_ENTITY_ICONS[value as keyof typeof FOLLOW_UP_ENTITY_ICONS],
  })),
  followUpPriorities: ["low", "normal", "urgent"].map(value => ({ value, label: value })),
  followUpStatuses: ["pending", "done", "overdue"].map(value => ({ value, label: value })),
  diseaseTypes: Object.entries(DISEASE_LABELS).map(([value, label]) => ({ value, label })),
  reportsTabs: ["daily", "weekly", "monthly", "packaging", "smart"].map(value => ({ value, label: value })),
  scanTabs: ["print", "scan"].map(value => ({ value, label: value })),
  settingsTestChannels: [
    { value: "sms", label: "SMS" },
    { value: "telegram", label: "Telegram" },
    { value: "get_updates", label: "Telegram Updates" },
  ],
} satisfies Record<string, SelectOption[]>;

export type OptionKey = keyof typeof OPTION_DEFAULTS;
export type OptionsMap = Record<OptionKey, SelectOption[]>;

export function normalizeOptions(raw: unknown, fallback: SelectOption[]): SelectOption[] {
  if (!Array.isArray(raw)) return fallback;
  const out = raw.flatMap((item): SelectOption[] => {
    if (typeof item === "string") return [{ value: item, label: item }];
    if (!item || typeof item !== "object") return [];
    const value = String((item as { value?: unknown }).value ?? "");
    if (!value) return [];
    return [{
      value,
      label: String((item as { label?: unknown }).label ?? value),
      icon: typeof (item as { icon?: unknown }).icon === "string" ? (item as { icon: string }).icon : undefined,
      color: typeof (item as { color?: unknown }).color === "string" ? (item as { color: string }).color : undefined,
      meta: typeof (item as { meta?: unknown }).meta === "object" && (item as { meta?: unknown }).meta !== null
        ? (item as { meta: Record<string, string | number | boolean | null> }).meta
        : undefined,
    }];
  });
  return out.length > 0 ? out : fallback;
}

