"use client";

import { useCallback, useEffect, useState } from "react";
import { OPTION_DEFAULTS, type OptionsMap } from "@/lib/options";

// Manager-editable dropdown lists (varieties, job titles, seed sources…).
// `refreshOptions()` re-pulls them in every mounted consumer, so adding an
// option inline (components/managed-select.tsx) updates the whole page at once
// without changing this hook's return shape.
let listeners: Array<() => void> = [];
export function refreshOptions() {
  listeners.forEach((l) => l());
}

export function useOptions(): OptionsMap {
  const [options, setOptions] = useState<OptionsMap>(OPTION_DEFAULTS);

  const load = useCallback(() => {
    fetch("/api/options")
      .then(r => r.ok ? r.json() : OPTION_DEFAULTS)
      .then(data => setOptions({ ...OPTION_DEFAULTS, ...data }))
      .catch(() => setOptions(OPTION_DEFAULTS));
  }, []);

  useEffect(() => {
    load();
    listeners.push(load);
    return () => { listeners = listeners.filter(l => l !== load); };
  }, [load]);

  return options;
}
