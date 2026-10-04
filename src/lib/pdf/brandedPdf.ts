/**
 * Branded, Unicode PDF writer for MathMentor documents sent on WhatsApp (solutions, mock exams).
 * - Embedded TrueType fonts (Noto Naskh Arabic + DejaVu Sans subsets, Type0 / Identity-H) so
 *   Arabic, Latin and maths symbols all render; ToUnicode maps keep the text copyable.
 * - Arabic shaped to presentation forms + a small bidi pass (see arabicText.ts).
 * - Every page carries the platform brand: header «منذر حداره · MathMentor» / "Munzer Haddara ·
 *   MathMentor", footer with the brand and page numbers.
 * Dependency-free (node:zlib only); relative imports so `node --test` loads it directly.
 */
import { deflateSync } from "node:zlib";
import { hasRtl, paragraphIsRtl, shapeArabic, visualOrder, isRtlCode } from "./arabicText.ts";
import { parseTrueType, type TrueTypeFont } from "./ttf.ts";
import { DEJAVU_SANS_BOLD_BASE64 } from "./fonts/dejaVuSansBold.ts";
import { DEJAVU_SANS_REGULAR_BASE64 } from "./fonts/dejaVuSansRegular.ts";
import { NOTO_NASKH_ARABIC_BOLD_BASE64 } from "./fonts/notoNaskhArabicBold.ts";
import { NOTO_NASKH_ARABIC_REGULAR_BASE64 } from "./fonts/notoNaskhArabicRegular.ts";

/* ------------------------------------------------------------------ brand */

export type PdfBrand = {
  /** Arabic header (right-aligned). */
  headerAr: string;
  /** Latin header (left-aligned). */
  headerLatin: string;
  /** Footer line (centre). */
  footer: string;
  /** PDF metadata author. */
  author: string;
};

/** The platform name, exactly as the owner writes it: «منذر حداره» (final ه, never tāʾ marbūṭa). */
export const PLATFORM_OWNER_AR = "منذر حداره";
export const PLATFORM_OWNER_LATIN = "Munzer Haddara";
export const PLATFORM_NAME = "MathMentor";

export const MATHMENTOR_BRAND: PdfBrand = {
  headerAr: `${PLATFORM_OWNER_AR} · ${PLATFORM_NAME}`,
  headerLatin: `${PLATFORM_OWNER_LATIN} · ${PLATFORM_NAME}`,
  footer: `${PLATFORM_NAME} — ${PLATFORM_OWNER_AR} / ${PLATFORM_OWNER_LATIN}`,
  author: `${PLATFORM_OWNER_LATIN} · ${PLATFORM_NAME}`,
};

