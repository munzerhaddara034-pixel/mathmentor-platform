/**
 * Executive AI Secretary (محمد) — appointments, reminders, daily briefing helpers.
 * Persona (Doctor of Mathematics, platform manager, solution verifier, secretary, software, design, HR) lives in ./persona.
 * Brand: Prof. Munzer Haddara / الأستاذ منذر حداره — never الطارة.
 */

import { createId } from "@/lib/ids";
import { INSTRUCTOR_AR } from "@/lib/pedagogy/lebanese";
import { BEIRUT_TZ, addYmd, beirutDayKey, formatInTimeZone, wallTimeToUtc } from "@/lib/live/timezone";
import type {
  ActionReminder,
  ActionReminderPriority,
  ScheduleAppointment,
  SecretarySource,
  WhatsAppVoiceIntent,
} from "./types";
import { SCHEDULE_MANAGEMENT_CONFIRM_AR } from "./schoolPitch";
import { listSecretaryAgenda, saveAppointment, saveReminder } from "./store";
import { AGENT_NAME_AR, AGENT_TITLE_AR } from "./persona";

export { AGENT_PERSONA_AR, AGENT_PERSONA_EN, AGENT_ROLES_AR, NEEDS_REVIEW_AR, SOLUTION_VERIFIER_RULES_AR } from "./persona";

export const SECRETARY_INTRO_AR = `${AGENT_NAME_AR}، ${AGENT_TITLE_AR} للأستاذ منذر حداره / MathMentor`;

/** Ops assistant that محمد routes non-secretary work to (on Munzer's behalf). */
export const OPS_ASSISTANT_AR = "المساعد التشغيلي";

/** Short Arabic handoff: محمد contacted the ops assistant and executed. */
export const SECRETARY_HANDOFF_AR = `محمد تواصل مع ${OPS_ASSISTANT_AR} ونفّذ`;

/** Lead phrase for executor-style WhatsApp confirms (never receipt-only). */
export const SECRETARY_EXECUTED_AR = "نفّذ محمد";

const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

function toAsciiDigits(s: string): string {
  return s.replace(/[٠-٩]/g, (ch) => {
    const i = ARABIC_DIGITS.indexOf(ch);
    return i >= 0 ? String(i) : ch;
  });
}

function paramString(intent: WhatsAppVoiceIntent, key: string): string | undefined {
  const v = intent.parameters[key];
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

function defaultTomorrowAt(hour: number, minute = 0): string {
  const today = beirutDayKey();
  const ymd = addYmd(today, 1);
  return wallTimeToUtc(ymd, `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`, BEIRUT_TZ).toISOString();
}

function parseHm(raw: string): { hour: number; minute: number } | null {
  const m = toAsciiDigits(raw).match(/(\d{1,2})\s*[:\.٫]\s*(\d{2})/);
  if (m) {
    const hour = Number(m[1]);
    const minute = Number(m[2]);
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) return { hour, minute };
  }
  const hOnly = toAsciiDigits(raw).match(/(?:الساعة|at)\s*(\d{1,2})\b/i);
  if (hOnly) {
    let hour = Number(hOnly[1]);
    if (/مساء|مساءً|المسا|pm|م\.?\s*$/i.test(raw) && hour < 12) hour += 12;
    if (/صباح|صباحا|الصبح|am/i.test(raw) && hour === 12) hour = 0;
    if (hour >= 0 && hour <= 23) return { hour, minute: 0 };
  }
  return null;
}

function resolveDayOffset(text: string): number {
  const t = text.toLowerCase();
  if (/بعد\s*بكرا|بعد\s*بكره|بعد\s*بكرة|بعد\s*غ?د|after\s*tomorrow|day\s*after/i.test(text) || /بعد غد/.test(text)) return 2;
  if (/غدا|غداً|بكرا|بكره|بكرة|bukra|tomorrow/i.test(text) || /tomorrow/.test(t)) return 1;
  if (/اليوم|today|هلا|هللا|هلأ|هلّأ|هالليله|هالليلة|الليله|الليلة|المسا|المساء|الصبح/i.test(text) || /today/.test(t)) return 0;
  const weekdayMap: Array<{ re: RegExp; target: number }> = [
    { re: /الأ?حد|sunday/i, target: 0 },
    { re: /الإ?ثنين|monday/i, target: 1 },
    { re: /الثلاثاء|tuesday/i, target: 2 },
    { re: /الأ?ربعاء|wednesday/i, target: 3 },
    { re: /الخميس|thursday/i, target: 4 },
    { re: /الجمعة|friday/i, target: 5 },
    { re: /السبت|saturday/i, target: 6 },
  ];
  const todayWd = formatInTimeZone(new Date(), BEIRUT_TZ).weekday;
  for (const { re, target } of weekdayMap) {
    if (re.test(text)) {
      let delta = (target - todayWd + 7) % 7;
      if (delta === 0) delta = 7;
      return delta;
    }
  }
  return 1;
}

