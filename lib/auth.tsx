"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { FARMERS } from "@/lib/data";
import type { Farmer } from "@/lib/types";

interface AuthState {
  user: Farmer | null;
  login: (farmerId: string) => void;
  logout: () => void;
  isManager: boolean;
  isSupervisor: boolean;
}

const AuthContext = createContext<AuthState>({
  user: null,
  login: () => {},
  logout: () => {},
  isManager: false,
  isSupervisor: false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Farmer | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("entoto_user_id");
      if (stored) {
        const found = FARMERS.find(f => f.id === stored);
        if (found) setUser(found);
      } else {
        // Default to manager for first load
        const manager = FARMERS.find(f => f.role === "manager");
        if (manager) setUser(manager);
      }
    } catch {}
  }, []);

  function login(farmerId: string) {
    const found = FARMERS.find(f => f.id === farmerId);
    if (found) {
      setUser(found);
      try { localStorage.setItem("entoto_user_id", farmerId); } catch {}
    }
  }

  function logout() {
    setUser(null);
    try { localStorage.removeItem("entoto_user_id"); } catch {}
  }

  return (
    <AuthContext.Provider value={{
      user,
      login,
      logout,
      isManager: user?.role === "manager",
      isSupervisor: user?.role === "supervisor",
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() { return useContext(AuthContext); }
