"use client";

import { InteractiveLessonPlayer } from "@/components/studio/InteractiveLessonPlayer";
import { getSampleLesson } from "@/lib/studio/sampleLessons";
import { parseLessonTimeline, TIMELINE_STORAGE_KEY, type LessonTimeline } from "@/lib/studio/timeline";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function StudioPlayerInner() {
  const params = useSearchParams();
  const lesson = params.get("lesson");
  const src = params.get("src");
  const [timeline, setTimeline] = useState<LessonTimeline>(() => getSampleLesson(lesson));
  const [ready, setReady] = useState(src !== "session");

  useEffect(() => {
    if (src === "session") {
      try {
        const raw = window.sessionStorage.getItem(TIMELINE_STORAGE_KEY);
        if (raw) {
          const parsed = parseLessonTimeline(JSON.parse(raw) as unknown);
          if (parsed.success) {
            setTimeline(parsed.data);
            setReady(true);
            return;
          }
        }
      } catch {
        /* sample fallback */
      }
    }
    setTimeline(getSampleLesson(lesson));
    setReady(true);
  }, [lesson, src]);

  return (
    <main className="shell">
      <p className="muted">
        <Link href="/studio/script">مولّد السكربت</Link>
        {" · "}
        <Link href="/lessons/interactive">عرض الدوال الأسية</Link>
      </p>
      {ready ? <InteractiveLessonPlayer timeline={timeline} /> : <p>Loading generated script…</p>}
    </main>
  );
}

export default function StudioPlayerPage() {
  return (
    <Suspense fallback={<main className="shell">Loading player…</main>}>
      <StudioPlayerInner />
    </Suspense>
  );
}
