"use client";

import { useI18n } from "@/components/i18n/I18nProvider";
import { useNs } from "@/components/i18n/useNs";
import { liveMessages } from "@/lib/i18n/ns/live";
import { pickLang } from "@/lib/i18n/pick";

type Props = {
  error?: string;
  errorAr?: string;
  errorFr?: string;
  hint?: string;
  hintAr?: string;
  hintFr?: string;
  onRetry?: () => void;
  retryLabel?: string;
  tone?: "warn" | "info";
};

/**
 * Banner when camera/mic permission fails or AV needs a user gesture. Shows the active locale's
 * variant only (ar → errorAr, fr → errorFr when given, otherwise English).
 */
export function MediaPermissionBanner({
  error,
  errorAr,
  errorFr,
  hint,
  hintAr,
  hintFr,
  onRetry,
  retryLabel,
  tone = "warn",
}: Props) {
  const { locale } = useI18n();
  const t = useNs(liveMessages).room;
  if (!error && !errorAr && !hint && !hintAr) return null;
  const message = pickLang(locale, error, errorAr, errorFr);
  const hintText = pickLang(locale, hint, hintAr, hintFr);
  return (
    <div
      className={tone === "info" ? "live-demo-banner live-media-banner" : "live-media-banner live-media-banner-warn"}
      role="alert"
    >
      {message ? <p>{message}</p> : null}
      {hintText ? <p className="muted">{hintText}</p> : null}
      {onRetry ? (
        <button className="btn dark live-av-enable-btn" type="button" onClick={onRetry}>
          {retryLabel ?? t.enableAv}
        </button>
      ) : null}
    </div>
  );
}
