import { checkWebFetchUrl, safeWebFetchBytes, type LookupFn } from "@/lib/security/safeFetch";
import { recordTeamWebAudit } from "./health";
import { redactSecrets } from "./secrets";
import { teamMessages } from "@/lib/i18n/ns/team";
import type { TeamAgentId } from "./types";

export type WebSearchResult = { title: string; url: string; snippet: string };
export type WebSearchProvider = "wikipedia_ar" | "wikipedia_en" | "mojeek" | "duckduckgo";
export type WebSearchResponse = {
  ok: boolean;
  results: WebSearchResult[];
  provider?: WebSearchProvider;
  cached?: boolean;
  failureReason?: string;
  notice?: string;
};
export type WebPageResponse = {
  ok: boolean;
  text: string;
  url?: string;
  failureReason?: string;
  notice?: string;
};
export type WebToolOptions = {
  agent?: TeamAgentId | "unknown" | string;
  fetchImpl?: typeof fetch;
  lookup?: LookupFn;
  nowMs?: () => number;
};

type CacheEntry = { expiresAt: number; results: WebSearchResult[]; provider: WebSearchProvider };
type BudgetEntry = { calls: number[] };

const DDG_SEARCH_ENDPOINT = "https://html.duckduckgo.com/html/";
const MOJEEK_SEARCH_ENDPOINT = "https://www.mojeek.com/search";
const WIKIPEDIA_API_ENDPOINT = (lang: "ar" | "en") => `https://${lang}.wikipedia.org/w/api.php`;
const SEARCH_TIMEOUT_MS = 8_000;
const SEARCH_MAX_BYTES = 512 * 1024;
const PAGE_MAX_BYTES = 2 * 1024 * 1024;
const PAGE_MAX_CHARS = 8_000;
const CACHE_TTL_MS = 15 * 60 * 1_000;
const CACHE_LIMIT = 100;
const BUDGET_HOUR_MS = 60 * 60 * 1_000;
const BUDGET_DAY_MS = 24 * 60 * 60 * 1_000;
const BUDGET_DEFAULT_HOUR = 20;
const BUDGET_DEFAULT_DAY = 200;
const NORMAL_BROWSER_UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36";

const cache = new Map<string, CacheEntry>();
const budgets = new Map<string, BudgetEntry>();
let testOverrides: Pick<WebToolOptions, "fetchImpl" | "lookup" | "nowMs"> = {};

/** Test-only dependency injection; production callers never need to use this. */
export function setWebSearchTestOverrides(overrides: Pick<WebToolOptions, "fetchImpl" | "lookup" | "nowMs"> = {}): void {
  testOverrides = overrides;
}

/** Clear bounded in-memory state between deterministic tests or worker reloads. */
export function resetWebSearchState(): void {
  cache.clear();
  budgets.clear();
  testOverrides = {};
}

function nowMs(options: WebToolOptions): number {
  return (options.nowMs ?? testOverrides.nowMs ?? (() => Date.now()))();
}

function agentKey(options: WebToolOptions): string {
  const raw = typeof options.agent === "string" ? options.agent.trim().toLowerCase() : "unknown";
  return raw.replace(/[^a-z0-9_-]/g, "_").slice(0, 80) || "unknown";
}

function positiveBudget(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(10_000, Math.floor(parsed))) : fallback;
}

function webEnabled(): boolean {
  return (process.env.AGENT_WEB_SEARCH ?? "on").trim().toLowerCase() !== "off";
}

function redactedText(value: string, max: number): string {
  let text = redactSecrets(value).text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
  for (const pattern of SECRET_QUERY_PATTERNS) text = text.replace(new RegExp(pattern.source, pattern.flags), "[redacted-secret]");
  return text
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[redacted-email]")
    .trim()
    .slice(0, max);
}

