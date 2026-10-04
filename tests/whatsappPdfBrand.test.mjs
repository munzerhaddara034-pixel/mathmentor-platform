// Branded WhatsApp PDFs (محمد): Arabic shaping + bidi, embedded fonts, «منذر حداره · MathMentor»
// header/footer, file name, PDF policy (always / on request), bare «PDF» resend, failure notes.
// No network. Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { inflateSync } from "node:zlib";
import { shapeArabic, visualOrder, paragraphIsRtl } from "../src/lib/pdf/arabicText.ts";
import { brandedPdfFilename, buildBrandedPdf, loadPdfFonts, MATHMENTOR_BRAND, PLATFORM_OWNER_AR } from "../src/lib/pdf/brandedPdf.ts";
import { pdfReplyMode, shouldSendPdf, wantsPdfReply } from "../src/lib/agent/media/captionIntent.ts";
import {
  answerMath,
  isBarePdfRequest,
  PDF_NOTHING_TO_RESEND_AR,
  PDF_SENT_AR,
  runAgentTurn,
  withNoteBeforeSignature,
} from "../src/lib/whatsapp/agentCore.ts";
import { MEDIA_SIGNATURE_AR } from "../src/lib/whatsapp/media/errorsAr.ts";
import { renderSolutionPdf, SOLUTION_PDF_CAPTION_AR, SOLUTION_PDF_FILENAME } from "../src/lib/agent/media/solutionFormat.ts";

const WRONG_SPELLING = "حدار" + "ة"; // never the brand spelling

function cp(text) {
  return Array.from(text).map((c) => c.codePointAt(0).toString(16));
}

/** Decode every FlateDecode stream of a PDF (to inspect ToUnicode maps and content). */
function streams(pdf) {
  const out = [];
  let at = 0;
  for (;;) {
    const s = pdf.indexOf("stream\n", at, "latin1");
    if (s < 0) break;
    const e = pdf.indexOf("\nendstream", s, "latin1");
    const dictStart = pdf.lastIndexOf("<<", s, "latin1");
    const dict = pdf.toString("latin1", dictStart, s);
    const body = pdf.subarray(s + 7, e);
    out.push({ dict, data: dict.includes("FlateDecode") ? inflateSync(body) : body });
    at = e + 10;
  }
  return out;
}

/** Unicode text recoverable from the ToUnicode maps (what a copy-paste would give, in glyph order). */
function toUnicodeChars(pdf) {
  const chars = new Set();
  for (const { data } of streams(pdf)) {
    const text = data.toString("latin1");
    if (!text.includes("beginbfchar")) continue;
    for (const m of text.matchAll(/<[0-9a-f]{4}> <([0-9a-f]+)>/g)) {
      const hex = m[1];
      let s = "";
      for (let i = 0; i < hex.length; i += 4) s += String.fromCharCode(parseInt(hex.slice(i, i + 4), 16));
      chars.add(s);
    }
  }
  return chars;
}

const sampleSolution = {
  summary: "Quadratic",
  finalAnswer: "S = {2 ; 3}",
  finalAnswerLatex: "S=\\{2\\,;\\,3\\}",
  examTip: { en: "Check the discriminant.", fr: "", ar: "احسب المميّز Δ أولاً وتأكّد من إشارته." },
  studyKind: "algebra",
  given: { latex: "x^{2}-5x+6=0", aimEn: "Solve in R", aimAr: "حلّ المعادلة في ℝ" },
  steps: [
    {
      title: "Discriminant",
      titleAr: "حساب المميّز",
      latex: "\\Delta=b^{2}-4ac=25-24=1",
      explanationEn: "Delta > 0 so two roots.",
      explanationFr: "",
      explanationAr: "بما أنّ Δ > 0، للمعادلة حلّان حقيقيان مختلفان.",
    },
    {
      title: "Roots",
      titleAr: "إيجاد الحلول",
      latex: "x_{1}=\\frac{5-1}{2}=2 \\quad x_{2}=\\frac{5+1}{2}=3",
      explanationEn: "Quadratic formula.",
      explanationFr: "",
      explanationAr: "نطبّق القانون العام: x = (−b ± √Δ) / 2a.",
      theoremAr: "القانون العام لحل معادلة من الدرجة الثانية",
    },
  ],
  avatarScript: {},
  canvasTimeline: {},
  timeline: {},
  topic: "Quadratic equations",
  topicTag: "algebra",
  track: "terminale-ls",
  language: "ar",
  source: "gemini",
  needsRetake: false,
};

