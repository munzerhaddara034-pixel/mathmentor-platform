/**
 * وكيل المطوّر: request → read repo files (GitHub API) → propose a unified diff with Arabic explanation.
 * It NEVER commits: commits happen only in the approval route after a human clicks «موافقة ونشر».
 */
import { agentCommitBranchCheck } from "@/lib/security/agentBranches";
import { createId } from "@/lib/ids";
import {
  MAX_CHANGED_LINES,
  MAX_FILE_BYTES,
  MAX_FILES_PER_PROPOSAL,
  isAllowedPath,
  staticFindings,
  syntaxCheck,
} from "./codeChecks";
import { unifiedDiff } from "./diff";
import { callTeamLlm, parseJsonObject, stringField, type LlmTurn } from "./gemini";
import { FORBIDDEN_BRANCHES, isProtectedBranch, isValidBranchName, listRepoFiles, readRepoFile, teamGithubConfig } from "./github";
import { DEVELOPER_SYSTEM_PROMPT_AR } from "./prompts";
import type { TeamChannelId, TeamProposal, TeamProposalFile } from "./types";

export type DeveloperResult = { text: string; proposal?: TeamProposal; notice?: string };

function protocolContext(): string {
  const config = teamGithubConfig();
  return `## سياق التشغيل (مضاف آلياً من المنصة)
- المستودع: ${config.owner}/${config.repo} · الفرع الأساسي/الحيّ: ${config.baseBranch} · main ممنوع من المنصة كلياً.
- لا تستطيع تشغيل أوامر أو عمل Commit بنفسك. المنصة تعرض الـ Diff الذي تقترحه مع زرّي «موافقة ونشر» و«رفض». الـ Commit يحدث فقط عند ضغط منذر على «موافقة ونشر» (موافقة بشرية)، ويذهب افتراضياً إلى فرع الميزة الذي تقترحه، ولا يُعاد تشغيل Render إلا إذا اختار منذر صراحة الفرع الحيّ وكتب اسمه.
- حدود التعديل: ${MAX_FILES_PER_PROPOSAL} ملفات كحد أقصى، ${MAX_FILE_BYTES / 1000}KB لكل ملف، ${MAX_CHANGED_LINES} سطر تغيير كحد أقصى، والمسارات المسموحة: src/ docs/ content/ scripts/ public/ README.md.
- ردّك يُعرض كنص عربي؛ لا تكرّر أي سرّ، وما يظهر «[سرّ محجوب]» هو سرّ حجبته المنصة.`;
}

const PLAN_PROTOCOL = `## المرحلة 1 — التخطيط (أجب بـ JSON فقط)
{"mode":"propose" | "reply","reply":"نص عربي للمستخدم إذا mode=reply (شرح، رفض مبرَّر، أو سؤال واحد ضروري)","files":["مسارات الملفات الموجودة التي تحتاج قراءتها (حتى 5)"],"branch":"feat/… أو fix/…"}
- استعمل propose عندما يطلب المستخدم تعديلاً برمجياً قابلاً للتنفيذ (حتى لو طلب Commit مباشر — عندها تقترح Diff وتشرح أن الـ Commit يحتاج موافقة).
- استعمل reply للأسئلة أو عندما يطلب الكتابة على main/الفرع الحيّ (اشرح المنع واقترح فرع ميزة) أو عندما يكون الطلب غامضاً جداً.
- إذا طلب وضع توكن/سرّ مباشرة في الكود: ارفض ولا تكرّر قيمته، ومع ذلك استعمل propose لـ Diff يقرأ القيمة من process.env (مع فحص وجود المتغير ورسالة خطأ واضحة)، واذكر في reply وجوب تدوير السرّ المكشوف.
- مهم: mode=reply ينهي الدور فوراً ولا توجد مرحلة لاحقة. لا تكتب في reply وعوداً مثل «سأقرأ/سأعرض/سأقوم»؛ إن كنت ستعدّل كوداً فاختر propose واذكر الملفات في files.`;