/** File-name prefix for every generated document: MathMentor-Munzer-Haddara-<kind>.pdf */
export function brandedPdfFilename(kind: string): string {
  const slug = kind
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${PLATFORM_NAME}-Munzer-Haddara-${slug || "document"}.pdf`;
}

/* ------------------------------------------------------------------ blocks */

export type PdfBlock =
  | { kind: "title"; text: string }
  | { kind: "subtitle"; text: string }
  | { kind: "heading"; text: string }
  | { kind: "paragraph"; text: string; bold?: boolean; muted?: boolean; indent?: number }
  /** Left-to-right maths line(s) on a tinted background. */
  | { kind: "math"; text: string }
  /** Boxed, bold (final answer). */
  | { kind: "highlight"; text: string }
  | { kind: "rule" }
  | { kind: "spacer"; height?: number };

export type BrandedPdfInput = {
  title: string;
  blocks: PdfBlock[];
  brand?: PdfBrand;
  createdAt?: Date;
};

/* ------------------------------------------------------------------ fonts */

type FontKey = "latin" | "latinBold" | "arabic" | "arabicBold";
const FONT_KEYS: readonly FontKey[] = ["latin", "latinBold", "arabic", "arabicBold"];
const SUBSET_TAG: Record<FontKey, string> = { latin: "MMLATN", latinBold: "MMLATB", arabic: "MMARBN", arabicBold: "MMARBB" };

let fontCache: Record<FontKey, TrueTypeFont> | undefined;

/** Parse the embedded fonts once. Throws when a font module is unusable. */
export function loadPdfFonts(): Record<FontKey, TrueTypeFont> {
  if (fontCache) return fontCache;
  const load = (base64: string, name: string): TrueTypeFont => ({ ...parseTrueType(Buffer.from(base64, "base64"), name), postscriptName: name });
  fontCache = {
    latin: load(DEJAVU_SANS_REGULAR_BASE64, "DejaVuSans"),
    latinBold: load(DEJAVU_SANS_BOLD_BASE64, "DejaVuSans-Bold"),
    arabic: load(NOTO_NASKH_ARABIC_REGULAR_BASE64, "NotoNaskhArabic-Regular"),
    arabicBold: load(NOTO_NASKH_ARABIC_BOLD_BASE64, "NotoNaskhArabic-Bold"),
  };
  return fontCache;
}

type FontUse = { gids: Map<number, string> };

const ARABIC_SCALE = 1.2;

class FontSet {
  readonly fonts: Record<FontKey, TrueTypeFont>;
  readonly used = new Map<FontKey, FontUse>();

  constructor(fonts: Record<FontKey, TrueTypeFont>) {
    this.fonts = fonts;
  }

  /** Font for one character: Arabic letters → Naskh, everything else → DejaVu; null = no glyph anywhere. */
  pick(code: number, bold: boolean): FontKey | null {
    const arabic: FontKey = bold ? "arabicBold" : "arabic";
    const latin: FontKey = bold ? "latinBold" : "latin";
    const order: FontKey[] = isRtlCode(code) ? [arabic, latin] : [latin, arabic];
    for (const key of order) if (this.fonts[key].cmap.has(code)) return key;
    return null;
  }

  /** Naskh letters are optically smaller than DejaVu at the same size: scale them up. */
  sizeFor(key: FontKey, size: number): number {
    return key === "arabic" || key === "arabicBold" ? size * ARABIC_SCALE : size;
  }

  advance(key: FontKey, code: number, size: number): number {
    const font = this.fonts[key];
    const gid = font.cmap.get(code) ?? 0;
    return ((font.advances[gid] ?? 0) * this.sizeFor(key, size)) / font.unitsPerEm;
  }

  width(text: string, size: number, bold: boolean): number {
    let total = 0;
    for (const ch of text) {
      const code = ch.codePointAt(0) ?? 0;
      const key = this.pick(code, bold);
      if (key) total += this.advance(key, code, size);
    }
    return total;
  }

  /** Remove characters no font can draw (emoji, pictographs) and control characters. */
  clean(text: string): string {
    let out = "";
    for (const ch of text) {
      const code = ch.codePointAt(0) ?? 0;
      if (code === 0x09) out += " ";
      else if (code < 0x20 || (code >= 0x200b && code <= 0x200f) || code === 0xfe0f) continue;
      else if (this.pick(code, false)) out += ch;
    }
    return out.replace(/ {2,}/g, " ");
  }

  /** PDF text operators for a visual-order line starting at x (baseline y). */
  draw(visual: string, x: number, y: number, size: number, bold: boolean): string {
    const parts: string[] = [];
    let cursor = x;
    let runKey: FontKey | null = null;
    let runHex = "";
    let runStart = x;
    const flush = () => {
      if (runKey && runHex) parts.push(`BT /${runKey} ${fmt(this.sizeFor(runKey, size))} Tf ${fmt(runStart)} ${fmt(y)} Td <${runHex}> Tj ET`);
      runHex = "";
    };
    for (const ch of visual) {
      const code = ch.codePointAt(0) ?? 0;
      const key = this.pick(code, bold);
      if (!key) continue;
      if (key !== runKey) {
        flush();
        runKey = key;
        runStart = cursor;
      }
      const gid = this.fonts[key].cmap.get(code) ?? 0;
      let use = this.used.get(key);
      if (!use) {
        use = { gids: new Map() };
        this.used.set(key, use);
      }
      if (!use.gids.has(gid)) use.gids.set(gid, ch);
      runHex += gid.toString(16).padStart(4, "0");
      cursor += this.advance(key, code, size);
    }
    flush();
    return parts.join("\n");
  }
}

function fmt(n: number): string {
  return (Math.round(n * 100) / 100).toString();
}

/* ------------------------------------------------------------------ layout */

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN_X = 50;
const HEADER_H = 54;
const CONTENT_TOP = PAGE_H - HEADER_H - 28;
const CONTENT_BOTTOM = 62;

type Rgb = readonly [number, number, number];
const NAVY: Rgb = [0.09, 0.2, 0.42];
const GOLD: Rgb = [0.85, 0.65, 0.13];
const INK: Rgb = [0.12, 0.12, 0.14];
const MUTED: Rgb = [0.38, 0.4, 0.45];
const MATH_BG: Rgb = [0.94, 0.96, 1];
const ANSWER_BG: Rgb = [0.91, 0.97, 0.92];
const ANSWER_BORDER: Rgb = [0.2, 0.55, 0.3];

function rgb(c: Rgb, stroke = false): string {
  return `${fmt(c[0])} ${fmt(c[1])} ${fmt(c[2])} ${stroke ? "RG" : "rg"}`;
}

type Style = { size: number; bold: boolean; color: Rgb; lineGap: number; before: number; after: number; align: "start" | "center"; forceLtr?: boolean; bg?: Rgb; border?: Rgb; pad?: number };

function styleFor(block: PdfBlock): Style {
  switch (block.kind) {
    case "title":
      return { size: 18, bold: true, color: NAVY, lineGap: 1.5, before: 0, after: 4, align: "center" };
    case "subtitle":
      return { size: 10, bold: false, color: MUTED, lineGap: 1.5, before: 0, after: 10, align: "center" };
    case "heading":
      return { size: 13, bold: true, color: NAVY, lineGap: 1.5, before: 10, after: 3, align: "start" };
    case "math":
      return { size: 11.5, bold: false, color: INK, lineGap: 1.55, before: 2, after: 4, align: "start", forceLtr: true, bg: MATH_BG, pad: 8 };
    case "highlight":
      return { size: 12.5, bold: true, color: ANSWER_BORDER, lineGap: 1.6, before: 8, after: 8, align: "start", bg: ANSWER_BG, border: ANSWER_BORDER, pad: 10 };
    case "paragraph":
      return { size: 11, bold: Boolean(block.bold), color: block.muted ? MUTED : INK, lineGap: 1.6, before: 1, after: 3, align: "start" };
    default:
      return { size: 11, bold: false, color: INK, lineGap: 1.5, before: 0, after: 0, align: "start" };
  }
}

/** Greedy word wrap of shaped (logical-order) text to a width. */
function wrapShaped(fonts: FontSet, text: string, width: number, size: number, bold: boolean): string[] {
  const words = text.split(" ").filter((w) => w.length > 0);
  const lines: string[] = [];
  let current = "";
  const spaceW = fonts.width(" ", size, bold);
  let currentW = 0;
  for (const word of words) {
    const w = fonts.width(word, size, bold);
    if (w > width) {
      // Hard-break a single over-long token (long formulas / URLs).
      if (current) lines.push(current);
      current = "";
      currentW = 0;
      let piece = "";
      let pieceW = 0;
      for (const ch of word) {
        const cw = fonts.width(ch, size, bold);
        if (pieceW + cw > width && piece) {
          lines.push(piece);
          piece = "";
          pieceW = 0;
        }
        piece += ch;
        pieceW += cw;
      }
      current = piece;
      currentW = pieceW;
      continue;
    }
    const next = current ? currentW + spaceW + w : w;
    if (current && next > width) {
      lines.push(current);
      current = word;
      currentW = w;
    } else {
      current = current ? `${current} ${word}` : word;
      currentW = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

class Layout {
  readonly pages: string[][] = [[]];
  private y = CONTENT_TOP;
  private readonly fonts: FontSet;

  constructor(fonts: FontSet) {
    this.fonts = fonts;
  }

  private get page(): string[] {
    return this.pages[this.pages.length - 1];
  }

  private ensure(height: number): void {
    if (this.y - height < CONTENT_BOTTOM) {
      this.pages.push([]);
      this.y = CONTENT_TOP;
    }
  }

  space(height: number): void {
    this.y -= height;
    if (this.y < CONTENT_BOTTOM) {
      this.pages.push([]);
      this.y = CONTENT_TOP;
    }
  }

  rule(): void {
    this.ensure(10);
    this.y -= 5;
    this.page.push(`${rgb([0.82, 0.84, 0.88], true)} 0.6 w ${fmt(MARGIN_X)} ${fmt(this.y)} m ${fmt(PAGE_W - MARGIN_X)} ${fmt(this.y)} l S`);
    this.y -= 5;
  }

  block(block: PdfBlock): void {
    if (block.kind === "rule") return this.rule();
    if (block.kind === "spacer") return this.space(block.height ?? 8);
    const style = styleFor(block);
    const indent = block.kind === "paragraph" ? block.indent ?? 0 : 0;
    const pad = style.pad ?? 0;
    const left = MARGIN_X + pad;
    const right = PAGE_W - MARGIN_X - pad;
    const lineH = style.size * style.lineGap;
    if (style.before) this.space(style.before);

    const paragraphs = block.text.split(/\r?\n/);
    const rows: Array<{ visual: string; width: number; rtl: boolean }> = [];
    for (const raw of paragraphs) {
      const cleaned = this.fonts.clean(raw).trim();
      if (!cleaned) {
        rows.push({ visual: "", width: 0, rtl: false });
        continue;
      }
      const rtl = style.forceLtr ? false : paragraphIsRtl(cleaned);
      const shaped = hasRtl(cleaned) ? shapeArabic(cleaned) : cleaned;
      const avail = right - left - indent;
      for (const line of wrapShaped(this.fonts, shaped, avail, style.size, style.bold)) {
        const visual = visualOrder(line, rtl);
        rows.push({ visual, width: this.fonts.width(visual, style.size, style.bold), rtl });
      }
    }
    if (!rows.length) return;

    const boxed = Boolean(style.bg);
    if (boxed) this.space(pad / 2);
    rows.forEach((row, index) => {
      this.ensure(lineH + (boxed ? pad / 2 : 0));
      const top = this.y;
      this.y -= lineH;
      if (style.bg) {
        const extraTop = index === 0 ? pad / 2 : 0;
        const extraBottom = index === rows.length - 1 ? pad / 2 : 0;
        const x = MARGIN_X;
        const w = PAGE_W - 2 * MARGIN_X;
        this.page.push(`${rgb(style.bg)} ${fmt(x)} ${fmt(this.y - extraBottom)} ${fmt(w)} ${fmt(lineH + extraTop + extraBottom)} re f`);
        if (style.border) {
          const bx = row.rtl ? x + w - 3 : x;
          this.page.push(`${rgb(style.border)} ${fmt(bx)} ${fmt(this.y - extraBottom)} 3 ${fmt(lineH + extraTop + extraBottom)} re f`);
        }
      }
      if (!row.visual) return;
      const baseline = top - style.size * 1.05 - (lineH - style.size * 1.3) / 2;
      let x: number;
      if (style.align === "center") x = (PAGE_W - row.width) / 2;
      else if (row.rtl) x = right - indent - row.width;
      else x = left + indent;
      this.page.push(`${rgb(style.color)}\n${this.fonts.draw(row.visual, x, baseline, style.size, style.bold)}`);
    });
    if (boxed) this.space(pad / 2);
    if (style.after) this.space(style.after);
  }

  /** Header band + footer on every page (needs the final page count). */
  decorate(brand: PdfBrand): void {
    const total = this.pages.length;
    this.pages.forEach((ops, index) => {
      const head: string[] = [];
      head.push(`${rgb(NAVY)} 0 ${fmt(PAGE_H - HEADER_H)} ${fmt(PAGE_W)} ${fmt(HEADER_H)} re f`);
      head.push(`${rgb(GOLD)} 0 ${fmt(PAGE_H - HEADER_H - 3)} ${fmt(PAGE_W)} 3 re f`);
      const baseline = PAGE_H - HEADER_H / 2 - 5;
      head.push(`1 1 1 rg\n${this.fonts.draw(brand.headerLatin, MARGIN_X, baseline, 12, true)}`);
      const ar = this.fonts.clean(brand.headerAr);
      const arVisual = visualOrder(shapeArabic(ar), paragraphIsRtl(ar));
      const arW = this.fonts.width(arVisual, 14, true);
      head.push(`1 1 1 rg\n${this.fonts.draw(arVisual, PAGE_W - MARGIN_X - arW, baseline, 14, true)}`);

      const foot: string[] = [];
      foot.push(`${rgb([0.82, 0.84, 0.88], true)} 0.6 w ${fmt(MARGIN_X)} 44 m ${fmt(PAGE_W - MARGIN_X)} 44 l S`);
      const footer = this.fonts.clean(brand.footer);
      const footVisual = visualOrder(shapeArabic(footer), false);
      const footW = this.fonts.width(footVisual, 9, false);
      foot.push(`${rgb(MUTED)}\n${this.fonts.draw(footVisual, (PAGE_W - footW) / 2, 28, 9, false)}`);
      const num = `${index + 1} / ${total}`;
      foot.push(this.fonts.draw(num, PAGE_W - MARGIN_X - this.fonts.width(num, 9, false), 28, 9, false));
      ops.unshift(...head);
      ops.push(...foot);
    });
  }
}

/* ------------------------------------------------------------------ PDF objects */

function pdfUtf16(text: string): string {
  const buf = Buffer.from(`\ufeff${text}`, "utf16le");
  for (let i = 0; i + 1 < buf.length; i += 2) {
    const a = buf[i];
    buf[i] = buf[i + 1];
    buf[i + 1] = a;
  }
  return `<${buf.toString("hex")}>`;
}

function utf16Hex(text: string): string {
  let out = "";
  for (let i = 0; i < text.length; i += 1) out += text.charCodeAt(i).toString(16).padStart(4, "0");
  return out;
}

function toUnicodeCmap(gids: Map<number, string>): string {
  const entries = [...gids.entries()].sort((a, b) => a[0] - b[0]);
  const chunks: string[] = [];
  for (let i = 0; i < entries.length; i += 100) {
    const slice = entries.slice(i, i + 100);
    chunks.push(`${slice.length} beginbfchar\n${slice.map(([gid, ch]) => `<${gid.toString(16).padStart(4, "0")}> <${utf16Hex(ch)}>`).join("\n")}\nendbfchar`);
  }
  return [
    "/CIDInit /ProcSet findresource begin",
    "12 dict begin",
    "begincmap",
    "/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def",
    "/CMapName /Adobe-Identity-UCS def",
    "/CMapType 2 def",
    "1 begincodespacerange",
    "<0000> <FFFF>",
    "endcodespacerange",
    ...chunks,
    "endcmap",
    "CMapName currentdict /CMap defineresource pop",
    "end",
    "end",
  ].join("\n");
}

class PdfWriter {
  private readonly objects: Buffer[] = [];

  reserve(): number {
    this.objects.push(Buffer.alloc(0));
    return this.objects.length;
  }

  set(id: number, body: string | Buffer): void {
    this.objects[id - 1] = Buffer.isBuffer(body) ? body : Buffer.from(body, "latin1");
  }

  add(body: string | Buffer): number {
    const id = this.reserve();
    this.set(id, body);
    return id;
  }

  stream(dict: string, data: Buffer, compress = true): Buffer {
    const payload = compress ? deflateSync(data) : data;
    const head = `<< ${dict}${compress ? " /Filter /FlateDecode" : ""} /Length ${payload.length} >>\nstream\n`;
    return Buffer.concat([Buffer.from(head, "latin1"), payload, Buffer.from("\nendstream", "latin1")]);
  }

  finish(rootId: number, infoId: number): Buffer {
    const parts: Buffer[] = [Buffer.from("%PDF-1.7\n%\xe2\xe3\xcf\xd3\n", "latin1")];
    let offset = parts[0].length;
    const offsets: number[] = [];
    this.objects.forEach((body, index) => {
      offsets.push(offset);
      const chunk = Buffer.concat([Buffer.from(`${index + 1} 0 obj\n`, "latin1"), body, Buffer.from("\nendobj\n", "latin1")]);
      parts.push(chunk);
      offset += chunk.length;
    });
    const xref = [`xref\n0 ${this.objects.length + 1}\n`, "0000000000 65535 f \n", ...offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`)].join("");
    const trailer = `trailer\n<< /Size ${this.objects.length + 1} /Root ${rootId} 0 R /Info ${infoId} 0 R >>\nstartxref\n${offset}\n%%EOF\n`;
    parts.push(Buffer.from(xref + trailer, "latin1"));
    return Buffer.concat(parts);
  }
}

