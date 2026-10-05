// Inbound image / PDF homework → solve + always attach branded solution PDF.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { detectMediaAction, shouldSendPdfForInboundFile, shouldSendPdf } from "../src/lib/agent/media/captionIntent.ts";
import { SOLUTION_PDF_FILENAME, solutionPdfBlocks } from "../src/lib/agent/media/solutionFormat.ts";
import { MATHMENTOR_BRAND } from "../src/lib/pdf/brandedPdf.ts";
import { runAgentTurn } from "../src/lib/whatsapp/agentCore.ts";
import { resetLevelPickStoresForTests, rememberThreadLevel } from "../src/lib/whatsapp/levelPick.ts";

test("inbound files always request the branded solution PDF (even on_request mode)", () => {
  assert.equal(shouldSendPdfForInboundFile(), true);
  assert.equal(shouldSendPdf("حل x=1", "on_request"), false);
});

test("readable PDF document without caption defaults to solve (not summarize)", () => {
  assert.equal(detectMediaAction({ category: "document", readable: true }), "solve");
  assert.equal(detectMediaAction({ category: "document", readable: true, caption: "لخصلي ياه" }), "summarize");
  assert.equal(detectMediaAction({ category: "image", readable: true }), "solve");
});

test("solution PDF blocks present Dr. Mohamed · Munzer's assistant (AI) under منذر حداره · MathMentor brand", () => {
  const blocks = solutionPdfBlocks({
    summary: "t",
    finalAnswer: "2",
    finalAnswerLatex: "2",
    examTip: { en: "", fr: "", ar: "" },
    studyKind: "algebra",
    given: { latex: "x=2", aimEn: "", aimAr: "" },
    steps: [],
    avatarScript: {},
    canvasTimeline: {},
    timeline: {},
    topic: "algebra",
    topicTag: "algebra",
    track: "brevet",
    language: "ar",
    source: "gemini",
    needsRetake: false,
  });
  const text = blocks.map((b) => b.text || "").join("\n");
  assert.ok(text.includes("الدكتور محمد · مساعد منذر · معلّم بالذكاء الاصطناعي"));
  assert.equal(MATHMENTOR_BRAND.headerAr, "منذر حداره · MathMentor");
  assert.match(SOLUTION_PDF_FILENAME, /MathMentor-Munzer-Haddara-solution\.pdf/);
});

test("photo turn always passes wantPdf=true and attaches the solution PDF", async () => {
  resetLevelPickStoresForTests();
  rememberThreadLevel("96171110001", "secondary");
  const solves = [];
  const replies = [];
  const png = Buffer.from("89504e470d0a1a0a", "hex");
  const result = await runAgentTurn(
    { from: "96171110001", kind: "image", mediaId: "mid", mimeType: "image/png", filename: "q.png", caption: "" },
    {
      download: async () => ({ ok: true, bytes: png, mimeType: "image/png", category: "image", sizeBytes: png.length }),
      transcribe: async () => ({ ok: false, quota: false, error: "unused" }),
      solve: async (req) => {
        solves.push(req);
        return {
          ok: true,
          textAr: "الجواب 2",
          pdf: req.wantPdf
            ? { bytes: Buffer.from("%PDF-1.7"), filename: SOLUTION_PDF_FILENAME, caption: "📄", mimeType: "application/pdf" }
            : undefined,
        };
      },
      reply: async (r) => replies.push(r),
      ack: async () => {},
      fallback: async () => {},
    },
  );
  assert.equal(result.route, "math");
  assert.equal(solves[0].wantPdf, true);
  assert.ok(solves[0].imageBase64);
  assert.equal(replies[0].attachment?.filename, SOLUTION_PDF_FILENAME);
});

test("handleInbound + solveFileAction force branded PDF for documents", () => {
  const inbound = readFileSync("src/lib/agent/media/handleInbound.ts", "utf8");
  assert.match(inbound, /shouldSendPdfForInboundFile\(\)/);
  const actions = readFileSync("src/lib/agent/media/actions.ts", "utf8");
  assert.match(actions, /wantPdf: true/);
  assert.match(actions, /extractPdfText/);
  assert.match(actions, /isPdfMime/);
});
