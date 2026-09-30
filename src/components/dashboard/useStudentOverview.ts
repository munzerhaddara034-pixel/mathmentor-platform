"use client";

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { StudentOverview } from "@/lib/dashboard/overview";

export type OverviewState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; overview: StudentOverview };

type OverviewResponse = { ok: true; overview: StudentOverview } | { ok: false; errorAr?: string };

export function useStudentOverview() {
  const { locale, m } = useI18n();
  const [state, setState] = useState<OverviewState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });
    (async () => {
      try {
        const response = await fetch("/api/me/overview", { cache: "no-store", signal: controller.signal });
        const payload = (await response.json()) as OverviewResponse;
        if (!response.ok || !payload.ok) {
          const serverAr = !payload.ok && locale === "ar" ? payload.errorAr : undefined;
          setState({ status: "error", message: serverAr || m.common.unavailable });
          return;
        }
        setState({ status: "ready", overview: payload.overview });
      } catch (error) {
        if (controller.signal.aborted) return;
        console.warn("overview fetch failed", error);
        setState({ status: "error", message: m.common.network });
      }
    })();
    return () => controller.abort();
  }, [attempt, locale, m]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { state, retry };
}
