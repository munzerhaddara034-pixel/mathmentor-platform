import type { MetadataRoute } from "next";
import { NOINDEX_PATHS, siteUrl } from "@/lib/seo/site";

/**
 * Crawling rules: the marketing pages are open, everything behind the paywall (and the API) is not.
 * Private pages also send `X-Robots-Tag: noindex` from the middleware, so a link that leaks out is
 * still not indexed.
 */
const PRIVATE_PREFIXES = [
  "/lessons",
  "/studio",
  "/classroom",
  "/practice",
  "/quiz",
  "/student",
  "/dashboard",
  "/professor",
  "/admin",
  "/assistant",
  "/bank",
  "/resources",
  "/leaderboard",
  "/redeem",
  "/activate",
  "/exams",
  "/wallet",
  "/profile",
  "/settings",
  "/teacher",
];

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  const disallow = ["/api/", ...PRIVATE_PREFIXES.map((prefix) => `${prefix}/`), ...NOINDEX_PATHS];
  return {
    rules: [{ userAgent: "*", allow: "/", disallow }],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
