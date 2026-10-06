// Lesson-video player: manifest parser, rendition picker, audio/video sync controller, VTT + keyboard helpers, gating.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  audioLanguages,
  availableRenditions,
  chaptersUrl,
  initialLanguage,
  lessonTitle,
  parseLessonManifest,
  playbackPlan,
  resolveMediaUrl,
  subtitleFor,
  subtitleLanguages,
} from "../src/lib/lessonPlayer/manifest.ts";
import { networkCap, pickRendition, renditionForPixels } from "../src/lib/lessonPlayer/rendition.ts";
import { AudioVideoSync, DEFAULT_DRIFT, driftAction } from "../src/lib/lessonPlayer/sync.ts";
import { chapterAt, parseVtt, parseVttTimestamp } from "../src/lib/lessonPlayer/vtt.ts";
import { formatClock, keyAction } from "../src/lib/lessonPlayer/format.ts";
import { loadLessonManifest } from "../src/lib/lessonPlayer/content.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = "/lesson-media/demo/";

const FULL = {
  id: "demo",
  title: { en: "Sine", ar: "الجيب", fr: "Sinus" },
  level: "Grade 11",
  curriculum: "Lebanese",
  duration: 8,
  ai_voice: true,
  poster: "poster.jpg",
  video: { 1080: "v1080.mp4", 720: "v720.mp4", 480: "v480.mp4" },
  audio: { en: "audio.en.m4a", ar: "audio.ar.m4a", fr: "audio.fr.m4a" },
  subtitles: { en: "s.en.vtt", ar: "s.ar.vtt", fr: "s.fr.vtt" },
  chapters: "chapters.vtt",
  review_mp4: "lesson-en.mp4",
};

function parse(input, expectedId) {
  const result = parseLessonManifest(input, { mediaBase: BASE, expectedId });
  assert.ok(result.ok, result.ok ? "" : result.error);
  return result;
}

// ---------------------------------------------------------------- manifest

test("manifest: full lesson.json resolves every reference against the media base", () => {
  const { manifest, warnings } = parse(FULL);
  assert.deepEqual(warnings, []);
  assert.equal(manifest.id, "demo");
  assert.equal(manifest.aiVoice, true);
  assert.equal(manifest.duration, 8);
  assert.equal(manifest.poster, "/lesson-media/demo/poster.jpg");
  assert.deepEqual(manifest.video, { 1080: "/lesson-media/demo/v1080.mp4", 720: "/lesson-media/demo/v720.mp4", 480: "/lesson-media/demo/v480.mp4" });
  assert.equal(manifest.audio.ar, "/lesson-media/demo/audio.ar.m4a");
  assert.equal(manifest.subtitles.fr, "/lesson-media/demo/s.fr.vtt");
  assert.equal(manifest.chapters.all, "/lesson-media/demo/chapters.vtt");
  assert.equal(manifest.reviewMp4, "/lesson-media/demo/lesson-en.mp4");
  assert.deepEqual(availableRenditions(manifest), ["1080", "720", "480"]);
  assert.deepEqual(audioLanguages(manifest), ["en", "ar", "fr"]);
  assert.equal(lessonTitle(manifest, "ar"), "الجيب");
  assert.equal(lessonTitle(manifest, "de"), "Sine");
});

test("manifest: tolerant — missing languages/renditions are dropped, junk keys warned, not fatal", () => {
  const { manifest, warnings } = parse({
    id: "demo",
    title: "Only English title",
    video: { "720p": "v720.mp4", 360: "v360.mp4", 1080: "" },
    audio: { en: "a.en.m4a", de: "a.de.m4a", fr: 42 },
    subtitles: { ar: "s.ar.vtt" },
    duration: "01:05",
    ai_voice: "yes",
    extra: { anything: true },
  });
  assert.deepEqual(availableRenditions(manifest), ["720"]);
  assert.deepEqual(audioLanguages(manifest), ["en"]);
  assert.deepEqual(subtitleLanguages(manifest), ["ar"]);
  assert.equal(manifest.title.en, "Only English title");
  assert.equal(manifest.duration, 65);
  assert.equal(manifest.aiVoice, false, "only boolean true turns the AI-voice label on");
  assert.equal(manifest.poster, undefined);
  assert.ok(warnings.some((w) => w.startsWith("audio.de")));
  assert.ok(warnings.some((w) => w.startsWith("audio.fr")));
  assert.ok(warnings.some((w) => w.startsWith("video.360")));
});

