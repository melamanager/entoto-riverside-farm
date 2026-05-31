"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Map, Bug, ListChecks, QrCode, ShieldCheck,
  MoreHorizontal, X, Sprout, Users, Wheat,
  FileBarChart, CalendarCheck, LogOut, Check, ChevronRight,
  Shield, UserCircle2, Package, ShoppingCart,
  DollarSign, Beaker, BarChart3,
  CalendarDays, Zap, Languages, Warehouse, Settings,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useLang } from "@/lib/lang";
import { EN, AM } from "@/lib/translations";
import type { Farmer } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ValveIcon } from "@/components/valve-icon";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

/* ── All nav items (mirrors sidebar) ────────────────────────────────── */
const NAV_GROUPS = [
  {
    label: "Overview",
    items: [
      { href: "/",           label: "Dashboard",    icon: LayoutDashboard, roles: ["manager"] },
      { href: "/supervisor", label: "My Dashboard", icon: ShieldCheck,     roles: ["supervisor"] },
      { href: "/map",        label: "Farm Map",      icon: Map,             roles: ["manager", "supervisor"] },
    ],
  },
  {
    label: "Crop Management",
    items: [
      { href: "/planting", label: "Planting Schedule", icon: CalendarDays, roles: ["manager", "supervisor"] },
      { href: "/beds",     label: "Raised Beds",        icon: Sprout,       roles: ["manager", "supervisor"] },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/valves",      label: "Valves",       icon: null,       roles: ["manager"],              isValve: true },
      { href: "/fertigation", label: "Fertigation",  icon: Beaker,     roles: ["manager", "supervisor"] },
      { href: "/diseases", label: "Disease Mgmt", icon: Bug,        roles: ["manager", "supervisor"] },
      { href: "/tasks",    label: "Daily Tasks",  icon: ListChecks, roles: ["manager", "supervisor"] },
      { href: "/stock",    label: "Input Store",  icon: Warehouse,  roles: ["manager", "supervisor"] },
    ],
  },
  {
    label: "Harvest & Sales",
    items: [
      { href: "/harvest",   label: "Harvest Log",     icon: Wheat,         roles: ["manager", "supervisor"] },
      { href: "/packaging", label: "Packaging",        icon: Package,       roles: ["manager", "supervisor"] },
      { href: "/orders",   label: "Customer Orders", icon: ShoppingCart, roles: ["manager"] },
      { href: "/expenses", label: "Expenses",         icon: DollarSign,   roles: ["manager"] },
    ],
  },
  {
    label: "Workforce",
    items: [
      { href: "/employees",  label: "Employees",  icon: Users,         roles: ["manager"] },
      { href: "/attendance", label: "Attendance", icon: CalendarCheck, roles: ["manager", "supervisor"] },
      { href: "/payroll",     label: "Payroll",     icon: DollarSign,    roles: ["manager"] },
      { href: "/productivity",label: "Productivity",icon: BarChart3,     roles: ["manager"] },
    ],
  },
  {
    label: "Reports",
    items: [
      { href: "/reports", label: "Analytics", icon: FileBarChart, roles: ["manager"] },
      { href: "/scan",    label: "QR Codes",  icon: QrCode,       roles: ["manager", "supervisor"] },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { href: "/ai",       label: "AI Alerts & Forecast", icon: Zap,      roles: ["manager", "supervisor"] },
      { href: "/settings", label: "Settings",              icon: Settings, roles: ["manager"] },
    ],
  },
];

