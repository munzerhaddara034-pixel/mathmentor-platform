import { test, after } from "node:test";
import assert from "node:assert/strict";
import { setPersistentStoreOverride } from "../src/lib/dataDir.ts";
import { verifyReply } from "../src/lib/team/agentLoop.ts";
import {
  fetchWebPage,
  resetWebSearchState,
  searchWeb,
  setWebSearchTestOverrides,
} from "../src/lib/team/webSearch.ts";

const publicLookup = async () => [{ address: "93.184.216.34" }];
const originalEnv = {
  enabled: process.env.AGENT_WEB_SEARCH,
  hour: process.env.AGENT_WEB_SEARCH_MAX_PER_HOUR,
  day: process.env.AGENT_WEB_SEARCH_MAX_PER_DAY,
};
const values = new Map();
setPersistentStoreOverride({
  async getJSON(key) { return values.has(key) ? structuredClone(values.get(key)) : null; },
  async setJSON(key, value) { values.set(key, structuredClone(value)); },
});

function restoreEnv() {
  if (originalEnv.enabled === undefined) delete process.env.AGENT_WEB_SEARCH;
  else process.env.AGENT_WEB_SEARCH = originalEnv.enabled;
  if (originalEnv.hour === undefined) delete process.env.AGENT_WEB_SEARCH_MAX_PER_HOUR;
  else process.env.AGENT_WEB_SEARCH_MAX_PER_HOUR = originalEnv.hour;
  if (originalEnv.day === undefined) delete process.env.AGENT_WEB_SEARCH_MAX_PER_DAY;
  else process.env.AGENT_WEB_SEARCH_MAX_PER_DAY = originalEnv.day;
  resetWebSearchState();
}

function htmlResult(url = "https://example.com/math") {
  return `<html><div class="result"><a class="result__a" href="${url}">A &amp; result</a><a class="result__snippet">A useful snippet.</a></div></html>`;
}

function stubFetch(body, calls = []) {
  return async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response(body, { status: 200, headers: { "content-type": "text/html" } });
  };
}

function sequenceFetch(responses, calls = []) {
  return async (url, init) => {
    calls.push({ url: String(url), init });
    const next = responses[calls.length - 1];
    if (next instanceof Error) throw next;
    const body = typeof next === "string" ? next : JSON.stringify(next);
    const contentType = new URL(String(url)).hostname.endsWith("wikipedia.org") ? "application/json" : "text/html";
    return new Response(body, { status: 200, headers: { "content-type": contentType } });
  };
}

const emptyWiki = { query: { search: [] } };
function mojeekResult(url = "https://example.com/mojeek") {
  return `<ul><li class="default"><h2><a href="${url}">Mojeek result</a></h2><p class="s">A Mojeek snippet.</p></li></ul>`;
}

after(() => {
  restoreEnv();
  setPersistentStoreOverride(null);
});

test("private/blocked web host is rejected before the fetch layer", async () => {
  restoreEnv();
  let called = false;
  const result = await fetchWebPage("http://127.0.0.1/private", {
    agent: "mohamed",
    lookup: publicLookup,
    fetchImpl: async () => { called = true; throw new Error("network must not run"); },
  });
  assert.equal(result.ok, false);
  assert.equal(called, false);
  assert.match(result.failureReason, /ip_literal|internal|private/);
});

test("oversize search response is truncated at the hard 512KB cap", async () => {
  restoreEnv();
  const calls = [];
  const body = `${htmlResult()}${"x".repeat(600 * 1024)}`;
  const result = await searchWeb("bounded oversize response", { agent: "sami", lookup: publicLookup, fetchImpl: stubFetch(body, calls) });
  assert.equal(result.ok, true);
  assert.equal(result.results.length, 1);
  assert.equal(calls.length, 4);
});

test("secret-shaped and PII query content is scrubbed before the request", async () => {
  restoreEnv();
  const calls = [];
  const result = await searchWeb("find gsk_abcdefghijklmnop email me@example.com at localhost:3000 and 10.0.0.2", {
    agent: "finance",
    lookup: publicLookup,
    fetchImpl: stubFetch(htmlResult(), calls),
  });
  assert.equal(result.ok, true);
  const requestUrl = new URL(calls[0].url);
  const sent = requestUrl.searchParams.get("srsearch") ?? requestUrl.searchParams.get("q");
  assert.doesNotMatch(sent, /gsk_|me@example\.com|localhost|10\.0\.0\.2/);
  assert.match(sent, /redacted/);
});

test("per-agent hourly rate limit returns a clear failure without another request", async () => {
  restoreEnv();
  process.env.AGENT_WEB_SEARCH_MAX_PER_HOUR = "1";
  const calls = [];
  const options = { agent: "developer", lookup: publicLookup, fetchImpl: stubFetch(htmlResult(), calls) };
  assert.equal((await searchWeb("first budget call", options)).ok, true);
  const second = await searchWeb("second budget call", options);
  assert.equal(second.ok, false);
  assert.equal(second.failureReason, "rate_limit_hour");
  assert.equal(calls.length, 4);
});

test("identical scrubbed query is served from the bounded cache", async () => {
  restoreEnv();
  const calls = [];
  const options = { agent: "sami", lookup: publicLookup, fetchImpl: stubFetch(htmlResult(), calls) };
  const first = await searchWeb("cacheable query", options);
  const second = await searchWeb("cacheable query", options);
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(second.cached, true);
  assert.equal(calls.length, 4);
});

