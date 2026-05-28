"use client";

import { useEffect, useState } from "react";
import { OPTION_DEFAULTS, type OptionsMap } from "@/lib/options";

export function useOptions(): OptionsMap {
  const [options, setOptions] = useState<OptionsMap>(OPTION_DEFAULTS);

  useEffect(() => {
    fetch("/api/options")
      .then(r => r.ok ? r.json() : OPTION_DEFAULTS)
      .then(data => setOptions({ ...OPTION_DEFAULTS, ...data }))
      .catch(() => setOptions(OPTION_DEFAULTS));
  }, []);

  return options;
}