test("Arabic shaping: contextual forms + lam-alef ligature, harakat dropped", () => {
  // م (initial) ن (medial) ذ (final, R-joining) · space · ح (initial) د (final) ا (isolated) ر (isolated) ه (isolated)
  assert.deepEqual(cp(shapeArabic("منذر")), ["fee3", "fee8", "feac", "fead"]);
  assert.deepEqual(cp(shapeArabic("حداره")), ["fea3", "feaa", "fe8d", "fead", "fee9"]);
  assert.deepEqual(cp(shapeArabic("لا")), ["fefb"]);
  assert.deepEqual(cp(shapeArabic("الأستاذ")).slice(0, 2), ["fe8d", "fef7"]);
  assert.deepEqual(cp(shapeArabic("حلّ")), ["fea3", "fede"]);
});

test("bidi: Arabic right-to-left, maths stays left-to-right, paired brackets keep their side", () => {
  const shaped = shapeArabic("الجواب: x = 2");
  assert.equal(paragraphIsRtl(shaped), true);
  const visual = visualOrder(shaped, true);
  assert.ok(visual.startsWith("x = 2"), visual);
  assert.ok(visualOrder(shapeArabic("الجواب النهائي: S = {2 ; 3}"), true).startsWith("S = {2 ; 3}"));
  assert.equal(visualOrder("f(x) = 2x + 1", false), "f(x) = 2x + 1");
  // A formula inside an Arabic sentence stays one left-to-right run.
  assert.ok(visualOrder(shapeArabic("حل المعادلة x² − 5x + 6 = 0 وابعتلي الحل"), true).includes("x² − 5x + 6 = 0"));
  // Numbered Arabic step: digits are weak, the paragraph is RTL and «1)» sits at the right edge.
  assert.equal(paragraphIsRtl("1) تحديد المعاملات"), true);
  assert.ok(visualOrder(shapeArabic("1) تحديد"), true).endsWith("(1"));
});

test("brand constants: «منذر حداره · MathMentor», file name, caption (never the ة spelling)", () => {
  assert.equal(PLATFORM_OWNER_AR, "منذر حداره");
  assert.equal(MATHMENTOR_BRAND.headerAr, "منذر حداره · MathMentor");
  assert.equal(MATHMENTOR_BRAND.headerLatin, "Munzer Haddara · MathMentor");
  assert.equal(SOLUTION_PDF_FILENAME, "MathMentor-Munzer-Haddara-solution.pdf");
  assert.equal(brandedPdfFilename("mock-exam-brevet"), "MathMentor-Munzer-Haddara-mock-exam-brevet.pdf");
  assert.match(SOLUTION_PDF_CAPTION_AR, /منذر حداره · MathMentor/);
  for (const s of [MATHMENTOR_BRAND.headerAr, MATHMENTOR_BRAND.footer, SOLUTION_PDF_CAPTION_AR, PDF_SENT_AR, MEDIA_SIGNATURE_AR]) {
    assert.ok(!s.includes(WRONG_SPELLING), s);
  }
});

test("no source file spells the brand «حدارة»", () => {
  const root = path.resolve(import.meta.dirname, "../src");
  const bad = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(ts|tsx|mjs|js|json)$/.test(name) && readFileSync(full, "utf8").includes(WRONG_SPELLING)) bad.push(full);
    }
  };
  walk(root);
  assert.deepEqual(bad, []);
});

