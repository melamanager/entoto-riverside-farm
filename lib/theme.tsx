"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

export type Theme = "dark" | "light" | "system";

const STORAGE_KEY = "entoto-theme";

type Ctx = { theme: Theme; resolved: "dark" | "light"; setTheme: (t: Theme) => void; toggle: () => void };

const ThemeContext = createContext<Ctx>({
  theme: "dark", resolved: "dark", setTheme: () => {}, toggle: () => {},
});

/** Applied before paint by the inline script below; kept in sync here too. */
function apply(resolved: "dark" | "light") {
  document.documentElement.classList.toggle("dark", resolved === "dark");
  document.documentElement.style.colorScheme = resolved;
}

function systemPrefersDark() {
  return typeof window !== "undefined"
    && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/**
 * Theme, remembered per device.
 *
 * The farm has only ever seen dark, so dark stays the default — nobody's
 * screen changes until they choose otherwise. "system" is available for
 * anyone who wants the phone to decide.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [resolved, setResolved] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const stored = (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? "dark";
    setThemeState(stored);
    const r = stored === "system" ? (systemPrefersDark() ? "dark" : "light") : stored;
    setResolved(r);
    apply(r);
  }, []);

  // follow the OS while the choice is "system"
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => { const r = mq.matches ? "dark" : "light"; setResolved(r); apply(r); };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    localStorage.setItem(STORAGE_KEY, t);
    const r = t === "system" ? (systemPrefersDark() ? "dark" : "light") : t;
    setResolved(r);
    apply(r);
  }, []);

  const toggle = useCallback(() => {
    setTheme(resolved === "dark" ? "light" : "dark");
  }, [resolved, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, resolved, setTheme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);

/**
 * Runs before first paint so the page never flashes the wrong theme.
 * Mirrors the resolution order above; kept deliberately tiny.
 */
export const THEME_INIT_SCRIPT = `
(function(){try{
  var t = localStorage.getItem(${JSON.stringify(STORAGE_KEY)}) || 'dark';
  var d = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', d);
  document.documentElement.style.colorScheme = d ? 'dark' : 'light';
}catch(e){document.documentElement.classList.add('dark');}})();
`;
