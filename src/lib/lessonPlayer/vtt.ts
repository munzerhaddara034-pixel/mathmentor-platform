/** Minimal WebVTT cue parser (chapters list + tests). Subtitles themselves use the browser's <track> parser. */

export type VttCue = { start: number; end: number; text: string };

export function parseVttTimestamp(value: string): number | null {
  const match = value.trim().match(/^(?:(\d+):)?(\d{1,2}):(\d{2})[.,](\d{1,3})$/);
  if (!match) return null;
  const [, h, m, s, ms] = match;
  return Number(h ?? 0) * 3600 + Number(m) * 60 + Number(s) + Number(ms.padEnd(3, "0")) / 1000;
}

export function parseVtt(text: string): VttCue[] {
  const source = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  if (!/^WEBVTT/.test(source)) return [];
  const cues: VttCue[] = [];
  for (const block of source.split(/\n{2,}/)) {
    const lines = block.split("\n").filter((line) => line.length > 0);
    const timing = lines.findIndex((line) => line.includes("-->"));
    if (timing < 0) continue;
    const [rawStart, rest] = lines[timing].split("-->");
    const start = parseVttTimestamp(rawStart);
    const end = parseVttTimestamp((rest ?? "").trim().split(/\s+/)[0] ?? "");
    if (start === null || end === null || end < start) continue;
    const body = lines
      .slice(timing + 1)
      .join("\n")
      .replace(/<[^>]+>/g, "")
      .trim();
    cues.push({ start, end, text: body });
  }
  return cues.sort((a, b) => a.start - b.start);
}

/** Index of the chapter that contains `time` (last chapter that started at or before it). */
export function chapterAt(cues: readonly VttCue[], time: number): number {
  let index = -1;
  for (let i = 0; i < cues.length; i += 1) {
    if (cues[i].start <= time + 0.001) index = i;
    else break;
  }
  return index;
}
