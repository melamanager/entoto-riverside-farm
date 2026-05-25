"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Leaf, Shield, UserCircle2, Lock, Eye, EyeOff, ArrowRight, KeyRound } from "lucide-react";

const LOGINABLE_USERS = [
  { id: "f-008", name: "Nuredin Hassen",   avatar: "NH", role: "manager"    as const, assignedValves: ["valve-a","valve-b","valve-c"] },
  { id: "f-006", name: "Selam Girma",      avatar: "SG", role: "supervisor" as const, assignedValves: ["valve-a","valve-b"] },
  { id: "f-007", name: "Yonas Alemu",      avatar: "YA", role: "supervisor" as const, assignedValves: ["valve-c"] },
];

const ROLE_ICONS = { manager: Shield, supervisor: UserCircle2, farmer: UserCircle2 };

const DEMO_CREDENTIALS = [
  { id: "f-008", label: "Manager",      name: "Nuredin Hassen", password: "manager2026"  },
  { id: "f-006", label: "Supervisor A/B", name: "Selam Girma",  password: "supervisor01" },
  { id: "f-007", label: "Supervisor C",   name: "Yonas Alemu",  password: "supervisor02" },
];

export default function LoginPage() {
  const router = useRouter();
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showDemo, setShowDemo] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUser) { setError("Please select an account."); return; }
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      farmerId: selectedUser,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError("Incorrect password.");
      setLoading(false);
    } else {
      const user = LOGINABLE_USERS.find(f => f.id === selectedUser);
      router.push(user?.role === "supervisor" ? "/supervisor" : "/");
    }
  }

  return (
    <div className="min-h-screen bg-[#0d1117] flex flex-col items-center justify-center px-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: "radial-gradient(circle at 25% 25%, #0d2818 0%, transparent 50%), radial-gradient(circle at 75% 75%, #0a1628 0%, transparent 50%)",
        }}/>
        <svg className="absolute inset-0 w-full h-full opacity-5" xmlns="http://www.w3.org/2000/svg">
          <defs><pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5"/></pattern></defs>
          <rect width="100%" height="100%" fill="url(#grid)"/>
        </svg>
      </div>

      <div className="relative w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="size-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-800 grid place-items-center shadow-2xl shadow-emerald-900/50 mb-4">
            <Leaf className="size-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">ENTOTO Riverside Farm</h1>
          <p className="text-slate-500 text-sm mt-1">Operations Management System</p>
        </div>

        <div className="bg-[#161b22] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
          <div className="px-6 pt-6 pb-2 flex items-start justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-white mb-1">Sign in</h2>
              <p className="text-slate-500 text-sm">Select your account and enter your password.</p>
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowDemo(p => !p)}
                title="Demo credentials"
                className={`mt-0.5 size-8 rounded-lg grid place-items-center transition-colors ${
                  showDemo
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                    : "bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10 hover:text-slate-200"
                }`}
              >
                <KeyRound className="size-4" />
              </button>
              {showDemo && (
                <div className="absolute right-0 top-10 z-10 w-64 bg-[#1c2230] border border-white/15 rounded-xl shadow-2xl p-2 space-y-1">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-2 pb-1">Click to fill credentials</p>
                  {DEMO_CREDENTIALS.map(d => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => { setSelectedUser(d.id); setPassword(d.password); setError(""); setShowDemo(false); }}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/8 transition-colors group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-300 group-hover:text-white">{d.label}</span>
                        <span className="text-[10px] font-mono text-emerald-400">{d.password}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{d.name}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <form onSubmit={handleLogin} className="p-6 pt-4 space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Account</label>
              <div className="space-y-2">
                {LOGINABLE_USERS.map(f => {
                  const Icon = ROLE_ICONS[f.role];
                  const isSelected = selectedUser === f.id;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => { setSelectedUser(f.id); setPassword(""); setError(""); }}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                        isSelected
                          ? "border-emerald-500 bg-emerald-500/10"
                          : "border-white/8 bg-white/3 hover:border-white/15 hover:bg-white/5"
                      }`}
                    >
                      <Avatar className="size-9 shrink-0">
                        <AvatarFallback className={`font-bold text-sm ${isSelected ? "bg-emerald-700 text-white" : "bg-slate-700 text-slate-300"}`}>
                          {f.avatar}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-white">{f.name}</div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1.5 capitalize mt-0.5">
                          <Icon className="size-3" />
                          {f.role}
                          {f.role === "supervisor" && (
                            <span className="text-slate-600">· Valves {f.assignedValves.map(v=>v.split("-")[1].toUpperCase()).join(", ")}</span>
                          )}
                        </div>
                      </div>
                      {isSelected && (
                        <div className="size-5 rounded-full bg-emerald-500 grid place-items-center shrink-0">
                          <div className="size-2 rounded-full bg-white" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedUser && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-500" />
                  <input
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError(""); }}
                    placeholder="Enter your password"
                    className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-10 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showPass ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={!selectedUser || !password || loading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 gap-2 h-10 font-semibold"
            >
              {loading ? (
                <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <><ArrowRight className="size-4" /> Sign In</>
              )}
            </Button>
          </form>

        </div>

        <p className="text-center text-[11px] text-slate-700 mt-4">
          Entoto Agro PLC · Addis Ababa, Ethiopia
        </p>
      </div>
    </div>
  );
}
