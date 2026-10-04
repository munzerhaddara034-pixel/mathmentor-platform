// Inbound WhatsApp provenance: Meta X-Hub-Signature-256, Twilio X-Twilio-Signature, UltraMsg shared
// secret; unverified providers never get privileged actions. Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  inboundProvenance,
  publicUrlCandidates,
  twilioSignature,
  ultraMsgSecretMatches,
  verifyTwilioSignature,
} from "../src/lib/security/webhookProvenance.ts";

const RAW = JSON.stringify({ object: "whatsapp_business_account", entry: [] });
const metaSig = (secret, raw = RAW) => `sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`;

test("Meta: secret set → valid signature is privileged, wrong / missing → 401", () => {
  const ok = inboundProvenance({ source: "meta", provider: "meta", rawBody: RAW, appSecret: "s3", metaSignatureHeader: metaSig("s3") });
  assert.deepEqual([ok.ok, ok.privileged], [true, true]);
  assert.equal(inboundProvenance({ source: "meta", provider: "meta", rawBody: RAW, appSecret: "s3", metaSignatureHeader: metaSig("x") }).status, 401);
  assert.equal(inboundProvenance({ source: "meta", provider: "meta", rawBody: RAW, appSecret: "s3" }).status, 401);
  assert.equal(inboundProvenance({ source: "meta", provider: "meta", rawBody: `${RAW} `, appSecret: "s3", metaSignatureHeader: metaSig("s3") }).status, 401);
});

test("Meta: secret unset → accepted but unprivileged, with a warning", () => {
  const d = inboundProvenance({ source: "meta", provider: "meta", rawBody: RAW });
  assert.equal(d.ok, true);
  assert.equal(d.verified, false);
  assert.equal(d.privileged, false);
  assert.match(d.warning, /WHATSAPP_APP_SECRET/);
});

test("Twilio signature: documented algorithm (url + sorted key/value, HMAC-SHA1, base64)", () => {
  const token = "12345";
  const url = "https://mycompany.com/myapp.php?foo=1&bar=2";
  const params = [["CallSid", "CA1234567890ABCDE"], ["Caller", "+12349013030"], ["Digits", "1234"], ["From", "+12349013030"], ["To", "+18005551212"]];
  const data = url + "CallSidCA1234567890ABCDECaller+12349013030Digits1234From+12349013030To+18005551212";
  const expected = createHmac("sha1", token).update(data).digest("base64");
  assert.equal(twilioSignature(token, url, [...params].reverse()), expected);
  assert.equal(verifyTwilioSignature({ authToken: token, urls: ["http://internal:10000/x", url], params, signatureHeader: expected }), true);
  assert.equal(verifyTwilioSignature({ authToken: token, urls: [url], params: [...params, ["Body", "موافق"]], signatureHeader: expected }), false);
  assert.equal(verifyTwilioSignature({ authToken: token, urls: [url], params, signatureHeader: null }), false);
});

test("Twilio provenance: token set → must verify; unset → unprivileged (401 if Meta is the provider and its secret is set)", () => {
  const url = "https://mathmentor.example/api/agent/whatsapp-voice";
  const params = [["From", "whatsapp:+96176532421"], ["Body", "موافق"]];
  const sig = twilioSignature("tok", url, params);
  const good = inboundProvenance({ source: "twilio", provider: "twilio", rawBody: null, twilio: { authToken: "tok", urls: [url], params, signatureHeader: sig } });
  assert.deepEqual([good.ok, good.privileged], [true, true]);
  const forged = inboundProvenance({ source: "twilio", provider: "twilio", rawBody: null, twilio: { authToken: "tok", urls: [url], params, signatureHeader: "AAAA" } });
  assert.equal(forged.status, 401);
  const missing = inboundProvenance({ source: "twilio", provider: "twilio", rawBody: null, twilio: { authToken: "tok", urls: [url], params } });
  assert.equal(missing.status, 401);
  const unset = inboundProvenance({ source: "twilio", provider: "twilio", rawBody: null, twilio: { urls: [url], params } });
  assert.deepEqual([unset.ok, unset.privileged], [true, false]);
  const metaProvider = inboundProvenance({ source: "twilio", provider: "meta", rawBody: null, appSecret: "s", twilio: { urls: [url], params } });
  assert.equal(metaProvider.status, 401);
});

test("UltraMsg: shared secret (?secret= / x-webhook-secret) in constant time", () => {
  assert.equal(ultraMsgSecretMatches("abc", ["", "abc"]), true);
  assert.equal(ultraMsgSecretMatches("abd", ["abc"]), false);
  assert.equal(ultraMsgSecretMatches("", ["abc"]), false);
  const good = inboundProvenance({ source: "ultramsg", provider: "ultramsg", rawBody: "{}", ultramsg: { provided: "w1", dedicatedSecret: "w1" } });
  assert.deepEqual([good.ok, good.privileged], [true, true]);
  const viaAgentSecret = inboundProvenance({ source: "ultramsg", provider: "ultramsg", rawBody: "{}", ultramsg: { provided: "a1", fallbackSecret: "a1" } });
  assert.equal(viaAgentSecret.privileged, true);
  assert.equal(inboundProvenance({ source: "ultramsg", provider: "ultramsg", rawBody: "{}", ultramsg: { provided: "nope", dedicatedSecret: "w1" } }).status, 401);
  assert.equal(inboundProvenance({ source: "ultramsg", provider: "ultramsg", rawBody: "{}", ultramsg: { dedicatedSecret: "w1" } }).status, 401);
  const unconfigured = inboundProvenance({ source: "ultramsg", provider: "ultramsg", rawBody: "{}", ultramsg: { fallbackSecret: "a1" } });
  assert.deepEqual([unconfigured.ok, unconfigured.privileged], [true, false]);
  // Meta is the provider and its secret is set: an unsigned UltraMsg-shaped payload can't bypass it.
  assert.equal(inboundProvenance({ source: "ultramsg", provider: "meta", rawBody: "{}", appSecret: "s", ultramsg: {} }).status, 401);
  // A forged Meta header on an UltraMsg body must still verify.
  assert.equal(inboundProvenance({ source: "ultramsg", provider: "ultramsg", rawBody: "{}", appSecret: "s", metaSignatureHeader: "sha256=00" }).status, 401);
});

test("public URL candidates include the forwarded public https URL", () => {
  const headers = new Headers({ "x-forwarded-host": "mathmentor-platform.onrender.com", "x-forwarded-proto": "https" });
  const urls = publicUrlCandidates("http://localhost:10000/api/agent/whatsapp-voice?secret=x", headers, "https://mathmentor.example");
  assert.ok(urls.includes("https://mathmentor-platform.onrender.com/api/agent/whatsapp-voice?secret=x"));
  assert.ok(urls.includes("https://mathmentor.example/api/agent/whatsapp-voice?secret=x"));
});
