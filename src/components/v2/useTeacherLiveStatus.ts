"use client";

import { useEffect, useState } from "react";
import { TEACHER_LIVE_STATUS_ENDPOINT, parseTeacherLiveStatus, type TeacherLiveStatus } from "@/lib/live/teacherLiveStatus";

const POLL_MS = 30_000;

/**
 * Starts from the server-rendered status (no photo ⇄ live flicker) and, once an endpoint exists, refreshes
 * it every 30 s while the tab is visible. With `TEACHER_LIVE_STATUS_ENDPOINT = null` it never fetches.
 */
export function useTeacherLiveStatus(initial: TeacherLiveStatus): TeacherLiveStatus {
  const [status, setStatus] = useState(initial);
  useEffect(() => {
    const endpoint = TEACHER_LIVE_STATUS_ENDPOINT;
    if (!endpoint) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      if (document.visibilityState === "visible") {
        try {
          const response = await fetch(endpoint, { cache: "no-store" });
          if (response.ok && !cancelled) setStatus(parseTeacherLiveStatus(await response.json()));
        } catch {
          /* keep the last known status */
        }
      }
      if (!cancelled) timer = setTimeout(tick, POLL_MS);
    };
    timer = setTimeout(tick, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible" && timer) {
        clearTimeout(timer);
        void tick();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  return status;
}

/** True when the head script flagged data-saver (Save-Data, 2g, or the visitor's own toggle). */
export function useDataSaver(): boolean {
  const [saver, setSaver] = useState(false);
  useEffect(() => {
    setSaver(document.documentElement.classList.contains("data-saver"));
  }, []);
  return saver;
}
