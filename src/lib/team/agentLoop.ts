import { runAgentLoop } from "@/lib/hamza/agent/loop";
import type { AgentOutcome } from "@/lib/hamza/agent/types";
import { dirSnapshot } from "@/lib/hamza/snapshotSources";
import { createRepoTools } from "@/lib/hamza/tools";
import { applyMohamedActions, startMohamedExplanationVideo } from "./mohamedActions";
import { createYoussefDesign } from "./youssefActions";
import { sendOwnerWhatsApp } from "./ownerWhatsApp";
import { callTeamLlm, parseJsonObject, type LlmTurn } from "./gemini";
import { loadTeamMemory, recordTeamHealth, saveTeamMemory, escalateTeamAgent, type TeamMemorySummary } from "./health";
import { TEAM_AGENT_NAMES_AR, type TeamAgentId } from "./types";
import { redactSecrets } from "./secrets";
import { teamMessages } from "@/lib/i18n/ns/team";

const TEAM_LOOP_MAX_STEPS = 8;
const TEAM_LOOP_MAX_TOOLS = 6;
const TEAM_LOOP_TIMEOUT_MS = 90_000;

export type TeamLoopResult = {
  text: string;
  tools: string[];
  verified: boolean;
  confidence: "مرتفع" | "متوسط" | "منخفض";
  couldNotVerify: string;
  escalation: boolean;
  escalationId?: string;
  notice?: string;
};

export type ToolState = { names: string[]; outputs: string[] };

type Tool = { run: (name: string, args: Record<string, unknown>) => Promise<string> };

function stringArg(args: Record<string, unknown>, key: string, max = 2_000): string {
  return typeof args[key] === "string" ? args[key].trim().slice(0, max) : "";
}

function objectArg(args: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = args[key];
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function toolProtocol(agent: TeamAgentId): string {
  return `## بروتوكول أدوات ${TEAM_AGENT_NAMES_AR[agent]}
هذه إجابة فريق داخلية وليست نشرًا عاماً. يجب أن تستخدم أداة واحدة على الأقل قبل الرد النهائي، ثم ترد بـ JSON واحد فقط:
{"thought":"جملة قصيرة","action":"tool","tool":"اسم الأداة","args":{}}
أو
{"thought":"جملة قصيرة","action":"reply","replyAr":"الجواب الكامل"}
الأدوات المشتركة: list_tree, grep, read_file, find_references, tests_for, project_rules, team_memory, run_tests.
أدوات محمد: secretary_actions, send_owner_whatsapp, explain_video.
أدوات يوسف: create_design.
أداة حمزة نفسها هي أدوات المستودع والاختبارات عبر حلقة حمزة الخلفية؛ لا تكتب ولا تنفّذ shell.
لا تدّعِ إرسالاً أو حفظاً أو توليداً أو فحصاً لم يظهر في نتيجة أداة. إذا احتجت قرار منذر أو لم تستطع التحقق، اذكر ذلك صراحة.`;
}

function safeText(value: string, max = 500): string {
  return redactSecrets(value).text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, max);
}

export function shouldEscalate(text: string, verified: boolean): boolean {
  if (!verified) return true;
  return /(بحاجة إلى موافقة|يحتاج موافقة|قرار منذر|أطلب قرار|غير متأكد|لم أستطع التحقق|يحتاج مراجعة|blocked|cannot verify|owner decision)/i.test(text);
}

function isMathIntent(intent: string): boolean {
  return /(رياضيات|مسألة|معادلة|دالة|تكامل|اشتقاق|احتمال|geometry|calculus|equation|math)/i.test(intent);
}

