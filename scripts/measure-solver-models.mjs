/**
 * Measures the real solver end to end for a given Gemini model order (no server, no database writes).
 * Usage: GEMINI_API_KEY=... GEMINI_STRONG_MODELS=a,b GEMINI_FAST_MODELS=c,d node --import ./tests/support/register.mjs scripts/measure-solver-models.mjs
 */
import { runMathSolver } from "../src/lib/solver/engine.ts";

const questions = [
  { label: "derivative", question: "احسب مشتقة الدالة f(x)=x^3-3x", expect: "3x^2-3" },
  { label: "quadratic", question: "حل المعادلة x^2-5x+6=0", expect: "2 and 3" },
  { label: "integral", question: "احسب التكامل غير المحدد ∫ x^2 dx", expect: "x^3/3 + C" },
];

console.log(`models: strong=[${process.env.GEMINI_STRONG_MODELS}] fast=[${process.env.GEMINI_FAST_MODELS}]`);
for (const item of questions) {
  const started = Date.now();
  let line;
  try {
    const solution = await runMathSolver({ question: item.question, language: "ar", track: "ls" });
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    line = `time=${seconds}s source=${solution.source} answer=${String(solution.finalAnswer ?? "").slice(0, 46)} expect=${item.expect}`;
  } catch (error) {
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    line = `time=${seconds}s FAILED ${error instanceof Error ? error.message.slice(0, 80) : "unknown"}`;
  }
  console.log(`${item.label.padEnd(11)} ${line}`);
}