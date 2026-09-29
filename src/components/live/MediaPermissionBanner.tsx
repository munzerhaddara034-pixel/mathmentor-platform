"use client";

type Props = {
  error?: string;
  errorAr?: string;
  hint?: string;
  hintAr?: string;
  onRetry?: () => void;
  retryLabel?: string;
  tone?: "warn" | "info";
};

/**
 * Clear AR/EN banner when camera/mic permission fails or AV needs a user gesture.
 */
export function MediaPermissionBanner({
  error,
  errorAr,
  hint,
  hintAr,
  onRetry,
  retryLabel = "تفعيل الكاميرا والميكروفون",
  tone = "warn",
}: Props) {
  if (!error && !errorAr && !hint && !hintAr) return null;
  return (
    <div
      className={tone === "info" ? "live-demo-banner live-media-banner" : "live-media-banner live-media-banner-warn"}
      role="alert"
    >
      {errorAr ? (
        <p dir="rtl" lang="ar">
          {errorAr}
        </p>
      ) : null}
      {error ? <p dir="ltr">{error}</p> : null}
      {hintAr ? (
        <p className="muted" dir="rtl" lang="ar">
          {hintAr}
        </p>
      ) : null}
      {hint ? (
        <p className="muted" dir="ltr">
          {hint}
        </p>
      ) : null}
      {onRetry ? (
        <button className="btn dark live-av-enable-btn" type="button" onClick={onRetry}>
          {retryLabel}
        </button>
      ) : null}
    </div>
  );
}
