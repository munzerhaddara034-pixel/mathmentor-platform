/** Platform prechecks on an applied patch; findings are fed back to the model before anything is shown. */
import { staticFindings, syntaxCheck } from "@/lib/team/codeChecks";
import type { TeamProposalFile } from "@/lib/team/types";
import { proposalTier, type TierResult } from "../limits";
import { checkStandards, formatFindings, standardsErrors, standardsInput } from "../standards";

export type SyntaxFn = (files: Array<{ path: string; content: string }>) => Promise<{ ran: boolean; errors: string[] }>;

export type PrecheckResult = { errors: string[]; warnings: string[]; checks: string[]; tier: TierResult };

function addedText(diff: string): string[] {
  return diff
    .split("\n")
    .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
    .map((line) => line.slice(1));
}

export async function runPrechecks(files: TeamProposalFile[], syntax: SyntaxFn = syntaxCheck): Promise<PrecheckResult> {
  const live = files.filter((file) => file.change !== "delete");
  const errors = staticFindings(live.map((file) => ({ path: file.path, content: file.newContent, addedLines: addedText(file.diff) })));
  const standards = checkStandards(standardsInput(files));
  const standardErrors = standardsErrors(standards);
  if (standardErrors.length) errors.push(formatFindings(standardErrors));
  const syntaxResult = await syntax(live.map((file) => ({ path: file.path, content: file.newContent })));
  errors.push(...syntaxResult.errors.map((error) => `TypeScript syntax: ${error}`));
  const tier = proposalTier(files);
  if (!tier.ok) errors.push(tier.reason);
  const warnings = standards.filter((finding) => finding.severity === "warn");
  const checks = [
    "Secrets / any / brand / paths: passed",
    `Standards: ${standardErrors.length ? "failed" : "passed"}${warnings.length ? ` (${warnings.length} warning(s))` : ""}`,
    syntaxResult.ran ? "TypeScript syntax (transpile): passed" : "TypeScript syntax: not available on this server",
    tier.ok ? `Size: ${tier.files} files / ${tier.lines} lines (${tier.tier})` : `Size: ${tier.files} files / ${tier.lines} lines (too big)`,
    "tsc --noEmit, npm test and next build run in the hamza-ci check on the PR",
  ];
  return { errors, warnings: warnings.length ? [formatFindings(warnings)] : [], checks, tier };
}
