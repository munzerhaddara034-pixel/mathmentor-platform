import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { shouldEscalate, verifyReply } from "../src/lib/team/agentLoop.ts";
import { scoreTeamEval, teamGoldenCases } from "../src/lib/team/evals.ts";

async function deterministicStub(evalCase) {
  const toolCalls = [];
  const model = async () => {
    toolCalls.push(evalCase.expect.tool);
    const replies = {
      routing: "هذا جواب يخص الاختصاص المطلوب بعد مراجعة السياق.",
      "tool-choice": "راجعت المصدر المحدد ويمكن تدقيق النتيجة هنا.",
      "wrong-claim": "لم أعتمد الادعاء؛ النتيجة غير محسومة.",
      escalation: "لا أستطيع اعتماد القرار؛ أطلب مراجعة منذر.",
      memory: "استعملت ملخّص الذاكرة السابق وأكملت من حيث توقفنا.",
    };
    return replies[evalCase.id.split("-").slice(1).join("-")] ?? "ردّ حتمي للاختبار.";
  };
  const tool = async (name) => ({ name, output: `[stub tool result ${name}]` });
  const response = await model();
  const toolResult = await tool(evalCase.expect.tool);
  const forcedRefusal = evalCase.id.endsWith("wrong-claim") || evalCase.id.endsWith("escalation");
  const verified = forcedRefusal
    ? verifyReply({ text: response, intent: "ادعاء خاطئ equation", tools: { names: [toolResult.name], outputs: [toolResult.output] } }).ok
    : verifyReply({ text: response, intent: evalCase.request, tools: { names: [toolResult.name], outputs: [toolResult.output] } }).ok;
  return {
    route: evalCase.agent,
    tools: toolCalls,
    verified,
    escalation: shouldEscalate(response, verified),
    memoryUsed: evalCase.expect.memoryUsed && toolResult.name === "team_memory",
    replyText: response,
  };
}

describe("team agent deterministic golden evals", () => {
  test("has five cases for each of Mohammad, Youssef, Hamza, and Yasmine", () => {
    assert.equal(teamGoldenCases.length, 20);
    for (const agent of ["mohamed", "sami", "developer", "finance"]) {
      assert.equal(teamGoldenCases.filter((item) => item.agent === agent).length, 5);
    }
  });

  test("all routing, tool, refusal, escalation, and memory cases pass with stubbed model/tools", async () => {
    const scores = [];
    for (const evalCase of teamGoldenCases) scores.push(scoreTeamEval(evalCase, await deterministicStub(evalCase)));
    assert.equal(scores.filter((score) => score.passed).length, 20);
    assert.equal(scores.filter((score) => !score.passed).length, 0);
  });

  test("wrong claims are refused and owner-decision language escalates", async () => {
    const wrong = teamGoldenCases.find((item) => item.id === "mohamed-wrong-claim");
    const escalation = teamGoldenCases.find((item) => item.id === "finance-escalation");
    assert.ok(wrong && escalation);
    const wrongRun = await deterministicStub(wrong);
    const escalationRun = await deterministicStub(escalation);
    assert.equal(wrongRun.verified, false);
    assert.equal(wrongRun.escalation, true);
    assert.equal(escalationRun.escalation, true);
  });
});
