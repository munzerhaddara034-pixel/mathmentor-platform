"use client";

import { useI18n } from "@/components/i18n/I18nProvider";

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
  label,
  rounded = "md",
}: SkeletonProps) {
  const { m } = useI18n();
  const h = typeof height === "number" ? `${height}px` : height;
  const w = typeof width === "number" ? `${width}px` : width;
  return (
    <span
      className={`mm-skeleton ${className}`.trim()}
      style={{ height: h, width: w, borderRadius: RADIUS[rounded] }}
      role="status"
      aria-busy="true"
      aria-label={label ?? m.common.loading}
    />
  );
}

export function SkeletonBlock({
  lines = 3,
  label,
  className = "",
}: {
  lines?: number;
  label?: string;
  className?: string;
}) {
  const { m } = useI18n();
  return (
    <div className={`mm-skeleton-block ${className}`.trim()} role="status" aria-busy="true" aria-label={label ?? m.common.loading}>
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
  const { locale } = useI18n();
  if (!error && !errorAr) return null;
  // Server errors come as ar + en: Arabic UI shows the Arabic copy, en/fr show English (fallback to the other).
  const showAr = locale === "ar" ? Boolean(errorAr) : !error;
  return (
    <div className={`studio-teacher-error mm-api-error ${className}`.trim()} role="alert">
      {showAr ? (
        <p dir="rtl" lang="ar">
          {errorAr}
        </p>
      ) : (
        <p dir="auto" lang="en">
          {error}
        </p>
      )}
    </div>
  );
}