function pdfDate(date: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `(D:${date.getUTCFullYear()}${p(date.getUTCMonth() + 1)}${p(date.getUTCDate())}${p(date.getUTCHours())}${p(date.getUTCMinutes())}${p(date.getUTCSeconds())}Z)`;
}

function embedFont(writer: PdfWriter, key: FontKey, font: TrueTypeFont, use: FontUse): number {
  const scale = 1000 / font.unitsPerEm;
  const gids = [...use.gids.keys()].sort((a, b) => a - b);
  const widths = gids.map((gid) => `${gid} [${Math.round((font.advances[gid] ?? 0) * scale)}]`).join(" ");
  const name = `${SUBSET_TAG[key]}+${font.postscriptName}`;
  const fileId = writer.add(writer.stream(`/Length1 ${font.bytes.length}`, font.bytes));
  const descriptorId = writer.add(
    `<< /Type /FontDescriptor /FontName /${name} /Flags 32 /FontBBox [${font.bbox.map((v) => Math.round(v * scale)).join(" ")}] ` +
      `/ItalicAngle 0 /Ascent ${Math.round(font.ascent * scale)} /Descent ${Math.round(font.descent * scale)} ` +
      `/CapHeight ${Math.round(font.capHeight * scale)} /StemV ${key.endsWith("Bold") ? 120 : 80} /FontFile2 ${fileId} 0 R >>`,
  );
  const cidId = writer.add(
    `<< /Type /Font /Subtype /CIDFontType2 /BaseFont /${name} /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> ` +
      `/FontDescriptor ${descriptorId} 0 R /CIDToGIDMap /Identity /DW 500 /W [${widths}] >>`,
  );
  const toUnicodeId = writer.add(writer.stream("", Buffer.from(toUnicodeCmap(use.gids), "latin1")));
  return writer.add(
    `<< /Type /Font /Subtype /Type0 /BaseFont /${name} /Encoding /Identity-H /DescendantFonts [${cidId} 0 R] /ToUnicode ${toUnicodeId} 0 R >>`,
  );
}

