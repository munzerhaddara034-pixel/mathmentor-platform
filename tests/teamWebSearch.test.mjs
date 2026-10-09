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
  assert.equal(calls.length, 1);
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
  const sent = decodeURIComponent(new URL(calls[0].url).searchParams.get("q"));
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
  assert.equal(calls.length, 1);
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
  assert.equal(calls.length, 1);
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
