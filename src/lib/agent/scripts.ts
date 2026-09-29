/**
 * 20–30s high-converting AR/EN marketing scripts (exam anxiety + Barème hooks).
 */

import type { AgentAudience, MarketingScriptPair } from "./types";
import { INSTRUCTOR_AR, INSTRUCTOR_EN, ACADEMY_LINE } from "@/lib/pedagogy/lebanese";

export function marketingScriptsFor(audience: AgentAudience): MarketingScriptPair {
  const baseHooks = ["exam anxiety", "Barème marks", "Lebanese official"];

  if (audience === "brevet") {
    return {
      durationHintSec: 25,
      hooks: [...baseHooks, "Brevet", "limits intro"],
      ar: [
        `قلقان من البروفيه؟ النقاط تضيع على حدود ودوال…`,
        `مع ${INSTRUCTOR_AR} تتعلّم خطوات الباريم خطوة بخطوة — KaTeX واضح، تمارين رسمية.`,
        `MathMentor · ٢٠ ثانية يومياً تغيّر علامتك. ابدأ الآن.`,
      ].join(" "),
      en: [
        `Brevet stress? Marks vanish on limits and functions…`,
        `With ${INSTRUCTOR_EN} you master Barème steps — clear KaTeX, official-style drills.`,
        `${ACADEMY_LINE}. Twenty seconds a day. Start now.`,
      ].join(" "),
    };
  }

  if (audience === "terminale_gs") {
    return {
      durationHintSec: 28,
      hooks: [...baseHooks, "Terminale GS", "asymptotes", "derivatives"],
      ar: [
        `ترمينال علوم عامة؟ المشتقات والمقاربات تأكل علامات الباريم.`,
        `${INSTRUCTOR_AR} يشرح الخطأ الشائع ثم يصحّحه على السبورة التفاعلية.`,
        `انضم لـ MathMentor قبل الامتحان الرسمي — فيديو قصير، نتيجة كبيرة.`,
      ].join(" "),
      en: [
        `Terminale GS? Derivatives and asymptotes eat Barème marks.`,
        `${INSTRUCTOR_EN} shows the common trap, then fixes it on the interactive board.`,
        `Join MathMentor before the official exam — short video, big score.`,
      ].join(" "),
    };
  }

  if (audience === "terminale_ls") {
    return {
      durationHintSec: 27,
      hooks: [...baseHooks, "Terminale LS", "exponential", "variation table"],
      ar: [
        `علوم الحياة — جدول التغيرات والدوال الأسية يخوّفونك؟`,
        `مع ${INSTRUCTOR_AR} كل خطوة لها علامة في الباريم اللبناني.`,
        `MathMentor · حلّال ذكي + فيديو الأستاذ. جرّب اليوم.`,
      ].join(" "),
      en: [
        `Life Sciences track — variation tables and exponentials scary?`,
        `With ${INSTRUCTOR_EN} every step maps to Lebanese Barème marks.`,
        `MathMentor · AI solver + professor video. Try today.`,
      ].join(" "),
    };
  }

  if (audience === "parents") {
    return {
      durationHintSec: 22,
      hooks: ["parents", "weekly digest", "WhatsApp"],
      ar: [
        `أهل الطلاب: تابعوا تقدّم ابنكم أسبوعياً عبر واتساب من ${INSTRUCTOR_AR}.`,
        `نقاط القوة والضعف بلغة واضحة — بدون مصطلحات مخيفة.`,
        `MathMentor · طمأنينة للأهل، علامات أفضل للطالب.`,
      ].join(" "),
      en: [
        `Parents: get a weekly WhatsApp digest from ${INSTRUCTOR_EN}.`,
        `Strengths and gaps in plain language — no jargon.`,
        `MathMentor · peace of mind for families.`,
      ].join(" "),
    };
  }

  if (audience === "schools") {
    return {
      durationHintSec: 26,
      hooks: ["B2B", "schools", "Whish"],
      ar: [
        `مدارس لبنان: شراكة رقمية مع ${INSTRUCTOR_AR} — تقارير باريم، صفوف، وWhish فقط.`,
        `لوحة منسّق + تقارير PDF للمدير.`,
        `تواصلوا مع MathMentor للشراكة المدرسية.`,
      ].join(" "),
      en: [
        `Lebanese schools: digital partnership with ${INSTRUCTOR_EN} — Barème reports, classes, Whish only.`,
        `Coordinator dashboard + PDF for leadership.`,
        `Contact MathMentor for school B2B.`,
      ].join(" "),
    };
  }

  return {
    durationHintSec: 24,
    hooks: baseHooks,
    ar: [
      `الامتحان قرّب والقلق زاد؟`,
      `${INSTRUCTOR_AR} يحوّل الخوف إلى خطوات باريم واضحة على MathMentor.`,
      `فيديو قصير · تمرين رسمي · نتيجة ملموسة.`,
    ].join(" "),
    en: [
      `Exam coming, anxiety rising?`,
      `${INSTRUCTOR_EN} turns fear into clear Barème steps on MathMentor.`,
      `Short video · official-style drill · real results.`,
    ].join(" "),
  };
}

export function parseAudience(raw: unknown): AgentAudience {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  if (s === "brevet" || s.includes("brevet") || s.includes("بروفيه")) return "brevet";
  if (s.includes("gs") || s.includes("terminale_gs")) return "terminale_gs";
  if (s.includes("ls") || s.includes("terminale_ls")) return "terminale_ls";
  if (s.includes("parent")) return "parents";
  if (s.includes("school")) return "schools";
  return "general";
}
