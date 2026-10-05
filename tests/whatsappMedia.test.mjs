// Unit tests for the dependency-free WhatsApp media modules.
// Run: npm test   (Node >= 22.18 strips TypeScript types natively.)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  baseMime,
  categoryForMime,
  checkInboundMedia,
  checkOutboundMedia,
  INBOUND_MAX_BYTES,
  isGeminiReadableMime,
  safeFilename,
} from "../src/lib/whatsapp/media/policy.ts";
import { mediaErrorReplyAr } from "../src/lib/whatsapp/media/errorsAr.ts";
import { buildMediaMessagePayload } from "../src/lib/whatsapp/media/payload.ts";
import { detectMediaAction, parseMockExamRequest, wantsPdfReply } from "../src/lib/agent/media/captionIntent.ts";
import { latexToReadable } from "../src/lib/math/latexToReadable.ts";

test("mime allowlist + categories", () => {
  assert.equal(baseMime("audio/ogg; codecs=opus"), "audio/ogg");
  assert.equal(categoryForMime("image/jpeg"), "image");
  assert.equal(categoryForMime("application/pdf"), "document");
  assert.equal(categoryForMime("video/mp4"), "video");
  assert.equal(categoryForMime("image/svg+xml"), null);
  assert.equal(categoryForMime("application/x-msdownload"), null);
  assert.equal(isGeminiReadableMime("application/pdf"), true);
  assert.equal(isGeminiReadableMime("application/vnd.openxmlformats-officedocument.wordprocessingml.document"), false);
});

test("inbound size limit + unsupported", () => {
  assert.deepEqual(checkInboundMedia({ mimeType: "image/png", sizeBytes: 1000 }), {
    ok: true,
    category: "image",
    mimeType: "image/png",
  });
  const big = checkInboundMedia({ mimeType: "application/pdf", sizeBytes: INBOUND_MAX_BYTES + 1 });
  assert.equal(big.ok, false);
  assert.equal(big.ok === false && big.reason, "too_big");
  const bad = checkInboundMedia({ mimeType: "application/zip", sizeBytes: 10 });
  assert.equal(bad.ok === false && bad.reason, "unsupported");
  const empty = checkInboundMedia({ mimeType: "image/png", sizeBytes: 0 });
  assert.equal(empty.ok === false && empty.reason, "empty");
});

test("outbound caps per Meta type", () => {
  assert.equal(checkOutboundMedia({ category: "image", mimeType: "image/png", sizeBytes: 6 * 1024 * 1024 }).ok, false);
  assert.equal(checkOutboundMedia({ category: "document", mimeType: "application/pdf", sizeBytes: 6 * 1024 * 1024 }).ok, true);
  assert.equal(checkOutboundMedia({ category: "image", mimeType: "application/pdf", sizeBytes: 10 }).ok, false);
});

test("safe filenames", () => {
  assert.equal(safeFilename("../../etc/passwd", "text/plain"), "etc_passwd.txt");
  assert.equal(safeFilename("", "application/pdf"), "file.pdf");
  assert.equal(safeFilename("امتحان رياضيات.pdf", "application/pdf"), "امتحان_رياضيات.pdf");
});

test("Arabic error replies", () => {
  const big = mediaErrorReplyAr("too_big", { sizeMb: "34", limitMb: "20", kindAr: "الملف" });
  assert.match(big, /كبير كتير/);
  assert.match(big, /20 ميغابايت/);
  assert.match(big, /منذر حداره/);
  assert.match(mediaErrorReplyAr("unsupported", { mimeType: "application/zip" }), /مش مدعوم/);
  assert.match(mediaErrorReplyAr("download_failed"), /ما قدرت نزّل/);
  assert.doesNotMatch(big, /الطارة/);
});