test("manifest: accepts JSON text; rejects invalid JSON, bad ids, nothing playable", () => {
  assert.equal(parse(JSON.stringify(FULL)).manifest.id, "demo");
  assert.deepEqual(parseLessonManifest("{nope", { mediaBase: BASE }), { ok: false, error: "lesson.json is not valid JSON" });
  assert.equal(parseLessonManifest({ ...FULL, id: "../etc" }, { mediaBase: BASE }).ok, false);
  assert.equal(parseLessonManifest({ ...FULL, id: "Demo Lesson" }, { mediaBase: BASE }).ok, false);
  assert.equal(parseLessonManifest({ id: "demo", audio: { en: "a.m4a" } }, { mediaBase: BASE }).ok, false);
  assert.equal(parseLessonManifest([], { mediaBase: BASE }).ok, false);
  // id may come from the folder; a mismatch is only a warning
  assert.equal(parse({ video: "v.mp4" }, "folder-id").manifest.id, "folder-id");
  assert.ok(parse({ ...FULL, id: "other" }, "demo").warnings[0].includes("differs"));
});

test("manifest: media URLs — relative, site-absolute and https pass; javascript:/data:/../protocol-relative rejected", () => {
  assert.equal(resolveMediaUrl("a.mp4", "/lesson-media/x"), "/lesson-media/x/a.mp4");
  assert.equal(resolveMediaUrl("./sub/a.mp4", BASE), "/lesson-media/demo/sub/a.mp4");
  assert.equal(resolveMediaUrl("/videos/a.mp4", BASE), "/videos/a.mp4");
  assert.equal(resolveMediaUrl("https://cdn.example.com/a.mp4", BASE), "https://cdn.example.com/a.mp4");
  for (const bad of ["javascript:alert(1)", "data:video/mp4;base64,AAAA", "//evil.example/a.mp4", "../secret.mp4", "a/../../b.mp4", "a b.mp4", "C:\\x.mp4", "", 7, null]) {
    assert.equal(resolveMediaUrl(bad, BASE), null, String(bad));
  }
});

test("manifest: per-language chapters, muxed fallback and review MP4 as last resort", () => {
  const perLang = parse({ ...FULL, chapters: { en: "c.en.vtt", ar: "c.ar.vtt" } }).manifest;
  assert.equal(chaptersUrl(perLang, "ar"), "/lesson-media/demo/c.ar.vtt");
  assert.equal(chaptersUrl(perLang, "fr"), "/lesson-media/demo/c.en.vtt");
  assert.equal(chaptersUrl(parse(FULL).manifest, "fr"), "/lesson-media/demo/chapters.vtt");
  assert.equal(chaptersUrl(parse({ ...FULL, chapters: undefined }).manifest, "en"), null);

  const full = parse(FULL).manifest;
  assert.deepEqual(playbackPlan(full, "ar"), { mode: "synced", lang: "ar", audio: "/lesson-media/demo/audio.ar.m4a" });

  // Master present, FR narration missing, FR muxed present → muxed for FR only.
  const mixed = parse({ ...FULL, audio: { en: "a.en.m4a" }, muxed: { fr: "lesson-fr.mp4" } }).manifest;
  assert.deepEqual(audioLanguages(mixed), ["en", "fr"]);
  assert.deepEqual(playbackPlan(mixed, "fr"), { mode: "muxed", lang: "fr", src: "/lesson-media/demo/lesson-fr.mp4" });
  assert.equal(playbackPlan(mixed, "ar").mode, "silent", "AR has subtitles but no narration → video + subtitles");

  // No master at all: review MP4 is the last-resort EN source.
  const reviewOnly = parse({ id: "demo", review_mp4: "lesson-en.mp4", subtitles: { ar: "s.ar.vtt" } }).manifest;
  assert.deepEqual(audioLanguages(reviewOnly), ["en"]);
  assert.deepEqual(playbackPlan(reviewOnly, "en"), { mode: "muxed", lang: "en", src: "/lesson-media/demo/lesson-en.mp4" });
  assert.equal(playbackPlan(reviewOnly, "ar").src, "/lesson-media/demo/lesson-en.mp4");
  // Review MP4 is NOT used while a silent master + narration exist.
  assert.equal(playbackPlan(full, "en").mode, "synced");
});

