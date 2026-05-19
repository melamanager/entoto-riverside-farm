"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Map, Sprout, Users, Bug, Wheat,
  FileBarChart, QrCode, ShieldCheck, CalendarCheck, ListChecks,
  ChevronRight, Leaf, LogIn, Package, ShoppingCart,
  TrendingUp, DollarSign, UserCog, Beaker, ClipboardList,
  BarChart3, CalendarDays, Zap, Bell, Warehouse,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { AccountSwitcher } from "@/components/account-switcher";
import { ValveIcon } from "@/components/valve-icon";

type NavItem = {
  href: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  isValve?: boolean;
  roles: string[];
  title?: string;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { href: "/",           label: "Dashboard",      icon: LayoutDashboard, roles: ["manager"] },
      { href: "/supervisor", label: "My Dashboard",   icon: ShieldCheck,     roles: ["supervisor"] },
      { href: "/map",        label: "Farm Map",        icon: Map,             roles: ["manager", "supervisor"] },
    ],
  },
  {
    label: "Crop Management",
    items: [
      { href: "/planting",   label: "Planting Schedule", icon: CalendarDays,  roles: ["manager", "supervisor"] },
      { href: "/beds",       label: "Raised Beds",        icon: Sprout,        roles: ["manager", "supervisor"] },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/valves",      label: "Irrigation Zones",   isValve: true,        roles: ["manager"], title: "Valves: each valve controls water to a section of raised beds" },
      { href: "/fertigation", label: "Nutrient Feeding",   icon: Beaker,         roles: ["manager", "supervisor"], title: "Fertigation: delivering fertilizer through the drip irrigation lines" },
      { href: "/diseases",    label: "Disease Management", icon: Bug,            roles: ["manager", "supervisor"] },
      { href: "/tasks",       label: "Daily Tasks",        icon: ListChecks,     roles: ["manager", "supervisor"] },
      { href: "/stock",       label: "Input Store",        icon: Warehouse,      roles: ["manager", "supervisor"], title: "Track fertilizers, pesticides, packaging & tool inventory" },
      { href: "/follow-ups",  label: "Follow-ups",         icon: Bell,           roles: ["manager", "supervisor"], title: "Pending actions, reminders & scheduled checks across all activities" },
    ],
  },
  {
    label: "Harvest & Sales",
    items: [
      { href: "/harvest",    label: "Harvest Log",     icon: Wheat,           roles: ["manager", "supervisor"] },
      { href: "/packaging",  label: "Packaging",       icon: Package,         roles: ["manager", "supervisor"] },
      { href: "/orders",     label: "Customer Orders", icon: ShoppingCart,    roles: ["manager"] },
      { href: "/revenue",    label: "Revenue",         icon: TrendingUp,      roles: ["manager"] },
    ],
  },
  {
    label: "Workforce",
    items: [
      { href: "/employees",    label: "Employees",       icon: Users,           roles: ["manager"] },
      { href: "/assignments",  label: "Assignments",     icon: ClipboardList,   roles: ["manager", "supervisor"] },
      { href: "/attendance",   label: "Attendance",      icon: CalendarCheck,   roles: ["manager", "supervisor"] },
      { href: "/payroll",      label: "Payroll",         icon: DollarSign,      roles: ["manager"] },
      { href: "/productivity", label: "Productivity",    icon: BarChart3,       roles: ["manager"] },
    ],
  },
  {
    label: "Reports",
    items: [
      { href: "/reports",    label: "Analytics",       icon: FileBarChart,    roles: ["manager"] },
      { href: "/scan",       label: "QR Codes",        icon: QrCode,          roles: ["manager", "supervisor"] },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { href: "/ai",         label: "AI Alerts & Forecast", icon: Zap,      roles: ["manager", "supervisor"] },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
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
          <span className="text-[11px] text-slate-400 capitalize">{role} access</span>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 overflow-y-auto space-y-4">
        {NAV_GROUPS.map((group) => {
          const visibleItems = group.items.filter(i => i.roles.includes(role));
          if (visibleItems.length === 0) return null;
          return (
            <div key={group.label}>
              <div className="px-3 mb-1 text-[9px] font-bold uppercase tracking-widest text-slate-600">
                {group.label}
              </div>
              <div className="space-y-0.5">
                {visibleItems.map((item) => {
                  const active = item.href === "/" ? pathname === "/"
                    : item.href === "/supervisor" && role === "supervisor" ? pathname === "/supervisor" || pathname === "/"
                    : pathname.startsWith(item.href);
                  return (
                    <Link
                      key={`${item.href}-${item.label}`}
                      href={item.href}
                      title={item.title}
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
                      <span className="truncate">{item.label}</span>
                      {active && <ChevronRight className="size-3 ml-auto text-emerald-500" />}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Account switcher */}
      <div className="px-2 pb-3 pt-2 border-t border-white/5 space-y-2">
        {user ? (
          <AccountSwitcher />
        ) : (
          <Link href="/login" className="flex items-center gap-2 px-3 py-2 rounded-md text-slate-400 hover:text-white hover:bg-white/5 text-sm">
            <LogIn className="size-4" /> Sign in
          </Link>
        )}
        <div className="flex items-center justify-between px-2 text-[10px] text-slate-600">
          <span className="flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live · ERP v2.0
          </span>
          <span>🇪🇹 Addis Ababa</span>
        </div>
      </div>
    </aside>
  );
}
