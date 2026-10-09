/**
 * Hamza's agent loop: explore with read-only tools → propose a patch → platform prechecks → fix → done.
 * Hard limits: steps, tool calls, wall time, per-task USD cap (pauses, resumable) and the monthly cap.
 */
import { addUsage, checkBudget, emptyCost } from "../cost";
import { ModelChainExhaustedError } from "../models/router";
import type { RouterTurn } from "../models/providers";
import { applyPatch } from "../patch";
import { runPrechecks } from "./prechecks";
import { parseAgentAction, type AgentAction } from "./protocol";
import type { AgentCheckpoint, AgentDeps, AgentInput, AgentLimits, AgentOutcome, AgentStepKind } from "./types";

const KEEP_FULL_TOOL_RESULTS = 10;
const TOOL_RESULT_PREFIX = "[tool result";

/** Older tool results are shortened so the context (and cost) stays bounded. */
export function compactTurns(turns: RouterTurn[]): RouterTurn[] {
  const toolIdx = turns.map((turn, i) => (turn.role === "user" && turn.text.startsWith(TOOL_RESULT_PREFIX) ? i : -1)).filter((i) => i >= 0);
  const old = new Set(toolIdx.slice(0, Math.max(0, toolIdx.length - KEEP_FULL_TOOL_RESULTS)));
  return turns.map((turn, i) => (old.has(i) && turn.text.length > 400 ? { ...turn, text: `${turn.text.slice(0, 400)}\n… [older result shortened — re-run the tool if needed]` } : turn));
}

type LoopState = AgentCheckpoint & { startedMs: number };

function common(state: LoopState) {
  return { cost: state.cost, steps: state.steps, toolCalls: state.toolCalls };
}

function checkpointOf(state: LoopState): AgentCheckpoint {
  return { turns: state.turns, cost: state.cost, steps: state.steps, toolCalls: state.toolCalls, patchRounds: state.patchRounds };
}

async function record(deps: AgentDeps, state: LoopState, kind: AgentStepKind, summary: string, extra: { model?: string; usd?: number; tool?: string } = {}) {
  await deps.onStep?.({ n: state.steps, kind, at: new Date(deps.nowMs()).toISOString(), usd: extra.usd ?? 0, model: extra.model, tool: extra.tool, summary: summary.slice(0, 300) }, checkpointOf(state));
}

async function guard(deps: AgentDeps, limits: AgentLimits, state: LoopState): Promise<AgentOutcome | null> {
  if (deps.isCancelled && (await deps.isCancelled())) return { ...common(state), kind: "failed", reason: "cancelled", message: "Cancelled by the team." };
  if (deps.nowMs() - state.startedMs > limits.timeoutMs) {
    return { ...common(state), kind: "failed", reason: "timeout", message: `Stopped after ${Math.round(limits.timeoutMs / 60000)} minutes.` };
  }
  if (state.steps >= limits.maxSteps) return { ...common(state), kind: "failed", reason: "steps", message: `Stopped after ${limits.maxSteps} steps without a valid patch.` };
  const budget = checkBudget({ taskUsd: state.cost.usd, taskCapUsd: limits.taskCapUsd, monthUsd: await deps.monthSpentUsd(), monthCapUsd: limits.monthCapUsd });
  if (budget.ok) return null;
  const reason = budget.reason === "task" ? "task_budget" : "month_budget";
  return { ...common(state), kind: "paused", reason, checkpoint: checkpointOf(state), message: `Paused at $${budget.spentUsd.toFixed(2)} (cap $${budget.capUsd.toFixed(2)}).` };
}

