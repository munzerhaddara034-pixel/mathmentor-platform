// WhatsApp agent «محمد»: text / voice note / photo turns, Graph media download + document reply,
// Gemini quota apology, persona rename, maths detection. Global fetch is mocked — no network.
// Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  answerMath,
  geminiAudioMime,
  geminiTranscribeAudio,
  isGeminiQuotaError,
  looksLikeMathRequest,
  metaDownloadMedia,
  metaSendMessage,
  metaUploadMedia,
  QUOTA_APOLOGY_AR,
  runAgentTurn,
  STT_FAILED_AR,
  VOICE_DOWNLOAD_FAILED_AR,
  whatsappPersonaText,
} from "../src/lib/whatsapp/agentCore.ts";
import { MEDIA_SIGNATURE_AR } from "../src/lib/whatsapp/media/errorsAr.ts";
import { isMetaMediaHost, providerMediaAuthHeaders } from "../src/lib/whatsapp/mediaHosts.ts";

const TOKEN = "test-token-not-a-secret";
const cfg = { token: TOKEN, phoneNumberId: "123456", graphUrl: (p) => `https://graph.facebook.com/v21.0/${p}` };

function recorder(handler) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    return handler(String(url), init, calls.length);
  };
  return { calls, fetchImpl };
}

function fakeDeps(overrides = {}) {
  const log = { replies: [], acks: [], fallbacks: [], solves: [], logs: [] };
  const deps = {
    download: async () => ({ ok: true, bytes: Buffer.from("OggS-fake-voice"), mimeType: "audio/ogg", category: "audio", sizeBytes: 15 }),
    transcribe: async () => ({ ok: true, text: "حل المعادلة 2x + 3 = 7", model: "gemini-flash-latest" }),
    solve: async (req) => {
      log.solves.push(req);
      return { ok: true, textAr: `✅ x = 2\n${MEDIA_SIGNATURE_AR}`, relatedIds: ["mq_1"] };
    },
    mockExam: async () => ({ bytes: Buffer.from("%PDF-1.4 exam"), filename: "exam.pdf", captionAr: "امتحان تجريبي" }),
    reply: async (r) => {
      log.replies.push(r);
    },
    fallback: async (f) => {
      log.fallbacks.push(f);
    },
    ack: async (to, text) => {
      log.acks.push({ to, text });
    },
    log: (level, message) => log.logs.push({ level, message }),
    ...overrides,
  };
  return { deps, log };
}

test("typed maths question → solver → signed reply (no pipeline)", async () => {
  const { deps, log } = fakeDeps();
  const result = await runAgentTurn({ from: "96176532421", kind: "text", text: "حل المعادلة x^2 - 4 = 0", messageId: "wamid.1" }, deps);
  assert.equal(result.route, "math");
  assert.equal(result.ok, true);
  assert.equal(log.fallbacks.length, 0);
  assert.equal(log.solves[0].question, "حل المعادلة x^2 - 4 = 0");
  assert.equal(log.replies.length, 1);
  assert.match(log.replies[0].textAr, /محمد/);
  assert.equal(log.replies[0].replyToMessageId, "wamid.1");
  assert.equal(log.acks.length, 1);
});

test("typed maths with «pdf» → wantPdf and the PDF is attached", async () => {
  const { deps, log } = fakeDeps({
    solve: async (req) => ({
      ok: true,
      textAr: "✅ الحل",
      pdf: req.wantPdf ? { bytes: Buffer.from("%PDF-1.4"), filename: "s.pdf", caption: "📄", mimeType: "application/pdf" } : undefined,
    }),
  });
  await runAgentTurn({ from: "961", kind: "text", text: "حل المعادلة 3x = 9 وابعتلي pdf" }, deps);
  assert.equal(log.replies[0].attachment?.mimeType, "application/pdf");
});