export function verifyReply(input: { text: string; intent: string; tools: ToolState }): { ok: boolean; confidence: TeamLoopResult["confidence"]; couldNotVerify: string } {
  const reasons: string[] = [];
  if (input.text.trim().length < 25) reasons.push("الرد قصير ولا يحمل نتيجة قابلة للتدقيق");
  if (!input.tools.names.length) reasons.push("لم تُستعمل أي أداة");
  const paths = input.text.match(/(?:src|app|tests|docs|\/admin)\/[A-Za-z0-9_./:[\]-]+/g) ?? [];
  for (const path of paths.slice(0, 5)) {
    if (!input.tools.outputs.some((output) => output.includes(path))) reasons.push(`المسار ${path} لم يظهر في مصدر مقروء`);
  }
  if (isMathIntent(input.intent) && !/(تحقق|تعويض|verification|check|substitut)/i.test(input.text)) {
    reasons.push("لم يظهر تحقق رياضي مستقل");
  }
  const confidence = reasons.length ? "منخفض" : input.tools.names.length > 1 ? "مرتفع" : "متوسط";
  return { ok: reasons.length === 0, confidence, couldNotVerify: reasons.join("؛ ") || "لم أجد شيئاً غير متحقق منه في الفحص المحدد" };
}

function refusal(couldNotVerify: string): string {
  return teamMessages.ar.verification.refused.replace("{reason}", couldNotVerify);
}

async function createTeamTools(agent: TeamAgentId, memory: Awaited<ReturnType<typeof loadTeamMemory>>, state: ToolState): Promise<Tool> {
  const snapshot = dirSnapshot(process.cwd(), "working-tree", "working-tree");
  const repoTools = createRepoTools({ snapshot, ciChecks: ["check:standards", "tsc", "tests"] });
  return {
    async run(name, args) {
      state.names.push(name);
      let output: string;
      if (["list_tree", "grep", "read_file", "find_references", "tests_for", "project_rules"].includes(name)) {
        output = await repoTools.run(name, args);
      } else if (name === "team_memory") {
        output = JSON.stringify({ notes: memory.notes, summaries: memory.summaries.slice(-6) });
      } else if (name === "run_tests") {
        const path = stringArg(args, "path", 240);
        output = await repoTools.run("tests_for", { path });
        output += "\nهذا يحدد الاختبارات المرتبطة فقط؛ لم أدّع تشغيل npm test من داخل الوكيل.";
      } else if (name === "secretary_actions" && agent === "mohamed") {
        const data = objectArg(args, "actions");
        const raw = "```mm-actions\n" + JSON.stringify(data) + "\n```";
        output = JSON.stringify(await applyMohamedActions(raw, stringArg(args, "request", 2_000)));
      } else if (name === "send_owner_whatsapp" && agent === "mohamed") {
        output = JSON.stringify(await sendOwnerWhatsApp({ text: stringArg(args, "text", 3_500) }));
      } else if (name === "explain_video" && agent === "mohamed") {
        output = JSON.stringify(await startMohamedExplanationVideo({ question: stringArg(args, "question", 2_000), title: stringArg(args, "title", 160), language: "ar" }));
      } else if (name === "create_design" && agent === "sami") {
        const design = await createYoussefDesign(stringArg(args, "request", 280), stringArg(args, "title", 180));
        output = JSON.stringify({ ok: true, id: design.id, title: design.title, private: true });
      } else {
        output = `الأداة ${name} غير متاحة لهذا الوكيل.`;
      }
      state.outputs.push(output.slice(0, 2_000));
      return output.slice(0, 12_000);
    },
  };
}

function outcomeText(outcome: AgentOutcome): string {
  if (outcome.kind === "reply") return outcome.text;
  if (outcome.kind === "proposal") return outcome.draft.replyAr || "لم أقدّم جواباً نهائياً؛ الناتج اقتراح يحتاج مراجعة.";
  return `توقّف الوكيل قبل الإكمال: ${outcome.message}`;
}

function memorySummary(intent: string, text: string): string {
  return safeText(`${intent}: ${text.replace(/\s+/g, " ")}`, 500);
}

