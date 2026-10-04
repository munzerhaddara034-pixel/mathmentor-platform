/**
 * Minimal TrueType reader for PDF embedding: units/em, vertical metrics, advance widths and the
 * Unicode → glyph-id cmap (formats 4 and 12). Dependency-free; throws on a malformed font.
 */

export type TrueTypeFont = {
  /** PostScript-safe name used as the PDF BaseFont. */
  postscriptName: string;
  unitsPerEm: number;
  ascent: number;
  descent: number;
  capHeight: number;
  bbox: [number, number, number, number];
  numGlyphs: number;
  /** Advance width per glyph id (font units). */
  advances: Uint16Array;
  /** Unicode code point → glyph id. */
  cmap: Map<number, number>;
  /** The raw font program (embedded as /FontFile2). */
  bytes: Buffer;
};

type TableRecord = { offset: number; length: number };

function tables(view: Buffer): Map<string, TableRecord> {
  if (view.length < 12) throw new Error("font too small");
  const numTables = view.readUInt16BE(4);
  const out = new Map<string, TableRecord>();
  for (let i = 0; i < numTables; i += 1) {
    const at = 12 + i * 16;
    const tag = view.toString("latin1", at, at + 4);
    const offset = view.readUInt32BE(at + 8);
    const length = view.readUInt32BE(at + 12);
    if (offset + length > view.length) throw new Error(`font table ${tag} out of range`);
    out.set(tag, { offset, length });
  }
  return out;
}

function need(map: Map<string, TableRecord>, tag: string): TableRecord {
  const table = map.get(tag);
  if (!table) throw new Error(`font is missing the ${tag} table`);
  return table;
}

function readCmapFormat4(view: Buffer, at: number, cmap: Map<number, number>): void {
  const segX2 = view.readUInt16BE(at + 6);
  const segCount = segX2 / 2;
  const endAt = at + 14;
  const startAt = endAt + segX2 + 2;
  const deltaAt = startAt + segX2;
  const rangeAt = deltaAt + segX2;
  for (let s = 0; s < segCount; s += 1) {
    const end = view.readUInt16BE(endAt + s * 2);
    const start = view.readUInt16BE(startAt + s * 2);
    const delta = view.readInt16BE(deltaAt + s * 2);
    const rangeOffset = view.readUInt16BE(rangeAt + s * 2);
    for (let code = start; code <= end && code !== 0xffff; code += 1) {
      let glyph: number;
      if (rangeOffset === 0) {
        glyph = (code + delta) & 0xffff;
      } else {
        const glyphAt = rangeAt + s * 2 + rangeOffset + (code - start) * 2;
        if (glyphAt + 2 > view.length) continue;
        const raw = view.readUInt16BE(glyphAt);
        glyph = raw === 0 ? 0 : (raw + delta) & 0xffff;
      }
      if (glyph !== 0 && !cmap.has(code)) cmap.set(code, glyph);
    }
  }
}

function readCmapFormat12(view: Buffer, at: number, cmap: Map<number, number>): void {
  const groups = view.readUInt32BE(at + 12);
  for (let g = 0; g < groups; g += 1) {
    const rec = at + 16 + g * 12;
    const start = view.readUInt32BE(rec);
    const end = view.readUInt32BE(rec + 4);
    const startGlyph = view.readUInt32BE(rec + 8);
    for (let code = start; code <= end; code += 1) {
      if (!cmap.has(code)) cmap.set(code, startGlyph + (code - start));
    }
  }
}

