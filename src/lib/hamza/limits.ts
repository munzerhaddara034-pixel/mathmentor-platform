/**
 * Patch size tiers and a simple risk level (pure). Standard: ≤12 files / ≤1,200 changed lines.
 * Large (needs the explicit "large change" checkbox at approval): ≤30 files / ≤3,000 lines.
 */
import type { ProposalTier, RiskLevel } from "./types";

export const TIER_LIMITS: Record<ProposalTier, { files: number; lines: number }> = {
  standard: { files: 12, lines: 1200 },
  large: { files: 30, lines: 3000 },
};

export type SizedFile = { path: string; additions: number; deletions: number; change?: string; oldPath?: string };

export type TierResult =
  | { ok: true; tier: ProposalTier; files: number; lines: number }
  | { ok: false; files: number; lines: number; reason: string; reasonAr: string };

export function changedLines(files: SizedFile[]): number {
  return files.reduce((sum, file) => sum + file.additions + file.deletions, 0);
}

export function proposalTier(files: SizedFile[]): TierResult {
  const count = files.length;
  const lines = changedLines(files);
  if (count <= TIER_LIMITS.standard.files && lines <= TIER_LIMITS.standard.lines) return { ok: true, tier: "standard", files: count, lines };
  if (count <= TIER_LIMITS.large.files && lines <= TIER_LIMITS.large.lines) return { ok: true, tier: "large", files: count, lines };
  return {
    ok: false,
    files: count,
    lines,
    reason: `Patch too big: ${count} files / ${lines} lines (max ${TIER_LIMITS.large.files} / ${TIER_LIMITS.large.lines}). Split the task.`,
    reasonAr: `التعديل أكبر من المسموح: ${count} ملف / ${lines} سطر (الحد ${TIER_LIMITS.large.files} / ${TIER_LIMITS.large.lines}). قسّم المهمة.`,
  };
}

const HIGH_RISK = [
  /^src\/lib\/(auth|security|db|billing|payments?)\//,
  /^src\/middleware\.ts$/,
  /^src\/app\/api\/(auth|admin|agent|whatsapp|billing|whish)\//,
  /^src\/lib\/hamza\//,
  /^src\/lib\/team\/(approval|github|codeChecks|guard)\.ts$/,
  /^scripts\/db-/,
  /^next\.config\./,
];

export function riskLevel(files: SizedFile[]): RiskLevel {
  if (files.some((file) => HIGH_RISK.some((re) => re.test(file.path) || (file.oldPath ? re.test(file.oldPath) : false)))) return "high";
  if (files.some((file) => file.change === "delete" || file.change === "rename")) return "medium";
  if (files.length > 3 || changedLines(files) > 200) return "medium";
  return "low";
}
