import type { GradeTrack, Language, LibraryItem, SourceKind } from "./types";

export const AHLIA_BOOKS_DIR = "C:\\Users\\user\\OneDrive\\Desktop\\math book ahlia";

type AhliaMeta = {
  title: string;
  kind: SourceKind;
  track: GradeTrack;
  subject: string;
  language: Language;
  notes: string;
};

export const ahliaBookMeta: Record<string, AhliaMeta> = {
  "math eb7 2006 al-ahlia.pdf": {
    title: "Al-Ahlia Mathematics EB7 (2006)",
    kind: "book",
    track: "grade-7",
    subject: "رياضيات الحلقة الثالثة · صف 7",
    language: "en",
    notes: "كتاب الأهلية للصف السابع. يُستخدم لتوليد شروح دروس الحلقة الثالثة بعد مراجعة الأستاذ.",
  },
  "mathematiques eb8 2007.pdf": {
    title: "Al-Ahlia Mathématiques EB8 (2007)",
    kind: "book",
    track: "grade-8",
    subject: "رياضيات الحلقة الثالثة · صف 8",
    language: "en",
    notes: "كتاب الأهلية للصف الثامن. مرجع لتوليد دروس الفيديو والتمارين الورقية.",
  },
  "math eb9 2010 al-ahlia.pdf": {
    title: "Al-Ahlia Mathematics EB9 (2010)",
    kind: "book",
    track: "grade-9",
    subject: "شهادة متوسطة · صف 9",
    language: "en",
    notes: "كتاب الأهلية للصف التاسع / البريفيه. أساس نماذج الشهادة المتوسطة.",
  },
  "maths-gr-9-geometry-of-2d-shapes.pdf": {
    title: "Grade 9 Geometry of 2D Shapes",
    kind: "worksheet",
    track: "grade-9",
    subject: "هندسة مستوية · صف 9",
    language: "en",
    notes: "وحدة هندسة الأشكال ثنائية البعد للصف التاسع.",
  },
  "11s volume 1.pdf": {
    title: "Grade 11 Sciences · Volume 1",
    kind: "book",
    track: "grade-11",
    subject: "علوم · صف 11 · المجلد 1",
    language: "en",
    notes: "المجلد الأول لصف العلوم 11. لتوليد شروح الدروس قبل الاعتماد.",
  },
  "grade 11 s volume 2.pdf": {
    title: "Grade 11 Sciences · Volume 2",
    kind: "book",
    track: "grade-11",
    subject: "علوم · صف 11 · المجلد 2",
    language: "en",
    notes: "المجلد الثاني لصف العلوم 11.",
  },
  "maths s1g 2015.pdf": {
    title: "Maths S1G 2015",
    kind: "book",
    track: "grade-11",
    subject: "سنة أولى ثانوي · علوم عامة",
    language: "en",
    notes: "كتاب السنة الأولى ثانوي علوم عامة (S1G).",
  },
  "math-s1g 2015.pdf": {
    title: "Math-S1G 2015",
    kind: "book",
    track: "grade-11",
    subject: "سنة أولى ثانوي · علوم عامة",
    language: "en",
    notes: "نسخة Math-S1G 2015. تُستبعد النسخ المكررة (1) و(2) تلقائياً.",
  },
  "ahlia mathematics se english 20014.pdf": {
    title: "AHLIA Mathematics SE English",
    kind: "book",
    track: "grade-12",
    subject: "اجتماع واقتصاد",
    language: "en",
    notes: "كتاب الأهلية لفرع الاجتماع والاقتصاد بالإنجليزية.",
  },
  "mathematics sv english 2013.pdf": {
    title: "Mathematics SV English 2013",
    kind: "book",
    track: "grade-12",
    subject: "علوم الحياة",
    language: "en",
    notes: "كتاب SV بالإنجليزية، قريب من مسار علوم الحياة.",
  },
  "maths sv. sgahlia.pdf": {
    title: "Maths SV / SG Al-Ahlia",
    kind: "book",
    track: "grade-12",
    subject: "علوم الحياة / علوم عامة",
    language: "en",
    notes: "مرجع أهليه لمساري SV وSG.",
  },
  "grade 12 ls.pdf": {
    title: "Grade 12 Life Sciences",
    kind: "book",
    track: "grade-12",
    subject: "علوم الحياة · صف 12",
    language: "en",
    notes: "كتاب الصف الثاني عشر علوم الحياة. يولّد شروح الدروس ثم تُراجع.",
  },
  "solution 12ls.pdf": {
    title: "Solution Guide · Grade 12 LS",
    kind: "solution-guide",
    track: "grade-12",
    subject: "حلول علوم الحياة · صف 12",
    language: "en",
    notes: "دليل حلول 12 LS. يولّد حلولاً ورقية وفيديو حل، ولا تُنشر قبل اعتماد الأستاذ.",
  },
  "general science.pdf": {
    title: "General Science Mathematics",
    kind: "book",
    track: "grade-12",
    subject: "علوم عامة",
    language: "en",
    notes: "كتاب الرياضيات لفرع العلوم العامة.",
  },
  "chamel sg (1).pdf": {
    title: "Chamel SG",
    kind: "solution-guide",
    track: "grade-12",
    subject: "شامل علوم عامة",
    language: "ar",
    notes: "شامل حلول/جلسات علوم عامة. مصدر لتوليد حلول النماذج.",
  },
  "gs-all sessions (1).pdf": {
    title: "GS · All Sessions",
    kind: "exam-model",
    track: "grade-12",
    subject: "جلسات علوم عامة",
    language: "en",
    notes: "حزمة جلسات علوم عامة محاكية للامتحان.",
  },
  "ls- all sessions.pdf": {
    title: "LS · All Sessions",
    kind: "exam-model",
    track: "grade-12",
    subject: "جلسات علوم الحياة",
    language: "en",
    notes: "حزمة جلسات علوم الحياة المحاكية للامتحان.",
  },
};

export function normalizePdfName(fileName: string) {
  return fileName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isDuplicateAhliaFile(fileName: string) {
  const name = fileName.toLowerCase();
  return name.includes("math-s1g 2015 (1)") || name.includes("math-s1g 2015 (2)");
}

export function metaForAhliaFile(fileName: string): AhliaMeta {
  const normalized = normalizePdfName(fileName);
  const match = Object.entries(ahliaBookMeta).find(([key]) => normalizePdfName(key) === normalized);
  if (match) return match[1];
  if (normalized.includes("eb8")) return ahliaBookMeta["mathematiques eb8 2007.pdf"];
  if (normalized.includes("s1g") && normalized.includes("1ere")) {
    return {
      title: "Mathématiques 1ère année Secondaire S1G",
      kind: "book",
      track: "grade-11",
      subject: "سنة أولى ثانوي · علوم عامة",
      language: "en",
      notes: "كتاب السنة الأولى ثانوي S1G من مجموعة الأهلية.",
    };
  }
  return {
    title: fileName.replace(/\.pdf$/i, ""),
    kind: "book",
    track: "grade-12",
    subject: "مرجع أهليه غير مصنّف",
    language: "en",
    notes: "أُضيف من مجلد كتب الأهلية. راجع التصنيف قبل التوليد.",
  };
}

export function libraryPreview(item: Pick<LibraryItem, "title" | "notes" | "fileName">) {
  return `${item.title}\n${item.notes}\nSource file: ${item.fileName}`;
}