const SECRET_QUERY_PATTERNS = [
  /\b(?:gsk|rnd)_[A-Za-z0-9_-]{8,}\b/gi,
  /\bgithub_pat_[A-Za-z0-9_]{12,}\b/gi,
  /\bsk-(?:proj-|live-|test-)?[A-Za-z0-9_-]{8,}\b/gi,
  /\b[A-Fa-f0-9]{32,}\b/g,
  /\b[A-Za-z0-9+/_=-]{48,}\b/g,
];
const INTERNAL_HOST_PATTERN = /(?:https?:\/\/)?(?:localhost|mathmentor-platform\.onrender\.com|[^\s/]+\.(?:local|internal|corp|lan|intranet)|127\.\d{1,3}\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(?::\d+)?(?:\/[^\s]*)?/gi;

/** Redact credentials, PII, internal hosts, paths, and multiline/file-content-shaped input before any provider sees it. */
export function scrubWebQuery(input: string): string {
  let query = String(input ?? "").replace(/```[\s\S]*?```/g, " ").split(/\r?\n/, 1)[0] ?? "";
  query = redactSecrets(query).text;
  for (const pattern of SECRET_QUERY_PATTERNS) query = query.replace(new RegExp(pattern.source, pattern.flags), "[redacted-secret]");
  query = query.replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[redacted-email]");
  query = query.replace(INTERNAL_HOST_PATTERN, "[redacted-internal-host]");
  query = query.replace(/\/(?:home|root|etc|var|tmp|workspace)\/[^\s]+/gi, "[redacted-path]");
  if (/[{};]|=>|\b(?:const|let|var|function|import|export|class|SELECT|CREATE\s+TABLE)\b/i.test(query)) query = "[redacted-file-content]";
  return query.replace(/\s+/g, " ").trim().slice(0, 500);
}

function auditQuery(value: string): string {
  try {
    const url = new URL(value);
    url.search = "";
    url.hash = "";
    return scrubWebQuery(url.toString());
  } catch {
    return scrubWebQuery(value);
  }
}

function resultClone(results: WebSearchResult[]): WebSearchResult[] {
  return results.map((item) => ({ ...item }));
}

function budgetCheck(agent: string, now: number): string | null {
  const entry = budgets.get(agent) ?? { calls: [] };
  entry.calls = entry.calls.filter((at) => at > now - BUDGET_DAY_MS);
  const dayMax = positiveBudget("AGENT_WEB_SEARCH_MAX_PER_DAY", BUDGET_DEFAULT_DAY);
  const hourMax = positiveBudget("AGENT_WEB_SEARCH_MAX_PER_HOUR", BUDGET_DEFAULT_HOUR);
  const hourCalls = entry.calls.filter((at) => at > now - BUDGET_HOUR_MS).length;
  if (hourCalls >= hourMax) {
    budgets.set(agent, entry);
    return "rate_limit_hour";
  }
  if (entry.calls.length >= dayMax) {
    budgets.set(agent, entry);
    return "rate_limit_day";
  }
  entry.calls.push(now);
  budgets.set(agent, entry);
  return null;
}

async function audit(input: {
  agent: string;
  query: string;
  resultCount: number;
  started: number;
  now: number;
  ok: boolean;
  failureReason?: string;
  provider?: WebSearchProvider;
}): Promise<void> {
  const knownAgent = ["mohamed", "sami", "developer", "finance"].includes(input.agent) ? (input.agent as TeamAgentId) : "unknown";
  try {
    await recordTeamWebAudit({
      agent: knownAgent,
      query: redactedText(scrubWebQuery(input.query), 180),
      resultCount: Math.max(0, Math.min(5, Math.floor(input.resultCount))),
      durationMs: Math.max(0, Math.min(900_000, input.now - input.started)),
      ok: input.ok,
      failureReason: input.failureReason ? redactedText(input.failureReason, 180) : undefined,
      provider: input.provider,
    });
  } catch {
    // A health-store outage must not turn a read-only research result into a false claim.
  }
}

function failureReason(error: unknown): string {
  if (error && typeof error === "object" && "reason" in error && typeof error.reason === "string") return error.reason;
  if (error instanceof Error && /timeout|aborted/i.test(error.name + " " + error.message)) return "timeout";
  return "network_error";
}

function decodeHtmlEntities(value: string): string {
  const named: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (whole, code: string) => {
    if (code.toLowerCase().startsWith("#x")) {
      const parsed = Number.parseInt(code.slice(2), 16);
      return Number.isFinite(parsed) ? String.fromCodePoint(Math.min(parsed, 0x10ffff)) : whole;
    }
    if (code.startsWith("#")) {
      const parsed = Number.parseInt(code.slice(1), 10);
      return Number.isFinite(parsed) ? String.fromCodePoint(Math.min(parsed, 0x10ffff)) : whole;
    }
    return named[code.toLowerCase()] ?? whole;
  });
}

