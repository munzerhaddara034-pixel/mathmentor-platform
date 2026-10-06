import type { Metadata } from "next";
import { LazyLessonPlayer } from "@/components/lessonPlayer/LazyLessonPlayer";
import { getI18n } from "@/lib/i18n/server";
import { lessonPlayerMessages } from "@/lib/i18n/ns/lessonPlayer";
import { formatClock } from "@/lib/lessonPlayer/format";
import { loadLessonManifest } from "@/lib/lessonPlayer/content";
import { lessonTitle } from "@/lib/lessonPlayer/manifest";
import { privateRobotsMetadata } from "@/lib/auth/metadata";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getI18n();
  return { ...privateRobotsMetadata, title: lessonPlayerMessages[locale].metaTitle };
}

export default async function LessonPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { locale, dir } = await getI18n();
  const t = lessonPlayerMessages[locale];
  const result = await loadLessonManifest(id);

  if (!result.ok) {
    return (
      <main className="shell lp-page" dir={dir}>
        <span className="lp-preview-badge">{t.previewBadge}</span>
        <h1>{t.notFoundTitle}</h1>
        <p className="muted">
          {t.notFoundLead} <bdi dir="ltr">({result.error})</bdi>
        </p>
      </main>
    );
  }

  const { manifest } = result;
  return (
    <main className="shell lp-page" dir={dir}>
      <span className="lp-preview-badge">{t.previewBadge}</span>
      <h1>{lessonTitle(manifest, locale)}</h1>
      <ul className="lp-meta">
        {manifest.level ? (
          <li>
            <b>{t.level}</b>
            <bdi>{manifest.level}</bdi>
          </li>
        ) : null}
        {manifest.curriculum ? (
          <li>
            <b>{t.curriculum}</b>
            <bdi>{manifest.curriculum}</bdi>
          </li>
        ) : null}
        {manifest.duration ? (
          <li>
            <b>{t.duration}</b>
            <bdi dir="ltr">{formatClock(manifest.duration)}</bdi>
          </li>
        ) : null}
      </ul>
      <p className="muted" style={{ margin: 0 }}>
        {t.previewLead}
      </p>
      <LazyLessonPlayer manifest={manifest} />
    </main>
  );
}
