/**
 * Project standards as code (no dependencies besides the secret scanner). Used three ways:
 * in Hamza's prechecks (findings go back to the model), by scripts/check-standards.mjs in `hamza-ci`,
 * and in tests. Only ADDED lines are judged for line rules, so old code never blocks a new PR.
 */
import { scanForSecrets } from "@/lib/team/secrets";

export type StandardsSeverity = "error" | "warn";
export type StandardsFinding = { path: string; line?: number; rule: string; severity: StandardsSeverity; message: string };
export type StandardsFile = {
  path: string;
  /** Content after the change ("" for a delete). */
  content: string;
  /** 1-based line numbers (in `content`) of added lines. */
  addedLines: number[];
  isNew: boolean;
  deleted?: boolean;
};

export const COMPONENT_MAX_LINES = 200;
export const FUNCTION_MAX_LINES = 60;
const MOBILE_MAX_PX = 390;

const ANY_RE = /(:\s*any\b|\bas\s+any\b|<\s*any\s*>|\bany\[\])/;
/** TS suppression directives only count inside a comment. */
const TS_DIRECTIVE_RE = /(\/\/|\/\*)\s*@ts-(?:ignore|nocheck|expect-error)\b/;
/** $…$ containing TeX-ish syntax, not a template `${`. */
const RAW_MATH_RE = /(?<![\\$])\$(?!\{)[^$\n{}`]*[\\^_][^$\n`]*\$(?!\{)/;
const WIDE_RE = /(?:(?:min-)?width\s*:\s*["']?|\bw-\[|\bmin-w-\[)(\d{3,4})px/;
// Wrong spellings of the brand, built from code points so the literal never appears in the repo.
const WRONG_BRANDS = [
  String.fromCharCode(0x062d, 0x062f, 0x0627, 0x0631, 0x0629),
  String.fromCharCode(0x0627, 0x0644, 0x0637, 0x0627, 0x0631, 0x0629),
];
const WRONG_BRAND_LATIN = /\bal[- ]?tarah\b/i;

/** 1-based new-file line numbers of "+" lines in a unified diff. */
export function addedLineNumbers(diff: string): number[] {
  const out: number[] = [];
  let line = 0;
  for (const row of diff.split("\n")) {
    const hunk = row.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunk) {
      line = Number(hunk[1]);
      continue;
    }
    if (!line || row.startsWith("+++") || row.startsWith("---")) continue;
    if (row.startsWith("+")) out.push(line++);
    else if (row.startsWith(" ")) line += 1;
  }
  return out;
}

function isComponentFile(path: string): boolean {
  return /^src\/(components|app)\/.+\.tsx$/.test(path);
}

function isCode(path: string): boolean {
  return /\.(ts|tsx|mts|cts)$/.test(path);
}

/** Top-level-ish function spans via brace matching (good enough for warnings). */
export function functionSpans(content: string): Array<{ name: string; start: number; end: number }> {
  const lines = content.split("\n");
  const spans: Array<{ name: string; start: number; end: number }> = [];
  const head = /^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function\s+(\w+)|(?:const|let)\s+(\w+)\s*(?::[^=]+)?=\s*(?:async\s*)?(?:\([^)]*\)|\w+)\s*(?::[^=]+)?=>)/;
  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i].match(head);
    if (!match) continue;
    let depth = 0;
    let opened = false;
    let end = i;
    for (let j = i; j < lines.length; j += 1) {
      for (const ch of lines[j].replace(/(["'`])(?:\\.|(?!\1).)*\1/g, "")) {
        if (ch === "{") (depth += 1), (opened = true);
        else if (ch === "}") depth -= 1;
      }
      end = j;
      if (opened && depth <= 0) break;
      if (!opened && j > i + 2) break;
    }
    if (opened) spans.push({ name: match[1] ?? match[2] ?? "anonymous", start: i + 1, end: end + 1 });
  }
  return spans;
}

/** Drops single-line string literals so prose like "no any type" in a string is not flagged. */
function withoutStrings(line: string): string {
  return line.replace(/(["'`])(?:\\.|(?!\1).)*\1/g, '""');
}

function lineRules(file: StandardsFile, lines: string[]): StandardsFinding[] {
  const out: StandardsFinding[] = [];
  const add = (line: number, rule: string, severity: StandardsSeverity, message: string) => out.push({ path: file.path, line, rule, severity, message });
  for (const n of file.addedLines) {
    const text = lines[n - 1] ?? "";
    if (isCode(file.path) && (ANY_RE.test(withoutStrings(text)) || TS_DIRECTIVE_RE.test(text))) add(n, "no-any", "error", "`any` / ts-ignore is forbidden (strict TypeScript) — name the type or use unknown + narrowing.");
    if (file.path.endsWith(".tsx") && RAW_MATH_RE.test(text)) add(n, "katex-only", "error", "Raw $…$ maths in TSX — use MathInline / MathServer (KaTeX).");
    if (WRONG_BRANDS.some((wrong) => text.includes(wrong)) || WRONG_BRAND_LATIN.test(text)) add(n, "brand", "error", "Wrong brand spelling — only «منذر حداره» / Munzer Haddara.");
    const wide = text.match(WIDE_RE);
    const isQuery = /matchMedia|@media|\(\s*(?:min|max)-width/.test(text);
    if (wide && !isQuery && Number(wide[1]) > MOBILE_MAX_PX && /\.(tsx|css)$/.test(file.path) && !/@media|\b(sm|md|lg|xl):/.test(file.content)) {
      add(n, "mobile-first", "warn", `Fixed width ${wide[1]}px > ${MOBILE_MAX_PX}px without a media query — mobile-first.`);
    }
  }
  return out;
}

function fetchRules(file: StandardsFile, addedText: string): StandardsFinding[] {
  if (!/^\s*["']use client["']/.test(file.content) || !/\bfetch\(/.test(addedText)) return [];
  const out: StandardsFinding[] = [];
  if (!/\btry\s*\{/.test(file.content) || !/\bcatch\b/.test(file.content)) {
    out.push({ path: file.path, rule: "fetch-try-catch", severity: "error", message: "Client fetch without try/catch — show a visible error (ApiErrorBanner)." });
  }
  if (!/Skeleton|isLoading|loading|aria-busy/.test(file.content)) {
    out.push({ path: file.path, rule: "fetch-skeleton", severity: "error", message: "Client fetch without a loading state — render a Skeleton while loading." });
  }
  return out;
}

function fileRules(file: StandardsFile, lines: string[]): StandardsFinding[] {
  const out: StandardsFinding[] = [];
  const added = new Set(file.addedLines);
  const lineCount = file.content.endsWith("\n") ? lines.length - 1 : lines.length;
  if (isComponentFile(file.path) && lineCount > COMPONENT_MAX_LINES && file.addedLines.length) {
    out.push({
      path: file.path,
      rule: "small-components",
      severity: file.isNew ? "error" : "warn",
      message: `${lineCount} lines > ${COMPONENT_MAX_LINES} — split the component into smaller files.`,
    });
  }
  if (isCode(file.path)) {
    for (const span of functionSpans(file.content)) {
      const length = span.end - span.start + 1;
      const touched = file.isNew || [...added].some((n) => n >= span.start && n <= span.end);
      if (length > FUNCTION_MAX_LINES && touched) {
        out.push({ path: file.path, line: span.start, rule: "small-functions", severity: "warn", message: `${span.name}() is ${length} lines > ${FUNCTION_MAX_LINES}.` });
      }
    }
  }
  const addedText = file.addedLines.map((n) => lines[n - 1] ?? "").join("\n");
  out.push(...fetchRules(file, addedText));
  const secrets = scanForSecrets(addedText);
  if (secrets.length) out.push({ path: file.path, rule: "no-secrets", severity: "error", message: `Secret pattern in added lines (${secrets.join(", ")}) — read it from process.env.` });
  return out;
}

export function checkStandards(files: StandardsFile[]): StandardsFinding[] {
  const findings: StandardsFinding[] = [];
  for (const file of files) {
    if (file.deleted) continue;
    const lines = file.content.split("\n");
    findings.push(...lineRules(file, lines), ...fileRules(file, lines));
  }
  return findings;
}

export function standardsErrors(findings: StandardsFinding[]): StandardsFinding[] {
  return findings.filter((finding) => finding.severity === "error");
}

export function formatFindings(findings: StandardsFinding[]): string {
  return findings
    .map((f) => `${f.severity === "error" ? "✖" : "⚠"} ${f.path}${f.line ? `:${f.line}` : ""} [${f.rule}] ${f.message}`)
    .join("\n");
}

/** Proposal files → standards input. */
export function standardsInput(files: Array<{ path: string; newContent: string; diff: string; isNew: boolean; change?: string }>): StandardsFile[] {
  return files.map((file) => ({
    path: file.path,
    content: file.newContent,
    addedLines: addedLineNumbers(file.diff),
    isNew: file.isNew,
    deleted: file.change === "delete",
  }));
}
