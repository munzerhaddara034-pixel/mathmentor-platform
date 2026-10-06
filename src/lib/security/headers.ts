/**
 * HTTP security headers applied to every route from next.config.ts.
 * No imports on purpose: next.config.ts loads this file and `node --test` imports it directly.
 *
 * The full Content-Security-Policy ships as *Report-Only* (browser console reports, nothing is
 * blocked) because the app loads Desmos, GeoGebra, KaTeX, LiveKit (wss) and HeyGen media from
 * third parties. Only `frame-ancestors` (clickjacking) is enforced. Tighten once the reports are clean.
 */

export const CSP_REPORT_ONLY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.desmos.com https://www.geogebra.org https://cdn.geogebra.org",
  "style-src 'self' 'unsafe-inline' https:",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https:",
  "media-src 'self' data: blob: https:",
  "connect-src 'self' https: wss:",
  "frame-src 'self' https:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join("; ");

export type HeaderPair = { key: string; value: string };

export function securityHeaders(): HeaderPair[] {
  return [
    // Enforced clickjacking protection (modern + legacy header).
    { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
    { key: "X-Frame-Options", value: "SAMEORIGIN" },
    { key: "Content-Security-Policy-Report-Only", value: CSP_REPORT_ONLY },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    // Browsers ignore HSTS on plain-http localhost, so this is safe for `next start` too.
    { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
    // Live classroom needs camera + microphone; region-locked pricing needs geolocation (region computed on device). Own origin only.
    { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(self), payment=()" },
    { key: "X-DNS-Prefetch-Control", value: "on" },
  ];
}
