/**
 * Demo speech→LaTeX + pedagogy checks (no Next server).
 * Run: npx tsx scripts/verify-voice-math.ts
 */
import { DEMO_DICTATION_AR, DEMO_DICTATION_EN, demoParseTranscript, questionFromTranscript } from "../src/lib/voiceMath/demo";
import { extractLatexHints, spokenMathToPlain } from "../src/lib/voiceMath/phrases";
import { syncTimelineToAudio } from "../src/lib/voiceMath/sync";
import { FORBIDDEN_NAME_AR, FORBIDDEN_NAME_EN, INSTRUCTOR_AR, INSTRUCTOR_EN } from "../src/lib/pedagogy/lebanese";
import { hasExamTip, hasVariationTable, hasBoxedAnswer } from "../src/lib/studio/timeline";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function main() {
  const plainAr = spokenMathToPlain(DEMO_DICTATION_AR);
  assert(/x\^2/.test(plainAr), "Arabic dictation should map إكس مربع → x^2");
  assert(/f'\(x\)|f\(x\)/.test(plainAr), "Arabic dictation should map ديريفاتيف / إف إكس");
  assert(/lim x->\+inf/.test(plainAr), "Arabic dictation should map نهاية عند الزائد إنفينيتي");

  const hints = extractLatexHints(DEMO_DICTATION_AR);
  assert(
    hints.some((item) => item.latex === "x^{2}"),
    "hint x^{2}",
  );
  assert(
    hints.some((item) => item.latex.includes("\\lim")),
    "hint lim",
  );
  assert(
    hints.some((item) => item.latex === "f'(x)"),
    "hint f'(x)",
  );

  assert(questionFromTranscript(DEMO_DICTATION_AR).includes("x^2 - 5x + 6"), "quadratic question from Arabic stub");
  assert(questionFromTranscript(DEMO_DICTATION_EN).includes("x^2 - 5x + 6"), "quadratic question from English stub");

  const parsed = demoParseTranscript(DEMO_DICTATION_AR, "ar", "brevet");
  assert(parsed.latexSteps.length >= 3, "Lebanese demo solver should return ≥3 steps");
  assert(parsed.solution.examTip.en.toLowerCase().includes("key idea") || /exam tip/i.test(parsed.solution.examTip.en), "exam tip present");
  const blob = JSON.stringify(parsed);
  assert(!blob.includes(FORBIDDEN_NAME_AR) && !blob.includes(FORBIDDEN_NAME_EN), "never الطارة / Al-Tarah");
  assert(blob.includes(INSTRUCTOR_EN) || parsed.solution.timeline.instructor === INSTRUCTOR_EN, "Munzer Haddara branding");
  assert(INSTRUCTOR_AR.includes("حداره"), "Arabic instructor name");

  const synced = syncTimelineToAudio(parsed.solution.timeline, {
    durationSec: 40,
    segments: [
      { start: 0, end: 8, text: "tip" },
      { start: 8, end: 16, text: "domain" },
    ],
  });
  assert(synced.timeline.durationSec === 40, "audio duration wins");
  assert((synced.timeline.events?.length ?? 0) > 0, "canvas events remapped");
  assert(hasExamTip(synced.timeline), "exam_tip on canvas");
  assert(hasVariationTable(synced.timeline) || hasBoxedAnswer(synced.timeline), "variation or boxed answer");
  console.log("voice-math demo pipeline ok ·", parsed.question, "· steps", parsed.latexSteps.length);
}

main();
