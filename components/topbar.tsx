"use client";

import { Bell, Search, LogIn, X, AlertTriangle, Wheat, Droplets, ListChecks } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { NOTIFICATIONS, FARMERS, BEDS, VALVES } from "@/lib/data";
import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import type { Notification } from "@/lib/types";

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

function buildIndex(): SearchResult[] {
  const results: SearchResult[] = [];
  BEDS().forEach(b => results.push({
    href: `/beds/${b.id}`,
    label: b.id,
    sub: `${b.variety} · ${b.lengthM}m`,
    type: "bed",
  }));
  FARMERS.forEach(f => results.push({
    href: `/employees`,
    label: f.name,
    sub: `${f.role} · ${f.phone}`,
    type: "farmer",
  }));
  VALVES.forEach(v => results.push({
    href: `/valves/${v.id}`,
    label: v.name,
    sub: v.irrigationSchedule,
    type: "valve",
  }));
  return results;
}

const TYPE_BADGE: Record<SearchResult["type"], string> = {
  bed:    "bg-emerald-100 text-emerald-700",
  farmer: "bg-blue-100 text-blue-700",
  valve:  "bg-amber-100 text-amber-700",
};

export function Topbar() {
  const { user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const [notifOpen, setNotifOpen]     = useState(false);
  const [notifications, setNotifications] = useState(NOTIFICATIONS);
  const [query, setQuery]             = useState("");
  const [searchOpen, setSearchOpen]   = useState(false);
  const [focused, setFocused]         = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const notifRef  = useRef<HTMLDivElement>(null);
  const searchBoxRef = useRef<HTMLDivElement>(null);

  const unread = notifications.filter(n => !n.read).length;
  const role = user?.role ?? "manager";

  // Build search index once
  const index = useRef<SearchResult[]>([]);
  useEffect(() => { index.current = buildIndex(); }, []);

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
  }

  if (pathname === "/login") return null;

  return (
    <header className="h-14 border-b border-slate-200 bg-white sticky top-0 z-30 flex items-center px-6 gap-4">

      {/* ── Search ─────────────────────────────────────────────────────── */}
      <div className="hidden md:block flex-1 max-w-sm" ref={searchBoxRef}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-400 pointer-events-none" />
          <input
            ref={searchRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setSearchOpen(true); setFocused(0); }}
            onFocus={() => setSearchOpen(true)}
            onKeyDown={handleKey}
            placeholder="Search beds, farmers, valves…"
            className="w-full pl-9 pr-16 h-8 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400/30 transition-all placeholder:text-slate-400"
          />
          <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded font-mono hidden lg:block">
            ⌘K
          </kbd>

          {/* Results dropdown */}
          {searchOpen && results.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden z-50">
              {results.map((r, i) => (
                <Link
                  key={`${r.href}-${r.label}`}
                  href={r.href}
                  onClick={() => { setQuery(""); setSearchOpen(false); }}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 text-sm transition-colors",
                    i === focused ? "bg-emerald-50" : "hover:bg-slate-50"
                  )}
                >
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${TYPE_BADGE[r.type]}`}>
                    {r.type}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-800 truncate">{r.label}</div>
                    <div className="text-[11px] text-slate-400 truncate">{r.sub}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* No results */}
          {searchOpen && query.trim().length >= 1 && results.length === 0 && (
            <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg px-4 py-3 text-sm text-slate-400 z-50">
              No results for <strong className="text-slate-600">"{query}"</strong>
            </div>
          )}
        </div>
      </div>

      {/* Mobile brand + search trigger */}
      <div className="flex items-center gap-2 flex-1 md:hidden">
        <span className="text-sm font-bold text-slate-900">ENTOTO Riverside</span>
        <button
          onClick={() => { setSearchOpen(true); setTimeout(() => searchRef.current?.focus(), 50); }}
          className="ml-auto p-2 rounded-md hover:bg-slate-100 transition-colors"
          aria-label="Search"
        >
          <Search className="size-4 text-slate-500" />
        </button>
      </div>

      {/* Mobile search overlay */}
      {searchOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-white flex flex-col">
          <div className="flex items-center gap-3 px-4 h-14 border-b border-slate-200">
            <Search className="size-4 text-slate-400 shrink-0" />
            <input
              autoFocus
              value={query}
              onChange={e => { setQuery(e.target.value); setFocused(0); }}
              onKeyDown={handleKey}
              placeholder="Search beds, farmers, valves…"
              className="flex-1 text-sm outline-none text-slate-800 placeholder:text-slate-400"
            />
            <button onClick={() => { setQuery(""); setSearchOpen(false); }} className="p-1">
              <X className="size-4 text-slate-500" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {results.map((r, i) => (
              <Link
                key={`${r.href}-${r.label}-mob`}
                href={r.href}
                onClick={() => { setQuery(""); setSearchOpen(false); }}
                className={cn("flex items-center gap-3 px-4 py-3", i === focused && "bg-emerald-50")}
              >
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${TYPE_BADGE[r.type]}`}>
                  {r.type}
                </span>
                <div className="min-w-0">
                  <div className="font-semibold text-slate-800 text-sm truncate">{r.label}</div>
                  <div className="text-[11px] text-slate-400 truncate">{r.sub}</div>
                </div>
              </Link>
            ))}
            {query.trim().length >= 1 && results.length === 0 && (
              <div className="px-4 py-6 text-sm text-slate-400 text-center">
                No results for <strong className="text-slate-600">"{query}"</strong>
              </div>
            )}
            {query.trim().length === 0 && (
              <div className="px-4 py-6 text-sm text-slate-400 text-center">
                Type to search beds, farmers or valves
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 ml-auto">
        {/* Role pill */}
        {user && (
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-[11px] font-medium text-slate-600">
            <span className={`size-1.5 rounded-full ${role === "manager" ? "bg-amber-500" : role === "supervisor" ? "bg-blue-500" : "bg-emerald-500"}`} />
            <span className="capitalize">{role}</span>
          </div>
        )}

        {/* Date */}
        <div className="hidden lg:block text-xs text-slate-400 px-2 border-r border-slate-200">
          {new Date("2026-05-17").toLocaleDateString("en", { weekday: "short", month: "short", day: "numeric" })}
        </div>

        {/* ── Notifications bell ────────────────────────────────────────── */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setNotifOpen(o => !o)}
            className="relative p-2 rounded-md hover:bg-slate-100 transition-colors"
            aria-label="Notifications"
          >
            <Bell className="size-4 text-slate-500" />
            {unread > 0 && (
              <span className="absolute top-1 right-1 size-4 rounded-full bg-red-500 text-white text-[9px] font-bold grid place-items-center">
                {unread}
              </span>
            )}
          </button>

          {/* Notification panel */}
          {notifOpen && (
            <div className="absolute right-0 top-full mt-2 w-[360px] bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-900 text-sm">Notifications</span>
                  {unread > 0 && (
                    <span className="size-5 rounded-full bg-red-500 text-white text-[10px] font-bold grid place-items-center">{unread}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {unread > 0 && (
                    <button
                      onClick={markAllRead}
                      className="text-[11px] text-emerald-600 hover:text-emerald-700 font-semibold"
                    >
                      Mark all read
                    </button>
                  )}
                  <button
                    onClick={() => setNotifOpen(false)}
                    className="size-6 rounded-md hover:bg-slate-100 grid place-items-center"
                  >
                    <X className="size-3.5 text-slate-500" />
                  </button>
                </div>
              </div>

              {/* Items */}
              <div className="max-h-[420px] overflow-y-auto divide-y divide-slate-50">
                {notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-slate-400">
                    <Bell className="size-8 mx-auto mb-2 opacity-20" />
                    <p>No notifications</p>
                  </div>
                ) : (
                  notifications.map(n => (
                    <div
                      key={n.id}
                      className={cn("px-4 py-3 flex gap-3 hover:bg-slate-50 transition-colors", !n.read && "bg-blue-50/40")}
                    >
                      <div className="size-7 rounded-full bg-slate-100 grid place-items-center shrink-0 mt-0.5">
                        {NOTIF_ICONS[n.type]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-700 leading-snug">{n.message}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-slate-400">{timeAgo(n.timestamp)}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                            n.channel === "telegram" ? "bg-blue-100 text-blue-700" :
                            n.channel === "sms"      ? "bg-amber-100 text-amber-700" :
                            "bg-slate-100 text-slate-600"
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
                            className="text-[11px] text-emerald-600 hover:text-emerald-700 font-semibold mt-1 inline-block"
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
          <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
            <Avatar className="size-7">
              <AvatarFallback className={`text-[11px] font-bold ${role === "manager" ? "bg-amber-600" : role === "supervisor" ? "bg-blue-600" : "bg-emerald-700"} text-white`}>
                {user.avatar}
              </AvatarFallback>
            </Avatar>
            <div className="hidden lg:block text-left">
              <div className="text-xs font-semibold text-slate-800">{user.name.split(" ")[0]}</div>
              <div className="text-[10px] text-slate-400 capitalize">{user.role}</div>
            </div>
          </div>
        ) : (
          <Link href="/login" className="flex items-center gap-1.5 pl-2 border-l border-slate-200 text-xs font-medium text-slate-600 hover:text-emerald-700">
            <LogIn className="size-3.5" /> Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
