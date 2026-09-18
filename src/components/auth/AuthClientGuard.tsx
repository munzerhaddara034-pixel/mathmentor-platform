"use client";

import { useEffect } from "react";

export function AuthClientGuard({ mode = "lesson" }: { mode?: "auth" | "lesson" | "staff" | "ai" | "live" }) {
  useEffect(() => {
    let cancelled = false;
    void fetch("/api/auth/session", { credentials: "same-origin" })
      .then(async (response) => {
        const payload = (await response.json()) as {
          ok?: boolean;
          reason?: string;
          subscribed?: boolean;
          aiAccess?: boolean;
          liveAccess?: boolean;
          canTeach?: boolean;
        };
        if (cancelled) return;
        const next = `${window.location.pathname}${window.location.search}`;
        if (!payload.ok) {
          const reason =
            payload.reason === "replaced" || payload.reason === "expired" ? payload.reason : undefined;
          const url = reason
            ? `/login?reason=${reason}&next=${encodeURIComponent(next)}`
            : `/login?next=${encodeURIComponent(next)}`;
          window.location.replace(url);
          return;
        }
        if (mode === "staff" && !payload.canTeach) {
          window.location.replace("/lessons/interactive");
          return;
        }
        if ((mode === "lesson" || mode === "ai") && payload.aiAccess === false && payload.subscribed === false && !payload.canTeach) {
          window.location.replace(`/redeem?need=${mode === "ai" ? "ai" : "subscription"}&next=${encodeURIComponent(next)}`);
          return;
        }
        if (mode === "live" && payload.liveAccess === false && !payload.canTeach) {
          window.location.replace(`/subscribe?need=live&next=${encodeURIComponent(next)}`);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [mode]);
  return null;
}
