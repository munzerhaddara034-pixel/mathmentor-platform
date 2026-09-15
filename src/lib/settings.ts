import type { PlatformSettings } from "./types";

export const defaultSettings: PlatformSettings = {
  phone: "+961 76 532 421",
  whatsapp: "96176532421",
  contactNote: "Academy WhatsApp / phone: 76532421 (+961 76 532 421).",
  plans: [
    { id: "g7-9", name: "Grades 7–9 · Brevet path", arabicName: "الصفوف 7–9 · الشهادة المتوسطة", usdMonthly: 29, usdTerm: 75, includes: "All EB7–EB9 classroom videos, chat, homework checks" },
    { id: "g11-12", name: "Grades 11–12 · Certificate", arabicName: "الصفوف 11–12 · الثانوية", usdMonthly: 39, usdTerm: 99, includes: "S1 + Grade 12 LS videos, chat with photo upload, exam models" },
    { id: "sat", name: "SAT Math", arabicName: "رياضيات SAT", usdMonthly: 45, usdTerm: 110, includes: "SAT classroom videos and weekly skills" },
    { id: "all", name: "Full academy", arabicName: "المنصة كاملة", usdMonthly: 59, usdTerm: 149, includes: "Every grade, SAT, chat, school reports after professor approval" },
  ],
  features: ["classroom-studio", "student-chat", "voice-manager"],
};

export function whatsappLink(number: string, text: string) {
  let digits = number.replace(/[^\d]/g, "");
  if (digits.length === 8) digits = `961${digits}`;
  if (digits.startsWith("00")) digits = digits.slice(2);
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