function readCmap(view: Buffer, table: TableRecord): Map<number, number> {
  const cmap = new Map<number, number>();
  const count = view.readUInt16BE(table.offset + 2);
  const subtables: Array<{ format: number; at: number; rank: number }> = [];
  for (let i = 0; i < count; i += 1) {
    const rec = table.offset + 4 + i * 8;
    const platform = view.readUInt16BE(rec);
    const encoding = view.readUInt16BE(rec + 2);
    const at = table.offset + view.readUInt32BE(rec + 4);
    const format = view.readUInt16BE(at);
    const unicode = platform === 0 || (platform === 3 && (encoding === 1 || encoding === 10));
    if (!unicode || (format !== 4 && format !== 12)) continue;
    subtables.push({ format, at, rank: format === 12 ? 0 : 1 });
  }
  subtables.sort((a, b) => a.rank - b.rank);
  for (const sub of subtables) {
    if (sub.format === 12) readCmapFormat12(view, sub.at, cmap);
    else readCmapFormat4(view, sub.at, cmap);
  }
  if (!cmap.size) throw new Error("font has no Unicode cmap");
  return cmap;
}

function readPostscriptName(view: Buffer, map: Map<string, TableRecord>, fallback: string): string {
  const name = map.get("name");
  if (!name) return fallback;
  try {
    const count = view.readUInt16BE(name.offset + 2);
    const strings = name.offset + view.readUInt16BE(name.offset + 4);
    for (let i = 0; i < count; i += 1) {
      const rec = name.offset + 6 + i * 12;
      const platform = view.readUInt16BE(rec);
      const nameId = view.readUInt16BE(rec + 6);
      if (nameId !== 6) continue;
      const length = view.readUInt16BE(rec + 8);
      const offset = strings + view.readUInt16BE(rec + 10);
      let text = "";
      if (platform === 3 || platform === 0) {
        for (let k = 0; k + 1 < length; k += 2) text += String.fromCharCode(view.readUInt16BE(offset + k));
      } else {
        text = view.toString("latin1", offset, offset + length);
      }
      const clean = text.replace(/[^A-Za-z0-9-]/g, "");
      if (clean) return clean;
    }
  } catch {
    return fallback;
  }
  return fallback;
}

/** Parse a TrueType (glyf) font. Throws with a short message when the font is unusable. */
export function parseTrueType(bytes: Buffer, fallbackName = "EmbeddedFont"): TrueTypeFont {
  const view = Buffer.from(bytes);
  const sfnt = view.readUInt32BE(0);
  if (sfnt !== 0x00010000 && sfnt !== 0x74727565) throw new Error("not a TrueType font");
  const map = tables(view);
  const head = need(map, "head");
  const hhea = need(map, "hhea");
  const maxp = need(map, "maxp");
  const hmtx = need(map, "hmtx");
  need(map, "glyf");
  need(map, "loca");

  const unitsPerEm = view.readUInt16BE(head.offset + 18);
  const bbox: [number, number, number, number] = [
    view.readInt16BE(head.offset + 36),
    view.readInt16BE(head.offset + 38),
    view.readInt16BE(head.offset + 40),
    view.readInt16BE(head.offset + 42),
  ];
  let ascent = view.readInt16BE(hhea.offset + 4);
  let descent = view.readInt16BE(hhea.offset + 6);
  const numberOfHMetrics = view.readUInt16BE(hhea.offset + 34);
  const numGlyphs = view.readUInt16BE(maxp.offset + 4);

  let capHeight = Math.round(ascent * 0.7);
  const os2 = map.get("OS/2");
  if (os2 && os2.length >= 72) {
    ascent = view.readInt16BE(os2.offset + 68) || ascent;
    descent = view.readInt16BE(os2.offset + 70) || descent;
    if (os2.length >= 90 && view.readUInt16BE(os2.offset) >= 2) capHeight = view.readInt16BE(os2.offset + 88) || capHeight;
  }

  const advances = new Uint16Array(numGlyphs);
  let last = 0;
  for (let g = 0; g < numGlyphs; g += 1) {
    if (g < numberOfHMetrics) last = view.readUInt16BE(hmtx.offset + g * 4);
    advances[g] = last;
  }

  return {
    postscriptName: readPostscriptName(view, map, fallbackName),
    unitsPerEm,
    ascent,
    descent,
    capHeight,
    bbox,
    numGlyphs,
    advances,
    cmap: readCmap(view, need(map, "cmap")),
    bytes: view,
  };
}
