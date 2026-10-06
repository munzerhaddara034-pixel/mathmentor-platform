import type { PlatformSettings } from "./types";

export const defaultSettings: PlatformSettings = {
  phone: "+961 76 532 421",
  whatsapp: "96176532421",
  contactNote: "Academy WhatsApp / phone (support only, not payment): 76532421 (+961 76 532 421). Pay via Whish to 96170772968.",
  /** Activation-code plans (ids, names, access tier). Prices live in src/lib/pricing/plans.ts only. */
  plans: [
    { id: "ai", name: "AI Solver + lessons", arabicName: "حلّال الذكاء + الدروس", includes: "Interactive lessons, AI math solver, auto avatar explanations", tier: "AI_TIER", liveCredits: 0 },
    { id: "g7-9", name: "Grades 7–9 · Brevet path (incl. Grade 8)", arabicName: "الصفوف 7–9 · الشهادة المتوسطة (مع الثامن)", includes: "All EB7–EB8–EB9 classroom videos (grades 7, 8 & 9), AI solver, homework checks", tier: "AI_TIER", liveCredits: 0 },
    { id: "g11-12", name: "Grades 10–12 · Certificate", arabicName: "الصفوف 10–12 · الثانوية", includes: "Grades 10–12 classroom videos (incl. Grade 10 / الصف العاشر), AI solver, exam models", tier: "AI_TIER", liveCredits: 0 },
    { id: "sat", name: "SAT Math", arabicName: "رياضيات SAT", includes: "SAT classroom videos, AI solver, weekly skills", tier: "AI_TIER", liveCredits: 0 },
    { id: "live", name: "Live 1-on-1 · Prof. Munzer", arabicName: "حصص مباشرة مع الأستاذ منذر", includes: "Booking credits for 1-on-1 live sessions with Prof. Munzer Haddara", tier: "LIVE_TIER", liveCredits: 4 },
    { id: "both", name: "AI + Live bundle", arabicName: "حزمة الذكاء + المباشرة", includes: "Lessons, AI solver, auto explanations, and live 1-on-1 credits", tier: "BOTH", liveCredits: 8 },
    { id: "all", name: "Full academy", arabicName: "المنصة كاملة", includes: "Every grade, SAT, AI solver, chat, school reports after professor approval", tier: "AI_TIER", liveCredits: 0 },
  ],
  features: ["classroom-studio", "student-chat", "voice-manager"],
};

export function whatsappLink(number: string, text: string) {
  let digits = number.replace(/[^\d]/g, "");
  if (digits.length === 8) digits = `961${digits}`;
  if (digits.startsWith("00")) digits = digits.slice(2);
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