test("non-maths text (appointment) goes to the intent pipeline", async () => {
  const { deps, log } = fakeDeps();
  const result = await runAgentTurn({ from: "961", kind: "text", text: "ذكرني بموعد الاجتماع بكرا الساعة 5" }, deps);
  assert.equal(result.route, "fallback");
  assert.deepEqual(log.fallbacks, [{ text: "ذكرني بموعد الاجتماع بكرا الساعة 5", fromVoice: false }]);
  assert.equal(log.replies.length, 0);
});

test("voice note → download → transcribe → solved like text, transcript echoed", async () => {
  const { deps, log } = fakeDeps();
  const result = await runAgentTurn({ from: "961", kind: "audio", mediaId: "MEDIA1", mimeType: "audio/ogg; codecs=opus" }, deps);
  assert.equal(result.route, "math");
  assert.equal(result.transcript, "حل المعادلة 2x + 3 = 7");
  assert.match(log.replies[0].textAr, /فهمت من المذكرة/);
  assert.equal(log.replies[0].note, "whatsapp_voice_solve");
});

test("voice note that is not maths → pipeline with fromVoice", async () => {
  const { deps, log } = fakeDeps({ transcribe: async () => ({ ok: true, text: "شو عندي مواعيد اليوم", model: "m" }) });
  await runAgentTurn({ from: "961", kind: "audio", mediaId: "M" }, deps);
  assert.deepEqual(log.fallbacks, [{ text: "شو عندي مواعيد اليوم", fromVoice: true }]);
});

test("voice note: quota → short apology; STT failure → retry message; download failure → message", async () => {
  let r = fakeDeps({ transcribe: async () => ({ ok: false, quota: true, error: "429" }) });
  assert.equal((await runAgentTurn({ from: "961", kind: "audio", mediaId: "M" }, r.deps)).route, "quota");
  assert.equal(r.log.replies[0].textAr, QUOTA_APOLOGY_AR);
  assert.ok(r.log.logs.some((l) => l.level === "error" && /429/.test(l.message)));

  r = fakeDeps({ transcribe: async () => ({ ok: false, quota: false, error: "bad audio" }) });
  assert.equal((await runAgentTurn({ from: "961", kind: "audio", mediaId: "M" }, r.deps)).route, "stt_failed");
  assert.equal(r.log.replies[0].textAr, STT_FAILED_AR);

  r = fakeDeps({ download: async () => ({ ok: false, reason: "download_failed", error: "404" }) });
  assert.equal((await runAgentTurn({ from: "961", kind: "audio", mediaId: "M" }, r.deps)).route, "download_failed");
  assert.equal(r.log.replies[0].textAr, VOICE_DOWNLOAD_FAILED_AR);
});

test("photo → stored → solver gets base64 image + caption", async () => {
  const stored = [];
  const { deps, log } = fakeDeps({
    download: async () => ({ ok: true, bytes: Buffer.from([0xff, 0xd8, 0xff, 0xe0]), mimeType: "image/jpeg", category: "image", sizeBytes: 4 }),
    storeInbound: async (f) => {
      stored.push(f);
      return "wamedia_1";
    },
  });
  const result = await runAgentTurn({ from: "961", kind: "image", mediaId: "IMG", caption: "حل pdf" }, deps);
  assert.equal(result.route, "math");
  assert.equal(stored.length, 1);
  assert.equal(log.solves[0].imageBase64, Buffer.from([0xff, 0xd8, 0xff, 0xe0]).toString("base64"));
  assert.equal(log.solves[0].mimeType, "image/jpeg");
  assert.equal(log.solves[0].wantPdf, true);
});

test("mock exam request (typed or spoken) → PDF document reply", async () => {
  const { deps, log } = fakeDeps({ transcribe: async () => ({ ok: true, text: "ابعتلي امتحان تجريبي", model: "m" }) });
  const result = await runAgentTurn({ from: "961", kind: "audio", mediaId: "M" }, deps);
  assert.equal(result.route, "mock_exam");
  assert.equal(log.replies[0].attachment.mimeType, "application/pdf");
});