async function handlePropose(deps: AgentDeps, limits: AgentLimits, state: LoopState, action: Extract<AgentAction, { action: "propose" }>): Promise<Extract<AgentOutcome, { kind: "proposal" | "failed" }> | string> {
  state.patchRounds += 1;
  const applied = await applyPatch(deps.snapshot, action.patch);
  const errors = applied.ok ? [] : applied.errors;
  if (action.rawOps > action.patch.length) errors.push(`${action.rawOps - action.patch.length} patch op(s) were malformed and ignored.`);
  const pre = applied.ok ? await runPrechecks(applied.files, deps.syntax) : null;
  if (pre) errors.push(...pre.errors);
  if (applied.ok && pre && !errors.length) {
    const { summaryAr, risksAr, testPlanAr, commitMessage, branch, replyAr } = action;
    const draft = { summaryAr, risksAr, testPlanAr, commitMessage, branch, replyAr, files: applied.files, checks: pre.checks, warnings: pre.warnings };
    return { ...common(state), kind: "proposal", draft };
  }
  if (state.patchRounds >= limits.maxPatchRounds) {
    return { ...common(state), kind: "failed", reason: "prechecks", message: `The patch still fails platform checks after ${state.patchRounds} attempts:\n${errors.slice(0, 8).join("\n")}` };
  }
  return `[platform prechecks FAILED — attempt ${state.patchRounds}/${limits.maxPatchRounds}; nothing was shown to the team]\n${errors.join("\n")}\nRead the files again if needed and send a corrected "propose".`;
}

export async function runAgentLoop(deps: AgentDeps, limits: AgentLimits, input: AgentInput): Promise<AgentOutcome> {
  const state: LoopState = { ...(input.resume ?? { turns: [...input.turns], cost: emptyCost(input.estimateUsd), steps: 0, toolCalls: 0, patchRounds: 0 }), startedMs: deps.nowMs() };
  for (;;) {
    const stop = await guard(deps, limits, state);
    if (stop) return stop;
    state.steps += 1;
    let result;
    try {
      result = await deps.call({ step: `step-${state.steps}`, system: input.system, turns: compactTurns(state.turns), json: true, temperature: 0.2 });
    } catch (error) {
      const message = error instanceof ModelChainExhaustedError || error instanceof Error ? error.message : "model error";
      await record(deps, state, "error", message);
      return { ...common(state), kind: "failed", reason: "models", message };
    }
    state.cost = addUsage(state.cost, { model: result.model, usd: result.usd, usage: result.usage });
    state.turns.push({ role: "model", text: result.text.slice(0, 60_000) });
    const action = parseAgentAction(result.json);
    const meta = { model: result.model, usd: result.usd };
    if (action.action === "reply") {
      if (input.requireToolCall && state.toolCalls === 0) {
        state.turns.push({ role: "user", text: "[platform] لا يمكن إنهاء دور فريق قبل استعمال أداة واحدة على الأقل. استعمل أداة قراءة/ذاكرة/إجراء ثم أجب." });
        await record(deps, state, "invalid", "A team turn must use at least one tool before replying.", meta);
        continue;
      }
      await record(deps, state, "reply", action.replyAr, meta);
      return { ...common(state), kind: "reply", text: action.replyAr || "…" };
    }
    if (action.action === "invalid") {
      await record(deps, state, "invalid", action.reason, meta);
      state.turns.push({ role: "user", text: `[platform] ${action.reason} Answer with ONE JSON object.` });
      continue;
    }
    if (action.action === "tool") {
      const over = state.toolCalls >= limits.maxToolCalls;
      const output = over ? `Tool budget (${limits.maxToolCalls} calls) is used up — propose a patch or reply now.` : await deps.tools.run(action.tool, action.args);
      if (!over) state.toolCalls += 1;
      state.turns.push({ role: "user", text: `${TOOL_RESULT_PREFIX} ${action.tool}]\n${output}` });
      await record(deps, state, "tool", `${action.tool} ${JSON.stringify(action.args).slice(0, 160)}`, { ...meta, tool: action.tool });
      continue;
    }
    const outcome = await handlePropose(deps, limits, state, action);
    if (typeof outcome !== "string") {
      await record(deps, state, outcome.kind === "proposal" ? "propose" : "precheck_failed", outcome.kind === "proposal" ? `${outcome.draft.files.length} file(s)` : outcome.message, meta);
      return outcome;
    }
    state.turns.push({ role: "user", text: outcome });
    await record(deps, state, "precheck_failed", outcome.split("\n")[1] ?? "prechecks failed", meta);
  }
}