/** Best-effort ISO datetime (UTC) from Arabic/English staff text + intent params. */
export function resolveAppointmentDateTime(intent: WhatsAppVoiceIntent, transcript: string): string {
  const explicit = paramString(intent, "dateTime") || paramString(intent, "when");
  if (explicit) {
    const parsed = Date.parse(explicit);
    if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
  }

  const dateParam = paramString(intent, "date");
  const timeParam = paramString(intent, "time");
  let ymd: string | undefined;
  let hm = { hour: 10, minute: 0 };

  if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    ymd = dateParam;
  }
  if (timeParam) {
    const p = parseHm(timeParam) || parseHm(`الساعة ${timeParam}`);
    if (p) hm = p;
  }

  const blob = `${transcript} ${Object.values(intent.parameters).filter((v) => typeof v === "string").join(" ")}`;
  if (!ymd) {
    const isoDate = toAsciiDigits(blob).match(/(\d{4})-(\d{2})-(\d{2})/);
    if (isoDate) ymd = `${isoDate[1]}-${isoDate[2]}-${isoDate[3]}`;
  }
  if (!ymd) {
    const dmy = toAsciiDigits(blob).match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (dmy) {
      const d = dmy[1].padStart(2, "0");
      const m = dmy[2].padStart(2, "0");
      let y = dmy[3];
      if (y.length === 2) y = `20${y}`;
      ymd = `${y}-${m}-${d}`;
    }
  }
  if (!ymd) {
    ymd = addYmd(beirutDayKey(), resolveDayOffset(blob));
  }

  const timeFromText = parseHm(blob);
  if (timeFromText && !timeParam) hm = timeFromText;

  return wallTimeToUtc(
    ymd,
    `${String(hm.hour).padStart(2, "0")}:${String(hm.minute).padStart(2, "0")}`,
    BEIRUT_TZ,
  ).toISOString();
}

export function formatBeirutDateTimeAr(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ar-LB", {
      timeZone: BEIRUT_TZ,
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return iso;
  }
}