test("Wikipedia search hits after Arabic is empty and returns canonical English article URLs", async () => {
  restoreEnv();
  const calls = [];
  const result = await searchWeb("wikipedia topic", {
    agent: "sami",
    lookup: publicLookup,
    fetchImpl: sequenceFetch([emptyWiki, { query: { search: [{ title: "Ada Lovelace", snippet: "<span>Early <b>programmer</b></span>" }] } }], calls),
  });
  assert.equal(result.ok, true);
  assert.equal(result.provider, "wikipedia_en");
  assert.equal(result.results[0].url, "https://en.wikipedia.org/wiki/Ada_Lovelace");
  assert.equal(result.results[0].snippet, "Early programmer");
  assert.match(new URL(calls[0].url).hostname, /^ar\.wikipedia\.org$/);
  assert.match(new URL(calls[1].url).hostname, /^en\.wikipedia\.org$/);
  assert.equal(calls.length, 2);
});

test("empty Wikipedia results fall back to Mojeek and record the answering provider", async () => {
  restoreEnv();
  const calls = [];
  const result = await searchWeb("mojeek fallback", {
    agent: "sami",
    lookup: publicLookup,
    fetchImpl: sequenceFetch([emptyWiki, emptyWiki, mojeekResult()], calls),
  });
  assert.equal(result.ok, true);
  assert.equal(result.provider, "mojeek");
  assert.equal(result.results[0].title, "Mojeek result");
  assert.equal(result.results[0].snippet, "A Mojeek snippet.");
  assert.equal(new URL(calls[2].url).hostname, "www.mojeek.com");
  assert.equal(calls.length, 3);
  assert.equal(values.get("team-agent-health.json").webCalls.at(-1).provider, "mojeek");
});

test("empty Wikipedia and Mojeek results fall back to DuckDuckGo last", async () => {
  restoreEnv();
  const calls = [];
  const result = await searchWeb("duckduckgo fallback", {
    agent: "sami",
    lookup: publicLookup,
    fetchImpl: sequenceFetch([emptyWiki, emptyWiki, "<html></html>", htmlResult()], calls),
  });
  assert.equal(result.ok, true);
  assert.equal(result.provider, "duckduckgo");
  assert.equal(new URL(calls[3].url).hostname, "html.duckduckgo.com");
  assert.deepEqual(calls.map(({ url }) => new URL(url).hostname), ["ar.wikipedia.org", "en.wikipedia.org", "www.mojeek.com", "html.duckduckgo.com"]);
});

test("all search providers failing returns a localized honest failure with no invented results", async () => {
  restoreEnv();
  const calls = [];
  const result = await searchWeb("unavailable providers", {
    agent: "developer",
    lookup: publicLookup,
    fetchImpl: sequenceFetch([new Error("offline"), new Error("offline"), new Error("offline"), new Error("offline")], calls),
  });
  assert.equal(result.ok, false);
  assert.deepEqual(result.results, []);
  assert.equal(result.provider, undefined);
  assert.equal(result.failureReason, "providers_unavailable");
  assert.match(result.notice, /تعذّر الوصول/);
  assert.equal(calls.length, 4);
  assert.equal(values.get("team-agent-health.json").webCalls.at(-1).ok, false);
});

test("Wikipedia provider is persisted in the web-search audit record", async () => {
  restoreEnv();
  const result = await searchWeb("Arabic encyclopedia", {
    agent: "mohamed",
    lookup: publicLookup,
    fetchImpl: sequenceFetch([{ query: { search: [{ title: "عنوان", snippet: "<b>مقتطف</b>" }] } }]),
  });
  assert.equal(result.provider, "wikipedia_ar");
  assert.equal(values.get("team-agent-health.json").webCalls.at(-1).provider, "wikipedia_ar");
});

test("kill switch disables both tools gracefully and performs no request", async () => {
  restoreEnv();
  process.env.AGENT_WEB_SEARCH = "off";
  let calls = 0;
  const fetchImpl = async () => { calls += 1; throw new Error("network must not run"); };
  const search = await searchWeb("disabled", { agent: "mohamed", lookup: publicLookup, fetchImpl });
  const page = await fetchWebPage("https://example.com", { agent: "mohamed", lookup: publicLookup, fetchImpl });
  assert.equal(search.ok, false);
  assert.equal(search.failureReason, "disabled");
  assert.equal(page.ok, false);
  assert.equal(page.failureReason, "disabled");
  assert.match(search.notice, /متوقف|disabled/i);
  assert.equal(calls, 0);
});

test("missing citation after a successful web tool is refused by the verification gate", () => {
  const result = verifyReply({
    text: "هذه إجابة طويلة بما يكفي لكنها بلا رابط مصدر واضح.",
    intent: "سؤال عام",
    tools: {
      names: ["web_search"],
      outputs: ['{"ok":true,"results":[{"url":"https://example.com/math"}]}'],
      webUsed: true,
      webSources: ["https://example.com/math"],
    },
  });
  assert.equal(result.ok, false);
  assert.match(result.couldNotVerify, /رابط مصدر|citation|source/i);
});