test("solver 429 (thrown or reported) → quota apology, never a demo answer", async () => {
  const thrown = Object.assign(new Error("Gemini 429 RESOURCE_EXHAUSTED"), { calls: [{ status: 429 }] });
  assert.equal(isGeminiQuotaError(thrown), true);
  assert.equal(isGeminiQuotaError(new Error("Gemini 500")), false);
  let r = fakeDeps({
    solve: async () => {
      throw thrown;
    },
  });
  await answerMath({ question: "حل x+1=2", wantPdf: false, from: "961" }, r.deps, { note: "t" });
  assert.equal(r.log.replies[0].textAr, QUOTA_APOLOGY_AR);
  assert.equal(r.log.replies[0].status, "failed");
  r = fakeDeps({ solve: async () => ({ ok: false, reason: "quota", error: "429" }) });
  await runAgentTurn({ from: "961", kind: "text", text: "احسب 2+2" }, r.deps);
  assert.equal(r.log.replies.at(-1).textAr, QUOTA_APOLOGY_AR);
});

test("a throwing dependency still produces a reply (never silent)", async () => {
  const { deps, log } = fakeDeps({
    fallback: async () => {
      throw new Error("pipeline down");
    },
  });
  const result = await runAgentTurn({ from: "961", kind: "text", text: "ذكرني بالموعد" }, deps);
  assert.equal(result.ok, false);
  assert.equal(log.replies.length, 1);
});

test("maths detection: maths vs secretary commands", () => {
  for (const t of ["حل المعادلة 2x+3=7", "solve x^2-4=0", "احسب نهاية الدالة", "résoudre l'équation", "f(x) = ln(x)", "3*4+5"]) {
    assert.equal(looksLikeMathRequest(t), true, t);
  }
  for (const t of ["ذكرني بموعد الساعة 5", "اعمل فيديو تسويقي", "موافق", "ok", "صباح الخير", ""]) {
    assert.equal(looksLikeMathRequest(t), false, t);
  }
});

test("persona: WhatsApp renames the website tutor to محمد, keeps the real teacher's name", () => {
  assert.equal(whatsappPersonaText("تصحيح — الدكتور محمد (معلّم بالذكاء الاصطناعي)، تحقّق ثانٍ"), "تصحيح — محمد، تحقّق ثانٍ");
  assert.equal(whatsappPersonaText("Correction — Dr. Mohamed (AI tutor), second check", { latin: true }), "Correction — Mohamed, second check");
  assert.equal(whatsappPersonaText("Correction — Dr Mohamed · assistant de Munzer", { latin: true }), "Correction — Mohamed");
  assert.equal(whatsappPersonaText("الدكتور محمد · مساعد منذر"), "محمد");
  // Legacy Youssef badge form still maps (pre-rename solver text).
  assert.equal(whatsappPersonaText("Correction — Youssef (AI tutor), second check", { latin: true }), "Correction — Mohamed, second check");
  assert.match(whatsappPersonaText(MEDIA_SIGNATURE_AR), /الأستاذ منذر حداره/);
});

test("Graph download: GET /{media-id} then GET url, Bearer on both, only to Meta hosts", async () => {
  const { calls, fetchImpl } = recorder(async (url) => {
    if (url.endsWith("/MEDIA42")) {
      return Response.json({ url: "https://lookaside.fbsbx.com/whatsapp_business/attachments/?mid=42", mime_type: "audio/ogg; codecs=opus", file_size: 5 });
    }
    return new Response(Buffer.from("OggS1"), { headers: { "content-type": "audio/ogg" } });
  });
  const out = await metaDownloadMedia({ mediaId: "MEDIA42", token: TOKEN, graphUrl: cfg.graphUrl, fetchImpl });
  assert.equal(out.ok, true);
  assert.equal(out.mimeType, "audio/ogg");
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, "https://graph.facebook.com/v21.0/MEDIA42");
  for (const c of calls) assert.equal(c.init.headers.Authorization, `Bearer ${TOKEN}`);

  const evil = recorder(async () => Response.json({ url: "https://evil.example/whatsapp.ogg", mime_type: "audio/ogg" }));
  const refused = await metaDownloadMedia({ mediaId: "X", token: TOKEN, graphUrl: cfg.graphUrl, fetchImpl: evil.fetchImpl });
  assert.equal(refused.ok, false);
  assert.equal(evil.calls.length, 1, "token never sent to a foreign host");
});

