import type { PlatformSettings } from "./types";

export const defaultSettings: PlatformSettings = {
  phone: "+961 76 532 421",
  whatsapp: "96176532421",
  contactNote: "Academy WhatsApp / phone: 76532421 (+961 76 532 421).",
  plans: [
    { id: "ai", name: "AI Solver + lessons", arabicName: "حلّال الذكاء + الدروس", usdMonthly: 35, usdTerm: 89, includes: "Interactive lessons, AI math solver, auto avatar explanations", tier: "AI_TIER", liveCredits: 0 },
    { id: "g7-9", name: "Grades 7–9 · Brevet path", arabicName: "الصفوف 7–9 · الشهادة المتوسطة", usdMonthly: 29, usdTerm: 75, includes: "All EB7–EB9 classroom videos, AI solver, homework checks", tier: "AI_TIER", liveCredits: 0 },
    { id: "g11-12", name: "Grades 11–12 · Certificate", arabicName: "الصفوف 11–12 · الثانوية", usdMonthly: 39, usdTerm: 99, includes: "S1 + Grade 12 LS videos, AI solver, exam models", tier: "AI_TIER", liveCredits: 0 },
    { id: "sat", name: "SAT Math", arabicName: "رياضيات SAT", usdMonthly: 45, usdTerm: 110, includes: "SAT classroom videos, AI solver, weekly skills", tier: "AI_TIER", liveCredits: 0 },
    { id: "live", name: "Live 1-on-1 · Prof. Munzer", arabicName: "حصص مباشرة مع الأستاذ منذر", usdMonthly: 79, usdTerm: 210, includes: "Booking credits for 1-on-1 live sessions with Prof. Munzer Haddara", tier: "LIVE_TIER", liveCredits: 4 },
    { id: "both", name: "AI + Live bundle", arabicName: "حزمة الذكاء + المباشرة", usdMonthly: 99, usdTerm: 249, includes: "Lessons, AI solver, auto explanations, and live 1-on-1 credits", tier: "BOTH", liveCredits: 8 },
    { id: "all", name: "Full academy", arabicName: "المنصة كاملة", usdMonthly: 59, usdTerm: 149, includes: "Every grade, SAT, AI solver, chat, school reports after professor approval", tier: "AI_TIER", liveCredits: 0 },
  ],
  features: ["classroom-studio", "student-chat", "voice-manager"],
};

export function whatsappLink(number: string, text: string) {
  let digits = number.replace(/[^\d]/g, "");
  if (digits.length === 8) digits = `961${digits}`;
  if (digits.startsWith("00")) digits = digits.slice(2);
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
