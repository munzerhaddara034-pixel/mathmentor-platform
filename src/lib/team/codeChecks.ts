/**
 * Guards applied to every developer proposal before it is shown AND again before commit.
 * (Full `tsc --noEmit` + `next build` cannot run inside the Render web process; see docs/TEAM_CHAT.md.)
 */
import { scanForSecrets } from "./secrets";

export const MAX_FILES_PER_PROPOSAL = 4;
export const MAX_FILE_BYTES = 60_000;
export const MAX_CHANGED_LINES = 600;

const ALLOWED_PREFIXES = ["src/", "docs/", "content/", "scripts/", "public/"];
const ALLOWED_ROOT_FILES = ["README.md"];
const DENIED = [
  /(^|\/)\.env/i,
  /^data\//,
  /node_modules\//,
  /^\.github\//,
  /package-lock\.json$/,
  /\.(pem|key|p12|pfx|db|sqlite|zip|png|jpe?g|gif|webp|mp4|mp3|pdf|woff2?)$/i,
  /(^|\/)secrets?(\/|\.)/i,
];

export function isAllowedPath(path: string): boolean {
  if (!path || path.includes("..") || path.startsWith("/") || path.includes("\\")) return false;
  if (DENIED.some((re) => re.test(path))) return false;
  return ALLOWED_ROOT_FILES.includes(path) || ALLOWED_PREFIXES.some((prefix) => path.startsWith(prefix));
}

const ANY_RE = /(:\s*any\b|\bas\s+any\b|<any>|any\[\]|@ts-ignore|@ts-nocheck|@ts-expect-error)/;
const FORBIDDEN_BRAND_RE = /الطارة|al[- ]?tarah/i;

/** Returns Arabic findings; empty = passes. */
export function staticFindings(files: Array<{ path: string; content: string; addedLines: string[] }>): string[] {
  const findings: string[] = [];
  for (const file of files) {
    if (!isAllowedPath(file.path)) findings.push(`${file.path}: مسار غير مسموح للتعديل من المنصة.`);
    if (Buffer.byteLength(file.content, "utf8") > MAX_FILE_BYTES) {
      findings.push(`${file.path}: حجم الملف يتجاوز ${MAX_FILE_BYTES / 1000}KB.`);
    }
    const secrets = scanForSecrets(file.content);
    if (secrets.length) findings.push(`${file.path}: نمط سرّ مكتشف (${secrets.join("، ")}) — ممنوع.`);
    if (/\.(ts|tsx)$/.test(file.path) && file.addedLines.some((line) => ANY_RE.test(line))) {
      findings.push(`${file.path}: يحتوي any أو @ts-ignore — ممنوع في TypeScript الصارم.`);
    }
    if (file.addedLines.some((line) => FORBIDDEN_BRAND_RE.test(line))) findings.push(`${file.path}: اسم علامة ممنوع.`);
  }
  return findings;
}

type TsModule = {
  transpileModule: (
    input: string,
    options: { compilerOptions: Record<string, unknown>; fileName: string; reportDiagnostics: boolean },
  ) => { diagnostics?: Array<{ messageText: string | { messageText: string }; start?: number }> };
};

/** Syntax check of .ts/.tsx via the TypeScript compiler when it is installed (dev dependency). */
export async function syntaxCheck(files: Array<{ path: string; content: string }>): Promise<{ ran: boolean; errors: string[] }> {
  let ts: TsModule;
  try {
    ts = (await import("typescript")) as unknown as TsModule;
  } catch {
    return { ran: false, errors: [] };
  }
  const errors: string[] = [];
  for (const file of files) {
    if (!/\.(ts|tsx)$/.test(file.path)) continue;
    const out = ts.transpileModule(file.content, {
      compilerOptions: { jsx: 1, target: 99, module: 99 },
      fileName: file.path,
      reportDiagnostics: true,
    });
    for (const diag of out.diagnostics ?? []) {
      const text = typeof diag.messageText === "string" ? diag.messageText : diag.messageText.messageText;
      errors.push(`${file.path}: ${text}`);
    }
  }
  return { ran: true, errors: errors.slice(0, 8) };
}
