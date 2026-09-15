"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { GraphPayload, HighlightKind, HighlightPayload, LessonLanguage } from "@/lib/studio/timeline";
import { compileFunction, defaultGraphTitle, sampleFn } from "@/lib/studio/functionPlot";
import { pickText } from "@/lib/studio/timeline";

type Props = {
  spec: GraphPayload;
  highlights: HighlightPayload[];
  language: LessonLanguage;
  progress: number;
};

const KIND_COLOR: Record<HighlightKind, string> = {
  root: "#f97316",
  asymptote: "#38bdf8",
  extrema: "#f472b6",
  point: "#d9aa53",
};

function mapX(x: number, xDomain: [number, number], width: number, pad: number) {
  const [min, max] = xDomain;
  return pad + ((x - min) / (max - min || 1)) * (width - pad * 2);
}

function mapY(y: number, yDomain: [number, number], height: number, pad: number) {
  const [min, max] = yDomain;
  return height - pad - ((y - min) / (max - min || 1)) * (height - pad * 2);
}

function ticks(domain: [number, number], count = 6) {
  const [min, max] = domain;
  const span = max - min || 1;
  const step = span / count;
  return Array.from({ length: count + 1 }, (_, i) => min + i * step);
}

export function FunctionGraph({ spec, highlights, language, progress }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const clipId = useId().replace(/:/g, "");
  const [width, setWidth] = useState(520);
  const height = 280;
  const pad = 36;

  useEffect(() => {
    const node = wrapRef.current;
    if (!node) return;
    const measure = () => setWidth(Math.max(280, node.clientWidth));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const xDomain: [number, number] = spec.xDomain ?? [-3, 3];
  const yDomain: [number, number] = spec.yDomain ?? [-2, 8];
  const title = defaultGraphTitle(spec);

  const polylines = useMemo(() => {
    if (spec.kind === "argand" || !spec.fn) return [];
    const samples = sampleFn(compileFunction(spec.fn), xDomain, spec.samples ?? 260);
    const lines: Array<Array<{ x: number; y: number }>> = [];
    let current: Array<{ x: number; y: number }> = [];
    for (const point of samples) {
      if (!point || point.y < yDomain[0] - 20 || point.y > yDomain[1] + 20) {
        if (current.length > 1) lines.push(current);
        current = [];
        continue;
      }
      current.push({
        x: mapX(point.x, xDomain, width, pad),
        y: mapY(point.y, yDomain, height, pad),
      });
    }
    if (current.length > 1) lines.push(current);
    return lines;
  }, [spec.fn, spec.kind, spec.samples, width, xDomain, yDomain]);

  const clip = Math.max(0.08, Math.min(1, progress));
  const graphPoints = spec.points ?? [];
  const x0 = mapX(0, xDomain, width, pad);
  const y0 = mapY(0, yDomain, height, pad);

  return (
    <div ref={wrapRef} className="studio-graph">
      <div className="studio-graph-head">
        <strong>{pickText(title, language)}</strong>
        <span className="studio-legend">
          <i className="lg root" /> {language === "ar" ? "جذور" : "Roots"}
          <i className="lg asy" /> {language === "ar" ? "تقارب" : "Asymptotes"}
          <i className="lg ext" /> {language === "ar" ? "نهايات" : "Extrema"}
        </span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={pickText(title, language)}>
        <defs>
          <clipPath id={clipId}>
            <rect x="0" y="0" width={Math.max(1, width * clip)} height={height} />
          </clipPath>
        </defs>
        <rect x="0" y="0" width={width} height={height} rx="16" fill="#0b182e" />
        {ticks(xDomain).map((tick) => {
          const x = mapX(tick, xDomain, width, pad);
          return (
            <g key={`vx-${tick}`}>
              <line x1={x} y1={pad} x2={x} y2={height - pad} stroke="rgba(255,255,255,.06)" />
              <text x={x} y={height - 10} textAnchor="middle" fill="#8aa0bd" fontSize="10">
                {tick.toFixed(0)}
              </text>
            </g>
          );
        })}
        {ticks(yDomain).map((tick) => {
          const y = mapY(tick, yDomain, height, pad);
          return (
            <g key={`hy-${tick}`}>
              <line x1={pad} y1={y} x2={width - pad} y2={y} stroke="rgba(255,255,255,.06)" />
              <text x={12} y={y + 3} fill="#8aa0bd" fontSize="10">
                {tick.toFixed(0)}
              </text>
            </g>
          );
        })}
        <line x1={pad} y1={y0} x2={width - pad} y2={y0} stroke="#c7d4e6" strokeWidth="1.2" />
        <line x1={x0} y1={pad} x2={x0} y2={height - pad} stroke="#c7d4e6" strokeWidth="1.2" />
        <text x={width - pad} y={y0 - 6} fill="#c7d4e6" fontSize="11">
          x
        </text>
        <text x={x0 + 6} y={pad + 4} fill="#c7d4e6" fontSize="11">
          {spec.kind === "argand" ? "Im" : "y"}
        </text>

        {highlights
          .filter((item) => item.kind === "asymptote")
          .map((item, index) => {
            if (item.axis === "y" && typeof item.value === "number") {
              const y = mapY(item.value, yDomain, height, pad);
              return (
                <line
                  key={`h-asy-${index}`}
                  x1={pad}
                  y1={y}
                  x2={width - pad}
                  y2={y}
                  stroke={KIND_COLOR.asymptote}
                  strokeDasharray="6 5"
                  strokeWidth="2"
                />
              );
            }
            if (item.axis === "x" && typeof item.value === "number") {
              const x = mapX(item.value, xDomain, width, pad);
              return (
                <line
                  key={`v-asy-${index}`}
                  x1={x}
                  y1={pad}
                  x2={x}
                  y2={height - pad}
                  stroke={KIND_COLOR.asymptote}
                  strokeDasharray="6 5"
                  strokeWidth="2"
                />
              );
            }
            return null;
          })}

        <g clipPath={spec.kind === "argand" ? undefined : `url(#${clipId})`}>
          {polylines.map((line, index) => (
            <polyline
              key={index}
              fill="none"
              stroke="#d9aa53"
              strokeWidth="2.6"
              strokeLinejoin="round"
              strokeLinecap="round"
              points={line.map((p) => `${p.x},${p.y}`).join(" ")}
            />
          ))}
        </g>

        {[...graphPoints, ...highlights.filter((item) => typeof item.x === "number")].map((item, index) => {
          if (typeof item.x !== "number" || typeof item.y !== "number") return null;
          const kind = ("kind" in item && item.kind) || "point";
          const cx = mapX(item.x, xDomain, width, pad);
          const cy = mapY(item.y, yDomain, height, pad);
          const label = "label" in item ? item.label : undefined;
          return (
            <g key={`pt-${index}`}>
              <circle cx={cx} cy={cy} r="6" fill={KIND_COLOR[kind]} stroke="#fff" strokeWidth="1.5" />
              {label ? (
                <text x={cx + 8} y={cy - 8} fill="#f8edda" fontSize="11" fontWeight="700">
                  {pickText(label, language)}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
