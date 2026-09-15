import { LessonWatchView } from "@/components/LessonWatchView";
import { getVideoLessonPack } from "@/lib/videoLessons";
import { notFound } from "next/navigation";

export default function Grade12LsContinuityPage() {
  const pack = getVideoLessonPack("grade-12-ls-continuity");
  if (!pack) notFound();
  return <LessonWatchView pack={pack} />;
}
