"use client";

import "@/styles/lessonPlayer.css";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { useNs } from "@/components/i18n/useNs";
import { lessonPlayerMessages } from "@/lib/i18n/ns/lessonPlayer";
import type { LessonManifest } from "@/lib/lessonPlayer/manifest";
import { PlayerSkeleton } from "./PlayerSkeleton";

const LessonPlayer = dynamic(() => import("./LessonPlayer").then((mod) => mod.LessonPlayer), {
  ssr: false,
  loading: () => (
    <div className="lp-frame lp-frame-placeholder">
      <div className="lp-stage">
        <PlayerSkeleton label="…" />
      </div>
    </div>
  ),
});

/**
 * Lazy shell: the player chunk and the <video> (and its metadata request) only load once the frame is within
 * 300px of the viewport. Until then a skeleton holds the 16:9 space (no layout shift).
 */
export function LazyLessonPlayer({ manifest }: { manifest: LessonManifest }) {
  const t = useNs(lessonPlayerMessages);
  const holder = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = holder.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={holder} className="lp-holder">
      {visible ? (
        <LessonPlayer manifest={manifest} />
      ) : (
        <div className="lp-frame lp-frame-placeholder">
          <div className="lp-stage">
            <PlayerSkeleton label={t.loading} poster={manifest.poster} />
          </div>
        </div>
      )}
    </div>
  );
}
