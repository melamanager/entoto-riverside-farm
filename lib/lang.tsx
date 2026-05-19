"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

type Lang = "en" | "am";

const LangContext = createContext<{
  lang: Lang;
  toggle: () => void;
  isAm: boolean;
}>({ lang: "en", toggle: () => {}, isAm: false });

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>("en");

  useEffect(() => {
    const saved = localStorage.getItem("lang") as Lang | null;
    if (saved === "am") setLang("am");
  }, []);

  function toggle() {
    setLang(l => {
      const next = l === "en" ? "am" : "en";
      localStorage.setItem("lang", next);
      return next;
    });
  }

  return (
    <LangContext.Provider value={{ lang, toggle, isAm: lang === "am" }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}