test("caption intent", () => {
  assert.equal(detectMediaAction({ category: "image", readable: true }), "solve");
  assert.equal(detectMediaAction({ category: "document", readable: true }), "solve");
  assert.equal(detectMediaAction({ category: "document", readable: true, caption: "صحح هالامتحان" }), "verify_exam");
  assert.equal(detectMediaAction({ category: "document", readable: true, caption: "لخصلي ياه" }), "summarize");
  assert.equal(detectMediaAction({ category: "document", readable: true, caption: "حل التمرين 2" }), "solve");
  assert.equal(detectMediaAction({ category: "image", readable: true, caption: "احفظ" }), "store");
  assert.equal(detectMediaAction({ category: "document", readable: false }), "store");
  assert.equal(detectMediaAction({ category: "video", readable: false, caption: "حل" }), "store");
  assert.equal(wantsPdfReply("حلها وابعتلي pdf"), true);
  assert.equal(wantsPdfReply("حلها"), false);
});

test("mock exam request", () => {
  assert.deepEqual(parseMockExamRequest("ابعتلي امتحان تجريبي brevet"), { matched: true, track: "brevet" });
  assert.equal(parseMockExamRequest("mock exam for LS").matched, true);
  assert.equal(parseMockExamRequest("شو الأخبار").matched, false);
});

test("Meta media payloads", () => {
  const doc = buildMediaMessagePayload({
    to: "+961 76 532 421",
    type: "document",
    media: { id: "123" },
    caption: "الحل",
    filename: "sol.pdf",
    replyToMessageId: "wamid.X",
  });
  assert.equal(doc.to, "96176532421");
  assert.deepEqual(doc.document, { id: "123", caption: "الحل", filename: "sol.pdf" });
  assert.deepEqual(doc.context, { message_id: "wamid.X" });
  const audio = buildMediaMessagePayload({ to: "96176532421", type: "audio", media: { link: "https://x/a.ogg" }, caption: "x" });
  assert.deepEqual(audio.audio, { link: "https://x/a.ogg" });
});

test("LaTeX → readable (WhatsApp + ASCII PDF)", () => {
  assert.equal(latexToReadable("x^{2}-5x+6=0"), "x²-5x+6=0");
  assert.equal(latexToReadable("\\frac{3x^{2}+1}{x^{2}-2}"), "(3x²+1)/(x²-2)");
  assert.equal(latexToReadable("\\lim\\limits_{x \\to +\\infty} f(x) = 3"), "lim_(x → +∞) f(x) = 3");
  assert.equal(latexToReadable("\\sqrt{x+1}", { ascii: true }), "sqrt(x+1)");
  assert.equal(latexToReadable("x \\in \\mathbb{R}", { ascii: true }), "x in R");
  assert.equal(latexToReadable("\\frac{1}{x}", { ascii: true }), "1/x");
});

test("LaTeX edge cases seen from Gemini output", () => {
  assert.equal(latexToReadable("S = \\{2, 3\\}"), "S = {2, 3}");
  assert.equal(latexToReadable("x_{1} = \\frac{-b - \\sqrt{\\Delta}}{2a}"), "x₁ = (-b - √(Δ))/(2a)");
  assert.equal(latexToReadable("بما أن \\ند \\Delta > 0"), "بما أن ند Δ > 0");
  assert.equal(latexToReadable("x_{1}", { ascii: true }), "x_1");
});

test("unreadable documents are stored even with a caption", () => {
  assert.equal(detectMediaAction({ category: "document", readable: false, caption: "لخصلي ياه" }), "store");
});

test("asciiForPdf keeps PDF text Latin-only and readable", async () => {
  const { asciiForPdf } = await import("../src/lib/math/latexToReadable.ts");
  assert.equal(asciiForPdf("find $x$ when $2x+5=10$ — “now”"), 'find x when 2x+5=10 - "now"');
  assert.equal(asciiForPdf("Brevet Mathematics — Official"), "Brevet Mathematics - Official");
  assert.equal(asciiForPdf("x² − 5x + 6"), "x^2 - 5x + 6");
});

test("quad separators and primes", async () => {
  const { asciiForPdf } = await import("../src/lib/math/latexToReadable.ts");
  assert.equal(latexToReadable("x_{1} = 2 \\quad x_{2} = 3"), "x₁ = 2 ; x₂ = 3");
  assert.equal(asciiForPdf("Compute f′(x) and P(A∩B), θ"), "Compute f'(x) and P(A n B), theta");
});