test("document reply: POST /{phone}/media (multipart) then /messages type=document by id", async () => {
  const { calls, fetchImpl } = recorder(async (url) => {
    if (url.endsWith("/123456/media")) return Response.json({ id: "UPLOADED_MEDIA_ID" });
    return Response.json({ messages: [{ id: "wamid.out" }] });
  });
  const id = await metaUploadMedia({ cfg, bytes: Buffer.from("%PDF-1.4 x"), mimeType: "application/pdf", filename: "solution.pdf", fetchImpl });
  assert.equal(id, "UPLOADED_MEDIA_ID");
  assert.equal(calls[0].init.method, "POST");
  assert.ok(calls[0].init.body instanceof FormData);
  assert.equal(calls[0].init.body.get("messaging_product"), "whatsapp");
  assert.equal(calls[0].init.body.get("type"), "application/pdf");
  assert.equal(calls[0].init.body.get("file").name, "solution.pdf");

  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: "96176532421",
    type: "document",
    document: { id, filename: "solution.pdf", caption: "📄 الحل" },
  };
  const wamid = await metaSendMessage({ cfg, payload, fetchImpl });
  assert.equal(wamid, "wamid.out");
  assert.equal(calls[1].url, "https://graph.facebook.com/v21.0/123456/messages");
  const sent = JSON.parse(calls[1].init.body);
  assert.equal(sent.type, "document");
  assert.equal(sent.document.id, "UPLOADED_MEDIA_ID");
  assert.equal(sent.document.link, undefined);
});

test("Gemini STT: inline audio/ogg, key in header (not URL), falls through models, flags 429", async () => {
  assert.equal(geminiAudioMime("audio/ogg; codecs=opus"), "audio/ogg");
  const { calls, fetchImpl } = recorder(async (_url, _init, n) =>
    n === 1
      ? new Response("quota", { status: 429 })
      : Response.json({ candidates: [{ content: { parts: [{ text: "حل المعادلة" }] } }] }),
  );
  const out = await geminiTranscribeAudio({ key: "k-test", models: ["m1", "m2"], bytes: Buffer.from("OggS"), mimeType: "audio/ogg; codecs=opus", fetchImpl });
  assert.deepEqual(out, { ok: true, text: "حل المعادلة", model: "m2" });
  assert.ok(!calls[0].url.includes("key="));
  assert.equal(calls[0].init.headers["x-goog-api-key"], "k-test");
  const body = JSON.parse(calls[1].init.body);
  assert.equal(body.contents[0].parts[0].inline_data.mime_type, "audio/ogg");

  const allQuota = recorder(async () => new Response("quota", { status: 429 }));
  const failed = await geminiTranscribeAudio({ key: "k", models: ["a", "b"], bytes: Buffer.from("x"), fetchImpl: allQuota.fetchImpl });
  assert.equal(failed.ok, false);
  assert.equal(failed.quota, true);
});

test("media hosts: credentials only for parsed provider hosts", () => {
  assert.equal(isMetaMediaHost("https://lookaside.fbsbx.com/x"), true);
  assert.equal(isMetaMediaHost("https://evil.example/whatsapp.ogg"), false);
  assert.equal(isMetaMediaHost("https://graph.facebook.com.evil.example/x"), false);
  assert.deepEqual(providerMediaAuthHeaders("https://evil.example/graph.facebook.com/a.ogg", { metaToken: "t" }), {});
});
