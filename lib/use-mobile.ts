"use client";

import { useEffect, useState } from "react";

/**
 * True on phone-sized viewports. Starts false and only flips after mount, so
 * server and first client render agree (no hydration mismatch) — components
 * must therefore treat the desktop layout as the default.
 *
 * Matches Tailwind's `md` breakpoint, which the rest of the app uses.
 */
export function useIsMobile(maxWidth = 767): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${maxWidth}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [maxWidth]);

  return isMobile;
}
