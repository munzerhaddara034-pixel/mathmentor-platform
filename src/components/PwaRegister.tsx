"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const register = async () => {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        // Force update path: unregister broken workers then register v4 once
        for (const reg of regs) {
          try {
            await reg.unregister();
          } catch {
            /* ignore */
          }
        }
        await navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" });
      } catch {
        /* ignore */
      }
    };

    if (document.readyState === "complete") void register();
    else window.addEventListener("load", () => void register(), { once: true });
  }, []);

  return null;
}