test("embedded fonts parse and cover Arabic presentation forms, Latin and maths symbols", () => {
  const fonts = loadPdfFonts();
  for (const code of [0xfee3, 0xfefb, 0xfe8d, 0x0627]) assert.ok(fonts.arabic.cmap.has(code), code.toString(16));
  for (const ch of "Mx²√≤≥∞πℝΔ→−") assert.ok(fonts.latin.cmap.has(ch.codePointAt(0)), ch);
});

test("buildBrandedPdf: valid xref, embedded Type0 fonts, brand on every page, copyable Arabic", () => {
  const blocks = [];
  for (let i = 0; i < 70; i += 1) blocks.push({ kind: "paragraph", text: `سطر رقم ${i + 1}: x² − 5x + 6 = 0` });
  const pdf = buildBrandedPdf({ title: "حل المسألة — Worked solution", blocks });
  assert.equal(pdf.toString("latin1", 0, 8), "%PDF-1.7");
  const text = pdf.toString("latin1");
  assert.match(text, /\/Subtype \/Type0/);
  assert.match(text, /\/FontFile2/);
  assert.match(text, /\/Encoding \/Identity-H/);
  // xref offsets point at "N 0 obj"
  const startxref = Number(text.slice(text.lastIndexOf("startxref") + 9).trim().split(/\s/)[0]);
  const xref = text.slice(startxref).split("\n");
  const count = Number(xref[1].split(" ")[1]);
  for (let id = 1; id < count; id += 1) {
    const offset = Number(xref[2 + id].slice(0, 10));
    assert.equal(text.slice(offset, offset + `${id} 0 obj`.length), `${id} 0 obj`, `object ${id}`);
  }
  const pages = (text.match(/\/Type \/Page /g) || []).length;
  assert.ok(pages >= 2, `expected a multi-page PDF, got ${pages}`);
  // Brand glyphs present (shaped presentation forms of «منذر حداره») and Latin brand text.
  const chars = toUnicodeChars(pdf);
  for (const ch of shapeArabic("منذر حداره")) if (ch !== " ") assert.ok(chars.has(ch), `brand glyph ${ch.codePointAt(0).toString(16)}`);
  for (const ch of "Munzer Haddara · MathMentor") assert.ok(chars.has(ch), `latin glyph ${ch}`);
  // Info dictionary carries the brand (UTF-16BE hex).
  const authorHex = Buffer.from("Munzer Haddara · MathMentor", "utf16le").swap16().toString("hex");
  assert.ok(text.includes(authorHex));
});

test("solution PDF: unicode renderer, Arabic steps, under WhatsApp limits", () => {
  const rendered = renderSolutionPdf(sampleSolution, {
    question: "حلّ المعادلة x² − 5x + 6 = 0 وابعتلي الحل بي دي إف",
    verdict: { status: "verified", noteAr: "✅ تحقّق محمد: الحل صحيح.", issues: [], calls: [] },
    createdAt: new Date("2026-10-05T00:00:00Z"),
  });
  assert.equal(rendered.renderer, "unicode");
  assert.ok(rendered.bytes.length > 10_000 && rendered.bytes.length < 2_000_000, String(rendered.bytes.length));
  const chars = toUnicodeChars(rendered.bytes);
  for (const ch of shapeArabic("الجواب النهائي")) if (ch !== " ") assert.ok(chars.has(ch), ch.codePointAt(0).toString(16));
  for (const ch of "Δ²√") assert.ok(chars.has(ch), ch);
});

test("PDF keywords: pdf / بي دي إف / أف / اف / ملف / file", () => {
  for (const t of ["حل x^2=4 PDF", "حل x^2=4 بي دي إف", "حلها بي دي أف", "ابعتلي الحل بي دي اف", "ابعتلي الحل ملف", "solve as a file", "بالـpdf"]) {
    assert.equal(wantsPdfReply(t), true, t);
  }
  assert.equal(wantsPdfReply("حل x^2=4"), false);
});

