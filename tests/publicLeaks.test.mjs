// /api/questions and /api/heygen/status: answers, scripts and job internals are staff-only.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pv = await import("../src/lib/security/publicViews.ts");
const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

test("publicQuestion strips correctIndex and steps", () => {
  const q = { id: "q1", lessonId: "l1", difficulty: 2, kind: "mcq", prompt: "2+2?", latex: "2+2", options: ["3", "4"], correctIndex: 1, steps: ["2+2=4"] };
  const out = pv.publicQuestion(q);
  assert.deepEqual(out, { id: "q1", lessonId: "l1", difficulty: 2, kind: "mcq", prompt: "2+2?", latex: "2+2", options: ["3", "4"] });
  assert.ok(!("correctIndex" in out) && !("steps" in out));
  out.options.push("x");
  assert.equal(q.options.length, 2, "copy, not alias");
});

test("publicHeyGenJob: no script/notes/provider ids/errors; media only once published", () => {
  const job = {
    id: "j1", lessonId: "l1", title: "T", script: "SECRET SCRIPT", notes: "n", mathExamples: "m", language: "en", speed: 1,
    status: "completed", heygenVideoId: "hv1", videoUrl: "https://v/x.mp4", thumbnailUrl: "https://v/x.jpg", studentEnabled: false,
    demo: false, message: "provider said", timelineJson: "{}", error: "boom", createdAt: "a", updatedAt: "b",
  };
  const hidden = pv.publicHeyGenJob(job);
  for (const key of ["script", "notes", "mathExamples", "heygenVideoId", "message", "timelineJson", "error", "videoUrl", "thumbnailUrl"]) {
    assert.ok(!(key in hidden), key);
  }
  const shown = pv.publicHeyGenJob({ ...job, studentEnabled: true });
  assert.equal(shown.videoUrl, "https://v/x.mp4");
  assert.ok(!("script" in shown) && !("heygenVideoId" in shown));
});

test("routes: questions GET strips for non-staff; heygen list + POST staff-only, per-job GET signed-in + published", () => {
  const questions = read("src/app/api/questions/route.ts");
  const qget = questions.slice(questions.indexOf("export async function GET"), questions.indexOf("export async function POST"));
  assert.match(qget, /apiRequireStaff\(\)[\s\S]*rows\.map\(publicQuestion\)/);
  const heygen = read("src/app/api/heygen/status/route.ts");
  const hget = heygen.slice(heygen.indexOf("export async function GET"), heygen.indexOf("export async function POST"));
  assert.match(hget, /if \(staff\.error\) \{\n[\s\S]*if \(!jobId\) return staff\.error;[\s\S]*apiSession\(\)[\s\S]*publicStatusPayload\(jobId\)/);
  const hpost = heygen.slice(heygen.indexOf("export async function POST"));
  assert.match(hpost, /^export async function POST\(request: Request\) \{\n.*\n\s*const staff = await apiRequireStaff\(\);\n\s*if \(staff\.error\) return staff\.error;/);
  const pub = heygen.slice(heygen.indexOf("async function publicStatusPayload"), heygen.indexOf("export async function GET"));
  assert.match(pub, /!job\.studentEnabled/);
  assert.match(pub, /publicHeyGenJob\(job\)/);
  assert.ok(!pub.includes("refreshLiveJob") && !pub.includes("notifyVideoJobIfReady"), "no side effects for students");
});
