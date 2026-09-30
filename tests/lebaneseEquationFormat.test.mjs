// Formatter regression: \text{…} and \frac{…}{…} used the same @@MM{i}@@ placeholder,
// so text slots were restored with fractions (or deleted). Fixtures are real solver outputs.
// Run: npm test   (Node >= 22.18 strips TypeScript types natively.)
import { test } from "node:test";
import assert from "node:assert/strict";
import { formatLebaneseEquation, hasForbiddenEquationForm } from "../src/lib/math/lebaneseEquationFormat.ts";

const textBits = (tex) => tex.match(/\\text\s*\{[^{}]*\}/g) ?? [];

test("keeps \\text{ and } between two equalities (M1 box)", () => {
  assert.equal(formatLebaneseEquation("x=3 \\text{ and } y=1"), "x=3 \\text{ and } y=1");
  assert.equal(formatLebaneseEquation("\\boxed{x = 3 \\text{ and } y = 1}"), "\\boxed{x = 3 \\text{ and } y = 1}");
});

test("keeps units after a \\frac (M2 area)", () => {
  assert.equal(formatLebaneseEquation("A=\\frac{a}{2}=13\\text{ cm}^{2}"), "A=\\frac{a}{2}=13\\text{ cm}^{2}");
  const m2 = "\\mathcal{A}_{AMN} = \\frac{AM \\times AN}{2} = \\frac{4{,}5 \\times 6}{2} = 13{,}5\\text{ cm}^{2}";
  assert.equal(formatLebaneseEquation(m2), m2);
});

test("many \\text + \\frac mixes restore each slot in place (U3 proof)", () => {
  const u3 =
    "\\text{Let } \\varepsilon > 0. \\text{ Choose } \\delta = \\min\\left(1, \\frac{\\varepsilon}{5}\\right). \\text{ Then if } 0 < |x - 2| < \\delta:\\\\ |x^{2} - 4| < \\frac{\\varepsilon}{5} \\cdot 5 = \\varepsilon.";
  const out = formatLebaneseEquation(u3);
  assert.deepEqual(textBits(out), textBits(u3));
  assert.equal(out, u3);
  assert.ok(!/@@/.test(out), "no placeholder may leak");
});

test("slash fractions next to \\text still convert, text untouched", () => {
  const out = formatLebaneseEquation("A = (x+1)/(x-1) \\text{ for } x \\neq 1");
  assert.equal(out, "A = \\frac{x+1}{x-1} \\text{ for } x \\neq 1");
  assert.equal(hasForbiddenEquationForm(out), false);
});

test("more text slots than fraction slots, and the reverse", () => {
  const a = "\\text{a} \\text{b} \\frac{1}{2} \\text{c}";
  assert.equal(formatLebaneseEquation(a), a);
  const b = "\\frac{1}{2} + \\frac{3}{4} \\text{ cm} + \\frac{5}{6}";
  assert.equal(formatLebaneseEquation(b), b);
});

test("idempotent on a mixed string", () => {
  const s = "f''(-1) = 0 \\text{ with sign change at } x = -1, \\quad I\\left(-1, \\frac{-2}{e}\\right)";
  const once = formatLebaneseEquation(s);
  assert.equal(formatLebaneseEquation(once), once);
  assert.equal(once, s);
});

test("forbidden-form check ignores \\text content", () => {
  assert.equal(hasForbiddenEquationForm("x = 3 \\text{ km/h}"), false);
  assert.equal(hasForbiddenEquationForm("x = 1/2"), true);
});
