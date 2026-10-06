"use client";

import { useEffect, useState } from "react";
import { parseVtt, type VttCue } from "@/lib/lessonPlayer/vtt";

/** Optional chapters.vtt → cue list. A missing/broken file just means "no chapters" (the list is optional UI). */
export function useChapters(url: string | null): { chapters: VttCue[]; loading: boolean } {
  const [chapters, setChapters] = useState<VttCue[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!url) {
      setChapters([]);
      return;
    }
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(url, { signal: controller.signal });
        const text = res.ok ? await res.text() : "";
        setChapters(parseVtt(text).filter((cue) => cue.text));
      } catch {
        if (!controller.signal.aborted) setChapters([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [url]);
  return { chapters, loading };
}
