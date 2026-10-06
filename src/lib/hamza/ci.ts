/** CI status → summary + chat report (pure; unit-tested). */
import type { CheckRunInfo } from "./github/types";
import type { CiCheckResult, CiState, CiSummary } from "./types";

const OK_CONCLUSIONS = new Set(["success", "skipped", "neutral"]);

function latestByName(runs: CheckRunInfo[]): Map<string, CheckRunInfo> {
  const out = new Map<string, CheckRunInfo>();
  for (const run of runs) {
    const current = out.get(run.name);
    if (!current || run.id > current.id) out.set(run.name, run);
  }
  return out;
}

function duration(run: CheckRunInfo): number | undefined {
  if (!run.startedAt || !run.completedAt) return undefined;
  const seconds = (Date.parse(run.completedAt) - Date.parse(run.startedAt)) / 1000;
  return Number.isFinite(seconds) && seconds >= 0 ? Math.round(seconds) : undefined;
}

/**
 * Required checks decide the state. No matching run yet = "pending" (CI not started), or "missing" when
 * it is still absent after `missingAfterMs` (workflow not installed / not triggered).
 */
export function summarizeChecks(input: {
  runs: CheckRunInfo[];
  required: string[];
  headSha: string;
  now: Date;
  waitingSinceMs?: number;
  missingAfterMs?: number;
}): CiSummary {
  const latest = latestByName(input.runs);
  const required = input.required.map((name) => latest.get(name)).filter((run): run is CheckRunInfo => Boolean(run));
  const checks: CiCheckResult[] = [...latest.values()].map((run) => ({
    name: run.name,
    status: run.status,
    conclusion: run.conclusion,
    url: run.url,
    durationSec: duration(run),
  }));
  let state: CiState;
  if (required.length < input.required.length) {
    const waited = input.waitingSinceMs !== undefined ? input.now.getTime() - input.waitingSinceMs : 0;
    state = required.length === 0 && waited > (input.missingAfterMs ?? 10 * 60_000) ? "missing" : required.some(isFailure) ? "failed" : "pending";
  } else if (required.some(isFailure)) state = "failed";
  else if (required.every((run) => run.status === "completed")) state = "passed";
  else state = "running";
  return { state, headSha: input.headSha, checks, checkedAt: input.now.toISOString() };
}

function isFailure(run: CheckRunInfo): boolean {
  return run.status === "completed" && !OK_CONCLUSIONS.has(run.conclusion ?? "");
}

export function failingJobIds(runs: CheckRunInfo[], required: string[]): number[] {
  const latest = latestByName(runs);
  return required
    .map((name) => latest.get(name))
    .filter((run): run is CheckRunInfo => Boolean(run) && isFailure(run as CheckRunInfo))
    .map((run) => run.jobId ?? run.id);
}

const ANSI_RE = /\u001b\[[0-9;]*[A-Za-z]/g;
const TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z\s?/;
const ERROR_RE = /(error\b|Error:|ERR!|\bFAIL\b|failed|✖|not ok\b|TS\d{4}|Type error|##\[error\])/;

/** First error lines of a GitHub Actions job log (≤ maxLines), timestamps and ANSI colours removed. */
export function extractErrorLines(log: string, maxLines = 30): string {
  const lines = log
    .replace(ANSI_RE, "")
    .split(/\r?\n/)
    .map((line) => line.replace(TIMESTAMP_RE, "").trimEnd())
    .filter((line) => line && !/^##\[(group|endgroup)\]/.test(line));
  const first = lines.findIndex((line) => ERROR_RE.test(line));
  const slice = first >= 0 ? lines.slice(Math.max(0, first - 2), first - 2 + maxLines) : lines.slice(-maxLines);
  return slice
    .slice(0, maxLines)
    .map((line) => line.slice(0, 300))
    .join("\n");
}

const ICON: Record<string, string> = { success: "✅", skipped: "⏭️", neutral: "➖", failure: "❌", cancelled: "⛔", timed_out: "⏱️" };

/** Arabic chat report (chat content stays Arabic, like every agent/system message in /admin/team). */
export function formatCiReport(input: { summary: CiSummary; prNumber?: number; prUrl?: string; repairNote?: string }): string {
  const { summary } = input;
  const head =
    summary.state === "passed"
      ? "✅ نجح فحص CI (tsc · الاختبارات · البناء)"
      : summary.state === "failed"
        ? "❌ فشل فحص CI"
        : summary.state === "missing"
          ? "⚠️ لم يبدأ أي فحص CI على هذا الـ PR (هل أُضيف .github/workflows/hamza-ci.yml؟)"
          : "⏳ فحص CI قيد التشغيل";
  const lines = [`${head}${input.prNumber ? ` — PR #${input.prNumber}` : ""} · ${summary.headSha.slice(0, 7)}`];
  for (const check of summary.checks) {
    const icon = check.status === "completed" ? (ICON[check.conclusion ?? ""] ?? "❌") : "⏳";
    lines.push(`- ${icon} ${check.name}${check.durationSec !== undefined ? ` (${check.durationSec} ث)` : ""}${check.url ? ` — ${check.url}` : ""}`);
  }
  if (summary.errorExcerpt) lines.push("", "أول أسطر الخطأ:", "```", summary.errorExcerpt, "```");
  if (summary.state === "passed") lines.push("", "الدمج في الفرع الحيّ يحتاج الموافقة الثانية (رمز منفصل + كتابة اسم الفرع).");
  if (input.repairNote) lines.push("", input.repairNote);
  if (input.prUrl) lines.push(`الـ PR: ${input.prUrl}`);
  return lines.join("\n");
}