/**
 * Build a branded A4 PDF. Throws only when the embedded fonts are unusable (callers fall back to
 * the Latin-only builder and log it).
 */
export function buildBrandedPdf(input: BrandedPdfInput): Buffer {
  const brand = input.brand ?? MATHMENTOR_BRAND;
  const fonts = new FontSet(loadPdfFonts());
  const layout = new Layout(fonts);
  layout.block({ kind: "title", text: input.title });
  for (const block of input.blocks) layout.block(block);
  layout.decorate(brand);

  const writer = new PdfWriter();
  const catalogId = writer.reserve();
  const pagesId = writer.reserve();
  const fontDict: string[] = [];
  for (const key of FONT_KEYS) {
    const use = fonts.used.get(key);
    if (use && use.gids.size) fontDict.push(`/${key} ${embedFont(writer, key, fonts.fonts[key], use)} 0 R`);
  }
  const resourcesId = writer.add(`<< /Font << ${fontDict.join(" ")} >> /ProcSet [/PDF /Text] >>`);
  const pageIds: number[] = [];
  for (const ops of layout.pages) {
    const contentId = writer.add(writer.stream("", Buffer.from(ops.join("\n"), "latin1")));
    pageIds.push(
      writer.add(
        `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${fmt(PAGE_W)} ${fmt(PAGE_H)}] /Resources ${resourcesId} 0 R /Contents ${contentId} 0 R >>`,
      ),
    );
  }
  writer.set(pagesId, `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`);
  writer.set(catalogId, `<< /Type /Catalog /Pages ${pagesId} 0 R /Lang (ar) >>`);
  const created = input.createdAt ?? new Date();
  const infoId = writer.add(
    `<< /Title ${pdfUtf16(`${input.title} — ${brand.headerLatin}`)} /Author ${pdfUtf16(brand.author)} /Subject ${pdfUtf16(brand.footer)} ` +
      `/Creator ${pdfUtf16(PLATFORM_NAME)} /Producer ${pdfUtf16(`${PLATFORM_NAME} PDF`)} /CreationDate ${pdfDate(created)} >>`,
  );
  return writer.finish(catalogId, infoId);
}
