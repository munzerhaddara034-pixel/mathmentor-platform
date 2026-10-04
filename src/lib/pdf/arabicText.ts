/**
 * Arabic for PDFs without a shaping engine: contextual letter forms via the Unicode Arabic
 * Presentation Forms (A/B) incl. lam-alef ligatures, plus a small bidi pass (RTL / LTR runs,
 * numbers and Latin maths stay left-to-right, brackets mirrored inside RTL runs).
 * Dependency-free and unit-tested. Harakat (tashkeel) are dropped: without GPOS they would be misplaced.
 */

/** [isolated, final, initial, medial]; R-joining letters have no initial / medial form. */
type Forms = readonly [number, number, number?, number?];

const FORMS: ReadonlyMap<number, Forms> = new Map<number, Forms>([
  [0x0621, [0xfe80, 0xfe80]],
  [0x0622, [0xfe81, 0xfe82]],
  [0x0623, [0xfe83, 0xfe84]],
  [0x0624, [0xfe85, 0xfe86]],
  [0x0625, [0xfe87, 0xfe88]],
  [0x0626, [0xfe89, 0xfe8a, 0xfe8b, 0xfe8c]],
  [0x0627, [0xfe8d, 0xfe8e]],
  [0x0628, [0xfe8f, 0xfe90, 0xfe91, 0xfe92]],
  [0x0629, [0xfe93, 0xfe94]],
  [0x062a, [0xfe95, 0xfe96, 0xfe97, 0xfe98]],
  [0x062b, [0xfe99, 0xfe9a, 0xfe9b, 0xfe9c]],
  [0x062c, [0xfe9d, 0xfe9e, 0xfe9f, 0xfea0]],
  [0x062d, [0xfea1, 0xfea2, 0xfea3, 0xfea4]],
  [0x062e, [0xfea5, 0xfea6, 0xfea7, 0xfea8]],
  [0x062f, [0xfea9, 0xfeaa]],
  [0x0630, [0xfeab, 0xfeac]],
  [0x0631, [0xfead, 0xfeae]],
  [0x0632, [0xfeaf, 0xfeb0]],
  [0x0633, [0xfeb1, 0xfeb2, 0xfeb3, 0xfeb4]],
  [0x0634, [0xfeb5, 0xfeb6, 0xfeb7, 0xfeb8]],
  [0x0635, [0xfeb9, 0xfeba, 0xfebb, 0xfebc]],
  [0x0636, [0xfebd, 0xfebe, 0xfebf, 0xfec0]],
  [0x0637, [0xfec1, 0xfec2, 0xfec3, 0xfec4]],
  [0x0638, [0xfec5, 0xfec6, 0xfec7, 0xfec8]],
  [0x0639, [0xfec9, 0xfeca, 0xfecb, 0xfecc]],
  [0x063a, [0xfecd, 0xfece, 0xfecf, 0xfed0]],
  [0x0641, [0xfed1, 0xfed2, 0xfed3, 0xfed4]],
  [0x0642, [0xfed5, 0xfed6, 0xfed7, 0xfed8]],
  [0x0643, [0xfed9, 0xfeda, 0xfedb, 0xfedc]],
  [0x0644, [0xfedd, 0xfede, 0xfedf, 0xfee0]],
  [0x0645, [0xfee1, 0xfee2, 0xfee3, 0xfee4]],
  [0x0646, [0xfee5, 0xfee6, 0xfee7, 0xfee8]],
  [0x0647, [0xfee9, 0xfeea, 0xfeeb, 0xfeec]],
  [0x0648, [0xfeed, 0xfeee]],
  [0x0649, [0xfeef, 0xfef0]],
  [0x064a, [0xfef1, 0xfef2, 0xfef3, 0xfef4]],
  // Persian / Urdu letters common in names (Presentation Forms-A).
  [0x067e, [0xfb56, 0xfb57, 0xfb58, 0xfb59]],
  [0x0686, [0xfb7a, 0xfb7b, 0xfb7c, 0xfb7d]],
  [0x0698, [0xfb8a, 0xfb8b]],
  [0x06a9, [0xfb8e, 0xfb8f, 0xfb90, 0xfb91]],
  [0x06af, [0xfb92, 0xfb93, 0xfb94, 0xfb95]],
  [0x06cc, [0xfbfc, 0xfbfd, 0xfbfe, 0xfbff]],
]);

