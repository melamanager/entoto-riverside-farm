"use client";

import { Bell, Search, LogIn, X, AlertTriangle, Wheat, Droplets, ListChecks } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import type { Notification, Bed, Farmer, Valve } from "@/lib/types";
import { useLang } from "@/lib/lang";
import { EN, AM } from "@/lib/translations";

const NOTIF_ICONS: Record<Notification["type"], React.ReactNode> = {
  disease:    <AlertTriangle className="size-3.5 text-red-500" />,
  harvest:    <Wheat className="size-3.5 text-emerald-500" />,
  irrigation: <Droplets className="size-3.5 text-blue-500" />,
  task:       <ListChecks className="size-3.5 text-purple-500" />,
};

function timeAgo(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

type SearchResult = {
  href: string;
  label: string;
  sub: string;
  type: "bed" | "farmer" | "valve";
};

function buildIndex(beds: Bed[], farmers: Farmer[], valves: Valve[]): SearchResult[] {
  const results: SearchResult[] = [];
  beds.forEach(b => results.push({
    href: `/beds/${b.id}`,
    label: b.id,
    sub: `${b.variety} · ${b.lengthM}m`,
    type: "bed",
  }));
  farmers.forEach(f => results.push({
    href: `/employees`,
    label: f.name,
    sub: `${f.role} · ${f.phone}`,
    type: "farmer",
  }));
  valves.forEach(v => results.push({
    href: `/valves/${v.id}`,
    label: v.name,
    sub: v.irrigationSchedule,
    type: "valve",
  }));
  return results;
}

const TYPE_BADGE: Record<SearchResult["type"], string> = {
  bed:    "bg-primary/15 text-primary",
  farmer: "bg-blue-100 text-blue-700",
  valve:  "bg-amber-100 text-amber-700",
};

export function Topbar() {
  const { isAm } = useLang();
  const t = isAm ? AM : EN;
  const { user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const [notifOpen, setNotifOpen]     = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [beds, setBeds]               = useState<Bed[]>([]);
  const [farmers, setFarmers]         = useState<Farmer[]>([]);
  const [valves, setValves]           = useState<Valve[]>([]);
  const [query, setQuery]             = useState("");
  const [searchOpen, setSearchOpen]   = useState(false);
  const [focused, setFocused]         = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const notifRef  = useRef<HTMLDivElement>(null);
  const searchBoxRef = useRef<HTMLDivElement>(null);

  const unread = notifications.filter(n => !n.read).length;
  const role = user?.role ?? "manager";

  useEffect(() => {
    fetch("/api/notifications").then(r => r.json()).then(setNotifications);
    fetch("/api/beds").then(r => r.json()).then(setBeds);
    fetch("/api/farmers").then(r => r.json()).then(setFarmers);
    fetch("/api/valves").then(r => r.json()).then(setValves);
  }, []);

  // Rebuild search index when data changes
  const index = useRef<SearchResult[]>([]);
  useEffect(() => { index.current = buildIndex(beds, farmers, valves); }, [beds, farmers, valves]);

  const results = query.trim().length >= 1
    ? index.current.filter(r =>
        r.label.toLowerCase().includes(query.toLowerCase()) ||
        r.sub.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 8)
    : [];

  // Keyboard nav for search
  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setFocused(f => Math.min(f + 1, results.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setFocused(f => Math.max(f - 1, 0)); }
    if (e.key === "Enter" && results[focused]) {
      router.push(results[focused].href);
      setQuery(""); setSearchOpen(false);
    }
    if (e.key === "Escape") { setQuery(""); setSearchOpen(false); }
  }

  // Close on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) setSearchOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  // Cmd/Ctrl+K shortcut
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchRef.current?.focus();
        setSearchOpen(true);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  function markAllRead() {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    fetch("/api/notifications/mark-all-read", { method: "PATCH" }).catch(() => {});
  }

  if (pathname === "/login") return null;

  return (
    <header className="h-14 border-b border-border bg-card sticky top-0 z-30 flex items-center px-6 gap-4">

      {/* ── Search ─────────────────────────────────────────────────────── */}
      <div className="hidden md:block flex-1 max-w-sm" ref={searchBoxRef}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <input
            ref={searchRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setSearchOpen(true); setFocused(0); }}
            onFocus={() => setSearchOpen(true)}
            onKeyDown={handleKey}
            placeholder={`${t.common.search} beds, farmers, valves…`}
            className="w-full pl-9 pr-16 h-8 text-sm text-foreground bg-muted border border-border rounded-lg focus:bg-card focus:border-primary/60 focus:outline-none focus:ring-1 focus:ring-primary/25 transition-all placeholder:text-muted-foreground"
          />
          <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground bg-muted border border-border px-1.5 py-0.5 rounded font-mono hidden lg:block">
            ⌘K
          </kbd>

          {/* Results dropdown */}
          {searchOpen && results.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1.5 bg-card border border-border rounded-xl shadow-lg overflow-hidden z-50">
              {results.map((r, i) => (
                <Link
                  key={`${r.href}-${r.label}`}
                  href={r.href}
                  onClick={() => { setQuery(""); setSearchOpen(false); }}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 text-sm transition-colors",
                    i === focused ? "bg-primary/10" : "hover:bg-primary/10"
                  )}
                >
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${TYPE_BADGE[r.type]}`}>
                    {r.type}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-foreground truncate">{r.label}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{r.sub}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* No results */}
          {searchOpen && query.trim().length >= 1 && results.length === 0 && (
            <div className="absolute top-full left-0 right-0 mt-1.5 bg-card border border-border rounded-xl shadow-lg px-4 py-3 text-sm text-muted-foreground z-50">
              No results for <strong className="text-foreground">"{query}"</strong>
            </div>
          )}
        </div>
      </div>

      {/* Mobile brand + search trigger */}
      <div className="flex items-center gap-2 flex-1 md:hidden">
        <span className="text-sm font-bold text-foreground">ENTOTO Riverside</span>
        <button
          onClick={() => { setSearchOpen(true); setTimeout(() => searchRef.current?.focus(), 50); }}
          className="ml-auto p-2 rounded-md hover:bg-accent transition-colors"
          aria-label="Search"
        >
          <Search className="size-4 text-muted-foreground" />
        </button>
      </div>

      {/* Mobile search overlay */}
      {searchOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-card flex flex-col">
          <div className="flex items-center gap-3 px-4 h-14 border-b border-border">
            <Search className="size-4 text-muted-foreground shrink-0" />
            <input
              autoFocus
              value={query}
              onChange={e => { setQuery(e.target.value); setFocused(0); }}
              onKeyDown={handleKey}
              placeholder={`${t.common.search} beds, farmers, valves…`}
              className="flex-1 text-sm outline-none text-foreground placeholder:text-muted-foreground"
            />
            <button onClick={() => { setQuery(""); setSearchOpen(false); }} className="p-1">
              <X className="size-4 text-muted-foreground" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-border">
            {results.map((r, i) => (
              <Link
                key={`${r.href}-${r.label}-mob`}
                href={r.href}
                onClick={() => { setQuery(""); setSearchOpen(false); }}
                className={cn("flex items-center gap-3 px-4 py-3", i === focused && "bg-primary/10")}
              >
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${TYPE_BADGE[r.type]}`}>
                  {r.type}
                </span>
                <div className="min-w-0">
                  <div className="font-semibold text-foreground text-sm truncate">{r.label}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{r.sub}</div>
                </div>
              </Link>
            ))}
            {query.trim().length >= 1 && results.length === 0 && (
              <div className="px-4 py-6 text-sm text-muted-foreground text-center">
                No results for <strong className="text-foreground">"{query}"</strong>
              </div>
            )}
            {query.trim().length === 0 && (
              <div className="px-4 py-6 text-sm text-muted-foreground text-center">
                Type to search beds, farmers or valves
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 ml-auto">
        {/* Role pill */}
        {user && (
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary border border-border text-[11px] font-medium text-foreground/80">
            <span className={`size-1.5 rounded-full ${role === "manager" ? "bg-amber-500" : role === "supervisor" ? "bg-blue-500" : "bg-primary"}`} />
            <span className="capitalize">{role}</span>
          </div>
        )}

        {/* Date */}
        <div className="hidden lg:block text-xs text-muted-foreground px-2 border-r border-border">
          {new Date().toLocaleDateString("en", { weekday: "short", month: "short", day: "numeric" })}
        </div>

        {/* ── Notifications bell ────────────────────────────────────────── */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setNotifOpen(o => !o)}
            className="relative p-2 rounded-md hover:bg-accent transition-colors"
            aria-label="Notifications"
          >
            <Bell className="size-4 text-muted-foreground" />
            {unread > 0 && (
              <span className="absolute top-1 right-1 size-4 rounded-full bg-red-500 text-white text-[9px] font-bold grid place-items-center">
                {unread}
              </span>
            )}
          </button>

          {/* Notification panel */}
          {notifOpen && (
            <div className="absolute right-0 top-full mt-2 w-[360px] bg-card border border-border rounded-2xl shadow-xl z-50 overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground text-sm">Notifications</span>
                  {unread > 0 && (
                    <span className="size-5 rounded-full bg-red-500 text-white text-[10px] font-bold grid place-items-center">{unread}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {unread > 0 && (
                    <button
                      onClick={markAllRead}
                      className="text-[11px] text-primary hover:text-primary/80 font-semibold"
                    >
                      Mark all read
                    </button>
                  )}
                  <button
                    onClick={() => setNotifOpen(false)}
                    className="size-6 rounded-md hover:bg-accent grid place-items-center"
                  >
                    <X className="size-3.5 text-muted-foreground" />
                  </button>
                </div>
              </div>

              {/* Items */}
              <div className="max-h-[420px] overflow-y-auto divide-y divide-border/30">
                {notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                    <Bell className="size-8 mx-auto mb-2 opacity-20" />
                    <p>No notifications</p>
                  </div>
                ) : (
                  notifications.map(n => (
                    <div
                      key={n.id}
                      className={cn("px-4 py-3 flex gap-3 hover:bg-accent transition-colors", !n.read && "bg-primary/5")}
                    >
                      <div className="size-7 rounded-full bg-muted grid place-items-center shrink-0 mt-0.5">
                        {NOTIF_ICONS[n.type]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-foreground/90 leading-snug">{n.message}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-muted-foreground">{timeAgo(n.timestamp)}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                            n.channel === "telegram" ? "bg-blue-100 text-blue-700" :
                            n.channel === "sms"      ? "bg-amber-100 text-amber-700" :
                            "bg-muted text-muted-foreground"
                          }`}>
                            {n.channel}
                          </span>
                          {!n.read && <span className="size-1.5 rounded-full bg-blue-500 ml-auto shrink-0" />}
                        </div>
                        {n.link && (
                          <Link
                            href={n.link}
                            onClick={() => {
                              setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x));
                              setNotifOpen(false);
                            }}
                            className="text-[11px] text-primary hover:text-primary/80 font-semibold mt-1 inline-block"
                          >
                            View →
                          </Link>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User */}
        {user ? (
          <div className="flex items-center gap-2 pl-2 border-l border-border">
            <Avatar className="size-7">
              <AvatarFallback className={`text-[11px] font-bold ${role === "manager" ? "bg-amber-600" : role === "supervisor" ? "bg-blue-600" : "bg-emerald-700"} text-white`}>
                {user.avatar}
              </AvatarFallback>
            </Avatar>
            <div className="hidden lg:block text-left">
              <div className="text-xs font-semibold text-foreground">{user.name.split(" ")[0]}</div>
              <div className="text-[10px] text-muted-foreground capitalize">{user.role}</div>
            </div>
          </div>
        ) : (
          <Link href="/login" className="flex items-center gap-1.5 pl-2 border-l border-border text-xs font-medium text-muted-foreground hover:text-primary">
            <LogIn className="size-3.5" /> Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
