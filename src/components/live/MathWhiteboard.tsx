"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Katex } from "@/components/studio/Katex";
import { formatLebaneseEquation } from "@/lib/math/lebaneseEquationFormat";
import type { WhiteboardEquation, WhiteboardStroke } from "@/lib/livekit/protocol";

const COLORS = [
  { id: "navy", value: "#10213d", label: "Navy" },
  { id: "gold", value: "#d9aa53", label: "Gold" },
  { id: "ink", value: "#15233b", label: "Ink" },
  { id: "red", value: "#9a3412", label: "Red" },
];

type Props = {
  canWrite: boolean;
  strokes: WhiteboardStroke[];
  equations: WhiteboardEquation[];
  onStroke: (stroke: WhiteboardStroke) => void;
  onEquation: (equation: WhiteboardEquation) => void;
  onClear: () => void;
  authorId: string;
};

function relativePoint(event: React.PointerEvent<HTMLCanvasElement>) {
  const rect = event.currentTarget.getBoundingClientRect();
  const w = rect.width || 1;
  const h = rect.height || 1;
  return {
    x: Math.min(1, Math.max(0, (event.clientX - rect.left) / w)),
    y: Math.min(1, Math.max(0, (event.clientY - rect.top) / h)),
  };
}

function paint(canvas: HTMLCanvasElement, strokes: WhiteboardStroke[]) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const stroke of strokes) {
    if (stroke.points.length < 2) continue;
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x * width, stroke.points[0].y * height);
    for (let i = 1; i < stroke.points.length; i += 1) {
      ctx.lineTo(stroke.points[i].x * width, stroke.points[i].y * height);
    }
    ctx.stroke();
  }
}

export function MathWhiteboard({
  canWrite,
  strokes,
  equations,
  onStroke,
  onEquation,
  onClear,
  authorId,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const draftRef = useRef<WhiteboardStroke | null>(null);
  const [color, setColor] = useState(COLORS[0].value);
  const [latex, setLatex] = useState("\\lim\\limits_{x \\to 0} \\frac{\\sin x}{x}");
  const preview = formatLebaneseEquation(latex);
  const boardId = useId();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    const resize = () => {
      const w = parent?.clientWidth ?? 640;
      const h = Math.max(280, Math.min(420, Math.round(w * 0.48)));
      canvas.width = w * 2;
      canvas.height = h * 2;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      paint(canvas, strokes);
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [strokes]);

  const pointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canWrite) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    draftRef.current = {
      id: `st-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      color,
      width: 3.2,
      points: [relativePoint(event)],
      authorId,
    };
  };

  const pointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const draft = draftRef.current;
    if (!draft || !canWrite) return;
    draft.points.push(relativePoint(event));
    const canvas = canvasRef.current;
    if (canvas) paint(canvas, [...strokes, draft]);
  };

  const pointerUp = () => {
    const draft = draftRef.current;
    draftRef.current = null;
    if (draft && draft.points.length > 1) onStroke(draft);
  };

  const addEquation = () => {
    if (!canWrite) return;
    const cleaned = formatLebaneseEquation(latex.trim());
    if (!cleaned) return;
    onEquation({
      id: `eq-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      latex: cleaned,
      authorId,
      createdAt: new Date().toISOString(),
    });
    setLatex("");
  };

  return (
    <section className="live-whiteboard" aria-labelledby={`${boardId}-title`}>
      <header className="live-whiteboard-head">
        <div>
          <p className="eyebrow">السبورة الرياضية / Math board</p>
          <h2 id={`${boardId}-title`}>KaTeX · المنهج اللبناني · Word Equation</h2>
        </div>
        <div className="live-whiteboard-tools">
          {COLORS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`live-swatch${color === item.value ? " on" : ""}`}
              style={{ background: item.value }}
              aria-label={item.label}
              disabled={!canWrite}
              onClick={() => setColor(item.value)}
            />
          ))}
          <button className="btn" type="button" disabled={!canWrite} onClick={onClear}>
            مسح السبورة / Clear
          </button>
        </div>
      </header>
      {!canWrite ? (
        <p className="muted live-board-lock">
          عرض فقط حتى يسمح الأستاذ بالكتابة على السبورة. / View only until Prof. Munzer Haddara grants write.
        </p>
      ) : null}
      <div className="live-whiteboard-canvas-wrap">
        <canvas
          ref={canvasRef}
          className="live-whiteboard-canvas"
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={pointerUp}
          onPointerCancel={pointerUp}
        />
      </div>
      <ol className="live-eq-list">
        {equations.length === 0 ? (
          <li className="muted">اكتب معادلة رسمية (كسور مكدّسة، جذور، نهايات تحت الرمز).</li>
        ) : null}
        {equations.map((item) => (
          <li key={item.id}>
            <Katex tex={item.latex} display />
          </li>
        ))}
      </ol>
      <div className="live-eq-composer">
        <label>
          LaTeX (يُنظَّف تلقائياً إلى شكل الورقة الرسمية)
          <input
            value={latex}
            disabled={!canWrite}
            onChange={(event) => setLatex(event.target.value)}
            onBlur={() => setLatex(formatLebaneseEquation(latex))}
            placeholder="\\frac{1}{x} · x^{2} · \\sqrt{x}"
          />
        </label>
        <div className="live-eq-preview" aria-label="Preview">
          {preview ? <Katex tex={preview} display /> : <span className="muted">معاينة / Preview</span>}
        </div>
        <button className="btn dark" type="button" disabled={!canWrite} onClick={addEquation}>
          أضف على السبورة / Pin equation
        </button>
      </div>
    </section>
  );
}
