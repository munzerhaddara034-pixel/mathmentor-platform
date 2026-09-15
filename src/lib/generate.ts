import { createId } from "./ids";
import type { ContentDraft, LibraryItem, StoryboardScene } from "./types";

function firstLines(text: string, count = 4) {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, count);
}

function scenesForLesson(item: LibraryItem): StoryboardScene[] {
  const lines = firstLines(item.extractedText || item.notes, 3);
  const topic = lines[0] ?? item.title;
  return [
    {
      title: item.language === "ar" ? "هدف الدرس" : "Lesson goal",
      narration:
        item.language === "ar"
          ? `اليوم نشرح ${item.title} وفق المنهج اللبناني. نبدأ بالفكرة ثم نحل مثالاً ونتحقق.`
          : `Today we explain ${item.title} for the Lebanese curriculum. We start with the idea, then a worked example, then a check.`,
      board: topic,
      durationSeconds: 18,
    },
    {
      title: item.language === "ar" ? "الخطوات" : "Worked steps",
      narration:
        item.language === "ar"
          ? "نكتب المعطيات، نختار القانون المناسب، وننفّذ خطوة بعد خطوة دون القفز إلى الناتج."
          : "Write the given information, choose the right rule, and move one step at a time instead of jumping to the answer.",
      board: lines[1] ?? item.notes,
      durationSeconds: 22,
    },
    {
      title: item.language === "ar" ? "التحقق" : "Check the result",
      narration:
        item.language === "ar"
          ? "نعوّض الناتج في العبارة الأصلية. إذا تحقق التساوي فالحل مقبول للنشر بعد مراجعة الأستاذ."
          : "Substitute the result back. If the original statement holds, the draft can wait for professor approval.",
      board: lines[2] ?? item.subject,
      durationSeconds: 16,
    },
  ];
}

function scenesForSolution(item: LibraryItem): StoryboardScene[] {
  const lines = firstLines(item.extractedText, 4);
  return [
    {
      title: item.language === "ar" ? "قراءة المسألة" : "Read the problem",
      narration:
        item.language === "ar"
          ? "نحدد المطلوب والمعطيات قبل أي حساب، كما في نماذج الشهادة اللبنانية."
          : "Identify what is asked and what is given before any calculation, as in Lebanese exam models.",
      board: lines[0] ?? item.title,
      durationSeconds: 16,
    },
    {
      title: item.language === "ar" ? "الحل المفصل" : "Worked solution",
      narration:
        item.language === "ar"
          ? "نكتب القانون ثم نعوّض الأرقام، ونذكر الوحدة إن وُجدت."
          : "State the rule, substitute the values, and keep units if they matter.",
      board: lines.slice(1, 3).join("\n") || item.notes,
      durationSeconds: 24,
    },
    {
      title: item.language === "ar" ? "الناتج النهائي" : "Final answer",
      narration:
        item.language === "ar"
          ? "نضع الناتج في إطار واضح. هذا الفيديو لا يصل إلى الطالب قبل اعتماد الأستاذ."
          : "Box the final answer. This video is not shown to students until the professor approves it.",
      board: lines[3] ?? "Answer pending professor review",
      durationSeconds: 14,
    },
  ];
}

function printableFrom(item: LibraryItem) {
  const body = item.extractedText || item.notes;
  if (item.language === "ar") {
    return `حل ورقي — ${item.title}

المصدر: ${item.fileName}
المسار: ${item.subject}

الخطوات:
1. انقل المسألة كما وردت في الكتاب أو النموذج.
2. اكتب القانون أو القاعدة المستخدمة.
3. نفّذ الحساب خطوة بخطوة.
4. تحقق بالتعويض أو بالمعنى السياقي.

المقتطف المعتمد للتوليد:
${body}

ملاحظة: هذه ورقة مسودة. لا تُطبع للطلاب إلا بعد اعتماد الأستاذ منذر.`;
  }
  return `Paper solution — ${item.title}

Source: ${item.fileName}
Track: ${item.subject}

Steps:
1. Copy the problem as it appears in the book or exam model.
2. Write the rule used.
3. Compute step by step.
4. Check by substitution or context.

Extract used for generation:
${body}

Note: This sheet stays in review until Professor Munzer approves it.`;
}

function scriptFrom(scenes: StoryboardScene[], title: string, kindLabel: string) {
  return [`${kindLabel}: ${title}`, ...scenes.map((scene, index) => `Scene ${index + 1} · ${scene.title}\n${scene.narration}\nBoard: ${scene.board}`)].join("\n\n");
}

export function generateDraftsFromLibrary(item: LibraryItem): ContentDraft[] {
  const createdAt = new Date().toISOString();
  const lessonScenes = scenesForLesson(item);
  const solutionScenes = scenesForSolution(item);
  const shared = {
    libraryItemId: item.id,
    language: item.language,
    status: "awaiting_approval" as const,
    createdAt,
  };

  const lesson: ContentDraft = {
    ...shared,
    id: createId("draft"),
    kind: "lesson-video",
    title: item.language === "ar" ? `شرح درس: ${item.title}` : `Lesson video: ${item.title}`,
    skill: item.subject,
    questionRef: `${item.track}/lesson/${item.id}`,
    videoScript: scriptFrom(lessonScenes, item.title, item.language === "ar" ? "فيديو شرح" : "Lesson video"),
    storyboard: lessonScenes,
    printableSolution: printableFrom(item),
  };

  const videoSolution: ContentDraft = {
    ...shared,
    id: createId("draft"),
    kind: "exam-solution-video",
    title: item.language === "ar" ? `فيديو حل: ${item.title}` : `Solution video: ${item.title}`,
    skill: item.subject,
    questionRef: `${item.track}/solution-video/${item.id}`,
    videoScript: scriptFrom(solutionScenes, item.title, item.language === "ar" ? "فيديو حل" : "Solution video"),
    storyboard: solutionScenes,
    printableSolution: printableFrom(item),
  };

  const paperSolution: ContentDraft = {
    ...shared,
    id: createId("draft"),
    kind: "exam-solution-paper",
    title: item.language === "ar" ? `حل ورقي: ${item.title}` : `Paper solution: ${item.title}`,
    skill: item.subject,
    questionRef: `${item.track}/paper/${item.id}`,
    videoScript: item.language === "ar" ? "حل مطبوع بلا فيديو — يُعتمد كنسخة ورقية بعد المراجعة." : "Printable solution with no video track — published on paper after review.",
    storyboard: [],
    printableSolution: printableFrom(item),
  };

  if (item.kind === "solution-guide") return [videoSolution, paperSolution];
  if (item.kind === "book") return [lesson, paperSolution];
  return [lesson, videoSolution, paperSolution];
}
