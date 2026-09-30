"use client";

import { useEffect, useState, type RefObject } from "react";
import type { CanvasAction } from "@/lib/studio/timeline";
import { eventsStorageKey, validateTimelineEvents } from "@/lib/studio/timeline";

type Identity = { name: string; phone: string };
type SessionPayload = { ok?: boolean; user?: { name?: string; phone?: string }; canTeach?: boolean };

const GUEST_IDENTITY: Identity = { name: "طالب المنصة", phone: "76532421" };

/** Records the lesson view and resolves the watermark identity + staff unlock from /api/auth/session. */
export function useViewerIdentity(lessonId: string, viewer: Identity | undefined, canTeach: boolean) {
  const [identity, setIdentity] = useState<Identity>(viewer ?? GUEST_IDENTITY);
  const [staffUnlock, setStaffUnlock] = useState(canTeach);

  useEffect(() => {
    if (viewer) setIdentity(viewer);
  }, [viewer]);

  useEffect(() => {
    (async () => {
      try {
        await fetch("/api/gamification/activity", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ kind: "lesson", lessonId, topic: "calculus" }),
        });
      } catch {
        /* streak tracking is best-effort */
      }
    })();
  }, [lessonId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/auth/session", { credentials: "same-origin" });
        const payload = (await response.json()) as SessionPayload;
        if (cancelled || !payload.ok || !payload.user) return;
        setIdentity({ name: payload.user.name || GUEST_IDENTITY.name, phone: payload.user.phone || GUEST_IDENTITY.phone });
        if (payload.canTeach) setStaffUnlock(true);
      } catch {
        /* keep the server-provided identity */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { identity, staffUnlock };
}

/** Loads teacher-saved timeline events (sessionStorage first, then /api/studio/events). */
export function useSavedTimelineEvents(lessonId: string, apply: RefObject<(events: CanvasAction[]) => void>) {
  useEffect(() => {
    let cancelled = false;
    const applyEvents = (events: CanvasAction[]) => {
      if (!cancelled) apply.current?.(events);
    };
    try {
      const raw = window.sessionStorage.getItem(eventsStorageKey(lessonId));
      if (raw) {
        const parsed = validateTimelineEvents(JSON.parse(raw) as unknown);
        if (parsed.ok) {
          applyEvents(parsed.events);
          return () => {
            cancelled = true;
          };
        }
      }
    } catch {
      /* private mode / bad JSON */
    }
    (async () => {
      try {
        const response = await fetch(`/api/studio/events?lessonId=${encodeURIComponent(lessonId)}`);
        if (!response.ok) return;
        const payload = (await response.json()) as { events?: unknown; saved?: boolean };
        if (!payload.saved || !payload.events) return;
        const parsed = validateTimelineEvents(payload.events);
        if (parsed.ok) applyEvents(parsed.events);
      } catch {
        /* fall back to the built-in timeline */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lessonId, apply]);
}

/** Tracks which host (board / video) is fullscreen and toggles it (iOS video fallback). */
export function useFullscreenHosts(board: RefObject<HTMLDivElement | null>, video: RefObject<HTMLDivElement | null>) {
  const [target, setTarget] = useState<"board" | "video" | null>(null);

  useEffect(() => {
    const onChange = () => {
      const active = document.fullscreenElement;
      if (active === board.current) setTarget("board");
      else if (active === video.current) setTarget("video");
      else setTarget(null);
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, [board, video]);

  const toggle = (which: "board" | "video") => {
    const node = which === "board" ? board.current : video.current;
    if (!node) return;
    const media = node.querySelector("video") as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    if (document.fullscreenElement === node) {
      void document.exitFullscreen().catch(() => undefined);
      return;
    }
    if (typeof node.requestFullscreen !== "function" && which === "video" && media?.webkitEnterFullscreen) {
      media.webkitEnterFullscreen();
      return;
    }
    void node.requestFullscreen?.().catch(() => {
      if (which === "video" && media?.webkitEnterFullscreen) media.webkitEnterFullscreen();
    });
  };

  return { fullscreenTarget: target, toggleFullscreen: toggle };
}