export function extractAppointmentTitle(intent: WhatsAppVoiceIntent, transcript: string): string {
  const title =
    paramString(intent, "title") ||
    paramString(intent, "subject") ||
    paramString(intent, "topic");
  if (title) return title.slice(0, 120);

  const about = transcript.match(/(?:بخصوص|عن|حول)\s+([^\n،.]{3,80})/i);
  if (about?.[1]) return about[1].trim().slice(0, 120);

  const cleaned = transcript
    .replace(/(?:سجّ?ل|سجل|حط)\s*(?:لي\s*)?(موعد|اجتماع|لقاء)/gi, "")
    .replace(/عندي\s*(اجتماع|موعد|لقاء)/gi, "")
    .replace(/schedule|appointment|meeting|book/gi, "")
    .replace(/غداً?|بكرا|بكره|بكرة|اليوم|هلا|هللا|هلأ|tomorrow|today|after\s*tomorrow|بعد\s*بكرا|بعد\s*غد/gi, "")
    .replace(/الساعة\s*\d{1,2}([:.:]\d{2})?/gi, "")
    .replace(/\d{1,2}([:.:]\d{2})?/g, "")
    .replace(/at\s*\d{1,2}([:.]\d{2})?\s*(am|pm)?/gi, "")
    .replace(/^(?:مع|with)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
  // Prefer "مع X بخصوص Y" residual as title
  return (cleaned || "موعد").slice(0, 120);
}

export function extractContactPerson(intent: WhatsAppVoiceIntent, transcript: string): string | undefined {
  const fromParam = paramString(intent, "contactPerson") || paramString(intent, "contact");
  if (fromParam) return fromParam.slice(0, 80);
  const m =
    transcript.match(/(?:مع|with)\s+([^\s،,]{2,40}(?:\s+[^\s،,]{2,40})?)/i) ||
    transcript.match(/(?:الأستاذ|المدير|والد|والدة|ولي أمر)\s+([^\s،,]{2,40})/);
  return m?.[1]?.trim().slice(0, 80);
}

export function extractReminderTask(intent: WhatsAppVoiceIntent, transcript: string): string {
  const task = paramString(intent, "task") || paramString(intent, "reminder") || paramString(intent, "note");
  if (task) return task.slice(0, 200);
  const cleaned = transcript
    .replace(/ذك[ّ]?رني|ذكرني|تذكير|حط\s*تذكير|ما\s*تنس[اىةه]|reminder|remind\s+me|add\s+reminder/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return (cleaned || "تذكير").slice(0, 200);
}

export function extractReminderPriority(intent: WhatsAppVoiceIntent, transcript: string): ActionReminderPriority {
  const p = paramString(intent, "priority")?.toLowerCase();
  if (p === "high" || p === "medium" || p === "low") return p;
  if (/عاجل|مهم جدا|high|urgent/i.test(transcript)) return "high";
  if (/منخفض|low/i.test(transcript)) return "low";
  return "medium";
}

export function resolveReminderDue(intent: WhatsAppVoiceIntent, transcript: string): string {
  const due = paramString(intent, "dueDate") || paramString(intent, "dateTime") || paramString(intent, "when");
  if (due) {
    const parsed = Date.parse(due);
    if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
  }
  return resolveAppointmentDateTime(intent, transcript);
}

export function formatAppointmentConfirmAr(appt: ScheduleAppointment): string {
  const lines = [
    `🗓️ ${SECRETARY_INTRO_AR} — ${SECRETARY_EXECUTED_AR}: تم تسجيل الموعد في جدول أعمالكم:`,
    `- الموضوع: ${appt.title}`,
    `- التاريخ والوقت: ${formatBeirutDateTimeAr(appt.dateTime)}`,
  ];
  if (appt.contactPerson) lines.push(`- الجهة / الشخص: ${appt.contactPerson}`);
  if (appt.notes) lines.push(`- ملاحظات: ${appt.notes}`);
  lines.push(`- ${INSTRUCTOR_AR} / MathMentor`);
  lines.push(SCHEDULE_MANAGEMENT_CONFIRM_AR);
  return lines.join("\n");
}

export function formatReminderConfirmAr(rem: ActionReminder): string {
  const priAr = rem.priority === "high" ? "عالية" : rem.priority === "low" ? "منخفضة" : "متوسطة";
  return [
    `✅ ${SECRETARY_INTRO_AR} — ${SECRETARY_EXECUTED_AR}: تم إضافة التذكير إلى مهامكم:`,
    `- المهمة: ${rem.task}`,
    `- الأولوية: ${priAr}`,
    `- الموعد النهائي: ${formatBeirutDateTimeAr(rem.dueDate)}`,
    `- ${INSTRUCTOR_AR} / MathMentor`,
  ].join("\n");
}

export async function formatDailyBriefingAr(): Promise<string> {
  const agenda = await listSecretaryAgenda(20);
  const today = beirutDayKey();
  const todaysAppts = agenda.appointments.filter((a) => beirutDayKey(a.dateTime) === today);
  const upcomingAppts = agenda.appointments.filter((a) => beirutDayKey(a.dateTime) !== today).slice(0, 5);
  const openReminders = agenda.reminders.slice(0, 8);

  const lines: string[] = [
    `📋 الموجز اليومي — ${SECRETARY_INTRO_AR} — ${SECRETARY_EXECUTED_AR}: جاهز`,
    `التاريخ (بيروت): ${today}`,
    "",
    "🗓️ مواعيد اليوم:",
  ];

  if (todaysAppts.length === 0) {
    lines.push("• لا مواعيد مجدولة لليوم.");
  } else {
    for (const a of todaysAppts) {
      const contact = a.contactPerson ? ` · ${a.contactPerson}` : "";
      lines.push(`• ${formatBeirutDateTimeAr(a.dateTime)} — ${a.title}${contact}`);
    }
  }

  lines.push("", "📌 تذكيرات مفتوحة:");
  if (openReminders.length === 0) {
    lines.push("• لا تذكيرات مفتوحة.");
  } else {
    for (const r of openReminders) {
      lines.push(`• [${r.priority}] ${r.task} — قبل ${formatBeirutDateTimeAr(r.dueDate)}`);
    }
  }

  if (upcomingAppts.length) {
    lines.push("", "🔜 قادمة:");
    for (const a of upcomingAppts) {
      lines.push(`• ${formatBeirutDateTimeAr(a.dateTime)} — ${a.title}`);
    }
  }

  lines.push("", SECRETARY_INTRO_AR);
  return lines.join("\n");
}

export async function createAppointmentFromIntent(input: {
  intent: WhatsAppVoiceIntent;
  transcript: string;
  source?: SecretarySource;
  persist?: boolean;
}): Promise<ScheduleAppointment> {
  const now = new Date().toISOString();
  const appt: ScheduleAppointment = {
    id: createId("appt"),
    title: extractAppointmentTitle(input.intent, input.transcript),
    dateTime: resolveAppointmentDateTime(input.intent, input.transcript),
    contactPerson: extractContactPerson(input.intent, input.transcript),
    status: "scheduled",
    notes: paramString(input.intent, "notes"),
    createdAt: now,
    updatedAt: now,
    source: input.source ?? "whatsapp",
  };
  if (input.persist === false) return appt;
  return saveAppointment(appt);
}

export async function createReminderFromIntent(input: {
  intent: WhatsAppVoiceIntent;
  transcript: string;
  source?: SecretarySource;
  persist?: boolean;
}): Promise<ActionReminder> {
  const now = new Date().toISOString();
  const rem: ActionReminder = {
    id: createId("rem"),
    task: extractReminderTask(input.intent, input.transcript),
    priority: extractReminderPriority(input.intent, input.transcript),
    dueDate: resolveReminderDue(input.intent, input.transcript),
    status: "open",
    createdAt: now,
    updatedAt: now,
    source: input.source ?? "whatsapp",
  };
  if (input.persist === false) return rem;
  return saveReminder(rem);
}

/** Fallback when transcript mentions appointment but datetime parse is weak. */
export function ensureFutureIso(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return defaultTomorrowAt(10);
  return new Date(t).toISOString();
}