const PROPOSE_PROTOCOL = `## المرحلة 2 — الـ Diff (أجب بـ JSON فقط)
{"replyAr":"شرح عربي مختصر: ماذا يغيّر الـ Diff ولماذا، ثم طلب الموافقة الصريحة","summaryAr":"ملخص سطرين","risksAr":"المخاطر","testPlanAr":"طريقة الاختبار (يتضمن npx tsc --noEmit و npm run build)","commitMessage":"feat: … (إنكليزي مختصر)","branch":"feat/…","changes":[{"path":"src/…","content":"المحتوى الكامل الجديد للملف"}]}
- content هو المحتوى الكامل النهائي للملف (وليس patch). عدّل أقل ما يمكن واحتفظ بباقي الملف حرفياً.
- TypeScript صارم بلا any ولا @ts-ignore، مكوّنات صغيرة، RTL، Mobile-First، Skeleton + try/catch لطلبات API، أسرار من process.env فقط.`;

/** Future-tense promises («سأقرأ…», «سأعرض…») — the agent has no later turn, so these mean "go propose". */
const PROMISE_RE = /(?:^|[\s،.])(?:سأ|سوف\s|سنقوم|سنعرض|الآن\s+أقرأ)/;

function slug(text: string): string {
  const ascii = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return ascii || `team-${Date.now().toString(36)}`;
}

/** Feature branch: explicit branch in the human message wins, then the model's suggestion. */
export function chooseBranch(humanText: string, suggested: string, commitMessage: string): string {
  const named = humanText.match(/\b((?:feat|fix|chore|docs)\/[A-Za-z0-9._-]{2,60})/);
  const candidates = [named?.[1] ?? "", suggested.trim()];
  for (const candidate of candidates) {
    if (candidate && isValidBranchName(candidate) && !isProtectedBranch(candidate) && agentCommitBranchCheck(candidate, { liveBranch: teamGithubConfig().baseBranch }).ok) {
      return candidate;
    }
  }
  return `feat/${slug(commitMessage.replace(/^(feat|fix|chore|docs)(\(.+?\))?:\s*/i, ""))}`;
}

function addedLines(diff: string): string[] {
  return diff
    .split("\n")
    .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
    .map((line) => line.slice(1));
}

type Change = { path: string; content: string };

function parseChanges(value: unknown): Change[] {
  if (!Array.isArray(value)) return [];
  const out: Change[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const path = typeof record.path === "string" ? record.path.trim().replace(/^\/+/, "") : "";
    const content = typeof record.content === "string" ? record.content : "";
    if (path && content) out.push({ path, content: content.endsWith("\n") ? content : `${content}\n` });
  }
  return out;
}

function stringList(value: unknown, max: number): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").slice(0, max) : [];
}

function relevantTree(paths: string[]): string {
  return paths
    .filter((path) => isAllowedPath(path) && !path.startsWith("public/") && !path.startsWith("content/banks/"))
    .slice(0, 900)
    .join("\n");
}

