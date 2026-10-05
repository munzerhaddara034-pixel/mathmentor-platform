// SSRF guard used by /api/bot for caller-supplied media URLs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sf = await import("../src/lib/security/safeFetch.ts");
const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const publicLookup = async () => [{ address: "157.240.1.1" }];

test("URL checks: https only, no creds/ports/IP literals, allow-listed hosts only", () => {
  const allowed = sf.allowedMediaHosts({ NEXT_PUBLIC_APP_URL: "https://app.example.org", MEDIA_FETCH_ALLOWED_HOSTS: ".cdn.example.net" });
  const ok = (u) => sf.checkFetchUrl(u, allowed);
  assert.equal(ok("https://lookaside.fbsbx.com/whatsapp_business/attachments/?mid=1").ok, true);
  assert.equal(ok("https://mmg.whatsapp.net/v/t62/abc.ogg").ok, true);
  assert.equal(ok("https://api.twilio.com/2010-04-01/Accounts/AC1/Messages/MM1/Media/ME1").ok, true);
  assert.equal(ok("https://app.example.org/voice.ogg").ok, true);
  assert.equal(ok("https://a.cdn.example.net/x.ogg").ok, true);
  assert.equal(ok("https://mathmentor-platform.onrender.com/x").ok, true);
  const reasons = {
    "http://lookaside.fbsbx.com/x": "https_only",
    "file:///etc/passwd": "https_only",
    "https://user:pw@lookaside.fbsbx.com/x": "credentials_in_url",
    "https://lookaside.fbsbx.com:8443/x": "port_not_allowed",
    "https://169.254.169.254/latest/meta-data/": "ip_literal_not_allowed",
    "https://[::1]/x": "ip_literal_not_allowed",
    "https://evil.example.com/x": "host_not_allowed",
    "https://whatsapp.net.evil.com/x": "host_not_allowed",
    "https://evilwhatsapp.net/x": "host_not_allowed",
    "https://localhost/x": "host_not_allowed",
    "not a url": "invalid_url",
  };
  for (const [url, reason] of Object.entries(reasons)) assert.deepEqual(ok(url), { ok: false, reason }, url);
});

test("blocked address ranges (private, loopback, link-local/metadata, CGNAT, ULA, mapped)", () => {
  for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1", "::1", "::", "fe80::1", "fd00:ec2::254", "fc00::1", "::ffff:127.0.0.1", "::ffff:10.0.0.1", "not-an-ip"]) {
    assert.equal(sf.isBlockedAddress(ip), true, ip);
  }
  for (const ip of ["157.240.1.1", "8.8.8.8", "172.32.0.1", "2a03:2880:f12f::1", "::ffff:8.8.8.8"]) {
    assert.equal(sf.isBlockedAddress(ip), false, ip);
  }
});

test("DNS rebinding style: allow-listed host resolving to a private IP is refused", async () => {
  await assert.rejects(
    sf.assertSafeFetchTarget("https://lookaside.fbsbx.com/x", { lookup: async () => [{ address: "157.240.1.1" }, { address: "10.0.0.5" }] }),
    (error) => error instanceof sf.BlockedFetchError && error.reason === "private_address",
  );
  await assert.rejects(sf.assertSafeFetchTarget("https://lookaside.fbsbx.com/x", { lookup: async () => [] }), /dns_failed/);
  const url = await sf.assertSafeFetchTarget("https://lookaside.fbsbx.com/x", { lookup: publicLookup });
  assert.equal(url.hostname, "lookaside.fbsbx.com");
});

test("redirects are re-validated hop by hop; size cap enforced", async () => {
  const calls = [];
  const redirectToMetadata = async (url) => {
    calls.push(String(url));
    return new Response(null, { status: 302, headers: { location: "https://169.254.169.254/latest/meta-data/" } });
  };
  await assert.rejects(
    sf.safeFetchBytes("https://lookaside.fbsbx.com/x", { lookup: publicLookup, fetchImpl: redirectToMetadata }),
    /ip_literal_not_allowed/,
  );
  assert.equal(calls.length, 1, "the redirect target is never fetched");

  let hop = 0;
  const redirectThenOk = async () => {
    hop += 1;
    if (hop === 1) return new Response(null, { status: 301, headers: { location: "https://mmg.whatsapp.net/a.ogg" } });
    return new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "content-type": "audio/ogg" } });
  };
  const ok = await sf.safeFetchBytes("https://lookaside.fbsbx.com/x", { lookup: publicLookup, fetchImpl: redirectThenOk });
  assert.equal(ok.bytes.length, 3);
  assert.equal(ok.contentType, "audio/ogg");

  const big = async () => new Response(new Uint8Array(64), { status: 200 });
  await assert.rejects(sf.safeFetchBytes("https://lookaside.fbsbx.com/x", { lookup: publicLookup, fetchImpl: big, maxBytes: 10 }), /too_large/);

  const loop = async () => new Response(null, { status: 302, headers: { location: "https://lookaside.fbsbx.com/again" } });
  await assert.rejects(sf.safeFetchBytes("https://lookaside.fbsbx.com/x", { lookup: publicLookup, fetchImpl: loop }), /too_many_redirects/);
});

test("/api/bot fetches media only through safeFetchBytes", () => {
  const source = read("src/app/api/bot/route.ts");
  assert.ok(source.includes("safeFetchBytes(mediaUrl"));
  assert.ok(!/\bfetch\(mediaUrl/.test(source), "no raw fetch of the caller URL");
});
