import { LessonWatchView } from "@/components/LessonWatchView";
import { getVideoLessonPack } from "@/lib/videoLessons";
import { notFound } from "next/navigation";

export default function BrevetGeometryPage() {
  const pack = getVideoLessonPack("brevet-geometry");
  if (!pack) notFound();
  return <LessonWatchView pack={pack} />;
}
