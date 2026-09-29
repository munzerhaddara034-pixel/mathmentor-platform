/**
 * Channel routing + loop guard (docs/TEAM_CHAT_SPEC.md §2).
 * Pure functions — unit-tested by scripts/test-team-chat.ts.
 */
import type { TeamAgentId, TeamChannelId } from "./types";

/** Max agent messages per human message (first responder(s) + one referral hop). */
export const MAX_AGENT_REPLIES_PER_HUMAN = 3;

const MENTION_RES: Record<TeamAgentId, RegExp> = {
  mohamed: /@\s?(?:محمد|mohamed|mohammad|muhammad)/i,
  sami: /@\s?(?:سامي|sami)/i,
  developer: /@\s?(?:المطوّر|المطور|المبرمج|وكيل المطوّر|developer|dev)/i,
};

const DESIGN_RE =
  /(تصميم|صمّم|صمم|بانر|بنر|بوستر|ملصق|(?<![\u0600-\u06FF])(?:ال)?(?:صورة|صور)(?![\u0600-\u06FF])|فيديو|(?<![\u0600-\u06FF])ريل(?![\u0600-\u06FF])|لوغو|لوجو|شعار|هوية بصرية|ألوان|الوان|واجهة|\bUI\b|\bUX\b|banner|poster|design|logo|thumbnail|غلاف|إنستغرام|انستغرام|instagram|reel|heygen|مونتاج)/i;

const CODE_RE =
  /(كود|برمج|diff|commit|كوميت|push|build|tsc|خطأ بناء|bug|باغ|route\.ts|\.tsx?\b|component|مكوّن|مكون|endpoint|github|branch|deploy|صفحة\s+(?:تسجيل|جديدة|دفع|حجز)|(?<![\u0600-\u06FF])(?:ال)?(?:زر|زرار)(?![\u0600-\u06FF])|button|typescript|next\.js)/i;

const GENERAL_RE =
  /(موعد|اجتماع|تذكير|ذكّرني|ذكرني|موجز|امتحان|نموذج امتحان|نموذج|رياضيات|دالة|معادلة|احتمال|تمرين|barème|bareme|brevet|بريفيه|توظيف|مقابلة|مرشح|أستاذ|HR|خطة|إطلاق|اطلاق|دورة|\\\(|\\frac|\\sin|\\lim)/i;

export type Topic = "design" | "code" | "general";

export function detectMentions(text: string): TeamAgentId[] {
  const found: Array<{ agent: TeamAgentId; index: number }> = [];
  for (const agent of Object.keys(MENTION_RES) as TeamAgentId[]) {
    const match = MENTION_RES[agent].exec(text);
    if (match) found.push({ agent, index: match.index });
  }
  return found.sort((a, b) => a.index - b.index).map((item) => item.agent);
}

export function detectTopics(text: string): Topic[] {
  const topics: Topic[] = [];
  if (DESIGN_RE.test(text)) topics.push("design");
  if (CODE_RE.test(text)) topics.push("code");
  if (GENERAL_RE.test(text)) topics.push("general");
  return topics;
}

export type RouteDecision = {
  responders: TeamAgentId[];
  reason: "direct" | "mention" | "topic" | "ambiguous";
};

/** Who answers a HUMAN message. Agent messages never trigger routing. */
export function routeHumanMessage(channel: TeamChannelId, text: string): RouteDecision {
  if (channel !== "team") return { responders: [channel], reason: "direct" };
  const mentions = detectMentions(text);
  if (mentions.length) return { responders: mentions, reason: "mention" };
  const topics = detectTopics(text);
  if (topics.length === 1) {
    if (topics[0] === "design") return { responders: ["sami"], reason: "topic" };
    if (topics[0] === "code") return { responders: ["developer"], reason: "topic" };
    return { responders: ["mohamed"], reason: "topic" };
  }
  if (topics.length === 0) return { responders: ["mohamed"], reason: "topic" };
  return { responders: ["mohamed"], reason: "ambiguous" };
}

export type Referral = { agent: TeamAgentId; task: string };

/**
 * Explicit referrals inside an agent reply: a line with "@name" + a concrete task.
 * One referral per agent; the author and agents that already answered are excluded.
 */
export function parseReferrals(reply: string, from: TeamAgentId, alreadyAnswered: TeamAgentId[]): Referral[] {
  const lines = reply.split(/\r?\n/);
  const out: Referral[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const mentions = detectMentions(lines[i]);
    for (const agent of mentions) {
      if (agent === from || alreadyAnswered.includes(agent) || out.some((item) => item.agent === agent)) continue;
      const block = [lines[i]];
      for (let j = i + 1; j < lines.length; j += 1) {
        if (!lines[j].trim() || detectMentions(lines[j]).length) break;
        block.push(lines[j]);
      }
      const task = block
        .join("\n")
        .replace(MENTION_RES[agent], "")
        .replace(/^[\s:：\-–—*•«"]+/, "")
        .trim();
      if (task.replace(/[\s.،:؛!؟?]/g, "").length >= 8) out.push({ agent, task });
    }
  }
  return out;
}

/** Plans the reply budget for one human message: never >3 agent messages, never an agent twice. */
export function planReplies(first: TeamAgentId[], referrals: Referral[]): { first: TeamAgentId[]; referrals: Referral[] } {
  const uniqueFirst = first.filter((agent, index) => first.indexOf(agent) === index).slice(0, MAX_AGENT_REPLIES_PER_HUMAN);
  const room = MAX_AGENT_REPLIES_PER_HUMAN - uniqueFirst.length;
  const allowed = referrals.filter((item) => !uniqueFirst.includes(item.agent)).slice(0, Math.max(0, room));
  return { first: uniqueFirst, referrals: allowed };
}

/** Empty acknowledgements the spec forbids (§0.2). Used to flag, not to rewrite, agent replies. */
export function isEmptyAcknowledgement(text: string): boolean {
  const clean = text.replace(/[\s.،!👍✅]/g, "");
  return clean.length < 25 && /(تمالاستلام|جاهز|حاضر|سأعملعلىذلك|تمام|رححضّرو|ok|done)/i.test(clean);
}