test("language defaults: platform UI language when available, else English, else first; subtitles follow audio", () => {
  const full = parse(FULL).manifest;
  assert.equal(initialLanguage(full, "ar"), "ar");
  assert.equal(initialLanguage(full, "fr"), "fr");
  assert.equal(initialLanguage(full, null), "en");
  assert.equal(initialLanguage(full, "de"), "en");
  const noEn = parse({ ...FULL, audio: { fr: "a.fr.m4a", ar: "a.ar.m4a" } }).manifest;
  assert.equal(initialLanguage(noEn, "en"), "ar", "EN/AR/FR order when the UI language is missing");
  assert.equal(subtitleFor(full, "fr"), "fr");
  const subsEnOnly = parse({ ...FULL, subtitles: { en: "s.en.vtt" } }).manifest;
  assert.equal(subtitleFor(subsEnOnly, "ar"), "en");
  assert.equal(subtitleFor(parse({ ...FULL, subtitles: {} }).manifest, "en"), null);
});

// ---------------------------------------------------------------- rendition

test("rendition: viewport × DPR picks the smallest rendition that covers the player", () => {
  const all = ["1080", "720", "480"];
  assert.equal(renditionForPixels(390), "480");
  assert.equal(renditionForPixels(854), "480");
  assert.equal(renditionForPixels(1280), "720");
  assert.equal(renditionForPixels(1600), "1080");
  assert.equal(pickRendition({ width: 390, devicePixelRatio: 1, available: all }), "480");
  assert.equal(pickRendition({ width: 390, devicePixelRatio: 3, available: all }), "480", "DPR capped at 2 → 780px");
  assert.equal(pickRendition({ width: 600, devicePixelRatio: 2, available: all }), "720");
  assert.equal(pickRendition({ width: 1040, devicePixelRatio: 1, available: all }), "720");
  assert.equal(pickRendition({ width: 1040, devicePixelRatio: 2, available: all }), "1080");
  assert.equal(pickRendition({ width: 0, available: all }), "720", "unknown width → 1280 default");
});

test("rendition: Save-Data / 2g / 3g / low downlink cap the choice; missing renditions fall back sensibly", () => {
  const all = ["1080", "720", "480"];
  assert.equal(networkCap({ saveData: true }), "480");
  assert.equal(networkCap({ effectiveType: "2g" }), "480");
  assert.equal(networkCap({ effectiveType: "slow-2g" }), "480");
  assert.equal(networkCap({ effectiveType: "3g" }), "480");
  assert.equal(networkCap({ effectiveType: "4g", downlink: 3 }), "720");
  assert.equal(networkCap({ effectiveType: "4g", downlink: 20 }), null);
  assert.equal(networkCap(null), null);
  assert.equal(pickRendition({ width: 1920, devicePixelRatio: 2, connection: { saveData: true }, available: all }), "480");
  assert.equal(pickRendition({ width: 1920, connection: { effectiveType: "4g", downlink: 2.5 }, available: all }), "720");
  assert.equal(pickRendition({ width: 1920, available: ["480", "720"] }), "720");
  assert.equal(pickRendition({ width: 390, available: ["1080", "720"] }), "720", "nothing small enough → smallest above");
  assert.equal(pickRendition({ width: 390, available: [] }), null);
});

