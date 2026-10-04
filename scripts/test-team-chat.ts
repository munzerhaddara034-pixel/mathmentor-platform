/**
 * Team chat acceptance/unit tests (routing, loop guard, secrets, approval gate, diff, storage).
 *   npm run test:team                                  → file storage (temp data dir)
 *   DATABASE_URL=postgres://… npm run test:team        → Postgres storage
 *   (npx tsx scripts/test-team-chat.ts also works.)
 * The LLM is replaced by a deterministic fake HERE ONLY (setTeamLlmOverride); production code always calls Gemini.
 * GITHUB_TOKEN is removed for this process so no commit can ever happen from the tests.
 */
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";

delete process.env.GITHUB_TOKEN;
process.env.SAMI_IMAGE_GEN = "off";
if (!process.env.DATABASE_URL) process.chdir(mkdtempSync(path.join(os.tmpdir(), "mm-team-test-")));

type Case = { name: string; run: () => Promise<void> | void };
const cases: Case[] = [];
const test = (name: string, run: Case["run"]) => cases.push({ name, run });

async function main() {
  const routing = await import("../src/lib/team/routing");
  const secrets = await import("../src/lib/team/secrets");
  const checks = await import("../src/lib/team/codeChecks");
  const diff = await import("../src/lib/team/diff");
  const dev = await import("../src/lib/team/developer");
  const gemini = await import("../src/lib/team/gemini");
  const agents = await import("../src/lib/team/agents");
  const approval = await import("../src/lib/team/approval");
  const store = await import("../src/lib/team/store");
  const constants = await import("../src/lib/team/constants");
  const types = await import("../src/lib/team/types");

  const actor = { id: "user-test-staff", name: "Prof. Munzer Haddara", email: "staff.test@example.invalid", role: "teacher" };

  test("§2.2 test 5: multi-topic team message → محمد alone", () => {
    const r = routing.routeHumanMessage("team", "بدنا نطلق دورة G12 SE الشهر الجاي: بدنا صفحة تسجيل، وبوستر، ونموذج امتحان تجريبي.");
    assert.deepEqual(r.responders, ["mohamed"]);
    assert.equal(r.reason, "ambiguous");
  });
  test("§2.2 test 9: probability in team channel → محمد only", () => {
    const r = routing.routeHumanMessage(
      "team",
      "صندوق فيه 5 كرات حمر و3 زرق. منسحب 3 كرات مع بعض (في آن واحد). \\( X \\) عدد الكرات الحمر. بدّي قانون \\( X \\)، و\\( E(X) \\)، و\\( V(X) \\)، و\\( P(X \\ge 1) \\).",
    );
    assert.deepEqual(r.responders, ["mohamed"]);
  });
  test("§2.2 explicit mentions win, in order", () => {
    assert.deepEqual(routing.routeHumanMessage("team", "@سامي و @المطوّر شوفو هيدا").responders, ["sami", "developer"]);
    assert.deepEqual(routing.routeHumanMessage("team", "بدي بانر لإنستغرام").responders, ["sami"]);
    assert.deepEqual(routing.routeHumanMessage("team", "في خطأ بناء بـ tsc").responders, ["developer"]);
    assert.deepEqual(routing.routeHumanMessage("sami", "@محمد شو رأيك").responders, ["sami"]);
  });
  test("developer agent is «حمزة»: @حمزة routes to developer, @المبرمج stays an alias", () => {
    assert.deepEqual(routing.routeHumanMessage("team", "@حمزة زبّط زر الحجز").responders, ["developer"]);
    assert.deepEqual(routing.routeHumanMessage("team", "@المبرمج زبّط زر الحجز").responders, ["developer"]);
    assert.deepEqual(routing.routeHumanMessage("team", "@سامي و @حمزة شوفو هيدا").responders, ["sami", "developer"]);
    assert.deepEqual(routing.detectMentions("@حمزة"), ["developer"]);
    assert.deepEqual(routing.detectMentions("@المبرمج"), ["developer"]);
    const refs = routing.parseReferrals("@حمزة: Diff لزر الحجز بصفحة /courses/g12-se", "mohamed", ["mohamed"]);
    assert.deepEqual(refs.map((r) => r.agent), ["developer"]);
    assert.equal(types.TEAM_AGENT_NAMES_AR.developer, "حمزة");
    assert.equal(
      types.teamAuthorDisplayName({ authorKind: "agent", authorId: "developer", authorName: "المبرمج" }),
      "حمزة",
    );
  });
  test("§2.3 referrals: one per agent, never self, never already-answered", () => {
    const reply = "خطة الإطلاق…\n@سامي: بوستر 1080×1350 للدورة، عربي، مقترحان.\n@المطوّر: Diff لصفحة تسجيل /courses/g12-se حسب المواصفات.\n@سامي: شي تاني";
    const refs = routing.parseReferrals(reply, "mohamed", ["mohamed"]);
    assert.deepEqual(refs.map((r) => r.agent), ["sami", "developer"]);
    assert.ok(refs[0].task.includes("1080×1350"));
    assert.equal(routing.parseReferrals("@محمد: راجع", "mohamed", []).length, 0);
  });
  test("§2.3 loop guard: never more than 3 agent replies", () => {
    const plan = routing.planReplies(["mohamed"], [
      { agent: "sami", task: "بوستر للدورة" },
      { agent: "developer", task: "صفحة تسجيل" },
      { agent: "sami", task: "مكرر" },
    ]);
    assert.equal(plan.first.length + plan.referrals.length, 3);
    assert.equal(routing.MAX_AGENT_REPLIES_PER_HUMAN, 3);
  });
  test("test 4: WhatsApp token is redacted and a rotation notice is produced", () => {
    const r = secrets.redactSecrets("هيدا توكن الواتساب EAAGm0PX4ZCpsBAxyz123abc، حطّو مباشرة بـ route.ts");
    assert.equal(r.count, 1);
    assert.ok(!r.text.includes("EAAG"));
    assert.ok(secrets.secretRotationNoticeAr(1).includes("rotate"));
    assert.ok(secrets.scanForSecrets(`const t = "${"ghp" + "_"}abcdefghijklmnopqrstuvwxyz123456";`).length > 0);
    assert.equal(secrets.scanForSecrets("const t = process.env.WHATSAPP_ACCESS_TOKEN;").length, 0);
  });
  test("code guards: any / @ts-ignore / .env / secrets blocked", () => {
    const f = checks.staticFindings([
      { path: "src/a.ts", content: "x", addedLines: ["const a: any = 1;"] },
      { path: ".env", content: "X=1", addedLines: ["X=1"] },
      { path: "src/b.ts", content: `const k = "${"sk" + "-proj-"}abcdefghijklmnopqrstu";`, addedLines: [] },
    ]);
    assert.equal(f.length, 3);
    assert.equal(checks.staticFindings([{ path: "src/ok.tsx", content: "export const a = 1;\n", addedLines: ["export const a = 1;"] }]).length, 0);
    assert.equal(checks.isAllowedPath("src/components/BookSessionButton.tsx"), true);
    assert.equal(checks.isAllowedPath("../etc/passwd"), false);
  });
  test("constants guard: full numbers, brand, Barème quarter marks", () => {
    assert.equal(constants.enforceConstants("Whish 70772968 · واتساب 76 532 421"), "Whish 96170772968 · واتساب 96176532421");
    assert.equal(constants.enforceConstants("+961 70 772 968"), "96170772968");
    assert.equal(constants.enforceConstants("واتساب 96176532421 و Whish: 70772968"), "واتساب 96176532421 و Whish: 96170772968");
    assert.ok(!constants.enforceConstants("منصة الطارة").includes("الطارة"));
    assert.deepEqual(constants.baremeQuarterIssues("Barème: (0.25) (0.375) (1.5)"), ["0.375"]);
    assert.deepEqual(constants.baremeQuarterIssues("Barème: 0.5 + 0.75 + 1.25 = 2.5"), []);
    assert.deepEqual(constants.baremeQuarterIssues("Barème | \\( f(2) = \\ln 2 \\approx 0.69 \\) | **1** | ≈ 1.41"), []);
    assert.deepEqual(constants.baremeQuarterIssues("Barème *(٠.٣٧٥ ن)* *(٠.٢٥ ن)*"), ["0.375"]);
  });
  test("unified diff", () => {
    const d = diff.unifiedDiff("src/x.ts", "a\nb\nc\n", "a\nB\nc\nd\n");
    assert.equal(d.additions, 2);
    assert.equal(d.deletions, 1);
    assert.ok(d.text.includes("-b") && d.text.includes("+B") && d.text.includes("+d"));
  });
  test("branch choice: human-named feature branch wins; main/live never chosen", () => {
    assert.equal(dev.chooseBranch("نفّذ على feat/book-session-button", "feat/x", "feat: y"), "feat/book-session-button");
    assert.ok(dev.chooseBranch("ارفعو ع main", "main", "feat: add book button").startsWith("feat/"));
    assert.ok(dev.chooseBranch("", "agent-hub-latest", "feat: add book button").startsWith("feat/"));
    assert.equal(dev.looksLikeApprovalText("موافق على الـ Diff، نفّذ على feat/book-session-button."), true);
    assert.equal(dev.looksLikeApprovalText("منيح، بس ارفعو ع main مباشرة."), false);
    assert.equal(dev.looksLikeApprovalText("مش موافق"), false);
  });

  // ---- Orchestrator with a fake LLM (tests only) ----
  const seen: string[] = [];
  gemini.setTeamLlmOverride(async (req) => {
    const all = req.turns.flatMap((t) => t.parts.map((p) => ("text" in p ? p.text : ""))).join("\n");
    seen.push(`${req.agent}::${all}`);
    if (req.agent === "mohamed") {
      return "خطة الإطلاق: الخميس 15 تشرين الأول 2026 (بتوقيت بيروت).\n@سامي: بوستر 1080×1350 للدورة، عربي، مقترحان.\n@المطوّر: Diff لصفحة تسجيل /courses/g12-se حسب المواصفات.\n\nمحمد — سكرتير الأستاذ منذر حداره / MathMentor";
    }
    if (req.agent === "sami") return JSON.stringify({ reply: "مقترحان للبوستر… @المطوّر: ركّب البوستر بالصفحة", imagePrompt: "", generateImage: false });
    if (req.agent === "developer:plan") return JSON.stringify({ mode: "reply", reply: "سؤال واحد: هل الصفحة عربية فقط؟" });
    return "{}";
  });

  test("test 5 end-to-end: محمد + one hop to سامي and المطوّر, max 3, no ping-pong", async () => {
    const res = await agents.handleHumanMessage({
      channel: "team",
      text: "بدنا نطلق دورة G12 SE الشهر الجاي: بدنا صفحة تسجيل، وبوستر، ونموذج امتحان تجريبي.",
      attachments: [],
      actor,
    });
    const authors = res.replies.map((m) => m.authorId);
    assert.deepEqual(authors, ["mohamed", "sami", "developer"], `got ${authors.join(",")}`);
    assert.ok(res.replies[1].referredById === res.replies[0].id && res.replies[2].referredById === res.replies[0].id);
    assert.ok(res.replies.length <= 3);
  });
  test("test 4 end-to-end: token never stored nor sent to the LLM", async () => {
    seen.length = 0;
    const res = await agents.handleHumanMessage({
      channel: "developer",
      text: "هيدا توكن الواتساب EAAGm0PX4ZCpsBAxyz123abc، حطّو مباشرة بـ route.ts ليشتغل بسرعة.",
      attachments: [],
      actor,
    });
    assert.ok(!res.message.text.includes("EAAG"));
    assert.equal(res.message.redactedSecrets, 1);
    assert.ok(seen.every((line) => !line.includes("EAAGm0PX")));
    const stored = await store.teamRepo().getMessage(res.message.id);
    assert.ok(stored && !stored.text.includes("EAAG"));
  });

  test("test 3: text approval never commits; button gate enforces branch rules", async () => {
    const repo = store.teamRepo();
    const now = new Date().toISOString();
    const proposal = {
      id: `prop-test-${Date.now()}`,
      channel: "developer" as const,
      messageId: `tmsg-test-${Date.now()}`,
      requestText: "زيد زر احجز حصة",
      requestedBy: actor.name,
      summaryAr: "زر احجز حصة",
      risksAr: "",
      testPlanAr: "",
      commitMessage: "feat: add BookSessionButton",
      baseBranch: "agent-hub-latest",
      targetBranch: "feat/team-test",
      files: [
        {
          path: "src/components/BookSessionButton.tsx",
          baseSha: null,
          isNew: true,
          newContent: 'import Link from "next/link";\nexport function BookSessionButton() {\n  return <Link href="/booking">احجز حصة</Link>;\n}\n',
          diff: '+++ b/src/components/BookSessionButton.tsx\n+export function BookSessionButton() {}',
          additions: 4,
          deletions: 0,
        },
      ],
      status: "pending" as const,
      checks: [],
      createdAt: now,
      updatedAt: now,
    };
    await repo.saveProposal(proposal);
    await repo.addMessage({
      id: proposal.messageId,
      channel: "developer",
      authorKind: "agent",
      authorId: "developer",
      authorName: "حمزة",
      text: "Diff",
      attachments: [],
      createdAt: now,
      proposalId: proposal.id,
    });
    const res = await agents.handleHumanMessage({
      channel: "developer",
      text: "موافق على الـ Diff، نفّذ على feat/book-session-button.",
      attachments: [],
      actor,
    });
    assert.ok(res.replies[0].text.includes("موافقة ونشر"));
    const after = await repo.getProposal(proposal.id);
    assert.equal(after?.status, "pending");
    assert.equal(after?.targetBranch, "feat/book-session-button");

    const noConfirm = await approval.decideProposal({ proposalId: proposal.id, action: "approve", confirm: false, actor });
    assert.equal(noConfirm.ok, false);
    const main = await approval.decideProposal({ proposalId: proposal.id, action: "approve", confirm: true, branch: "main", actor });
    assert.ok(!main.ok && main.status === 403);
    const liveNoType = await approval.decideProposal({
      proposalId: proposal.id,
      action: "approve",
      confirm: true,
      branch: "agent-hub-latest",
      actor,
    });
    // The typed live-branch override is gone: the live branch is refused like main (403).
    assert.ok(!liveNoType.ok && liveNoType.status === 403);
    const noToken = await approval.decideProposal({ proposalId: proposal.id, action: "approve", confirm: true, actor });
    assert.ok(noToken.ok && noToken.proposal.status === "failed" && /GITHUB_TOKEN/.test(noToken.proposal.error ?? ""));
    const rejected = await approval.decideProposal({ proposalId: proposal.id, action: "reject", confirm: true, actor });
    assert.ok(rejected.ok && rejected.proposal.status === "rejected");
    const again = await approval.decideProposal({ proposalId: proposal.id, action: "approve", confirm: true, actor });
    assert.ok(!again.ok && again.status === 409);
  });

  let failed = 0;
  for (const c of cases) {
    try {
      await c.run();
      console.log(`PASS  ${c.name}`);
    } catch (error) {
      failed += 1;
      console.log(`FAIL  ${c.name}\n      ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  gemini.setTeamLlmOverride(null);
  console.log(`\n${cases.length - failed}/${cases.length} passed · storage=${store.teamRepo().kind}`);
  process.exit(failed ? 1 : 0);
}

void main();