/** Lam + alef variant → [isolated, final] ligature. */
const LAM_ALEF: ReadonlyMap<number, readonly [number, number]> = new Map<number, readonly [number, number]>([
  [0x0622, [0xfef5, 0xfef6]],
  [0x0623, [0xfef7, 0xfef8]],
  [0x0625, [0xfef9, 0xfefa]],
  [0x0627, [0xfefb, 0xfefc]],
]);

const TATWEEL = 0x0640;
const LAM = 0x0644;

function isHarakah(code: number): boolean {
  return (code >= 0x064b && code <= 0x065f) || code === 0x0670 || (code >= 0x06d6 && code <= 0x06ed);
}

function joinsBefore(code: number | undefined): boolean {
  // Can this letter connect to the FOLLOWING letter (dual-joining or tatweel)?
  if (code === undefined) return false;
  if (code === TATWEEL) return true;
  const forms = FORMS.get(code);
  return Boolean(forms && forms[2] !== undefined);
}

function joinsAfter(code: number | undefined): boolean {
  // Can this letter connect to the PRECEDING letter (dual- or right-joining or tatweel)?
  if (code === undefined) return false;
  if (code === TATWEEL) return true;
  return FORMS.has(code) && code !== 0x0621;
}

/** Contextual shaping in logical order: letters → presentation forms, lam-alef → ligature. */
export function shapeArabic(input: string): string {
  const codes: number[] = [];
  for (const ch of input) {
    const code = ch.codePointAt(0) ?? 0;
    if (!isHarakah(code)) codes.push(code);
  }
  const out: number[] = [];
  for (let i = 0; i < codes.length; i += 1) {
    const code = codes[i];
    const prev = i > 0 ? codes[i - 1] : undefined;
    const next = i + 1 < codes.length ? codes[i + 1] : undefined;
    const prevConnects = joinsBefore(prev);

    if (code === LAM && next !== undefined && LAM_ALEF.has(next)) {
      const lig = LAM_ALEF.get(next);
      if (lig) {
        out.push(prevConnects ? lig[1] : lig[0]);
        i += 1;
        continue;
      }
    }
    const forms = FORMS.get(code);
    if (!forms) {
      out.push(code);
      continue;
    }
    const dual = forms[2] !== undefined && forms[3] !== undefined;
    const connectsPrev = prevConnects && joinsAfter(code);
    const connectsNext = dual && joinsAfter(next);
    if (connectsPrev && connectsNext) out.push(forms[3] ?? forms[1]);
    else if (connectsPrev) out.push(forms[1]);
    else if (connectsNext) out.push(forms[2] ?? forms[0]);
    else out.push(forms[0]);
  }
  return out.map((code) => String.fromCodePoint(code)).join("");
}

/* ------------------------------------------------------------------ bidi */

export type BidiClass = "R" | "L" | "N";

export function isRtlCode(code: number): boolean {
  return (
    (code >= 0x0590 && code <= 0x08ff && !(code >= 0x0660 && code <= 0x0669) && !(code >= 0x06f0 && code <= 0x06f9)) ||
    (code >= 0xfb1d && code <= 0xfdff) ||
    (code >= 0xfe70 && code <= 0xfefc)
  );
}

function isDigitLike(code: number): boolean {
  return (
    (code >= 0x30 && code <= 0x39) ||
    (code >= 0x0660 && code <= 0x0669) ||
    (code >= 0x06f0 && code <= 0x06f9) ||
    code === 0xb2 ||
    code === 0xb3 ||
    code === 0xb9 ||
    (code >= 0x2070 && code <= 0x209f)
  );
}

function isLatinLetter(code: number): boolean {
  return (
    (code >= 0x41 && code <= 0x5a) ||
    (code >= 0x61 && code <= 0x7a) ||
    (code >= 0xc0 && code <= 0x24f && code !== 0xd7 && code !== 0xf7) ||
    (code >= 0x370 && code <= 0x3ff) ||
    (code >= 0x2100 && code <= 0x214f)
  );
}

export function bidiClass(code: number): BidiClass {
  if (isRtlCode(code)) return "R";
  if (isDigitLike(code) || isLatinLetter(code)) return "L";
  return "N";
}

