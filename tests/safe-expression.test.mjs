import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSafeExpression, sampleExpression, SafeExpressionError } from "../src/lib/math/safeExpression.ts";

const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≈ ${b}`);

test("evaluates the solver's plotFunction expression", () => {
  const f = parseSafeExpression("(x-1)*exp(x)");
  close(f(0), -1);
  close(f(1), 0);
  close(f(2), Math.exp(2));
});

test("supports precedence, powers, implicit multiplication and constants", () => {
  close(parseSafeExpression("2x^2 - 3x + 1")(2), 3);
  close(parseSafeExpression("-x^2")(3), -9);
  close(parseSafeExpression("2^3^2")(0), 512);
  close(parseSafeExpression("(x-1)(x+1)")(3), 8);
  close(parseSafeExpression("sqrt(x) + ln(e) + abs(-2) + sin(pi/2)")(9), 7);
  close(parseSafeExpression("x**2")(4), 16);
});

test("rejects anything that is not math", () => {
  for (const bad of ["process.exit(1)", "constructor", "x; alert(1)", "`x`", "x[0]", "fetch(x)", "a=1", "(x"]) {
    assert.throws(() => parseSafeExpression(bad), SafeExpressionError, bad);
  }
  assert.throws(() => parseSafeExpression("(".repeat(60) + "x" + ")".repeat(60)), SafeExpressionError);
});

test("samples points and drops non-finite values", () => {
  const points = sampleExpression("1/x", -1, 1, 10);
  assert.ok(points && points.every((p) => Number.isFinite(p.y)));
  assert.equal(points.length, 10);
  assert.equal(sampleExpression("nope(x)", 0, 1), null);
  assert.equal(sampleExpression("x", 1, 0), null);
});