export async function runDeveloperAgent(input: {
  turns: LlmTurn[];
  humanText: string;
  requestedBy: string;
  channel: TeamChannelId;
  messageId: string;
  extraContext?: string;
}): Promise<DeveloperResult> {
  const config = teamGithubConfig();
  const system = [DEVELOPER_SYSTEM_PROMPT_AR, protocolContext(), input.extraContext ?? ""].filter(Boolean).join("\n\n");

  let tree: string[] = [];
  try {
    tree = await listRepoFiles(config);
  } catch (error) {
    return {
      text: "تعذّر الوصول إلى مستودع GitHub لقراءة الملفات، فلا أستطيع اقتراح Diff موثوق الآن. تأكّد من GITHUB_OWNER / GITHUB_REPO / GITHUB_TOKEN على Render ثم أعد الطلب.",
      notice: error instanceof Error ? error.message.slice(0, 160) : "GitHub error",
    };
  }

  const planRaw = await callTeamLlm({
    agent: "developer:plan",
    system: `${system}\n\n${PLAN_PROTOCOL}\n\n## ملفات المستودع (مقتطف)\n${relevantTree(tree)}`,
    turns: input.turns,
    json: true,
    temperature: 0.2,
  });
  const plan = parseJsonObject(planRaw);
  const mode = stringField(plan, "mode");
  const promisesWork = PROMISE_RE.test(stringField(plan, "reply"));
  const mentioned = [...stringField(plan, "reply").matchAll(/[\w./-]+\.(?:tsx?|css|md|json|mjs)/g)].map((match) => match[0]);
  const candidates = [...new Set([...stringList(plan?.files, 5), ...mentioned])];
  const listedFiles = candidates.some((path) => tree.includes(path));
  // A "reply" that promises later work would end the turn with nothing delivered — continue to the Diff instead.
  if (mode !== "propose" && !(listedFiles && promisesWork)) {
    const reply = stringField(plan, "reply") || planRaw.slice(0, 1500);
    return { text: reply };
  }

  const wanted = candidates.filter((path) => tree.includes(path) && isAllowedPath(path)).slice(0, 5);
  const read = await Promise.all(wanted.map((path) => readRepoFile(path, config)));
  const files = read.filter((file): file is NonNullable<typeof file> => Boolean(file) && (file?.size ?? 0) <= MAX_FILE_BYTES * 2);
  const fileContext = files.length
    ? files.map((file) => `### ${file.path}\n\`\`\`\n${file.content}\n\`\`\``).join("\n\n")
    : "(لا ملفات موجودة مطلوبة — ملفات جديدة فقط)";

  const proposeRaw = await callTeamLlm({
    agent: "developer:propose",
    system: `${system}\n\n${PROPOSE_PROTOCOL}\n\n## محتوى الملفات الحالي على ${config.baseBranch}\n${fileContext}`,
    turns: input.turns,
    json: true,
    temperature: 0.2,
  });
  let proposed = parseJsonObject(proposeRaw);
  // One self-repair round when the generated TypeScript does not even parse.
  const firstSyntax = await syntaxCheck(parseChanges(proposed?.changes).map((change) => ({ path: change.path, content: change.content })));
  if (firstSyntax.errors.length) {
    const repairRaw = await callTeamLlm({
      agent: "developer:repair",
      system: `${system}\n\n${PROPOSE_PROTOCOL}\n\n## محتوى الملفات الحالي على ${config.baseBranch}\n${fileContext}`,
      turns: [
        ...input.turns,
        { role: "model", parts: [{ text: proposeRaw }] },
        {
          role: "user",
          parts: [{ text: `[فحص المنصة] الـ Diff لا يُترجم (TypeScript):\n${firstSyntax.errors.join("\n")}\nأعد نفس JSON كاملاً بعد تصحيح الصياغة فقط.` }],
        },
      ],
      json: true,
      temperature: 0.1,
    });
    const repaired = parseJsonObject(repairRaw);
    if (repaired && parseChanges(repaired.changes).length) proposed = repaired;
  }
  const changes = parseChanges(proposed?.changes).slice(0, MAX_FILES_PER_PROPOSAL + 1);
  const replyAr = stringField(proposed, "replyAr");
  if (!changes.length) {
    return { text: replyAr || "لم أستطع توليد Diff صالح لهذا الطلب. وضّح الملف أو السلوك المطلوب بجملة واحدة." };
  }
  if (changes.length > MAX_FILES_PER_PROPOSAL) {
    return { text: `التعديل المقترح يمسّ أكثر من ${MAX_FILES_PER_PROPOSAL} ملفات — قسّم الطلب إلى أجزاء أصغر.` };
  }

  const proposalFiles: TeamProposalFile[] = [];
  for (const change of changes) {
    const existing = files.find((file) => file.path === change.path) ?? (tree.includes(change.path) ? await readRepoFile(change.path, config) : null);
    const diff = unifiedDiff(change.path, existing ? existing.content : null, change.content);
    if (!diff.additions && !diff.deletions) continue;
    proposalFiles.push({
      path: change.path,
      baseSha: existing?.sha ?? null,
      isNew: !existing,
      newContent: change.content,
      diff: diff.text,
      additions: diff.additions,
      deletions: diff.deletions,
    });
  }
  if (!proposalFiles.length) return { text: "الـ Diff الناتج فارغ (لا فرق عن الملفات الحالية). وضّح التغيير المطلوب." };

  const changed = proposalFiles.reduce((sum, file) => sum + file.additions + file.deletions, 0);
  const findings = staticFindings(
    proposalFiles.map((file) => ({ path: file.path, content: file.newContent, addedLines: addedLines(file.diff) })),
  );
  if (changed > MAX_CHANGED_LINES) findings.push(`حجم التغيير ${changed} سطر يتجاوز الحد ${MAX_CHANGED_LINES}.`);
  const syntax = await syntaxCheck(proposalFiles.map((file) => ({ path: file.path, content: file.newContent })));
  findings.push(...syntax.errors.map((error) => `خطأ صياغة TypeScript: ${error}`));
  if (findings.length) {
    return {
      text: `حجبتُ الـ Diff لأنه لم يجتز فحوص الأمان والجودة، ولن يُعرض للموافقة:\n${findings.map((f) => `- ${f}`).join("\n")}\nأعد صياغة الطلب أو اطلب مني نسخة مصحّحة.`,
    };
  }

  const commitMessage = (stringField(proposed, "commitMessage") || "feat: team chat developer change").slice(0, 120);
  const targetBranch = chooseBranch(input.humanText, stringField(proposed, "branch") || stringField(plan, "branch"), commitMessage);
  const now = new Date().toISOString();
  const checks = [
    `فحص الأسرار: ناجح (${proposalFiles.length} ملف)`,
    "فحص any / @ts-ignore: ناجح",
    `حجم التغيير: ${changed} سطر ≤ ${MAX_CHANGED_LINES}`,
    syntax.ran ? "فحص صياغة TypeScript (transpile): ناجح" : "فحص صياغة TypeScript: غير متاح على هذا الخادم",
    "npx tsc --noEmit و npm run build: لا يعملان داخل خادم Render — شغّلهما على فرع الميزة قبل الدمج في الفرع الحيّ",
  ];
  const proposal: TeamProposal = {
    id: createId("prop"),
    channel: input.channel,
    messageId: input.messageId,
    requestText: input.humanText.slice(0, 2000),
    requestedBy: input.requestedBy,
    summaryAr: stringField(proposed, "summaryAr").slice(0, 1200),
    risksAr: stringField(proposed, "risksAr").slice(0, 1200),
    testPlanAr: stringField(proposed, "testPlanAr").slice(0, 1200),
    commitMessage,
    baseBranch: config.baseBranch,
    targetBranch: agentCommitBranchCheck(targetBranch, { liveBranch: config.baseBranch }).ok ? targetBranch : `feat/${slug(commitMessage)}`,
    files: proposalFiles,
    status: "pending",
    checks,
    createdAt: now,
    updatedAt: now,
  };
  const text =
    (replyAr ||
      "اقترحت الـ Diff التالي. راجعه ثم اضغط «موافقة ونشر» إذا وافقت، أو «رفض».") +
    `\n\nالفرع المقترح: ${proposal.targetBranch} (من ${config.baseBranch}) · الملفات: ${proposalFiles
      .map((file) => `${file.path} (+${file.additions}/−${file.deletions})`)
      .join("، ")}\nلا Commit قبل ضغط منذر على «موافقة ونشر».`;
  return { text, proposal };
}

/** Human text that tries to approve by message: the approval itself must be the button click. */
export function looksLikeApprovalText(text: string): boolean {
  if (/(مش|غير|لا)\s*موافق/.test(text)) return false;
  return /(موافق|وافقت|اعتمد|approve|approved|go ahead|نفّذ|نفذ)/i.test(text);
}

export function namedBranch(text: string): string | null {
  const match = text.match(/\b((?:feat|fix|chore|docs)\/[A-Za-z0-9._-]{2,60}|main|master|agent-hub-latest)\b/);
  return match ? match[1] : null;
}
