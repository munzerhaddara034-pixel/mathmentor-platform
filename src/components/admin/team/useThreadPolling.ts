"use client";

import { useEffect } from "react";

/** Calls `refresh` every `intervalMs` while `active` (Hamza tasks running), paused when the tab is hidden. */
export function useThreadPolling(active: boolean, refresh: () => void, intervalMs = 6000) {
  useEffect(() => {
    if (!active) return undefined;
    const timer = setInterval(() => {
      if (typeof document === "undefined" || document.visibilityState === "visible") refresh();
    }, intervalMs);
    return () => clearInterval(timer);
  }, [active, refresh, intervalMs]);
}
