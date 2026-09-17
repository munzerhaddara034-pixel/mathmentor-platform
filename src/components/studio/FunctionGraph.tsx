"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { GraphPayload, HighlightKind, HighlightPayload } from "@/lib/studio/timeline";
import type { LessonLocale } from "@/lib/studio/i18n";
import { pickText, STUDIO_UI } from "@/lib/studio/i18n";
import { compileFunction, defaultGraphTitle, sampleFn } from "@/lib/studio/functionPlot";

type Props = {
  spec: GraphPayload;
  highlights: HighlightPayload[];
  language: LessonLocale;
  progress: number;
};

const KIND_COLOR: Record<HighlightKind, string> = {
  root: "#f97316",
  asymptote: "#38bdf8",
  extrema: "#f472b6",
  point: "#d9aa53",
};

type View = { xMin: number; xMax: number; yMin: number; yMax: number };

function mapX(x: number, view: View, width: number, pad: number) {
  return pad + ((x - view.xMin) / (view.xMax - view.xMin || 1)) * (width - pad * 2);
}

function mapY(y: number, view: View, height: number, pad: number) {
  return height - pad - ((y - view.yMin) / (view.yMax - view.yMin || 1)) * (height - pad * 2);
}

function unmapX(px: number, view: View, width: number, pad: number) {
  return view.xMin + ((px - pad) / (width - pad * 2 || 1)) * (view.xMax - view.xMin);
}

function unmapY(py: number, view: View, height: number, pad: number) {
  return view.yMin + ((height - pad - py) / (height - pad * 2 || 1)) * (view.yMax - view.yMin);
}

function ticks(min: number, max: number, count = 6) {
  const span = max - min || 1;
  const step = span / count;
  return Array.from({ length: count + 1 }, (_, i) => min + i * step);
}

function viewFromSpec(spec: GraphPayload): View {
  const x = spec.xDomain ?? [-3, 3];
  const y = spec.yDomain ?? [-2, 8];
  return { xMin: x[0], xMax: x[1], yMin: y[0], yMax: y[1] };
}

function zoomView(view: View, cx: number, cy: number, factor: number): View {
  const xSpan = Math.max(0.4, (view.xMax - view.xMin) * factor);
  const ySpan = Math.max(0.4, (view.yMax - view.yMin) * factor);
  const xRatio = (cx - view.xMin) / (view.xMax - view.xMin || 1);
  const yRatio = (cy - view.yMin) / (view.yMax - view.yMin || 1);
  return {
    xMin: cx - xSpan * xRatio,
    xMax: cx + xSpan * (1 - xRatio),
    yMin: cy - ySpan * yRatio,
    yMax: cy + ySpan * (1 - yRatio),
  };
}

