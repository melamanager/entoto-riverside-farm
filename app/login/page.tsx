"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Leaf, Lock, Eye, EyeOff, ArrowRight, KeyRound, User } from "lucide-react";

const SUPERVISOR_IDS = new Set(["f-006", "f-007"]);

const DEMO_CREDENTIALS = [
  { id: "f-008", label: "Manager",        name: "Nuredin Hassen", password: "manager2026"  },
  { id: "f-006", label: "Supervisor A/B", name: "Selam Girma",    password: "supervisor01" },
  { id: "f-007", label: "Supervisor C",   name: "Yonas Alemu",    password: "supervisor02" },
];

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showDemo, setShowDemo] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!username) { setError("Please enter your username."); return; }
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      farmerId: username.trim(),
      password,
      redirect: false,
    });

    if (result?.error) {
      setError("Incorrect username or password.");
      setLoading(false);
    } else {
      router.push(SUPERVISOR_IDS.has(username.trim()) ? "/supervisor" : "/");
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
              <p className="text-slate-500 text-sm">Enter your username and password.</p>
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
                      onClick={() => { setUsername(d.id); setPassword(d.password); setError(""); setShowDemo(false); }}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/8 transition-colors group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-300 group-hover:text-white">{d.label}</span>
                        <span className="text-[10px] font-mono text-emerald-400">{d.id}</span>
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="text-[10px] text-slate-500">{d.name}</span>
                        <span className="text-[10px] font-mono text-slate-400">{d.password}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <form onSubmit={handleLogin} className="p-6 pt-4 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Username</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-500" />
                <input
                  type="text"
                  value={username}
                  onChange={e => { setUsername(e.target.value); setError(""); }}
                  placeholder="Enter your username"
                  autoComplete="username"
                  autoFocus
                  className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-500" />
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(""); }}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-10 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30"
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

            {error && (
              <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={!username || !password || loading}
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