// ---------------------------------------------------------------- sync

test("drift policy: tolerance, proportional rate nudge (capped), hard seek", () => {
  assert.deepEqual(driftAction(10, 10.02, 1), { kind: "none", rate: 1 });
  const ahead = driftAction(10, 10.1, 1);
  assert.equal(ahead.kind, "nudge");
  assert.ok(ahead.rate < 1 && ahead.rate >= 0.95, "audio ahead → slow down");
  const behind = driftAction(10, 9.9, 1.5);
  assert.ok(behind.kind === "nudge" && behind.rate > 1.5 && behind.rate <= 1.5 * 1.05, "audio behind → speed up, relative to base rate");
  assert.equal(driftAction(10, 10.29, 1).rate, 1 - DEFAULT_DRIFT.maxNudge);
  assert.deepEqual(driftAction(10, 10.5, 1), { kind: "seek", time: 10, drift: 0.5 });
  assert.equal(driftAction(10, 9, 1).kind, "seek");
  assert.equal(driftAction(10, Number.NaN, 1).kind, "none");
});

/** Minimal HTMLMediaElement stand-in: async events like a browser, manual clock. */
class FakeMedia extends EventTarget {
  constructor(name, { duration = 8, failLoad = false } = {}) {
    super();
    this.name = name;
    this._t = 0;
    this.paused = true;
    this.playbackRate = 1;
    this.readyState = 0;
    this.duration = Number.NaN;
    this._duration = duration;
    this.src = "";
    this.failLoad = failLoad;
    this.blockPlay = false;
    this.loads = 0;
    this.log = [];
  }
  get currentTime() {
    return this._t;
  }
  set currentTime(value) {
    this._t = value;
    this.log.push(`seek:${value.toFixed(2)}`);
    this.emit("seeking");
    this.emit("seeked");
  }
  emit(type) {
    queueMicrotask(() => this.dispatchEvent(new Event(type)));
  }
  load() {
    this.loads += 1;
    this.readyState = 0;
    this.duration = Number.NaN;
    this.paused = true;
    if (!this.src) return;
    queueMicrotask(() => {
      if (this.failLoad) return this.dispatchEvent(new Event("error"));
      this.readyState = 1;
      this.duration = this._duration;
      this.dispatchEvent(new Event("loadedmetadata"));
    });
  }
  removeAttribute(name) {
    if (name === "src") this.src = "";
  }
  play() {
    if (this.blockPlay) {
      const error = new Error("blocked");
      error.name = "NotAllowedError";
      return Promise.reject(error);
    }
    if (this.paused) {
      this.paused = false;
      this.log.push("play");
      this.emit("play");
      this.emit("playing");
    }
    return Promise.resolve();
  }
  pause() {
    if (!this.paused) {
      this.paused = true;
      this.log.push("pause");
      this.emit("pause");
    }
  }
  /** Advance the playhead without firing seek events (normal playback). */
  tick(seconds) {
    if (!this.paused) this._t += seconds * this.playbackRate;
  }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

async function setup(opts = {}) {
  const video = new FakeMedia("video");
  const audio = new FakeMedia("audio", opts.audio);
  const events = { hold: [], switching: [], audioError: 0, blocked: 0 };
  const sync = new AudioVideoSync(video, audio, {
    onHold: (v) => events.hold.push(v),
    onSwitching: (v) => events.switching.push(v),
    onAudioError: () => (events.audioError += 1),
    onAudioBlocked: () => (events.blocked += 1),
  });
  await sync.setVideoSource("/m/v720.mp4");
  await sync.setAudioSource("/m/audio.en.m4a");
  await flush();
  return { video, audio, sync, events };
}

test("sync: play/pause/seek/rate follow the video; audio is aligned to the video clock", async () => {
  const { video, audio, sync } = await setup();
  assert.equal(audio.src, "/m/audio.en.m4a");
  await sync.play();
  await flush();
  assert.equal(video.paused, false);
  assert.equal(audio.paused, false);
  assert.equal(sync.state.intent, true);

  video.tick(2);
  audio.tick(2);
  sync.seek(5);
  await flush();
  assert.equal(video.currentTime, 5);
  assert.equal(audio.currentTime, 5);
  assert.equal(audio.paused, false, "audio resumes after seeked while playing");

  sync.setRate(1.5);
  await flush();
  assert.equal(audio.playbackRate, 1.5);

  sync.pause();
  await flush();
  assert.equal(video.paused, true);
  assert.equal(audio.paused, true);
  assert.equal(sync.state.intent, false);

  // Seek while paused keeps both paused and aligned.
  sync.seek(1);
  await flush();
  assert.equal(audio.currentTime, 1);
  assert.equal(audio.paused, true);
  sync.destroy();
});

test("sync: drift correction nudges small drift and hard-seeks large drift", async () => {
  const { video, audio, sync } = await setup();
  await sync.play();
  await flush();
  video._t = 4;
  audio._t = 4.1;
  const nudge = sync.correctDrift();
  assert.equal(nudge.kind, "nudge");
  assert.ok(audio.playbackRate < 1);
  audio._t = 4.0;
  assert.equal(sync.correctDrift().kind, "none");
  assert.equal(audio.playbackRate, 1, "rate restored once back in tolerance");
  audio._t = 6;
  assert.equal(sync.correctDrift().kind, "seek");
  assert.equal(audio.currentTime, 4);
  // timeupdate drives the same correction
  audio._t = 7;
  video.dispatchEvent(new Event("timeupdate"));
  assert.equal(audio.currentTime, 4);
  sync.destroy();
});

test("sync: video buffering pauses narration; narration buffering holds the video without losing play intent", async () => {
  const { video, audio, sync, events } = await setup();
  await sync.play();
  await flush();
  video.dispatchEvent(new Event("waiting"));
  assert.equal(audio.paused, true, "video stalled → narration paused");
  video.dispatchEvent(new Event("playing"));
  await flush();
  assert.equal(audio.paused, false, "video resumed → narration resumes");

  audio.dispatchEvent(new Event("waiting"));
  await flush();
  assert.equal(video.paused, true, "narration stalled → video held");
  assert.equal(sync.state.intent, true, "hold is not a user pause");
  assert.deepEqual(events.hold, [true]);
  audio.dispatchEvent(new Event("canplay"));
  await flush();
  assert.equal(video.paused, false, "narration ready → video resumes");
  assert.deepEqual(events.hold, [true, false]);
  sync.destroy();
});

test("sync: language switch swaps the narration at the same position and keeps play state", async () => {
  const { video, audio, sync, events } = await setup();
  await sync.play();
  await flush();
  video._t = 3.25;
  audio._t = 3.25;
  const loadsBefore = video.loads;
  const switching = sync.setAudioSource("/m/audio.ar.m4a");
  assert.equal(sync.state.switching, true);
  await switching;
  await flush();
  assert.equal(audio.src, "/m/audio.ar.m4a");
  assert.equal(audio.currentTime, 3.25, "new narration starts where the video is");
  assert.equal(video.currentTime, 3.25, "video position untouched");
  assert.equal(video.loads, loadsBefore, "video is not reloaded on a language switch");
  assert.equal(video.paused, false, "was playing → still playing");
  assert.equal(audio.paused, false);
  assert.equal(sync.state.switching, false);
  assert.deepEqual(events.switching.slice(-2), [true, false]);

  // Paused before the switch → paused after, still aligned.
  sync.pause();
  await flush();
  video._t = 6;
  await sync.setAudioSource("/m/audio.fr.m4a");
  await flush();
  assert.equal(audio.currentTime, 6);
  assert.equal(video.paused, true);
  assert.equal(audio.paused, true);
  sync.destroy();
});

test("sync: overlapping switches — only the last language wins", async () => {
  const { audio, sync } = await setup();
  const first = sync.setAudioSource("/m/audio.ar.m4a");
  const second = sync.setAudioSource("/m/audio.fr.m4a");
  await Promise.all([first, second]);
  await flush();
  assert.equal(audio.src, "/m/audio.fr.m4a");
  assert.equal(sync.state.switching, false);
  sync.destroy();
});

test("sync: rendition switch reloads the video at the same position and play state", async () => {
  const { video, audio, sync } = await setup();
  await sync.play();
  await flush();
  video._t = 2.5;
  audio._t = 2.5;
  sync.setRate(1.25);
  await sync.setVideoSource("/m/v480.mp4");
  await flush();
  assert.equal(video.src, "/m/v480.mp4");
  assert.equal(video.currentTime, 2.5);
  assert.equal(video.playbackRate, 1.25, "rate survives load()");
  assert.equal(video.paused, false);
  assert.equal(audio.paused, false);
  sync.destroy();
});

test("sync: detaching narration (muxed/silent) stops driving the audio; audio errors and autoplay blocks are reported", async () => {
  const { video, audio, sync, events } = await setup();
  await sync.setAudioSource(null);
  await sync.play();
  await flush();
  assert.equal(audio.src, "");
  assert.equal(audio.paused, true);
  assert.equal(video.paused, false);
  assert.equal(sync.correctDrift(), null);
  sync.destroy();

  const broken = await setup({ audio: { failLoad: true } });
  assert.equal(broken.events.audioError >= 1, true, "audio load error surfaced");
  broken.sync.destroy();

  const blocked = await setup();
  blocked.audio.blockPlay = true;
  blocked.video.play();
  await flush();
  await flush();
  assert.equal(blocked.events.blocked, 1);
  blocked.sync.destroy();
  assert.equal(events.audioError, 0);
});

test("sync: narration time is clamped to its duration", async () => {
  const { video, audio, sync } = await setup({ audio: { duration: 7.5 } });
  video._t = 7.9;
  sync.seek(7.9);
  await flush();
  assert.ok(audio.currentTime <= 7.5);
  sync.destroy();
});

// ---------------------------------------------------------------- vtt / keys / clock

test("vtt: timestamps, cues (ids, settings, tags, CRLF, BOM) and chapter lookup", () => {
  assert.equal(parseVttTimestamp("00:01.500"), 1.5);
  assert.equal(parseVttTimestamp("01:02:03.04"), 3723.04);
  assert.equal(parseVttTimestamp("nope"), null);
  const cues = parseVtt("\uFEFFWEBVTT\r\n\r\n1\r\n00:00:00.000 --> 00:00:03.000 align:start\r\n<b>Intro</b>\r\n\r\nNOTE skip me\r\n\r\n00:00:03.000 --> 00:00:06.000\r\nالدور 2π\r\n");
  assert.deepEqual(cues, [
    { start: 0, end: 3, text: "Intro" },
    { start: 3, end: 6, text: "الدور 2π" },
  ]);
  assert.deepEqual(parseVtt("not a vtt"), []);
  assert.equal(chapterAt(cues, 0), 0);
  assert.equal(chapterAt(cues, 4.2), 1);
  assert.equal(chapterAt([], 4), -1);
});

test("keyboard map: space/k, arrows, j/l, m, c, f; sliders keep their own arrow keys", () => {
  assert.deepEqual(keyAction(" "), { type: "toggle" });
  assert.deepEqual(keyAction("K"), { type: "toggle" });
  assert.deepEqual(keyAction("ArrowRight"), { type: "seekBy", seconds: 5 });
  assert.deepEqual(keyAction("ArrowLeft"), { type: "seekBy", seconds: -5 });
  assert.deepEqual(keyAction("ArrowUp"), { type: "volumeBy", delta: 0.1 });
  assert.deepEqual(keyAction("m"), { type: "mute" });
  assert.deepEqual(keyAction("c"), { type: "subtitles" });
  assert.deepEqual(keyAction("f"), { type: "fullscreen" });
  assert.deepEqual(keyAction("l"), { type: "seekBy", seconds: 10 });
  assert.equal(keyAction("ArrowRight", { onSlider: true }), null);
  assert.equal(keyAction("x"), null);
  assert.equal(formatClock(0), "0:00");
  assert.equal(formatClock(65.9), "1:05");
  assert.equal(formatClock(3725), "1:02:05");
  assert.equal(formatClock(Number.NaN), "0:00");
});

// ---------------------------------------------------------------- content + fixture + gating

test("content loader: demo manifest loads; unknown / traversal ids do not", async () => {
  const result = await loadLessonManifest("demo-sine", path.join(ROOT, "content/lessons"));
  assert.ok(result.ok, result.ok ? "" : result.error);
  assert.deepEqual(result.warnings, []);
  assert.equal(result.manifest.video["720"], "/lesson-media/demo-sine/video.720.mp4");
  assert.equal(result.manifest.aiVoice, true);
  assert.deepEqual(audioLanguages(result.manifest), ["en", "ar", "fr"]);
  assert.equal((await loadLessonManifest("../../package", path.join(ROOT, "content/lessons"))).ok, false);
  assert.equal((await loadLessonManifest("grade-12-ls-continuity", path.join(ROOT, "content/lessons"))).ok, false, "storyboard-only lessons are not player lessons");
});

const hasFfmpeg = spawnSync("ffmpeg", ["-version"], { stdio: "ignore" }).status === 0;

test("demo fixture script produces every file the demo manifest references (small, exact durations)", { skip: !hasFfmpeg && "ffmpeg not installed" }, () => {
  const out = mkdtempSync(path.join(tmpdir(), "lesson-demo-"));
  try {
    execFileSync(path.join(ROOT, "scripts/make-lesson-demo.sh"), [out], { stdio: "pipe" });
    const raw = JSON.parse(readFileSync(path.join(ROOT, "content/lessons/demo-sine/lesson.json"), "utf8"));
    const refs = [raw.poster, raw.chapters, raw.review_mp4, ...Object.values(raw.video), ...Object.values(raw.audio), ...Object.values(raw.subtitles)];
    for (const ref of refs) assert.ok(existsSync(path.join(out, ref)), `missing ${ref}`);
    const total = readdirSync(out).reduce((sum, name) => sum + statSync(path.join(out, name)).size, 0);
    assert.ok(total < 1_000_000, `fixture should stay tiny, got ${total} bytes`);
    const probe = (file) => Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path.join(out, file)]).toString().trim());
    const videoDuration = probe(raw.video["480"]);
    for (const lang of ["en", "ar", "fr"]) assert.ok(Math.abs(probe(raw.audio[lang]) - videoDuration) < 0.05, `audio.${lang} length = video length`);
    const streams = execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_type,codec_name", "-of", "csv=p=0", path.join(out, raw.video["1080"])]).toString();
    assert.match(streams, /h264,video/);
    assert.doesNotMatch(streams, /audio/, "master video is silent");
    for (const lang of ["en", "ar", "fr"]) assert.ok(parseVtt(readFileSync(path.join(out, raw.subtitles[lang]), "utf8")).length >= 3);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test("gating: preview route is staff-only, private, and not linked from any navigation", () => {
  const layout = readFileSync(path.join(ROOT, "src/app/lessons/preview/layout.tsx"), "utf8");
  assert.match(layout, /await requireStaff\("\/lessons\/preview"\)/);
  assert.match(layout, /privateRobotsMetadata/);
  const offenders = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(tsx?|mjs)$/.test(name) && !full.includes(`${path.sep}lessons${path.sep}preview${path.sep}`)) {
        if (/["'`]\/lessons\/preview/.test(readFileSync(full, "utf8"))) offenders.push(path.relative(ROOT, full));
      }
    }
  };
  walk(path.join(ROOT, "src"));
  assert.deepEqual(offenders, [], "nothing outside the preview route links to it");
});
