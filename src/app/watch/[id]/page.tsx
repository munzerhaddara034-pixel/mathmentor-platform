"use client";

import { LessonWatchView } from "@/components/LessonWatchView";
import { getVideoLessonPack } from "@/lib/videoLessons";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function WatchLessonPage() {
  const params = useParams<{ id: string }>();
  const pack = getVideoLessonPack(params.id);
  if (!pack) {
    return (
      <main className="shell">
        <h1>Lesson not found</h1>
        <p className="muted">No bilingual explainer is wired for “{params.id}”.</p>
        <Link href="/lessons">Back to video lessons</Link>
      </main>
    );
  }
  return <LessonWatchView pack={pack} />;
}
