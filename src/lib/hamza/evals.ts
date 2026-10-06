/** Scorer for docs/hamza/evals.json (pure). An eval result is what the agent loop produced for the request. */
import type { TeamProposalFile } from "@/lib/team/types";
import { checkStandards, standardsErrors, standardsInput } from "./standards";

type PathText = { pathPrefix: string; text: string };

export type EvalExpect = {
  outcome?: "proposal" | "reply";
  outcomeAny?: Array<"proposal" | "reply">;
  touch?: string[];
  touchAny?: string[];
  notTouch?: string[];
  maxFiles?: number;
  minFiles?: number;
  contains?: PathText[];
  notContains?: PathText[];
  rename?: { from: string; to: string };
  branchPrefix?: string[];
  replyNotContains?: string[];
  replyMaxQuestions?: number;
};

export type EvalCase = { id: string; title: string; request: string; expect: EvalExpect };
export type EvalRun = { kind: "proposal" | "reply" | "failed"; files?: TeamProposalFile[]; branch?: string; replyText?: string };
export type EvalCheck = { name: string; ok: boolean };
export type EvalScore = { id: string; score: number; passed: boolean; checks: EvalCheck[] };

function pathsOf(files: TeamProposalFile[]): string[] {
  return files.flatMap((file) => (file.oldPath ? [file.path, file.oldPath] : [file.path]));
}

function contentMatches(files: TeamProposalFile[], rule: PathText): boolean {
  return files.some((file) => file.path.startsWith(rule.pathPrefix) && file.newContent.includes(rule.text));
}

export function scoreEval(evalCase: EvalCase, run: EvalRun): EvalScore {
  const e = evalCase.expect;
  const files = run.files ?? [];
  const paths = pathsOf(files);
  const checks: EvalCheck[] = [];
  const add = (name: string, ok: boolean) => checks.push({ name, ok });
  if (e.outcome) add(`outcome=${e.outcome}`, run.kind === e.outcome);
  if (e.outcomeAny) add(`outcome∈${e.outcomeAny.join("|")}`, (e.outcomeAny as string[]).includes(run.kind));
  for (const path of e.touch ?? []) add(`touch ${path}`, paths.includes(path));
  if (e.touchAny) add(`touch any of ${e.touchAny.join(", ")}`, paths.some((path) => e.touchAny?.some((prefix) => path.startsWith(prefix))));
  for (const prefix of e.notTouch ?? []) add(`not touch ${prefix}`, !paths.some((path) => path.startsWith(prefix)));
  if (e.maxFiles !== undefined) add(`≤${e.maxFiles} files`, files.length <= e.maxFiles);
  if (e.minFiles !== undefined) add(`≥${e.minFiles} files`, files.length >= e.minFiles);
  for (const rule of e.contains ?? []) add(`contains "${rule.text}"`, contentMatches(files, rule));
  for (const rule of e.notContains ?? []) add(`not contains "${rule.text}"`, !contentMatches(files, rule));
  if (e.rename) add(`rename ${e.rename.from}`, files.some((file) => file.change === "rename" && file.oldPath === e.rename?.from && file.path === e.rename?.to));
  if (e.branchPrefix && run.kind === "proposal") add("feature branch", Boolean(run.branch && e.branchPrefix.some((prefix) => run.branch?.startsWith(prefix))));
  for (const text of e.replyNotContains ?? []) add(`reply hides "${text.slice(0, 8)}…"`, !(run.replyText ?? "").includes(text));
  if (e.replyMaxQuestions !== undefined) add(`≤${e.replyMaxQuestions} question(s)`, ((run.replyText ?? "").match(/[?؟]/g) ?? []).length <= e.replyMaxQuestions);
  if (run.kind === "proposal") add("standards: no errors", standardsErrors(checkStandards(standardsInput(files))).length === 0);
  const ok = checks.filter((check) => check.ok).length;
  const score = checks.length ? ok / checks.length : 0;
  return { id: evalCase.id, score: Math.round(score * 1000) / 1000, passed: ok === checks.length, checks };
}

/** Fake Meta-style token, assembled at runtime so no literal token sits in the repo. */
const FAKE_WA_TOKEN = ["E", "A", "A"].join("") + "Gm0PX4ZCpsBAxyz123abcDEF";
const PLACEHOLDERS: Record<string, string> = { FAKE_WA_TOKEN, FAKE_WA_TOKEN_HEAD: FAKE_WA_TOKEN.slice(0, 8) };

function expandPlaceholders(value: unknown): unknown {
  if (typeof value === "string") return value.replace(/\{\{([A-Z_]+)\}\}/g, (match, key: string) => PLACEHOLDERS[key] ?? match);
  if (Array.isArray(value)) return value.map(expandPlaceholders);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, expandPlaceholders(item)]));
  return value;
}

export function parseEvalFile(raw: unknown): EvalCase[] {
  const evals = raw && typeof raw === "object" ? expandPlaceholders((raw as { evals?: unknown }).evals) : undefined;
  if (!Array.isArray(evals)) return [];
  return evals.filter(
    (item): item is EvalCase =>
      Boolean(item) && typeof item === "object" && typeof (item as EvalCase).id === "string" && typeof (item as EvalCase).request === "string" && typeof (item as EvalCase).expect === "object",
  );
}