/**
 * First strong LETTER decides (digits are weak, so «1) تحديد…» is right-to-left);
 * text without letters is LTR.
 */
export function paragraphIsRtl(text: string): boolean {
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (isRtlCode(code)) return true;
    if (isLatinLetter(code)) return false;
  }
  return false;
}

/** Any Arabic / Hebrew character at all. */
export function hasRtl(text: string): boolean {
  for (const ch of text) if (isRtlCode(ch.codePointAt(0) ?? 0)) return true;
  return false;
}

const MIRROR: ReadonlyMap<string, string> = new Map([
  ["(", ")"],
  [")", "("],
  ["[", "]"],
  ["]", "["],
  ["{", "}"],
  ["}", "{"],
  ["<", ">"],
  [">", "<"],
  ["«", "»"],
  ["»", "«"],
  ["≤", "≥"],
  ["≥", "≤"],
]);

const OPENERS: ReadonlyMap<string, string> = new Map([
  ["(", ")"],
  ["[", "]"],
  ["{", "}"],
  ["«", "»"],
]);

/** Matching bracket index pairs (outermost last), unmatched brackets ignored. */
function bracketPairs(chars: string[]): Array<[number, number]> {
  const stack: Array<{ index: number; close: string }> = [];
  const pairs: Array<[number, number]> = [];
  chars.forEach((ch, index) => {
    const close = OPENERS.get(ch);
    if (close) {
      stack.push({ index, close });
      return;
    }
    for (let k = stack.length - 1; k >= 0; k -= 1) {
      if (stack[k].close === ch) {
        pairs.push([stack[k].index, index]);
        stack.length = k;
        break;
      }
    }
  });
  return pairs;
}

/**
 * One line (already shaped, logical order) → visual left-to-right order.
 * Neutrals between two runs of the same direction take it; otherwise the paragraph direction.
 */
export function visualOrder(line: string, rtl: boolean): string {
  const chars = Array.from(line);
  if (!chars.length) return line;
  const classes = chars.map((ch) => bidiClass(ch.codePointAt(0) ?? 0));
  const base: BidiClass = rtl ? "R" : "L";
  const resolved: BidiClass[] = classes.slice();
  const fixed = new Set<number>();
  // Paired brackets (simplified UBA rule N0): both brackets take one direction, so "{2 ; 3}"
  // or "f(x)" never ends up with a bracket flipped to the other side of the line.
  for (const [open, close] of bracketPairs(chars)) {
    let inside: BidiClass | null = null;
    for (let k = open + 1; k < close; k += 1) {
      if (classes[k] === base) {
        inside = base;
        break;
      }
      if (classes[k] !== "N") inside = classes[k];
    }
    if (!inside) continue;
    let dir: BidiClass = inside;
    if (inside !== base) {
      let before: BidiClass = base;
      for (let j = open - 1; j >= 0; j -= 1) {
        if (classes[j] !== "N") {
          before = classes[j];
          break;
        }
      }
      dir = before === inside ? inside : base;
    }
    resolved[open] = dir;
    resolved[close] = dir;
    fixed.add(open);
    fixed.add(close);
  }
  for (let i = 0; i < chars.length; i += 1) {
    if (classes[i] !== "N" || fixed.has(i)) continue;
    let before: BidiClass = base;
    for (let j = i - 1; j >= 0; j -= 1) {
      if (classes[j] !== "N") {
        before = classes[j];
        break;
      }
    }
    let after: BidiClass = base;
    for (let j = i + 1; j < chars.length; j += 1) {
      if (classes[j] !== "N") {
        after = classes[j];
        break;
      }
    }
    resolved[i] = before === after ? before : base;
  }

  type Run = { dir: BidiClass; chars: string[] };
  const runs: Run[] = [];
  chars.forEach((ch, i) => {
    const dir = resolved[i];
    const last = runs[runs.length - 1];
    if (last && last.dir === dir) last.chars.push(ch);
    else runs.push({ dir, chars: [ch] });
  });
  const rendered = runs.map((run) =>
    run.dir === "R" ? run.chars.slice().reverse().map((ch) => MIRROR.get(ch) ?? ch).join("") : run.chars.join(""),
  );
  return (rtl ? rendered.reverse() : rendered).join("");
}