export async function runTeamAgentTurn(input: { agent: TeamAgentId; intent: string; system: string; turns: LlmTurn[] }): Promise<TeamLoopResult> {
  const started = Date.now();
  const memory = await loadTeamMemory(input.agent);
  const state: ToolState = { names: [], outputs: [] };
  const tools = await createTeamTools(input.agent, memory, state);
  const call = async (request: { step: string; system: string; turns: Array<{ role: "user" | "model"; text: string }>; json: boolean; temperature?: number }) => {
    const raw = await callTeamLlm({ agent: `team-loop:${input.agent}:${request.step}`, system: request.system, turns: request.turns.map((turn) => ({ role: turn.role, parts: [{ text: turn.text }] })), json: request.json, temperature: request.temperature });
    return { text: raw, json: parseJsonObject(raw), model: "team-gemini", usage: { inputTokens: 0, cachedTokens: 0, outputTokens: 0 }, usd: 0, attempts: [{ model: "team-gemini", ok: true }] };
  };
  const outcome = await runAgentLoop(
    {
      call,
      tools,
      snapshot: dirSnapshot(process.cwd(), "working-tree", "working-tree"),
      nowMs: () => Date.now(),
      monthSpentUsd: async () => 0,
      onStep: async () => undefined,
    },
    { maxSteps: TEAM_LOOP_MAX_STEPS, maxToolCalls: TEAM_LOOP_MAX_TOOLS, timeoutMs: TEAM_LOOP_TIMEOUT_MS, maxPatchRounds: 1, taskCapUsd: 1, monthCapUsd: 10 },
    { system: [input.system, toolProtocol(input.agent), `## الذاكرة السابقة\n${JSON.stringify(memory)}`].join("\n\n"), turns: input.turns.map((turn) => ({ role: turn.role, text: turn.parts.map((part) => ("text" in part ? part.text : "[مرفق]")).join("\n") })), estimateUsd: 0, requireToolCall: true },
  );
  let text = outcomeText(outcome);
  const verification = verifyReply({ text, intent: input.intent, tools: state });
  let verified = verification.ok && outcome.kind === "reply";
  let couldNotVerify = verification.couldNotVerify;
  let escalation = shouldEscalate(text, verified);
  let escalationId: string | undefined;
  let notice: string | undefined;
  if (!verified) {
    text = refusal(couldNotVerify);
    escalation = true;
  }
  if (escalation) {
    try {
      const escalated = await escalateTeamAgent({ agent: input.agent, intent: input.intent, reason: verified ? text : couldNotVerify });
      escalationId = escalated.itemId;
      notice = teamMessages.ar.escalation.created.replace("{id}", escalationId).replace("{detail}", escalated.whatsapp);
    } catch (error) {
      notice = teamMessages.ar.escalation.failed.replace("{reason}", error instanceof Error ? error.message.slice(0, 140) : "خطأ غير معروف");
    }
  }
  const confidence = teamMessages.ar.verification.confidence.replace("{value}", verification.confidence);
  const unknown = teamMessages.ar.verification.unknown.replace("{reason}", couldNotVerify);
  const finalText = `${text}\n\n${confidence}\n${unknown}${notice ? `\n${notice}` : ""}`;
  await saveTeamMemory({ agent: input.agent, intent: input.intent, summary: memorySummary(input.intent, finalText), tools: state.names, outcome: verified ? "success" : "failed", verified, notes: `آخر مقصد موثّق: ${safeText(input.intent, 240)}` });
  await recordTeamHealth({ agent: input.agent, intent: safeText(input.intent, 180), tools: [...new Set(state.names)].slice(0, 12), outcome: verified ? "success" : "failed", durationMs: Date.now() - started, verified, escalation, failure: verified ? undefined : safeText(couldNotVerify, 300) });
  return { text: finalText, tools: [...new Set(state.names)], verified, confidence: verification.confidence, couldNotVerify, escalation, escalationId, notice };
}

export function compactMemorySummary(memory: { summaries: TeamMemorySummary[] }): string {
  return memory.summaries.slice(-3).map((item) => `${item.at}: ${item.summary}`).join("\n").slice(0, 1_500);
}
