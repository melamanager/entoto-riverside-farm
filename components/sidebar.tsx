"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Map, Sprout, Users, Bug, Wheat,
  FileBarChart, QrCode, ShieldCheck, CalendarCheck, ListChecks,
  ChevronRight, Leaf, LogIn, Package, ShoppingCart,
  TrendingUp, DollarSign, Beaker, ClipboardList,
  BarChart3, CalendarDays, Zap, Bell, Warehouse, Languages,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { useLang } from "@/lib/lang";
import { EN, AM } from "@/lib/translations";
import { AccountSwitcher } from "@/components/account-switcher";
import { ValveIcon } from "@/components/valve-icon";

type NavItem = {
  href: string;
  labelKey: keyof typeof EN.item;
  icon?: React.ComponentType<{ className?: string }>;
  isValve?: boolean;
  roles: string[];
};

type NavGroup = {
  groupKey: keyof typeof EN.nav;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    groupKey: "overview",
    items: [
      { href: "/",           labelKey: "dashboard",        icon: LayoutDashboard, roles: ["manager"] },
      { href: "/supervisor", labelKey: "myDashboard",      icon: ShieldCheck,     roles: ["supervisor"] },
      { href: "/map",        labelKey: "farmMap",           icon: Map,             roles: ["manager", "supervisor"] },
    ],
  },
  {
    groupKey: "cropMgmt",
    items: [
      { href: "/planting", labelKey: "plantingSchedule", icon: CalendarDays, roles: ["manager", "supervisor"] },
      { href: "/beds",     labelKey: "raisedBeds",        icon: Sprout,       roles: ["manager", "supervisor"] },
    ],
  },
  {
    groupKey: "operations",
    items: [
      { href: "/valves",      labelKey: "irrigationZones",  isValve: true,    roles: ["manager"] },
      { href: "/fertigation", labelKey: "nutrientFeeding",  icon: Beaker,     roles: ["manager", "supervisor"] },
      { href: "/diseases",    labelKey: "diseaseMgmt",      icon: Bug,        roles: ["manager", "supervisor"] },
      { href: "/tasks",       labelKey: "dailyTasks",       icon: ListChecks, roles: ["manager", "supervisor"] },
      { href: "/stock",       labelKey: "inputStore",       icon: Warehouse,  roles: ["manager", "supervisor"] },
      { href: "/follow-ups",  labelKey: "followUps",        icon: Bell,       roles: ["manager", "supervisor"] },
    ],
  },
  {
    groupKey: "harvestSales",
    items: [
      { href: "/harvest",    labelKey: "harvestLog",      icon: Wheat,        roles: ["manager", "supervisor"] },
      { href: "/packaging",  labelKey: "packaging",        icon: Package,      roles: ["manager", "supervisor"] },
      { href: "/orders",     labelKey: "customerOrders",   icon: ShoppingCart, roles: ["manager"] },
      { href: "/revenue",    labelKey: "revenue",          icon: TrendingUp,   roles: ["manager"] },
      { href: "/expenses",   labelKey: "expenses",         icon: DollarSign,   roles: ["manager"] },
    ],
  },
  {
    groupKey: "workforce",
    items: [
      { href: "/employees",    labelKey: "employees",    icon: Users,         roles: ["manager"] },
      { href: "/assignments",  labelKey: "assignments",  icon: ClipboardList, roles: ["manager", "supervisor"] },
      { href: "/attendance",   labelKey: "attendance",   icon: CalendarCheck, roles: ["manager", "supervisor"] },
      { href: "/payroll",      labelKey: "payroll",      icon: DollarSign,    roles: ["manager"] },
      { href: "/productivity", labelKey: "productivity", icon: BarChart3,     roles: ["manager"] },
    ],
  },
  {
    groupKey: "reports",
    items: [
      { href: "/reports", labelKey: "analytics", icon: FileBarChart, roles: ["manager"] },
      { href: "/scan",    labelKey: "qrCodes",   icon: QrCode,       roles: ["manager", "supervisor"] },
    ],
  },
  {
    groupKey: "intelligence",
    items: [
      { href: "/ai", labelKey: "aiAlerts", icon: Zap, roles: ["manager", "supervisor"] },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { toggle, isAm } = useLang();
  const t = isAm ? AM : EN;
  const role = user?.role ?? "manager";

  if (pathname === "/login") return null;

  return (
    <aside className="hidden md:flex w-[220px] shrink-0 flex-col h-screen sticky top-0 bg-[#0d1117] text-white border-r border-white/5">
      {/* Logo */}
      <div className="px-4 pt-5 pb-4 border-b border-white/5">
        <Link href={role === "supervisor" ? "/supervisor" : "/"} className="flex items-center gap-3">
          <div className="size-8 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 grid place-items-center shadow-lg shadow-emerald-900/50">
            <Leaf className="size-4 text-white" />
          </div>
          <div>
            <div className="text-[13px] font-bold tracking-tight text-white">ENTOTO</div>
            <div className="text-[9px] text-slate-400 tracking-wide uppercase">Farm ERP · v2.0</div>
          </div>
        </Link>
      </div>

      {/* Role badge */}
      {user && (
        <div className="mx-3 mt-3 px-2 py-1.5 rounded-md bg-white/4 border border-white/6 flex items-center gap-1.5">
          <span className={`size-1.5 rounded-full ${role === "manager" ? "bg-amber-400" : role === "supervisor" ? "bg-blue-400" : "bg-emerald-400"}`} />
          <span className="text-[11px] text-slate-400 capitalize">
            {role === "manager" ? t.common.managerAccess : t.common.supervisorAccess}
          </span>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 overflow-y-auto space-y-4">
        {NAV_GROUPS.map((group) => {
          const visibleItems = group.items.filter(i => i.roles.includes(role));
          if (visibleItems.length === 0) return null;
          return (
            <div key={group.groupKey}>
              <div className="px-3 mb-1 text-[9px] font-bold uppercase tracking-widest text-slate-600">
                {t.nav[group.groupKey]}
              </div>
              <div className="space-y-0.5">
                {visibleItems.map((item) => {
                  const label = t.item[item.labelKey];
                  const active = item.href === "/" ? pathname === "/"
                    : item.href === "/supervisor" && role === "supervisor" ? pathname === "/supervisor" || pathname === "/"
                    : pathname.startsWith(item.href);
                  return (
                    <Link
                      key={`${item.href}-${item.labelKey}`}
                      href={item.href}
                      className={cn(
                        "group flex items-center gap-2.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-all",
                        active
                          ? "bg-emerald-600/20 text-emerald-400 border border-emerald-600/25"
                          : "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent"
                      )}
                    >
                      {item.isValve
                        ? <ValveIcon size={14} className="shrink-0" />
                        : item.icon
                        ? <item.icon className={cn("size-3.5 shrink-0", active ? "text-emerald-400" : "text-slate-500 group-hover:text-slate-300")} />
                        : null
                      }
                      <span className="truncate">{label}</span>
                      {active && <ChevronRight className="size-3 ml-auto text-emerald-500" />}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Footer: account + language */}
      <div className="px-2 pb-3 pt-2 border-t border-white/5 space-y-2">
        {user ? (
          <AccountSwitcher />
        ) : (
          <Link href="/login" className="flex items-center gap-2 px-3 py-2 rounded-md text-slate-400 hover:text-white hover:bg-white/5 text-sm">
            <LogIn className="size-4" /> {isAm ? "ግባ" : "Sign in"}
          </Link>
        )}
        <div className="flex items-center justify-between px-2 text-[10px] text-slate-600">
          <span className="flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            {t.common.liveErp}
          </span>
          <span>{t.common.addisAbaba}</span>
        </div>

        {/* Language toggle */}
        <button
          onClick={toggle}
          className="w-full flex items-center justify-between px-3 py-1.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/8 transition-colors"
        >
          <span className="flex items-center gap-2 text-[11px] text-slate-400">
            <Languages className="size-3 text-slate-500" />
            {isAm ? "ቋንቋ" : "Language"}
          </span>
          <div className="flex items-center gap-0.5 text-[10px]">
            <span className={cn("px-1.5 py-0.5 rounded font-bold transition-colors", !isAm ? "bg-emerald-600 text-white" : "text-slate-600")}>EN</span>
            <span className={cn("px-1.5 py-0.5 rounded font-bold transition-colors", isAm ? "bg-emerald-600 text-white" : "text-slate-600")}>አማ</span>
          </div>
        </button>
      </div>
    </aside>
  );
}
