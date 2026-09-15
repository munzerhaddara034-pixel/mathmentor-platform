import { academyLessons } from "./academyLessons";
import { createId } from "./ids";
import type { AcademyLessonRecord, GradeTrack, OutreachDraft, PlatformSettings } from "./types";

export type CommandResult = {
  reply: string;
  outreach?: Omit<OutreachDraft, "id" | "createdAt">;
  settingsPatch?: Partial<PlatformSettings>;
  newLesson?: AcademyLessonRecord;
  generatedLessonId?: string;
};

function trackFromText(text: string): GradeTrack {
  if (text.includes("sat")) return "sat";
  if (text.includes("11")) return "grade-11";
  if (text.includes("9") || text.includes("brevet")) return "grade-9";
  if (text.includes("8")) return "grade-8";
  if (text.includes("7")) return "grade-7";
  return "grade-12";
}

export function runEmployeeCommand(input: string, settings: PlatformSettings): CommandResult {
  const text = input.trim();
  const lower = text.toLowerCase();

  const phone = text.match(/(\+?\d[\d\s-]{7,}\d)/);
  if ((lower.includes("phone") || lower.includes("whatsapp") || lower.includes("هاتف") || lower.includes("واتس")) && phone) {
    const value = phone[1].replace(/\s+/g, " ").trim();
    return {
      reply: `I set the academy phone / WhatsApp to ${value}. Students will see it on Subscribe. Confirm if the digits are final.`,
      settingsPatch: { phone: value, whatsapp: value.replace(/\s/g, "") },
    };
  }

  const price = text.match(/(\d+)\s*(usd|\$|دولار)/i);
  if ((lower.includes("price") || lower.includes("سعر") || lower.includes("اشتراك")) && price) {
    const usdMonthly = Number(price[1]);
    return {
      reply: `I updated Full academy monthly price to $${usdMonthly}. Other plans stay until you name them. This is live on the Subscribe page.`,
      settingsPatch: {
        plans: settings.plans.map((plan) => (plan.id === "all" ? { ...plan, usdMonthly } : plan)),
      },
    };
  }

  if (lower.includes("generate") || lower.includes("video") || lower.includes("فيديو") || lower.includes("شرح")) {
    const lesson =
      academyLessons.find((item) => lower.includes(item.id) || lower.includes(item.title.toLowerCase())) ??
      academyLessons.find((item) => item.track === trackFromText(lower) && item.chapter === 1);
    return {
      reply: `I generated a full classroom video for ${lesson?.gradeLabel} · ${lesson?.title}. It now has definition, rule, two examples, a trap, independent work, marking, homework, and the next step. Open Classroom Studio to play it. I can generate another chapter if you name it.`,
      generatedLessonId: lesson?.id,
    };
  }

  if (lower.includes("add lesson") || lower.includes("أضف درس") || lower.includes("new lesson")) {
    const title = text.replace(/add lesson|أضف درس|new lesson/gi, "").trim() || "New academy lesson";
    const chapter = 90 + Math.floor(Math.random() * 9);
    const newLesson: AcademyLessonRecord = {
      id: createId("lesson"),
      track: trackFromText(lower),
      gradeLabel: "Custom",
      chapter,
      title,
      arabicTitle: title,
      idea: `${title} is taught as a complete classroom hour: definition, rule, examples, trap, and check.`,
      board: `Rule for ${title}`,
      example: `Start a standard question on ${title}.`,
      exampleBoard: "Write given → rule → steps → boxed result.",
    };
    return {
      reply: `I added a new classroom lesson: “${title}”. It appears in Classroom Studio after this command. Play it, then tell me if the board text should change.`,
      newLesson,
      generatedLessonId: newLesson.id,
    };
  }

  if (lower.includes("school") || lower.includes("مدرس")) {
    return {
      reply: "I drafted a school letter with prices and the WhatsApp number. It is waiting for your approval. I will not send it.",
      outreach: {
        audience: "school",
        channel: "email",
        subject: "Munzer Haddara Math Academy — classroom pilot",
        body: `Dear Coordinator,

Students sit in a full classroom video: Professor Munzer writes the definition, the rule, two examples, the trap, and homework. Grades 7–12 and SAT are ready.

Subscription:
- Grades 7–9: $${settings.plans[0]?.usdMonthly}/month
- Grades 11–12: $${settings.plans[1]?.usdMonthly}/month
- Full academy: $${settings.plans[3]?.usdMonthly}/month

WhatsApp: ${settings.phone}

Nothing is published without the professor’s approval.

Academy Operations Manager
(draft — not sent)`,
        status: "awaiting_approval",
      },
    };
  }

  if (lower.includes("student") || lower.includes("طالب") || lower.includes("subscribe") || lower.includes("اشتراك")) {
    return {
      reply: "I drafted a student / parent invitation with prices and WhatsApp. Awaiting your approval.",
      outreach: {
        audience: "student",
        channel: "whatsapp",
        subject: "Join the classroom",
        body: `Hello,

Join Munzer Haddara Math Academy. Full lessons, not slogans: the professor writes, you copy, then you chat with a photo if you are stuck.

Pay monthly:
${settings.plans.map((plan) => `• ${plan.name}: $${plan.usdMonthly}/month`).join("\n")}

WhatsApp: ${settings.phone}

Reply YES and your grade.

(draft — not sent)`,
        status: "awaiting_approval",
      },
    };
  }

  if (lower.includes("develop") || lower.includes("طور") || lower.includes("feature") || lower.includes("منصه") || lower.includes("platform")) {
    const feature = text.slice(0, 180);
    return {
      reply: `I recorded a platform development order: “${feature}”. Enabled inside the academy settings. Visible features now include this command. For code-level work, keep giving orders here: generate video, add lesson, set phone, set price, school letter.`,
      settingsPatch: { features: Array.from(new Set([...settings.features, feature])) },
    };
  }

  return {
    reply:
      "I am the academy employee. Command me in English or Arabic, by typing or by voice. I can: generate a full explanation video, add a lesson, set the phone number, set a subscription price, draft a school letter, draft a student invite, or record a platform development order. I never send a message until you approve it.",
  };
}
