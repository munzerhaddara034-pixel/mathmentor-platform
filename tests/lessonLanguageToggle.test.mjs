import { after, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const env = {
  LESSON_CONTENT_DEFAULT_LANGUAGE: process.env.LESSON_CONTENT_DEFAULT_LANGUAGE,
  HEYGEN_VOICE_ID_EN: process.env.HEYGEN_VOICE_ID_EN,
  HEYGEN_VOICE_ID_AR: process.env.HEYGEN_VOICE_ID_AR,
  HEYGEN_VOICE_ID_FR: process.env.HEYGEN_VOICE_ID_FR,
};
const docs = new Map();
const store = {
  async getJSON(key) {
    return docs.has(key) ? structuredClone(docs.get(key)) : null;
  },
  async setJSON(key, value) {
    docs.set(key, structuredClone(value));
  },
};

const videoLessons = await import("../src/lib/videoLessons.ts");
const heygen = await import("../src/lib/studio/heygen.ts");
const jobs = await import("../src/lib/studio/heygenJobs.ts");
const images = await import("../src/lib/team/images.ts");
const dataDir = await import("../src/lib/dataDir.ts");
const youssef = await import("../src/lib/team/youssefActions.ts");

dataDir.setPersistentStoreOverride(store);

function restoreEnv() {
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

beforeEach(() => {
  docs.clear();
  delete process.env.LESSON_CONTENT_DEFAULT_LANGUAGE;
  delete process.env.HEYGEN_VOICE_ID_EN;
  delete process.env.HEYGEN_VOICE_ID_AR;
  delete process.env.HEYGEN_VOICE_ID_FR;
});

after(() => {
  restoreEnv();
  dataDir.setPersistentStoreOverride(null);
});

describe("lesson language toggle and content-language defaults", () => {
  test("renders EN | AR | FR and persists through the existing locale mechanism", async () => {
    const source = await readFile(new URL("../src/components/LanguageToggle.tsx", import.meta.url), "utf8");
    const watch = await readFile(new URL("../src/components/LessonWatchView.tsx", import.meta.url), "utf8");
    assert.match(source, /EN/);
    assert.match(source, /AR/);
    assert.match(source, /FR/);
    assert.match(source, /role=\"radiogroup\"/);
    assert.match(source, /aria-checked/);
    assert.match(watch, /saveLocale\(next\)/);
  });

  test("English is the default lesson metadata and language choices select the same lesson assets", () => {
    const pack = videoLessons.getVideoLessonPack("grade-12-ls-continuity");
    assert.ok(pack);
    assert.equal(videoLessons.copyForLang(pack, "en").title, pack.titleEn);
    assert.equal(videoLessons.copyForLang(pack, "ar").title, pack.titleAr);
    assert.equal(videoLessons.copyForLang(pack, "fr").title, pack.titleFr);
    assert.deepEqual(videoLessons.notesForPack(pack, "ar"), pack.notesEn);
    assert.equal(videoLessons.scenesForPack(pack, "ar")[0], pack.fallbackEn[0]);
  });

  test("HeyGen payloads and queued records default to en and honor AR/FR overrides", () => {
    const english = heygen.buildHeyGenGeneratePayload({ script: "Explain continuity." });
    assert.equal(english.video_inputs[0].voice.locale, "en-US");
    process.env.HEYGEN_VOICE_ID_EN = "english-voice";
    assert.equal(heygen.resolveHeyGenVoiceId("en"), "english-voice");
    const arabic = heygen.buildHeyGenGeneratePayload({ script: "اشرح الاتصال", language: "ar" });
    assert.equal(arabic.video_inputs[0].voice.locale, "ar-SA");
    const frenchJob = jobs.newQueuedJob({ lessonId: "fr", title: "fr", script: "fr", notes: "", mathExamples: "", language: "fr", speed: 1, demo: true });
    assert.equal(frenchJob.language, "fr");
    const englishJob = jobs.newQueuedJob({ lessonId: "en", title: "en", script: "en", notes: "", mathExamples: "", speed: 1, demo: true });
    assert.equal(englishJob.language, "en");
  });

  test("Youssef records language en by default and keeps explicit Arabic available", async () => {
    const english = await youssef.createYoussefDesign("design an English pricing page");
    assert.equal(english.language, "en");
    assert.match(english.html, /<html lang="en" dir="ltr">/);
    assert.match(english.html, /Start now/);
    const arabic = await youssef.createYoussefDesign("صمّم صفحة الأسعار", { language: "ar" });
    assert.equal(arabic.language, "ar");
    assert.match(arabic.html, /<html lang="ar" dir="rtl">/);
    assert.match(arabic.html, /صفحة الأسعار/);
    assert.match(images.imagePromptForLanguage("pricing page", "en"), /all specification text in English/);
    assert.equal(images.imagePromptForLanguage("صفحة", "ar"), "صفحة");
  });
});
