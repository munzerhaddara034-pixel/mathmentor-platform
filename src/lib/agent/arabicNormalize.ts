/**
 * Lebanese colloquial (عامية) + MSA (فصحى) orthography normalizer for intent heuristics.
 * Unit-testable; does not alter payment/allowlist phones.
 */

/** Tatweel / kashida */
const TATWEEL = /\u0640/g;

/** Combining Arabic diacritics (fatha..sukun, shadda, Quranic marks commonly seen in typed chat) */
const DIACRITICS =
  /[\u064B-\u065F\u0670\u06D6-\u06ED]/g;

/** Common Lebanese / informal spellings → canonical match tokens */
const LEBANESE_SPELLING: ReadonlyArray<readonly [RegExp, string]> = [
  [/بد[ّ]?ي/g, "بدي"],
  [/هل[ّ]?ا|هللا|هلق|هلّق/g, "هلا"],
  [/بكر[ةاه]/g, "بكرا"],
  [/بعد\s*بكر[ةاه]/g, "بعد بكرا"],
  [/بعدين/g, "بعدين"],
  [/فيي+/g, "فيي"],
  [/منيح/g, "منيح"],
  [/شو+/g, "شو"],
  [/هل[ّ]?ق/g, "هلا"],
  [/المسا(?![ءا])/g, "المساء"],
  [/الصبح/g, "الصبح"],
  [/نبل[ّ]?ش|نبلش/g, "نبلش"],
  [/شغل\s*الوكيل/g, "شغل الوكيل"],
  [/كل\s*شي\s*تمام/g, "كل شي تمام"],
  [/في\s*عطل|فيي?\s*عطل/g, "في عطل"],
  [/ما\s*تنس[اىةه]/g, "ما تنسى"],
  [/حط[ّ]?ي?/g, "حط"],
  [/سج[ّ]?ل/g, "سجل"],
  [/ذك[ّ]?رني/g, "ذكرني"],
  [/اجند[ةه]/g, "اجنده"],
  [/المنص[ةه]/g, "المنصه"],
  [/جاهز[ةه]/g, "جاهزه"],
];

/**
 * Normalize Arabic dialect/MSA orthography for keyword matching.
 * - strips tatweel + diacritics
 * - أإآٱ → ا, ى → ي, ة → ه
 * - applies common Lebanese spelling folds
 * - lowercases Latin side; collapses whitespace
 */
export function normalizeArabicForMatch(raw: string): string {
  let s = (raw || "").normalize("NFC");
  s = s.replace(TATWEEL, "");
  s = s.replace(DIACRITICS, "");
  s = s.replace(/[أإآٱ]/g, "ا");
  s = s.replace(/ى/g, "ي");
  s = s.replace(/ة/g, "ه");
  s = s.toLowerCase();
  for (const [re, rep] of LEBANESE_SPELLING) {
    s = s.replace(re, rep);
  }
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

/** Join original + normalized so heuristics can match either form. */
export function arabicMatchBlob(raw: string): string {
  const original = (raw || "").trim();
  const normalized = normalizeArabicForMatch(original);
  if (!normalized || normalized === original.toLowerCase()) return `${original} ${original.toLowerCase()}`;
  return `${original} ${original.toLowerCase()} ${normalized}`;
}

/** Test helper: whether normalized text matches a pattern. */
export function arabicMatches(raw: string, pattern: RegExp): boolean {
  return pattern.test(arabicMatchBlob(raw));
}
