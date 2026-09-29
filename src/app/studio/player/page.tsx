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
  const jobId = params.get("job");
  const [timeline, setTimeline] = useState<LessonTimeline>(() => getSampleLesson(lesson));
  const [ready, setReady] = useState(src !== "session" && !jobId);
  const [jobNote, setJobNote] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (jobId) {
        try {
          const response = await fetch(`/api/heygen/status?jobId=${encodeURIComponent(jobId)}`);
          const payload = (await response.json()) as {
            timeline?: LessonTimeline;
            job?: { status: string; videoUrl?: string; studentEnabled?: boolean; demo?: boolean };
            error?: string;
          };
          if (cancelled) return;
          if (payload.timeline) {
            setTimeline(payload.timeline);
            setJobNote(
              payload.job
                ? `HeyGen job ${payload.job.status}${payload.job.videoUrl ? " · video attached" : ""}${payload.job.demo ? " · demo" : ""}`
                : "",
            );
            setReady(true);
            return;
          }
        } catch {
          /* sample fallback */
        }
      }
      if (src === "session") {
        try {
          const raw = window.sessionStorage.getItem(TIMELINE_STORAGE_KEY);
          if (raw) {
            const parsed = parseLessonTimeline(JSON.parse(raw) as unknown);
            if (parsed.success) {
              if (!cancelled) {
                setTimeline(parsed.data);
                setReady(true);
              }
              return;
            }
          }
        } catch {
          /* sample fallback */
        }
      }
      if (!cancelled) {
        setTimeline(getSampleLesson(lesson));
        setReady(true);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [jobId, lesson, src]);

  return (
    <main className="shell studio-shell">
      <p className="muted">
        <Link href="/studio/script">Script editor</Link>
        {" · "}
        <Link href="/lessons/interactive">Official exam demo</Link>
        {" · "}
        <Link href="/admin/video-generator">Video generator</Link>
        {jobNote ? ` · ${jobNote}` : ""}
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