function plainFragment(value: string, max: number): string {
  return redactedText(
    decodeHtmlEntities(value)
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " "),
    max,
  );
}

function resultUrl(raw: string): string | null {
  try {
    const decoded = decodeHtmlEntities(raw);
    const candidate = new URL(decoded.startsWith("//") ? `https:${decoded}` : decoded, DDG_SEARCH_ENDPOINT);
    const uddg = candidate.searchParams.get("uddg");
    const target = uddg ? new URL(uddg) : candidate;
    if (target.protocol !== "http:" && target.protocol !== "https:") return null;
    if (target.username || target.password) return null;
    target.hash = "";
    const safe = target.toString();
    if (safe !== scrubWebQuery(safe) || /\b(?:gsk|rnd|sk-|github_pat_)\b/i.test(safe)) return null;
    if (!checkWebFetchUrl(safe).ok) return null;
    return safe;
  } catch {
    return null;
  }
}

function parseSearchResults(html: string): WebSearchResult[] {
  const results: WebSearchResult[] = [];
  const anchor = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while (results.length < 5 && (match = anchor.exec(html))) {
    if (!/\bclass=["'][^"']*\bresult__a\b[^"']*["']/i.test(match[1])) continue;
    const href = /\bhref=["']([^"']+)["']/i.exec(match[1]);
    const url = resultUrl(href?.[1] ?? "");
    if (!url) continue;
    const tail = html.slice(match.index, Math.min(html.length, match.index + 8_000));
    const snippetMatch = /class=["'][^"']*\bresult__snippet\b[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i.exec(tail);
    results.push({ title: plainFragment(match[2], 300), url, snippet: plainFragment(snippetMatch?.[1] ?? "", 700) });
  }
  return results;
}

function parseMojeekResults(html: string): WebSearchResult[] {
  const results: WebSearchResult[] = [];
  const item = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
  let match: RegExpExecArray | null;
  while (results.length < 5 && (match = item.exec(html))) {
    const block = match[1];
    const heading = /<h[1-6]\b[^>]*>[\s\S]*?<a\b([^>]*)>([\s\S]*?)<\/a>[\s\S]*?<\/h[1-6]>/i.exec(block);
    const anchor = heading ?? /<a\b([^>]*)>([\s\S]*?)<\/a>/i.exec(block);
    if (!anchor) continue;
    const href = /\bhref=["']([^"']+)["']/i.exec(anchor[1]);
    const url = resultUrl(href?.[1] ?? "");
    if (!url) continue;
    const snippetMatch = /<(?:p|div)\b([^>]*)>([\s\S]*?)<\/(?:p|div)>/i.exec(block);
    const snippet = snippetMatch && /(?:snippet|description|s\b)/i.test(snippetMatch[1])
      ? snippetMatch[2]
      : snippetMatch?.[2] ?? "";
    results.push({ title: plainFragment(anchor[2], 300), url, snippet: plainFragment(snippet, 700) });
  }
  return results;
}

function parseWikipediaResults(body: string, lang: "ar" | "en"): WebSearchResult[] {
  const parsed: unknown = JSON.parse(body);
  if (!parsed || typeof parsed !== "object") return [];
  const query = (parsed as { query?: { search?: unknown } }).query;
  if (!query || !Array.isArray(query.search)) return [];
  return query.search.slice(0, 5).flatMap((value): WebSearchResult[] => {
    if (!value || typeof value !== "object") return [];
    const hit = value as { title?: unknown; snippet?: unknown };
    if (typeof hit.title !== "string" || !hit.title.trim()) return [];
    const title = plainFragment(hit.title, 300);
    const pathTitle = encodeURIComponent(hit.title.replace(/ /g, "_")).replace(/%3A/gi, ":");
    return [{
      title,
      url: `https://${lang}.wikipedia.org/wiki/${pathTitle}`,
      snippet: plainFragment(typeof hit.snippet === "string" ? hit.snippet : "", 700),
    }];
  });
}

function responseNotice(reason: string): string {
  if (reason === "disabled") return teamMessages.ar.web.disabled;
  if (reason === "rate_limit_hour" || reason === "rate_limit_day") return teamMessages.ar.web.rateLimited;
  if (reason === "empty_query") return teamMessages.ar.web.emptyQuery;
  return teamMessages.ar.web.failed;
}

function disabledSearch(agent: string, query: string, started: number, now: number): Promise<WebSearchResponse> {
  return audit({ agent, query, resultCount: 0, started, now, ok: false, failureReason: "disabled" }).then(() => ({ ok: false, results: [], failureReason: "disabled", notice: responseNotice("disabled") }));
}

async function searchProviders(scrubbed: string, key: string, options: WebToolOptions, agent: string, started: number): Promise<WebSearchResponse> {
  const fetchSearch = async (url: string, accept: string) => safeWebFetchBytes(url, {
    maxBytes: SEARCH_MAX_BYTES,
    timeoutMs: SEARCH_TIMEOUT_MS,
    truncate: true,
    lookup: options.lookup ?? testOverrides.lookup,
    fetchImpl: options.fetchImpl ?? testOverrides.fetchImpl,
    headers: { "user-agent": NORMAL_BROWSER_UA, accept },
  });
  let lastFailure = "network_error";
  const acceptResults = async (results: WebSearchResult[], provider: WebSearchProvider): Promise<WebSearchResponse | null> => {
    if (!results.length) return null;
    cache.set(key, { expiresAt: nowMs(options) + CACHE_TTL_MS, results: resultClone(results), provider });
    while (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value as string);
    await audit({ agent, query: scrubbed, resultCount: results.length, started, now: nowMs(options), ok: true, provider });
    return { ok: true, results, provider };
  };
  for (const lang of ["ar", "en"] as const) {
    const endpoint = new URL(WIKIPEDIA_API_ENDPOINT(lang));
    for (const [name, value] of Object.entries({ action: "query", list: "search", srsearch: scrubbed, format: "json", srlimit: "5" })) endpoint.searchParams.set(name, value);
    try {
      const fetched = await fetchSearch(endpoint.toString(), "application/json");
      const response = await acceptResults(parseWikipediaResults(fetched.bytes.toString("utf8"), lang), `wikipedia_${lang}`);
      if (response) return response;
    } catch (error) {
      lastFailure = failureReason(error);
    }
  }
  const providers: Array<{ provider: WebSearchProvider; endpoint: URL; parse: (body: string) => WebSearchResult[] }> = [
    { provider: "mojeek", endpoint: new URL(MOJEEK_SEARCH_ENDPOINT), parse: parseMojeekResults },
    { provider: "duckduckgo", endpoint: new URL(DDG_SEARCH_ENDPOINT), parse: parseSearchResults },
  ];
  for (const item of providers) {
    item.endpoint.searchParams.set("q", scrubbed);
    try {
      const fetched = await fetchSearch(item.endpoint.toString(), "text/html");
      const response = await acceptResults(item.parse(fetched.bytes.toString("utf8")), item.provider);
      if (response) return response;
    } catch (error) {
      lastFailure = failureReason(error);
    }
  }
  const reason = lastFailure === "network_error" ? "providers_unavailable" : lastFailure;
  await audit({ agent, query: scrubbed, resultCount: 0, started, now: nowMs(options), ok: false, failureReason: reason });
  return { ok: false, results: [], failureReason: "providers_unavailable", notice: responseNotice("providers_unavailable") };
}

export async function searchWeb(query: string, options: WebToolOptions = {}): Promise<WebSearchResponse> {
  const started = nowMs(options);
  const agent = agentKey(options);
  const scrubbed = scrubWebQuery(query);
  if (!webEnabled()) return disabledSearch(agent, scrubbed, started, nowMs(options));
  if (!scrubbed) {
    await audit({ agent, query: scrubbed, resultCount: 0, started, now: nowMs(options), ok: false, failureReason: "empty_query" });
    return { ok: false, results: [], failureReason: "empty_query", notice: responseNotice("empty_query") };
  }
  const limitReason = budgetCheck(agent, nowMs(options));
  if (limitReason) {
    await audit({ agent, query: scrubbed, resultCount: 0, started, now: nowMs(options), ok: false, failureReason: limitReason });
    return { ok: false, results: [], failureReason: limitReason, notice: responseNotice(limitReason) };
  }
  const key = scrubbed.toLowerCase();
  const cached = cache.get(key);
  if (cached && cached.expiresAt > nowMs(options)) {
    cache.delete(key);
    cache.set(key, cached);
    const results = resultClone(cached.results);
    await audit({ agent, query: scrubbed, resultCount: results.length, started, now: nowMs(options), ok: true, provider: cached.provider });
    return { ok: true, results, provider: cached.provider, cached: true };
  }
  if (cached) cache.delete(key);
  return searchProviders(scrubbed, key, options, agent, started);
}

function pageText(html: string, contentType: string): string {
  if (!/html|xhtml/i.test(contentType)) return redactedText(html, PAGE_MAX_CHARS);
  return plainFragment(html, PAGE_MAX_CHARS);
}

export async function fetchWebPage(url: string, options: WebToolOptions = {}): Promise<WebPageResponse> {
  const started = nowMs(options);
  const agent = agentKey(options);
  const query = auditQuery(url);
  if (!webEnabled()) {
    await audit({ agent, query, resultCount: 0, started, now: nowMs(options), ok: false, failureReason: "disabled" });
    return { ok: false, text: "", failureReason: "disabled", notice: responseNotice("disabled") };
  }
  const limitReason = budgetCheck(agent, nowMs(options));
  if (limitReason) {
    await audit({ agent, query, resultCount: 0, started, now: nowMs(options), ok: false, failureReason: limitReason });
    return { ok: false, text: "", failureReason: limitReason, notice: responseNotice(limitReason) };
  }
  try {
    const fetched = await safeWebFetchBytes(url, {
      maxBytes: PAGE_MAX_BYTES,
      timeoutMs: SEARCH_TIMEOUT_MS,
      lookup: options.lookup ?? testOverrides.lookup,
      fetchImpl: options.fetchImpl ?? testOverrides.fetchImpl,
      headers: { "user-agent": NORMAL_BROWSER_UA, accept: "text/html,text/plain" },
    });
    const text = pageText(fetched.bytes.toString("utf8"), fetched.contentType);
    await audit({ agent, query, resultCount: text ? 1 : 0, started, now: nowMs(options), ok: true });
    return { ok: true, text, url: auditQuery(url) };
  } catch (error) {
    const reason = failureReason(error);
    await audit({ agent, query, resultCount: 0, started, now: nowMs(options), ok: false, failureReason: reason });
    return { ok: false, text: "", failureReason: reason, notice: responseNotice(reason) };
  }
}
