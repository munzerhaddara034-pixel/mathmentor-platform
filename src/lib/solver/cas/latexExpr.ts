/** Best-effort LaTeX → mathjs expression for numeric comparison (returns null when unsure). */

function replaceBraced(tex: string, command: RegExp, arity: 1 | 2, build: (args: string[]) => string): string {
  let out = tex;
  for (let guard = 0; guard < 20; guard++) {
    const next = out.replace(
      arity === 2
        ? new RegExp(`${command.source}\\s*\\{([^{}]*)\\}\\s*\\{([^{}]*)\\}`, "g")
        : new RegExp(`${command.source}\\s*\\{([^{}]*)\\}`, "g"),
      (_m: string, a: string, b?: string) => build(arity === 2 ? [a, b ?? ""] : [a]),
    );
    if (next === out) break;
    out = next;
  }
  return out;
}

export function latexToExpr(input: string): string | null {
  let tex = input
    .replace(/\\text\s*\{[^{}]*\}/g, " ")
    .replace(/\\(?:mathrm|operatorname)\s*\{([^{}]*)\}/g, "$1")
    .replace(/\\left|\\right|\\displaystyle|\\,|\\;|\\!|\\quad|\\qquad|~/g, " ")
    .replace(/\{,\}/g, ".")
    .replace(/\\cdot|\\times/g, "*")
    .replace(/\\pi\b/g, "pi")
    .replace(/\\infty/g, "Infinity")
    .replace(/\\ln\b/g, "log")
    .replace(/\\(sin|cos|tan|exp|log)\b/g, "$1");
  tex = replaceBraced(tex, /\\sqrt\s*\[([^\]]+)\]/, 1, ([a]) => `nthRoot(${a})`);
  tex = replaceBraced(tex, /\\(?:d|t)?frac/, 2, ([a, b]) => `((${a})/(${b}))`);
  tex = replaceBraced(tex, /\\sqrt/, 1, ([a]) => `sqrt(${a})`);
  tex = tex.replace(/\^\{([^{}]*)\}/g, "^($1)").replace(/_\{[^{}]*\}|_[A-Za-z0-9]/g, "");
  if (/\\[A-Za-z]/.test(tex) || /[{}]/.test(tex)) return null;
  tex = tex
    .replace(/(\d)\s*(?=[A-Za-z(])/g, "$1*")
    .replace(/\)\s*(?=[A-Za-z0-9(])/g, ")*")
    .replace(/\s+/g, " ")
    .trim();
  return tex || null;
}
