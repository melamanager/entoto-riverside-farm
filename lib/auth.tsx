"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useSession, signOut as nextAuthSignOut } from "next-auth/react";
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
  const { data: session, status } = useSession();
  const [farmerDetail, setFarmerDetail] = useState<Farmer | null>(null);

  useEffect(() => {
    if (session?.user?.id) {
      fetch(`/api/farmers/${session.user.id}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data) setFarmerDetail(data);
        })
        .catch(() => {});
    } else {
      setFarmerDetail(null);
    }
  }, [session?.user?.id]);

  const user: Farmer | null = farmerDetail ?? (
    session?.user ? {
      id: session.user.id,
      name: session.user.name ?? "",
      phone: "",
      avatar: (session.user as { avatar?: string }).avatar ?? "",
      role: (session.user as { role?: string }).role as Farmer["role"] ?? "farmer",
      performanceScore: 0,
      attendanceRate: 0,
      joinedDate: "",
      assignedValves: [],
    } : null
  );

  const login = useCallback((_farmerId: string) => {
    // Login is handled by NextAuth signIn() — this is a no-op kept for interface compatibility
  }, []);

  const logout = useCallback(() => {
    nextAuthSignOut({ callbackUrl: "/login" });
  }, []);

  if (status === "loading") {
    return <>{children}</>;
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