test("PDF policy: always by default, on_request via WHATSAPP_PDF_REPLY", () => {
  assert.equal(pdfReplyMode({}), "always");
  assert.equal(pdfReplyMode({ WHATSAPP_PDF_REPLY: "on_request" }), "on_request");
  assert.equal(shouldSendPdf("حل x^2=4", "always"), true);
  assert.equal(shouldSendPdf("حل x^2=4", "on_request"), false);
  assert.equal(shouldSendPdf("حل x^2=4 بي دي إف", "on_request"), true);
});

function fakeDeps(overrides = {}) {
  const log = { replies: [], solves: [], fallbacks: [], logs: [] };
  const deps = {
    download: async () => ({ ok: true, bytes: Buffer.from("x"), mimeType: "image/jpeg", category: "image", sizeBytes: 1 }),
    transcribe: async () => ({ ok: true, text: "حل المعادلة 2x + 3 = 7 بي دي إف", model: "m" }),
    solve: async (req) => {
      log.solves.push(req);
      return {
        ok: true,
        textAr: `✅ x = 2\n${MEDIA_SIGNATURE_AR}`,
        pdf: req.wantPdf ? { bytes: Buffer.from("%PDF-1.7"), filename: SOLUTION_PDF_FILENAME, caption: SOLUTION_PDF_CAPTION_AR, mimeType: "application/pdf" } : undefined,
      };
    },
    reply: async (r) => log.replies.push(r),
    fallback: async (f) => log.fallbacks.push(f),
    log: (level, message) => log.logs.push({ level, message }),
    ...overrides,
  };
  return { deps, log };
}

test("typed maths without the word PDF still gets the branded PDF (default policy)", async () => {
  const prev = process.env.WHATSAPP_PDF_REPLY;
  delete process.env.WHATSAPP_PDF_REPLY;
  try {
    const { deps, log } = fakeDeps();
    await runAgentTurn({ from: "96176532421", kind: "text", text: "حل المعادلة x^2 - 5x + 6 = 0" }, deps);
    assert.equal(log.solves[0].wantPdf, true);
    assert.equal(log.replies[0].attachment.filename, "MathMentor-Munzer-Haddara-solution.pdf");
    assert.equal(log.replies[0].attachmentSentNoteAr, PDF_SENT_AR);
  } finally {
    if (prev === undefined) delete process.env.WHATSAPP_PDF_REPLY;
    else process.env.WHATSAPP_PDF_REPLY = prev;
  }
});

test("voice note «… بي دي إف» → wantPdf even in on_request mode", async () => {
  const prev = process.env.WHATSAPP_PDF_REPLY;
  process.env.WHATSAPP_PDF_REPLY = "on_request";
  try {
    const { deps, log } = fakeDeps();
    await runAgentTurn({ from: "96176532421", kind: "audio", mediaId: "m1", mimeType: "audio/ogg" }, deps);
    assert.equal(log.solves[0].wantPdf, true);
    assert.ok(log.replies[0].attachment);
  } finally {
    if (prev === undefined) delete process.env.WHATSAPP_PDF_REPLY;
    else process.env.WHATSAPP_PDF_REPLY = prev;
  }
});

test("PDF generation failure → text still sent, flagged pdfError, logged as error", async () => {
  const { deps, log } = fakeDeps({
    solve: async (req) => ({ ok: true, textAr: `✅ x = 2\n${MEDIA_SIGNATURE_AR}`, pdfError: "font missing" }),
  });
  await answerMath({ question: "حل x+1=2", wantPdf: true, from: "961" }, deps, { note: "t" });
  assert.equal(log.replies[0].status, "completed");
  assert.equal(log.replies[0].pdfError, "font missing");
  assert.ok(log.logs.some((l) => l.level === "error" && /PDF missing/.test(l.message)));
});

