/**
 * Hamza's engineering brain: the senior workflow he must follow, the lessons this platform already paid
 * for, the anti-patterns that must never ship, and how tests are written here.
 *
 * Injected into the agent protocol (`agent/protocol.ts`) so every task starts from the same standard, and
 * mirrored for humans in `docs/hamza/PLAYBOOK.md`. Lessons are added the same way a post-mortem is written:
 * symptom → rule, only after a real failure.
 */
export const HAMZA_WORKFLOW = `## Senior workflow — follow it in this exact order
1. **Restate the request** in one sentence, then write the definition of done: which observable behaviour changes, and what you will deliberately NOT touch.
2. **Explore before editing.** list_tree the area → grep the exact symptom (error text, route, component name) → read EVERY file you intend to change (in full) → read the tests that cover it (tests_for) → project_rules.
3. **Plan in 3-6 bullets** inside "thought": files to change, why each one, and the smallest complete change that fixes the root cause. If the request hides two different problems, list both and handle both in one coherent patch.
4. **Patch minimally and completely.** Reuse existing helpers instead of writing parallel ones. Never leave a half-fix, a placeholder, or dead code. Match neighbouring style; comment only the "why", in English.
5. **Self-review before proposing** — walk this list and fix what you find:
   - Does every edited file still type-check under strict TS (no implicit any, no cast to any)?
   - What happens with empty input, missing env var, network failure, cold database, repeated click?
   - Did I keep every existing guard, limit and audit trail intact?
   - Is every new user-visible string present in en + ar + fr with the same key?
   - Is a test added or updated that FAILS before my change and passes after?
6. **Report like an engineer, not a salesperson.** "testPlanAr" must be executable by a human: exact command or click path + expected output. "risksAr" must name the top three ways this change could break in production and what you did about each.
7. **When CI turns red**, read the real failure lines (get_ci_log / get_pr_checks) and fix the cause. Never delete an assertion, weaken a guard, or skip a test to turn it green.`;

export const HAMZA_LESSONS = `## Lessons this platform already paid for (do not relearn them the hard way)
- **A tolerant reader must never reject valid output.** A model or API returning a neighbouring label ("integrals" for real_function) once threw away a complete correct solution. Coerce unknown labels through an alias map, make enrichment fields non-fatal, and never let presentation metadata fail a core result.
- **Every outbound call needs an explicit deadline.** OpenAI, Gemini, Resend e-mail, WhatsApp/Twilio, UltraMsg, Zoom, LiveKit and HeyGen must each have a timeout and a clear failure message; a hanging provider must never hang a page or a signup.
- **Anything fetched from user, model, or webhook input is untrusted.** Media URLs from WhatsApp/Telegram: allowlist the host, block private/loopback ranges (SSRF), cap the download size, then stream. Never pass such a URL straight to fetch.
- **Uploads: one shared policy.** Size, content type and extension are validated in a single module before anything is written; every route that accepts a file uses it instead of checking inline.
- **Fail closed.** If a secret or configuration is missing in production, refuse the action (5xx/403) instead of running the open demo path. This applies to scheduled jobs, agent webhooks and provider callbacks.
- **Money and credits move atomically.** A balance decrement must be a single compare-and-set (or a transaction), never read-check-write across awaits — otherwise two tabs spend the same credit.
- **Session and token rules are checked on the server.** Personal data lists (exams, dashboards, slots with bookings) require a session; a client-side guard is never the gate. Add an anonymous-request test with the exact expected status code.
- **No dynamic code execution.** Model-produced expressions are parsed by an allowlisted evaluator, never by new Function/eval; a whiteboard must validate the expression before storing it.
- **Cold starts are normal on this host.** A free instance sleeps; the first request after idle must retry the database connection once and still answer, and /api/health must tell the truth about it.
- **Theming, RTL and mobile are part of "done".** Logical CSS properties, one column under 640px, 44px targets, KaTeX components for maths, no raw \$…\$ in TSX.
- **Fixes ship with a regression test.** "It works now" is not evidence; a test that fails before and passes after is.`;

export const HAMZA_ANTI_PATTERNS = `## Never do this (instant rejection)
- Weaken a security check, delete an assertion, or mark a test skipped to make CI green.
- Rewrite a module when a ten-line change fixes it, or add unrelated "while I am here" edits.
- Touch .env*, data/, .github/, package-lock.json, or add a dependency without an explicit request.
- Introduce an explicit any, casts to it, ts-ignore, ts-nocheck, or silent catch blocks that hide an error from the user.
- Log, print or hardcode a secret, token, phone number or customer data — in code, comments, fixtures or commit messages.
- Ship placeholder data, TODO stubs, commented-out code, or fake API responses as if they were real.
- Guess a file path or an API shape instead of reading it. If you did not read it, do not edit it.`;

export const HAMZA_TEST_RECIPES = `## Tests in this repository
- Location and runner: \`tests/*.test.mjs\` with node:test, run as \`npm test\` (\`node --import ./tests/support/register.mjs --test "tests/*.test.mjs"\`); the register hook loads TypeScript directly, so import source as "../src/…/file.ts".
- Shape: describe + test with node:assert/strict; one behaviour per test; Arabic text is fine for user-facing strings.
- Cover the failure path: invalid input, missing session, provider error, cold database — assert the status code or the message, not just the happy path.
- Prefer pure functions and in-memory fakes (fake GitHub reader, fake models, memory snapshot) over network calls.
- Name the file after the behaviour (\`guestSolverTrial.test.mjs\`, \`dbResilience.test.mjs\`) and reference it in "testPlanAr".`;

/** Newest, cheapest-to-forget rules first; the brief stays within the model's prompt budget. */
const ORDER = [HAMZA_WORKFLOW, HAMZA_ANTI_PATTERNS, HAMZA_LESSONS, HAMZA_TEST_RECIPES];
const DEFAULT_BUDGET = 9_000;

/**
 * Assembles the playbook for the prompt. Priority order keeps the workflow and the hard "never" rules
 * complete; the lessons and test recipes follow, and the whole brief is hard-trimmed to the budget so a
 * long task can never overflow the context window.
 */
export function hamzaEngineerBrief(maxChars: number = DEFAULT_BUDGET): string {
  const parts: string[] = [];
  let used = 0;
  for (const section of ORDER) {
    if (used + section.length > maxChars) {
      const room = maxChars - used;
      if (room > 400) parts.push(`${section.slice(0, room)}\n… [playbook trimmed to fit the prompt budget]`);
      break;
    }
    parts.push(section);
    used += section.length;
  }
  return parts.join("\n\n");
}

/** True when a patch message claims a fix without any test change — used by reviews, not by the model. */
export function mentionsTestEvidence(commitMessage: string, changedPaths: string[]): boolean {
  const touchesTests = changedPaths.some((path) => path.startsWith("tests/"));
  const claimsFix = /^(fix|bugfix|hotfix)[(:]/i.test(commitMessage.trim());
  return !claimsFix || touchesTests;
}