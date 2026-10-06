/**
 * Canonical public origin, indexable routes and structured data.
 *
 * Search engines and link previews need absolute URLs, so the origin comes from configuration
 * (`NEXT_PUBLIC_APP_URL`, falling back to `APP_BASE_URL`) and only then from the Render host, so a
 * preview deploy still emits valid absolute URLs instead of relative ones.
 */
export const SITE_FALLBACK_URL = "https://mathmentor-platform.onrender.com";

export function siteUrl() {
  const configured = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_BASE_URL || "").trim().replace(/\/+$/, "");
  return configured || SITE_FALLBACK_URL;
}

export type PublicRoute = {
  path: string;
  priority: number;
  changeFrequency: "daily" | "weekly" | "monthly";
};

/** Marketing and free-trial surfaces only: everything behind the paywall stays out of the index. */
export const PUBLIC_ROUTES: PublicRoute[] = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  { path: "/math-solver", priority: 0.9, changeFrequency: "weekly" },
  { path: "/subscribe", priority: 0.8, changeFrequency: "weekly" },
  { path: "/live", priority: 0.7, changeFrequency: "daily" },
  { path: "/signup", priority: 0.5, changeFrequency: "monthly" },
  { path: "/login", priority: 0.3, changeFrequency: "monthly" },
  { path: "/privacy", priority: 0.3, changeFrequency: "monthly" },
  { path: "/terms", priority: 0.3, changeFrequency: "monthly" },
];

/** Paths that must never be crawled even though they are reachable without a session. */
export const NOINDEX_PATHS = ["/api/", "/math-solver/result"];

export const OG_IMAGE = { url: "/brand/mathmentor-logo.png", width: 512, height: 512, alt: "MathMentor" };

/** Structured data for the home page: the academy, the course it teaches and the AI tutor service. */
export function homeJsonLd(input: { description: string; priceFrom?: number; currency?: string }) {
  const base = siteUrl();
  const organization = {
    "@type": "EducationalOrganization",
    "@id": `${base}/#organization`,
    name: "MathMentor",
    alternateName: "منذر حداره · MathMentor",
    url: base,
    logo: `${base}/brand/mathmentor-logo.png`,
    description: input.description,
    founder: { "@type": "Person", name: "Munzer Haddara" },
    knowsLanguage: ["ar", "en", "fr"],
    areaServed: ["LB", "AE", "SA", "QA", "KW"],
  };
  const course = {
    "@type": "Course",
    "@id": `${base}/#course`,
    name: "Mathematics with Prof. Munzer Haddara",
    description:
      "Lebanese Brevet & Terminale, IB Math AA/AI, Cambridge IGCSE/A-Level, SAT and AP Calculus, taught step by step with an AI tutor, whiteboard lessons and live 1:1 sessions.",
    provider: { "@id": `${base}/#organization` },
    inLanguage: ["ar", "en", "fr"],
    teaches: ["Algebra", "Calculus", "Geometry", "Probability and statistics"],
  };
  const graph: Record<string, unknown>[] = [organization, course];
  if (input.priceFrom && input.priceFrom > 0) {
    graph.push({
      "@type": "Service",
      "@id": `${base}/#subscription`,
      name: "MathMentor subscription",
      serviceType: "Online maths tutoring",
      provider: { "@id": `${base}/#organization` },
      areaServed: ["LB", "AE", "SA", "QA", "KW"],
      offers: {
        "@type": "Offer",
        price: input.priceFrom,
        priceCurrency: input.currency || "USD",
        url: `${base}/subscribe`,
        availability: "https://schema.org/InStock",
      },
    });
  }
  return { "@context": "https://schema.org", "@graph": graph };
}
