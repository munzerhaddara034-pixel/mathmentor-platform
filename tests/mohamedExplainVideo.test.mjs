import { describe, test } from "node:test";
import assert from "node:assert/strict";

// This test must never call the real video provider.
delete process.env.HEYGEN_API_KEY;

const routing = await import("../src/lib/team/routing.ts");
const actions = await import("../src/lib/team/mohamedActions.ts");

const fallbackSolution = {
  avatarScript: { ar: "", en: "", fr: "" },
  steps: [
    {
      title: "Factorisation",
      titleAr: "التحليل إلى عوامل",
      latex: "x^2-5x+6=(x-2)(x-3)",
      explanationEn: "Factor the quadratic.",
      explanationFr: "Factoriser le trinôme.",
      explanationAr: "نحلّل كثير الحدود إلى عاملين.",
    },
  ],
  finalAnswer: "x=2 أو x=3",
};

describe("Mohamed explanation video action", () => {
  test("routes a video request to Mohamed and parses its action block", async () => {
    const decision = routing.routeHumanMessage("team", "اعمل فيديو شرح لسؤال: حل المعادلة x^2-5x+6=0");
    assert.deepEqual(decision, { responders: ["mohamed"], reason: "ambiguous" });

    const result = await actions.applyMohamedActions(
      'سأحضّر الشرح.\n```mm-actions\n{"explainVideo":[{"question":"حل المعادلة x^2-5x+6=0","language":"ar"}]}\n```',
    );
    assert.equal(result.text.includes("mm-actions"), false);
    assert.equal(result.recorded.length, 1);
    assert.match(result.recorded[0], /غير مهيّأ/);
  });

  test("falls back to Arabic steps and the final answer when avatarScript is empty", () => {
    const narration = actions.narrationFromSolution(fallbackSolution);
    assert.match(narration, /التحليل إلى عوامل/);
    assert.match(narration, /x\^2-5x\+6/);
    assert.match(narration, /الجواب النهائي: x=2 أو x=3/);
  });

  test("returns a documented unconfigured result without claiming a video", async () => {
    const result = await actions.startMohamedExplanationVideo({
      question: "حل المعادلة x^2-5x+6=0",
      solution: fallbackSolution,
    });
    assert.equal(result.ok, false);
    assert.equal(result.configured, false);
    assert.match(result.detailAr, /غير مهيّأ/);
    assert.match(result.detailAr, /لم يُنتَج أي فيديو/);
  });
});
