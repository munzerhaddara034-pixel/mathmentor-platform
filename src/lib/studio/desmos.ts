/**
 * Desmos Graphing Calculator API (v1.8).
 *
 * Official docs: https://www.desmos.com/api/v1.8/docs/index.html
 * Script: https://www.desmos.com/api/v1.8/calculator.js?apiKey=YOUR_KEY
 *
 * Desmos requires an API key. Request one from the docs page above, then set
 * NEXT_PUBLIC_DESMOS_API_KEY. If the key is missing or the script fails to load,
 * the studio canvas falls back to the built-in SVG function plotter.
 */

export const DESMOS_SCRIPT_BASE = "https://www.desmos.com/api/v1.8/calculator.js";

export function desmosApiKey() {
  const explicit = process.env.NEXT_PUBLIC_DESMOS_API_KEY?.trim() ?? "";
  if (!explicit || explicit === "0" || explicit.toLowerCase() === "off") return "";
  return explicit;
}

export function hasDesmosKey() {
  return desmosApiKey().length > 0;
}

export function desmosScriptSrc(key = desmosApiKey()) {
  if (!key) return "";
  return `${DESMOS_SCRIPT_BASE}?apiKey=${encodeURIComponent(key)}`;
}

export type DesmosCalculator = {
  setExpression: (expression: Record<string, unknown>) => void;
  setMathBounds: (bounds: { left: number; right: number; bottom: number; top: number }) => void;
  destroy: () => void;
};

export type DesmosAPI = {
  GraphingCalculator: (element: HTMLElement, options?: Record<string, unknown>) => DesmosCalculator;
};

declare global {
  interface Window {
    Desmos?: DesmosAPI;
  }
}

let desmosLoader: Promise<DesmosAPI> | null = null;

export function loadDesmosApi(): Promise<DesmosAPI> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Desmos is browser-only."));
  }
  if (window.Desmos) return Promise.resolve(window.Desmos);
  const src = desmosScriptSrc();
  if (!src) return Promise.reject(new Error("NEXT_PUBLIC_DESMOS_API_KEY is not set."));
  if (desmosLoader) return desmosLoader;

  desmosLoader = new Promise<DesmosAPI>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-desmos-api]");
    const onReady = () => {
      if (window.Desmos) resolve(window.Desmos);
      else reject(new Error("Desmos script loaded without API global."));
    };
    if (existing) {
      existing.addEventListener("load", onReady);
      existing.addEventListener("error", () => reject(new Error("Desmos script failed.")));
      if (window.Desmos) onReady();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.desmosApi = "v1.8";
    script.onload = onReady;
    script.onerror = () => {
      desmosLoader = null;
      reject(new Error("Could not load Desmos calculator.js"));
    };
    document.head.appendChild(script);
  });
  return desmosLoader;
}

/** Convert a JS/plot expression in x into a Desmos LaTeX expression. */
export function jsFnToDesmosLatex(expression: string) {
  let src = expression.trim();
  if (!src) return "y=x";
  src = src.replace(/^y\s*=\s*/i, "");
  src = src.replace(/Math\./g, "");
  src = src.replace(/\*\*/g, "^");
  src = src.replace(/exp\s*\(([^)]+)\)/gi, "e^{$1}");
  src = src.replace(/\*/g, "");
  return src.startsWith("y=") ? src : `y=${src}`;
}
