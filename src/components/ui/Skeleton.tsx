/** Mobile-first skeleton placeholders for API-bound UI. */

export type SkeletonProps = {
  /** Approximate height in px (or CSS length). */
  height?: number | string;
  /** Approximate width (default 100%). */
  width?: number | string;
  /** Extra class names. */
  className?: string;
  /** Accessible label while loading. */
  label?: string;
  /** Rounded pill vs card. */
  rounded?: "sm" | "md" | "lg" | "full";
};

const RADIUS: Record<NonNullable<SkeletonProps["rounded"]>, string> = {
  sm: "8px",
  md: "14px",
  lg: "20px",
  full: "999px",
};

export function Skeleton({
  height = 16,
  width = "100%",
  className = "",
  label = "جارٍ التحميل…",
  rounded = "md",
}: SkeletonProps) {
  const h = typeof height === "number" ? `${height}px` : height;
  const w = typeof width === "number" ? `${width}px` : width;
  return (
    <span
      className={`mm-skeleton ${className}`.trim()}
      style={{ height: h, width: w, borderRadius: RADIUS[rounded] }}
      role="status"
      aria-busy="true"
      aria-label={label}
    />
  );
}

export function SkeletonBlock({
  lines = 3,
  label = "جارٍ التحميل…",
  className = "",
}: {
  lines?: number;
  label?: string;
  className?: string;
}) {
  return (
    <div className={`mm-skeleton-block ${className}`.trim()} role="status" aria-busy="true" aria-label={label}>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} height={index === 0 ? 22 : 14} width={index === lines - 1 ? "72%" : "100%"} label="" />
      ))}
    </div>
  );
}

export function ApiErrorBanner({
  error,
  errorAr,
  className = "",
}: {
  error?: string;
  errorAr?: string;
  className?: string;
}) {
  if (!error && !errorAr) return null;
  // Arabic-first UI: show the Arabic message; English only when no Arabic copy exists.
  return (
    <div className={`studio-teacher-error mm-api-error ${className}`.trim()} role="alert">
      {errorAr ? (
        <p dir="rtl" lang="ar">
          {errorAr}
        </p>
      ) : (
        <p dir="ltr" lang="en">
          {error}
        </p>
      )}
    </div>
  );
}
