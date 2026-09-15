import { LessonWatchView } from "@/components/LessonWatchView";
import { getVideoLessonPack } from "@/lib/videoLessons";
import { notFound } from "next/navigation";

export default function Grade12LsDerivativesPage() {
  const pack = getVideoLessonPack("grade-12-ls-derivatives");
  if (!pack) notFound();
  return <LessonWatchView pack={pack} />;
}
