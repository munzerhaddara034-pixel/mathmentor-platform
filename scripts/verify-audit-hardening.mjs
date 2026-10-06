// Manual verification for the audit hardening (not part of `npm test`).
// Run: node --import ./tests/support/register.mjs scripts/verify-audit-hardening.mjs
import assert from "node:assert/strict";
import { compileFunction } from "../src/lib/studio/functionPlot.ts";
import { readUploadFile, sniffUpload, UPLOAD_MAX_BYTES } from "../src/lib/security/uploads.ts";

const results = [];
async function check(name, fn) {
  try {
    await fn();
    results.push(`ok   ${name}`);
  } catch (error) {
    results.push(`FAIL ${name}: ${error.message}`);
  }
}
const png = () =>
  new File([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 1])], "note.png");

// 1) Hostile board expressions must not execute.
await check("hostile expression does not execute", () => {
  let pwned = false;
  globalThis.__mmPwn = () => {
    pwned = true;
  };
  const fn = compileFunction("x);globalThis.__mmPwn();(");
  fn(1);
  assert.equal(pwned, false);
  assert.ok(Number.isNaN(fn(2)));
  delete globalThis.__mmPwn;
});
await check("property access / call chain is rejected", () => {
  assert.ok(Number.isNaN(compileFunction('constructor.constructor("return 1")()')(1)));
});
// 2) Legitimate maths still renders.
await check("sin/cos/pi/e still compile", () => {
  const fn = compileFunction("sin(x) + cos(x) + pi + e");
  assert.ok(Math.abs(fn(0) - (0 + 1 + Math.PI + Math.E)) < 1e-9);
});
await check("^ keeps working and log() stays natural log", () => {
  assert.ok(Math.abs(compileFunction("x^2")(3) - 9) < 1e-9);
  assert.ok(Math.abs(compileFunction("log(e)")(0) - 1) < 1e-9);
  assert.ok(Math.abs(compileFunction("ln(e)")(0) - 1) < 1e-9);
});
// 3) Upload policy.
await check("real png passes and gets our extension", async () => {
  const ok = await readUploadFile(png(), ["image"]);
  assert.equal(ok.ok, true);
  assert.equal(ok.ext, "png");
});
await check("html declared as image/png is rejected", async () => {
  const html = new File([Buffer.from("<html><script>alert(1)</script></html>")], "evil.html", { type: "image/png" });
  const bad = await readUploadFile(html, ["image"]);
  assert.equal(bad.ok, false);
  assert.equal(bad.status, 415);
});
await check("oversize file is rejected before buffering", async () => {
  const big = new File([Buffer.alloc(UPLOAD_MAX_BYTES.image + 1)], "big.png", { type: "image/png" });
  const tooBig = await readUploadFile(big, ["image"]);
  assert.equal(tooBig.ok, false);
  assert.equal(tooBig.status, 413);
});
await check("magic bytes drive the extension", () => {
  assert.equal(sniffUpload(Buffer.from([0xff, 0xd8, 0xff, 0, 0, 0, 0, 0, 0, 0, 0, 0])).ext, "jpg");
  assert.equal(sniffUpload(Buffer.from("%PDF-1.7")), null);
  assert.equal(sniffUpload(Buffer.concat([Buffer.from("%PDF-1.7"), Buffer.alloc(8)])).ext, "pdf");
});

console.log(results.join("\n"));
if (results.some((row) => row.startsWith("FAIL"))) process.exitCode = 1;