export function FunctionGraph({ spec, highlights, language, progress }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const clipId = useId().replace(/:/g, "");
  const [width, setWidth] = useState(520);
  const height = 280;
  const pad = 36;
  const [view, setView] = useState<View>(() => viewFromSpec(spec));
  const [hover, setHover] = useState<{ x: number; y: number; px: number; py: number } | null>(null);
  const drag = useRef<{ id: number; x: number; y: number; view: View } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; view: View } | null>(null);
  const fn = useMemo(() => (spec.fn ? compileFunction(spec.fn) : null), [spec.fn]);

  useEffect(() => {
    setView(viewFromSpec(spec));
  }, [spec.fn, spec.xDomain?.[0], spec.xDomain?.[1], spec.yDomain?.[0], spec.yDomain?.[1]]);

  useEffect(() => {
    const node = wrapRef.current;
    if (!node) return;
    const measure = () => setWidth(Math.max(280, node.clientWidth));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const rect = svg.getBoundingClientRect();
      const px = ((event.clientX - rect.left) / rect.width) * width;
      const py = ((event.clientY - rect.top) / rect.height) * height;
      const factor = event.deltaY > 0 ? 1.12 : 1 / 1.12;
      setView((current) => zoomView(current, unmapX(px, current, width, pad), unmapY(py, current, height, pad), factor));
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [width]);

  const title = defaultGraphTitle(spec);
  const polylines = useMemo(() => {
    if (spec.kind === "argand" || !spec.fn) return [];
    const xDomain: [number, number] = [view.xMin, view.xMax];
    const samples = sampleFn(compileFunction(spec.fn), xDomain, spec.samples ?? 280);
    const lines: Array<Array<{ x: number; y: number }>> = [];
    let current: Array<{ x: number; y: number }> = [];
    for (const point of samples) {
      if (!point || point.y < view.yMin - 20 || point.y > view.yMax + 20) {
        if (current.length > 1) lines.push(current);
        current = [];
        continue;
      }
      current.push({
        x: mapX(point.x, view, width, pad),
        y: mapY(point.y, view, height, pad),
      });
    }
    if (current.length > 1) lines.push(current);
    return lines;
  }, [spec.fn, spec.kind, spec.samples, view, width]);

  const clip = Math.max(0.2, Math.min(1, progress <= 0 ? 1 : Math.min(1, 0.35 + progress * 3)));
  const graphPoints = spec.points ?? [];
  const x0 = mapX(0, view, width, pad);
  const y0 = mapY(0, view, height, pad);

  const clientToSvg = (event: { clientX: number; clientY: number }) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: ((event.clientX - rect.left) / rect.width) * width,
      y: ((event.clientY - rect.top) / rect.height) * height,
    };
  };

  const pointerDist = () => {
    const pts = [...pointers.current.values()];
    if (pts.length < 2) return 0;
    const first = pts[0];
    const second = pts[1];
    if (!first || !second) return 0;
    return Math.hypot(first.x - second.x, first.y - second.y);
  };

  const onPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    event.stopPropagation();
    (event.target as Element).setPointerCapture?.(event.pointerId);
    const pt = clientToSvg(event);
    pointers.current.set(event.pointerId, pt);
    if (pointers.current.size === 1) {
      drag.current = { id: event.pointerId, x: pt.x, y: pt.y, view };
    } else if (pointers.current.size === 2) {
      drag.current = null;
      pinch.current = { dist: pointerDist(), view };
    }
  };

  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    event.stopPropagation();
    const pt = clientToSvg(event);
    if (pointers.current.has(event.pointerId)) pointers.current.set(event.pointerId, pt);

    if (pointers.current.size >= 2 && pinch.current) {
      const dist = pointerDist();
      if (dist > 8 && pinch.current.dist > 8) {
        const factor = pinch.current.dist / dist;
        const midX = (view.xMin + view.xMax) / 2;
        const midY = (view.yMin + view.yMax) / 2;
        setView(zoomView(pinch.current.view, midX, midY, factor));
      }
      return;
    }

    if (drag.current && drag.current.id === event.pointerId) {
      const dx = unmapX(pt.x, drag.current.view, width, pad) - unmapX(drag.current.x, drag.current.view, width, pad);
      const dy = unmapY(pt.y, drag.current.view, height, pad) - unmapY(drag.current.y, drag.current.view, height, pad);
      setView({
        xMin: drag.current.view.xMin - dx,
        xMax: drag.current.view.xMax - dx,
        yMin: drag.current.view.yMin - dy,
        yMax: drag.current.view.yMax - dy,
      });
      setHover(null);
      return;
    }

    if (!fn || spec.kind === "argand") {
      setHover(null);
      return;
    }
    const x = unmapX(pt.x, view, width, pad);
    const y = fn(x);
    if (!Number.isFinite(y)) {
      setHover(null);
      return;
    }
    setHover({ x, y, px: mapX(x, view, width, pad), py: mapY(y, view, height, pad) });
  };

  const endPointer = (event: React.PointerEvent<SVGSVGElement>) => {
    event.stopPropagation();
    pointers.current.delete(event.pointerId);
    if (drag.current?.id === event.pointerId) drag.current = null;
    if (pointers.current.size < 2) pinch.current = null;
  };

  return (
    <div ref={wrapRef} className="studio-graph studio-graph-interactive">
      <div className="studio-graph-head">
        <strong>{pickText(title, language)}</strong>
        <span className="studio-legend">
          <i className="lg root" /> {pickText(STUDIO_UI.roots, language)}
          <i className="lg asy" /> {pickText(STUDIO_UI.asymptotes, language)}
          <i className="lg ext" /> {pickText(STUDIO_UI.extrema, language)}
        </span>
      </div>
      <p className="studio-interact-hint">{pickText(STUDIO_UI.interactHint, language)}</p>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={pickText(title, language)}
        className="studio-graph-svg"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onDoubleClick={(event) => {
          event.stopPropagation();
          setView(viewFromSpec(spec));
        }}
      >
        <defs>
          <clipPath id={clipId}>
            <rect x="0" y="0" width={Math.max(1, width * clip)} height={height} />
          </clipPath>
        </defs>
        <rect x="0" y="0" width={width} height={height} rx="16" fill="#0b182e" />
        {ticks(view.xMin, view.xMax).map((tick) => {
          const x = mapX(tick, view, width, pad);
          return (
            <g key={`vx-${tick}`}>
              <line x1={x} y1={pad} x2={x} y2={height - pad} stroke="rgba(255,255,255,.06)" />
              <text x={x} y={height - 10} textAnchor="middle" fill="#8aa0bd" fontSize="10">
                {tick.toFixed(0)}
              </text>
            </g>
          );
        })}
        {ticks(view.yMin, view.yMax).map((tick) => {
          const y = mapY(tick, view, height, pad);
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
              const y = mapY(item.value, view, height, pad);
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
              const x = mapX(item.value, view, width, pad);
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
          const cx = mapX(item.x, view, width, pad);
          const cy = mapY(item.y, view, height, pad);
          const label = "label" in item ? item.label : undefined;
          return (
            <g key={`pt-${index}`}>
              <circle cx={cx} cy={cy} r="6" fill={KIND_COLOR[kind]} stroke="#fff" strokeWidth="1.5" />
              {label ? (
                <text x={cx + 8} y={cy - 8} fill="#f8edda" fontSize="11" fontWeight="700">
                  {pickText(label, language)}
                </text>
              ) : (
                <text x={cx + 8} y={cy - 8} fill="#f8edda" fontSize="11" fontWeight="700">
                  {kind === "root" ? "root" : kind === "extrema" ? "min" : ""} ({item.x}, {item.y})
                </text>
              )}
            </g>
          );
        })}

        {hover ? (
          <g>
            <circle cx={hover.px} cy={hover.py} r="4.5" fill="#fff" stroke="#d9aa53" strokeWidth="2" />
            <rect x={hover.px + 10} y={hover.py - 28} width="118" height="22" rx="8" fill="rgba(16,33,61,.92)" />
            <text x={hover.px + 18} y={hover.py - 13} fill="#f8edda" fontSize="11" fontWeight="700">
              ({hover.x.toFixed(2)}, {hover.y.toFixed(2)})
            </text>
          </g>
        ) : null}
      </svg>
      <button className="studio-reset-view" type="button" onClick={() => setView(viewFromSpec(spec))}>
        {pickText(STUDIO_UI.resetView, language)}
      </button>
    </div>
  );
}
