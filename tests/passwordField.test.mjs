// Regression guard for the signup/login password field (the «إظهار» toggle once covered the
// start of the LTR text and swallowed taps, so the field looked locked). Static checks only;
// the real typing behaviour was verified in a headless browser against `npm start`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/styles/auth.css", import.meta.url), "utf8");
const tsx = readFileSync(new URL("../src/components/auth/PasswordField.tsx", import.meta.url), "utf8");

function rule(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`));
  assert.ok(match, `missing CSS rule ${selector}`);
  return match[1];
}

const px = (block, prop) => {
  const m = block.match(new RegExp(`(?:^|[;\\s])${prop}:\\s*(\\d+)px`));
  return m ? Number(m[1]) : null;
};

test("toggle and input padding use the same physical side (no logical props)", () => {
  const button = rule(".mm-password button");
  const input = rule(".mm-field .mm-password input");
  assert.doesNotMatch(button + input, /inset-inline|padding-inline/, "logical props resolve differently for the RTL wrapper and the LTR input");
  const left = px(button, "left");
  const width = px(button, "width");
  const padLeft = px(input, "padding-left");
  assert.ok(left !== null && width !== null && padLeft !== null, "button left/width and input padding-left must be px");
  assert.ok(padLeft >= left + width + 4, `input padding-left (${padLeft}px) must clear the toggle (${left}+${width}px)`);
});

test("input is LTR, toggle is a non-submit button outside the label and switches type", () => {
  assert.match(tsx, /dir="ltr"/);
  assert.match(tsx, /type=\{visible \? "text" : "password"\}/);
  assert.match(tsx, /<button\s+type="button"/);
  assert.match(tsx, /<label htmlFor=\{id\}>[^<]*<\/label>/, "label must only wrap its caption, not the toggle");
  assert.match(tsx, /aria-pressed=\{visible\}/);
});
