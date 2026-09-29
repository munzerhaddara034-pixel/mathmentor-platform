"use client";

import { useMemo } from "react";
import { compileFunction, sampleFn } from "@/lib/studio/functionPlot";
import type { WhiteboardPlot } from "@/lib/livekit/protocol";

type Props = {
  plot: WhiteboardPlot;
};

const WIDTH = 320;
const HEIGHT = 140;
const PAD = 18;

export function LiveBoardPlot({ plot }: Props) {
  const path = useMemo(() => {
    const fn = compileFunction(plot.expression);
    const samples = sampleFn(fn, [plot.xMin, plot.xMax], 160);
    const ys = samples.filter((point): point is { x: number; y: number } => point !== null).map((point) => point.y);
    const yMin = ys.length ? Math.min(...ys, -1) : -2;
    const yMax = ys.length ? Math.max(...ys, 1) : 2;
    const mapX = (x: number) => PAD + ((x - plot.xMin) / (plot.xMax - plot.xMin || 1)) * (WIDTH - PAD * 2);
    const mapY = (y: number) => HEIGHT - PAD - ((y - yMin) / (yMax - yMin || 1)) * (HEIGHT - PAD * 2);

    const parts: string[] = [];
    let drawing = false;
    for (const point of samples) {
      if (!point) {
        drawing = false;
        continue;
      }
      const px = mapX(point.x);
      const py = mapY(point.y);
      if (!drawing) {
        parts.push(`M ${px} ${py}`);
        drawing = true;
      } else {
        parts.push(`L ${px} ${py}`);
      }
    }
    return { d: parts.join(" "), yMin, yMax, mapX, mapY };
  }, [plot.expression, plot.xMax, plot.xMin]);

  const zeroY = path.mapY(0);
  const zeroX = path.mapX(0);

  return (
    <figure className="live-board-plot">
      <figcaption dir="ltr">
        y = {plot.expression}
        <span className="muted"> · [{plot.xMin}, {plot.xMax}]</span>
      </figcaption>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={`Plot of ${plot.expression}`}>
        <line x1={PAD} y1={zeroY} x2={WIDTH - PAD} y2={zeroY} stroke="#cbd5e1" strokeWidth="1" />
        <line x1={zeroX} y1={PAD} x2={zeroX} y2={HEIGHT - PAD} stroke="#cbd5e1" strokeWidth="1" />
        <path d={path.d} fill="none" stroke="#10213d" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    </figure>
  );
}