test("bare «ابعتلي ياه PDF» resends the latest PDF; none → clear message; ops text untouched", async () => {
  const last = { bytes: Buffer.from("%PDF-1.7"), filename: SOLUTION_PDF_FILENAME, caption: "c", mimeType: "application/pdf" };
  const a = fakeDeps({ lastPdf: () => last });
  const r1 = await runAgentTurn({ from: "961", kind: "text", text: "ابعتلي ياه PDF" }, a.deps);
  assert.equal(r1.route, "pdf_resend");
  assert.equal(a.log.replies[0].attachment, last);
  assert.equal(a.log.solves.length, 0);

  const b = fakeDeps({ lastPdf: () => undefined });
  await runAgentTurn({ from: "961", kind: "text", text: "ابعتلي الحل بي دي اف" }, b.deps);
  assert.equal(b.log.replies[0].textAr, PDF_NOTHING_TO_RESEND_AR);

  assert.equal(isBarePdfRequest("ابعتلي تقرير المدرسة PDF"), false);
  const c = fakeDeps({ lastPdf: () => last });
  await runAgentTurn({ from: "961", kind: "text", text: "ابعتلي تقرير المدرسة PDF" }, c.deps);
  assert.equal(c.log.fallbacks.length, 1);
});

test("status notes go above the signature", () => {
  const text = withNoteBeforeSignature(`✅ x = 2\n${MEDIA_SIGNATURE_AR}`, "📄 note");
  assert.equal(text, `✅ x = 2\n📄 note\n${MEDIA_SIGNATURE_AR}`);
  assert.equal(withNoteBeforeSignature("hello", "n"), "hello\nn");
  assert.equal(withNoteBeforeSignature("hello", ""), "hello");
});

test("reply status line: delivered → sent note; failed send / build failure → tell the student", async () => {
  const { attachmentStatusNoteAr } = await import("../src/lib/agent/media/reply.ts");
  const { PDF_SEND_FAILED_AR, PDF_BUILD_FAILED_AR } = await import("../src/lib/whatsapp/agentCore.ts");
  const at = new Date().toISOString();
  assert.equal(attachmentStatusNoteAr({ hadAttachment: true, result: { status: "sent", provider: "meta", to: "961", at }, sentNoteAr: PDF_SENT_AR }), PDF_SENT_AR);
  assert.equal(attachmentStatusNoteAr({ hadAttachment: true, result: { status: "failed", provider: "meta", to: "961", error: "Meta media upload 400", at } }), PDF_SEND_FAILED_AR);
  assert.equal(attachmentStatusNoteAr({ hadAttachment: true, result: { status: "skipped", provider: "meta", to: "961", at } }), PDF_SEND_FAILED_AR);
  assert.equal(attachmentStatusNoteAr({ hadAttachment: false, pdfError: "font" }), PDF_BUILD_FAILED_AR);
  assert.equal(attachmentStatusNoteAr({ hadAttachment: false }), "");
});

test("PDFs show readable maths only: no raw 'LaTeX (Word Equation): …' line (unicode blocks + Latin fallback)", async () => {
  const { solutionPdfBlocks, solutionPdfLatin, solutionWhatsAppTextAr } = await import("../src/lib/agent/media/solutionFormat.ts");
  const blocks = solutionPdfBlocks(sampleSolution, { createdAt: new Date("2026-10-05T00:00:00Z") });
  const texts = blocks.map((b) => b.text || "").join("\n");
  assert.ok(!/LaTeX|Word Equation/.test(texts), "no LaTeX source line in the branded PDF");
  assert.ok(!texts.includes("\\{"), "no raw LaTeX escapes");
  assert.ok(blocks.some((b) => b.kind === "highlight" && b.text.startsWith("الجواب النهائي:")), "readable final answer kept");
  const latin = solutionPdfLatin(sampleSolution);
  const raw = latin.toString("latin1") + streams(latin).map((s) => s.data.toString("latin1")).join("\n");
  assert.ok(!/LaTeX \(Word Equation\)/.test(raw), "Latin fallback PDF drops the line too");
  assert.match(raw, /FINAL ANSWER/);
  assert.ok(!/LaTeX \(Word Equation\)/.test(solutionWhatsAppTextAr(sampleSolution)), "WhatsApp text never carried it");
});