const ROLE_COLORS = {
  manager:    { bg: "bg-amber-500",   badge: "bg-amber-100 text-amber-800 border-amber-300"   },
  supervisor: { bg: "bg-blue-500",    badge: "bg-blue-100 text-blue-800 border-blue-300"      },
  farmer:     { bg: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-800 border-emerald-300" },
};

const PRIMARY_TAB_KEYS = ["home", "map", "diseases", "tasks"] as const;
const PRIMARY_TABS = [
  { href: "/",           tabKey: "home",     managerIcon: LayoutDashboard, supervisorHref: "/supervisor", supervisorIcon: ShieldCheck },
  { href: "/map",        tabKey: "map",      icon: Map         },
  { href: "/diseases",   tabKey: "diseases", icon: Bug         },
  { href: "/tasks",      tabKey: "tasks",    icon: ListChecks  },
] as const;

export function MobileNav() {
  const pathname = usePathname();
  const router   = useRouter();
  const { user, login, logout, isManager, isSupervisor } = useAuth();
  const { toggle, isAm } = useLang();
  const t = isAm ? AM : EN;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [farmers, setFarmers] = useState<Farmer[]>([]);

  useEffect(() => {
    fetch("/api/farmers").then(r => r.json()).then(setFarmers);
  }, []);

  if (pathname === "/login") return null;

  const role = user?.role ?? "manager";

  function handleSwitch(id: string) {
    login(id);
    setDrawerOpen(false);
    router.refresh();
    const target = farmers.find(f => f.id === id);
    router.push(target?.role === "supervisor" ? "/supervisor" : "/");
  }

  function handleSignOut() {
    logout();
    setDrawerOpen(false);
    router.push("/login");
  }

  return (
    <>
      {/* ── Bottom tab bar ─────────────────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-card/95 backdrop-blur-sm border-t border-border">
        <div className="flex items-stretch h-16">
          {PRIMARY_TABS.map(tab => {
            const href = isSupervisor && "supervisorHref" in tab ? tab.supervisorHref : tab.href;
            const Icon = isSupervisor && "supervisorIcon" in tab ? tab.supervisorIcon
              : "icon" in tab ? tab.icon
              : "managerIcon" in tab ? tab.managerIcon
              : LayoutDashboard;
            const active =
              href === "/" ? pathname === "/" :
              href === "/supervisor" ? (pathname === "/supervisor" || pathname === "/") :
              pathname.startsWith(href);
            return (
              <Link
                key={tab.tabKey}
                href={href}
                className={cn(
                  "flex-1 flex flex-col items-center justify-center gap-0.5 relative transition-colors",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                {active && <span className="absolute top-0 inset-x-3 h-0.5 bg-primary rounded-b-full" />}
                <Icon className="size-5" />
                <span className="text-[10px] font-semibold">{t.tabs[tab.tabKey]}</span>
              </Link>
            );
          })}

          {/* More button */}
          <button
            onClick={() => setDrawerOpen(true)}
            className={cn(
              "flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors",
              drawerOpen ? "text-primary" : "text-muted-foreground"
            )}
          >
            <MoreHorizontal className="size-5" />
            <span className="text-[10px] font-semibold">{t.tabs.more}</span>
          </button>
        </div>
      </nav>

      {/* ── More drawer ────────────────────────────────────────────── */}
      {drawerOpen && (
        <>
          {/* Backdrop */}
          <div
            className="md:hidden fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />

          {/* Slide-up panel */}
          <div className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-card rounded-t-3xl shadow-2xl max-h-[88vh] flex flex-col">

            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-muted" />
            </div>

            {/* User card + close */}
            <div className="flex items-center gap-3 px-5 pt-2 pb-4 border-b border-border shrink-0">
              {user && (
                <>
                  <div className={`size-10 rounded-full ${ROLE_COLORS[role].bg} grid place-items-center shrink-0`}>
                    <span className="text-white font-bold text-sm">{user.avatar}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-foreground truncate">{user.name}</div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border capitalize ${ROLE_COLORS[role].badge}`}>
                      {user.role}
                    </span>
                  </div>
                </>
              )}
              <button
                onClick={() => setDrawerOpen(false)}
                className="size-8 rounded-full bg-muted grid place-items-center shrink-0 hover:bg-accent transition-colors"
              >
                <X className="size-4 text-muted-foreground" />
              </button>
            </div>

            {/* Nav + Account switcher — scrollable */}
            <div className="flex-1 overflow-y-auto overscroll-contain">

              {/* Nav groups */}
              <div className="px-3 pt-3 pb-2 space-y-4">
                {NAV_GROUPS.map(group => {
                  const visible = group.items.filter(i =>
                    i.roles.includes(role) &&
                    // de-duplicate: supervisor item in Overview is different from People
                    !(i.href === "/supervisor" && i.label === "Supervisor View" && isSupervisor)
                  );
                  if (visible.length === 0) return null;
                  return (
                    <div key={group.label}>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-2 mb-1.5">
                        {group.label}
                      </div>
                      <div className="space-y-0.5">
                        {visible.map(item => {
                          const active = item.href === "/" ? pathname === "/"
                            : item.href === "/supervisor" && isSupervisor ? pathname === "/supervisor" || pathname === "/"
                            : pathname.startsWith(item.href);
                          return (
                            <Link
                              key={`${item.href}-${item.label}`}
                              href={item.href}
                              onClick={() => setDrawerOpen(false)}
                              className={cn(
                                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                                active
                                  ? "bg-primary/12 text-primary border border-primary/25"
                                  : "text-foreground/80 hover:bg-accent border border-transparent"
                              )}
                            >
                              {"isValve" in item && item.isValve
                                ? <ValveIcon size={16} />
                                : item.icon
                                ? <item.icon className={cn("size-4 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
                                : null
                              }
                              <span className="flex-1">{item.label}</span>
                              {active && <ChevronRight className="size-3.5 text-primary" />}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Account switcher */}
              <div className="mx-3 mt-2 mb-3 rounded-2xl border border-border overflow-hidden">
                <div className="px-4 py-2.5 bg-muted border-b border-border">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t.tabs.switchAccount}</div>
                </div>
                {farmers.filter(f => f.role !== "farmer").map(f => {
                  const isActive = user?.id === f.id;
                  const Icon = f.role === "manager" ? Shield : UserCircle2;
                  return (
                    <button
                      key={f.id}
                      onClick={() => handleSwitch(f.id)}
                      className={cn(
                        "flex items-center gap-3 w-full px-4 py-3 transition-colors border-b border-border/50 last:border-0",
                        isActive ? "bg-primary/10" : "hover:bg-accent"
                      )}
                    >
                      <Avatar className="size-9 shrink-0">
                        <AvatarFallback className={cn(
                          "text-xs font-bold",
                          isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                        )}>
                          {f.avatar}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 text-left min-w-0">
                        <div className="text-sm font-semibold text-foreground truncate">{f.name}</div>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-1 capitalize">
                          <Icon className="size-3" />
                          {f.role}
                          {f.role === "supervisor" && (
                            <span className="text-muted-foreground ml-1">
                              · {f.assignedValves.map(v => v.split("-")[1].toUpperCase()).join(", ")}
                            </span>
                          )}
                        </div>
                      </div>
                      {isActive && <Check className="size-4 text-primary shrink-0" />}
                    </button>
                  );
                })}
              </div>

              {/* Language toggle */}
              <div className="px-3 pb-2">
                <button
                  onClick={toggle}
                  className="flex items-center justify-between w-full px-4 py-3 rounded-xl bg-muted border border-border text-sm font-semibold text-foreground/80 hover:bg-accent transition-colors"
                >
                  <span className="flex items-center gap-2"><Languages className="size-4 text-muted-foreground" />{isAm ? "ቋንቋ" : "Language"}</span>
                  <div className="flex items-center gap-1 text-xs">
                    <span className={cn("px-2 py-0.5 rounded font-bold", !isAm ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>EN</span>
                    <span className={cn("px-2 py-0.5 rounded font-bold", isAm ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>አማ</span>
                  </div>
                </button>
              </div>

              {/* Sign out */}
              <div className="px-3 pb-6">
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-2.5 w-full px-4 py-3 rounded-xl text-destructive hover:bg-destructive/10 border border-destructive/20 transition-colors text-sm font-semibold"
                >
                  <LogOut className="size-4" />
                  {t.tabs.signOut}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
