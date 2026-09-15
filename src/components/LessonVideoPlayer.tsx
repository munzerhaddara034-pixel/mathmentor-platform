"use client";

import { ClassroomStudio } from "@/components/ClassroomStudio";
import { resolveLessonVideo } from "@/lib/lessonMedia";
import type { StoryboardScene } from "@/lib/types";

export function LessonVideoPlayer({
  videoUrl,
  heading,
  scenes,
  watermark,
}: {
  videoUrl?: string;
  heading: string;
  scenes: StoryboardScene[];
  watermark: string;
}) {
  const media = resolveLessonVideo({ videoUrl });

  if (media.kind === "storyboard") {
    return <ClassroomStudio heading={heading} scenes={scenes} watermark={watermark} />;
  }

  return (
    <div className="classroom video-secure" onContextMenu={(event) => event.preventDefault()}>
      <div className="lesson-media-frame">
        {media.kind === "file" ? (
          <video
            className="lesson-media"
            src={media.src}
            controls
            controlsList="nodownload noplaybackrate"
            disablePictureInPicture
            playsInline
            preload="metadata"
          />
        ) : (
          <iframe
            className="lesson-media"
            title={heading}
            src={media.src}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            allowFullScreen
          />
        )}
        <span className="dynamic-watermark">{watermark}</span>
        <span className="dynamic-watermark delay">{watermark}</span>
        <p className="classroom-tag">
          {media.providerLabel} · محمي · بلا تحميل
        </p>
      </div>
    </div>
  );
}
