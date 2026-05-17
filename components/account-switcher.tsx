"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { FARMERS } from "@/lib/data";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  ChevronDown, LogOut, UserCircle2, Shield, Users, Check,
} from "lucide-react";

const ROLE_ICONS = {
  manager: Shield,
  supervisor: UserCircle2,
  farmer: Users,
};

const ROLE_COLORS = {
  manager: "bg-amber-100 text-amber-800 border-amber-200",
  supervisor: "bg-blue-100 text-blue-800 border-blue-200",
  farmer: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

export function AccountSwitcher() {
  const { user, login, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const switchableUsers = FARMERS.filter(f => f.role !== "farmer");

  function handleSwitch(id: string) {
    login(id);
    setOpen(false);
    router.refresh();
  }

  if (!user) return null;

  const RoleIcon = ROLE_ICONS[user.role];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(p => !p)}
        className="flex items-center gap-2 w-full px-2 py-2 rounded-lg hover:bg-white/5 transition-colors"
      >
        <Avatar className="size-7 shrink-0">
          <AvatarFallback className="bg-emerald-700 text-white text-[11px] font-bold">
            {user.avatar}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 text-left min-w-0">
          <div className="text-[12px] font-semibold text-white truncate">{user.name.split(" ")[0]}</div>
          <div className="text-[10px] text-slate-400 capitalize flex items-center gap-1">
            <RoleIcon className="size-2.5" />{user.role}
          </div>
        </div>
        <ChevronDown className={`size-3 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full left-0 right-0 mb-2 z-50 bg-[#161b22] border border-white/10 rounded-xl shadow-2xl shadow-black/50 overflow-hidden">
            <div className="px-3 py-2 border-b border-white/5">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                Switch Account
              </div>
            </div>
            <div className="py-1">
              {switchableUsers.map(f => {
                const Icon = ROLE_ICONS[f.role];
                const isActive = user.id === f.id;
                return (
                  <button
                    key={f.id}
                    onClick={() => handleSwitch(f.id)}
                    className={`flex items-center gap-3 w-full px-3 py-2.5 hover:bg-white/5 transition-colors ${isActive ? "bg-white/5" : ""}`}
                  >
                    <Avatar className="size-8 shrink-0">
                      <AvatarFallback className={`text-[11px] font-bold ${isActive ? "bg-emerald-700 text-white" : "bg-slate-700 text-slate-300"}`}>
                        {f.avatar}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 text-left min-w-0">
                      <div className="text-[12px] font-semibold text-white truncate">{f.name}</div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-1 capitalize">
                        <Icon className="size-2.5" />{f.role}
                        {f.role === "supervisor" && (
                          <span className="ml-1 text-slate-500">
                            · {f.assignedValves.map(v => v.split("-")[1].toUpperCase()).join(", ")}
                          </span>
                        )}
                      </div>
                    </div>
                    {isActive && <Check className="size-3.5 text-emerald-400 shrink-0" />}
                  </button>
                );
              })}
            </div>
            <div className="border-t border-white/5 p-1">
              <button
                onClick={() => { logout(); setOpen(false); router.push("/login"); }}
                className="flex items-center gap-2 w-full px-3 py-2 rounded-lg hover:bg-red-500/10 text-red-400 text-xs transition-colors"
              >
                <LogOut className="size-3.5" /> Sign out
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
