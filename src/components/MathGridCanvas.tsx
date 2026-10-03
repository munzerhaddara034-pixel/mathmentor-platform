"use client";

import { useEffect, useRef } from "react";

function themeIsDark() {
  return document.documentElement.getAttribute("data-theme") === "dark";
}

export function MathGridCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let raf = 0;
    let last = 0;
    const sparks = Array.from({ length: 14 }, (_, index) => ({
      x: Math.random(),
      y: Math.random(),
      speed: 0.00008 + Math.random() * 0.00012,
      axis: index % 2 === 0 ? "x" : "y",
      phase: Math.random() * Math.PI * 2,
    }));

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(window.innerWidth * ratio);
      canvas.height = Math.floor(window.innerHeight * ratio);
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const draw = (now: number) => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      ctx.clearRect(0, 0, width, height);
      const dark = themeIsDark();
      const gap = 36;
      ctx.lineWidth = 1;
      ctx.strokeStyle = dark ? "rgba(227, 188, 106, 0.07)" : "rgba(16, 33, 61, 0.06)";
      ctx.beginPath();
      for (let x = 0; x <= width; x += gap) {
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, height);
      }
      for (let y = 0; y <= height; y += gap) {
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(width, y + 0.5);
      }
      ctx.stroke();

      if (!reduced) {
        const dt = Math.min(32, now - last || 16);
        last = now;
        for (const spark of sparks) {
          if (spark.axis === "x") spark.x = (spark.x + spark.speed * dt) % 1;
          else spark.y = (spark.y + spark.speed * dt) % 1;
          const px = spark.x * width;
          const py = spark.y * height;
          const pulse = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(now / 700 + spark.phase));
          ctx.fillStyle = dark ? `rgba(227, 188, 106, ${0.18 * pulse})` : `rgba(217, 170, 83, ${0.22 * pulse})`;
          ctx.beginPath();
          ctx.arc(px, py, 2.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      frame += 1;
      raf = window.requestAnimationFrame(draw);
    };

    const onVisibility = () => {
      if (document.hidden) {
        window.cancelAnimationFrame(raf);
        return;
      }
      last = 0;
      raf = window.requestAnimationFrame(draw);
    };

    resize();
    raf = window.requestAnimationFrame(draw);
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVisibility);
    const observer = new MutationObserver(() => {
      /* theme flips redraw on next frame via themeIsDark */
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
      observer.disconnect();
      void frame;
    };
  }, []);

  return <canvas ref={ref} className="math-grid-canvas" aria-hidden="true" />;
}
