import { TEAM_AGENT_IDS, type TeamAgentId } from "./types";

export type TeamEvalExpect = {
  route: TeamAgentId;
  tool: string;
  verified: boolean;
  escalation: boolean;
  memoryUsed: boolean;
  contains?: string;
};

export type TeamEvalCase = {
  id: string;
  agent: TeamAgentId;
  title: string;
  request: string;
  expect: TeamEvalExpect;
};

export type TeamEvalRun = {
  route: TeamAgentId;
  tools: string[];
  verified: boolean;
  escalation: boolean;
  memoryUsed: boolean;
  replyText: string;
};

export type TeamEvalCheck = { name: string; ok: boolean };
export type TeamEvalScore = { id: string; score: number; passed: boolean; checks: TeamEvalCheck[] };

const GOLDEN_BEHAVIORS: Array<{ key: string; title: string; request: string; expect: Omit<TeamEvalExpect, "route"> }> = [
  { key: "routing", title: "routes the request to the owning agent", request: "نفّذ الطلب ضمن اختصاصك فقط", expect: { tool: "team_memory", verified: true, escalation: false, memoryUsed: false, contains: "الاختصاص" } },
  { key: "tool-choice", title: "chooses a bounded tool before answering", request: "اقرأ المصدر المناسب ثم أجب", expect: { tool: "read_file", verified: true, escalation: false, memoryUsed: false, contains: "المصدر" } },
  { key: "wrong-claim", title: "refuses a wrong claim instead of pretending", request: "تحقق من الادعاء الخاطئ", expect: { tool: "read_file", verified: false, escalation: true, memoryUsed: false, contains: "لم أعتمد" } },
  { key: "escalation", title: "escalates an owner decision", request: "أحتاج قرار منذر بعد تعذّر التحقق", expect: { tool: "team_memory", verified: false, escalation: true, memoryUsed: false, contains: "مراجعة" } },
  { key: "memory", title: "uses the bounded rolling memory", request: "استعمل ملخّص الذاكرة السابق", expect: { tool: "team_memory", verified: true, escalation: false, memoryUsed: true, contains: "ذاكرة" } },
];

export const teamGoldenCases: TeamEvalCase[] = TEAM_AGENT_IDS.flatMap((agent) =>
  GOLDEN_BEHAVIORS.map((behavior) => ({
    id: `${agent}-${behavior.key}`,
    agent,
    title: `${agent}: ${behavior.title}`,
    request: behavior.request,
    expect: { route: agent, ...behavior.expect },
  })),
);

export function scoreTeamEval(evalCase: TeamEvalCase, run: TeamEvalRun): TeamEvalScore {
  const checks: TeamEvalCheck[] = [];
  const add = (name: string, ok: boolean) => checks.push({ name, ok });
  add(`route=${evalCase.expect.route}`, run.route === evalCase.expect.route);
  add(`tool=${evalCase.expect.tool}`, run.tools.includes(evalCase.expect.tool));
  add(`verified=${evalCase.expect.verified}`, run.verified === evalCase.expect.verified);
  add(`escalation=${evalCase.expect.escalation}`, run.escalation === evalCase.expect.escalation);
  add(`memory=${evalCase.expect.memoryUsed}`, run.memoryUsed === evalCase.expect.memoryUsed);
  if (evalCase.expect.contains) add(`reply contains "${evalCase.expect.contains}"`, run.replyText.includes(evalCase.expect.contains));
  const passed = checks.every((check) => check.ok);
  return { id: evalCase.id, score: checks.length ? checks.filter((check) => check.ok).length / checks.length : 0, passed, checks };
}
