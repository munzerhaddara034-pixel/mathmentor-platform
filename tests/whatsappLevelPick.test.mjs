// WhatsApp ambiguous level → 3 quick-reply options (متوسط / ثانوي / جامعي); no solve until picked.
import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { detectCurriculum } from "../src/lib/solver/curriculum/detect.ts";
import {
  clearPendingLevelSolve,
  LEVEL_ASK_NUMBERED_AR,
  LEVEL_BUTTONS,
  parseLevelChoice,
  recallPendingLevelSolve,
  recallThreadLevel,
  rememberPendingLevelSolve,
  rememberThreadLevel,
  resetLevelPickStoresForTests,
} from "../src/lib/whatsapp/levelPick.ts";
import { metaInteractiveButtonsPayload, runAgentTurn } from "../src/lib/whatsapp/agentCore.ts";

afterEach(() => resetLevelPickStoresForTests());

test("parseLevelChoice: button ids, 1/2/3, Arabic and English words", () => {
  assert.equal(parseLevelChoice("level_middle"), "middle");
  assert.equal(parseLevelChoice("level_secondary"), "secondary");
  assert.equal(parseLevelChoice("level_university"), "university");
  assert.equal(parseLevelChoice("1"), "middle");
  assert.equal(parseLevelChoice("٢"), "secondary");
  assert.equal(parseLevelChoice("3"), "university");
  assert.equal(parseLevelChoice("متوسط"), "middle");
  assert.equal(parseLevelChoice("ثانوي"), "secondary");
  assert.equal(parseLevelChoice("جامعي"), "university");
  assert.equal(parseLevelChoice("1 متوسط"), "middle");
  assert.equal(parseLevelChoice("hello"), undefined);
});

test("Meta interactive payload has exactly the three level buttons", () => {
  const payload = metaInteractiveButtonsPayload(
    "96176532421",
    LEVEL_ASK_NUMBERED_AR,
    LEVEL_BUTTONS.map(({ id, title }) => ({ id, title })),
  );
  assert.equal(payload.type, "interactive");
  assert.equal(payload.interactive.type, "button");
  assert.equal(payload.interactive.action.buttons.length, 3);
  assert.deepEqual(
    payload.interactive.action.buttons.map((b) => b.reply.id),
    ["level_middle", "level_secondary", "level_university"],
  );
});

test("ambiguous WhatsApp maths → level_ask reply with buttons, no solve yet", async () => {
  const solves = [];
  const replies = [];
  const result = await runAgentTurn(
    { from: "96170000001", kind: "text", text: "Solve x^2 - 5x + 6 = 0" },
    {
      download: async () => ({ ok: false, reason: "download_failed", error: "unused" }),
      transcribe: async () => ({ ok: false, quota: false, error: "unused" }),
      solve: async (req) => {
        solves.push(req);
        return { ok: true, textAr: "should not run" };
      },
      reply: async (r) => {
        replies.push(r);
      },
      fallback: async () => {},
    },
  );
  assert.equal(result.route, "level_ask");
  assert.equal(solves.length, 0, "must not solve before the student picks a level");
  assert.equal(replies.length, 1);
  assert.match(replies[0].textAr, /متوسط/);
  assert.match(replies[0].textAr, /1 متوسط · 2 ثانوي · 3 جامعي/);
  assert.deepEqual(
    replies[0].interactiveButtons?.map((b) => b.id),
    ["level_middle", "level_secondary", "level_university"],
  );
  assert.ok(recallPendingLevelSolve("96170000001"));
});

test("after level pick (button id or 2), solve once with that level and remember the thread", async () => {
  rememberPendingLevelSolve("96170000002", { question: "Solve x^2=4", wantPdf: false });
  const solves = [];
  const result = await runAgentTurn(
    { from: "96170000002", kind: "text", text: "level_secondary" },
    {
      download: async () => ({ ok: false, reason: "download_failed", error: "unused" }),
      transcribe: async () => ({ ok: false, quota: false, error: "unused" }),
      solve: async (req) => {
        solves.push(req);
        return { ok: true, textAr: "تم الحل ✅\nمحمد — منذر حداره · MathMentor" };
      },
      reply: async () => {},
      ack: async () => {},
      fallback: async () => {},
    },
  );
  assert.equal(result.route, "math_level_picked");
  assert.equal(solves.length, 1);
  assert.equal(solves[0].level, "secondary");
  assert.equal(solves[0].track, "gs");
  assert.equal(solves[0].question, "Solve x^2=4");
  assert.equal(recallPendingLevelSolve("96170000002"), undefined);
  assert.equal(recallThreadLevel("96170000002"), "secondary");

  // Next ambiguous question in the same thread uses the remembered level (no second ask).
  const solves2 = [];
  const asks = [];
  const result2 = await runAgentTurn(
    { from: "96170000002", kind: "text", text: "Find the roots of x^2-1=0" },
    {
      download: async () => ({ ok: false, reason: "download_failed", error: "unused" }),
      transcribe: async () => ({ ok: false, quota: false, error: "unused" }),
      solve: async (req) => {
        solves2.push(req);
        return { ok: true, textAr: "ok" };
      },
      reply: async (r) => {
        if (r.note === "whatsapp_level_ask") asks.push(r);
      },
      ack: async () => {},
      fallback: async () => {},
    },
  );
  assert.equal(result2.route, "math");
  assert.equal(asks.length, 0);
  assert.equal(solves2[0].level, "secondary");
});

test("site track=brevet still yields middle levelBlock (regression)", () => {
  const d = detectCurriculum({ question: "anything with eigenvalues", track: "brevet" });
  assert.equal(d.level, "middle");
  assert.equal(d.ambiguous, false);
});

test("sendWhatsApp / adapter / Meta route wire interactive buttons and button_reply parsing", () => {
  const adapter = readFileSync("src/lib/whatsapp/adapter.ts", "utf8");
  assert.match(adapter, /metaInteractiveButtonsPayload/);
  assert.match(adapter, /interactiveButtons/);
  const route = readFileSync("src/app/api/agent/whatsapp-voice/route.ts", "utf8");
  assert.match(route, /button_reply/);
  assert.match(route, /buttonReply\.id/);
});
