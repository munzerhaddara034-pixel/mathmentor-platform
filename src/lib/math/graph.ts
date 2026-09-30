import type { GraphPoint } from "./safeExpression";

/** Pre-computed SVG geometry for a function graph (built on the server; the client only paints it). */
export type GraphGeometry = {
  width: number;
  height: number;
  path: string;
  /** Rough path length, used for the CSS / Framer draw-in. */
  length: number;
  xAxisY: number | null;
  yAxisX: number | null;
  min: { cx: number; cy: number; x: number; y: number } | null;
};

const round = (value: number) => Math.round(value * 10) / 10;

/**
 * Maps sampled points into a `width × height` box. The y-range is clipped to robust bounds so one
 * exploding value (e.g. e^x at the right edge) doesn't flatten the interesting part.
 */
export function buildGraph(points: GraphPoint[], width = 320, height = 180, pad = 14, clip?: { yMin?: number; yMax?: number }): GraphGeometry | null {
  if (points.length < 2) return null;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y).sort((a, b) => a - b);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const lowIndex = Math.floor(ys.length * 0.02);
  const highIndex = Math.ceil(ys.length * 0.9) - 1;
  let y0 = clip?.yMin ?? Math.min(ys[lowIndex], 0);
  let y1 = clip?.yMax ?? Math.max(ys[Math.max(lowIndex, highIndex)], 0);
  if (y1 - y0 < 1e-6) {
    y0 -= 1;
    y1 += 1;
  }
  const span = y1 - y0;
  y0 -= span * 0.08;
  y1 += span * 0.08;
  const sx = (x: number) => pad + ((x - x0) / (x1 - x0)) * (width - 2 * pad);
  const sy = (y: number) => height - pad - ((y - y0) / (y1 - y0)) * (height - 2 * pad);

  let path = "";
  let length = 0;
  let previous: { px: number; py: number } | null = null;
  for (const point of points) {
    const inside = point.y >= y0 && point.y <= y1;
    if (!inside) {
      previous = null;
      continue;
    }
    const px = round(sx(point.x));
    const py = round(sy(point.y));
    path += `${previous ? "L" : "M"}${px} ${py}`;
    if (previous) length += Math.hypot(px - previous.px, py - previous.py);
    previous = { px, py };
  }
  if (!path) return null;

  let minPoint: GraphPoint | null = null;
  for (let i = 1; i < points.length - 1; i += 1) {
    const point = points[i];
    if (point.y <= points[i - 1].y && point.y <= points[i + 1].y && (!minPoint || point.y < minPoint.y)) minPoint = point;
  }

  return {
    width,
    height,
    path,
    length: Math.ceil(length),
    xAxisY: y0 <= 0 && y1 >= 0 ? round(sy(0)) : null,
    yAxisX: x0 <= 0 && x1 >= 0 ? round(sx(0)) : null,
    min: minPoint ? { cx: round(sx(minPoint.x)), cy: round(sy(minPoint.y)), x: minPoint.x, y: minPoint.y } : null,
  };
}
