import { createId } from "./ids";
import type { ManagerMessage, OutreachDraft } from "./types";

const greeting =
  "I am the Academy Operations Manager. I prepare classroom videos, school outreach, and subscription offers. I never message a student, parent, or school until Professor Munzer approves the exact text.";

export function managerReply(input: string): { reply: string; outreach?: Omit<OutreachDraft, "id" | "createdAt"> } {
  const text = input.toLowerCase();
  if (text.includes("school") || text.includes("مدرس")) {
    return {
      reply:
        "I drafted a school-outreach letter for Lebanese middle and secondary coordinators. It presents Grade 7–12 and SAT paths, classroom videos with Professor Munzer, and a request to schedule a pilot. Status: awaiting your approval. Nothing is sent yet.",
      outreach: {
        audience: "school",
        channel: "email",
        subject: "Pilot classroom: Munzer Haddara Math Academy",
        body: `Dear Coordinator,

Munzer Haddara Math Academy offers bilingual Grade 7–12 Lebanese mathematics and SAT Math. Students watch Professor Munzer explain at the board, write the same lines, and practice with professor-approved solutions.

We propose a school pilot: one grade, one month, with attendance and homework reports for the math department.

Subscription for the pilot can be monthly per class, settled locally (including Whish Money). No public claim of official accreditation is made; lessons follow Ahlia / Lebanese certificate skills.

If you agree, we will send a timetable after Professor Munzer confirms.

Respectfully,
Academy Operations Manager
(draft — not sent)`,
        status: "awaiting_approval",
      },
    };
  }
  if (text.includes("student") || text.includes("طالب") || text.includes("join") || text.includes("اشتراك") || text.includes("subscribe")) {
    return {
      reply:
        "I drafted a student invitation. It explains how to join, what they will see in class videos, and how the family can subscribe. Status: awaiting your approval. I will not WhatsApp or email any student until you confirm.",
      outreach: {
        audience: "student",
        channel: "whatsapp",
        subject: "Join the live-style classroom",
        body: `Hello,

This is an invitation to Munzer Haddara Math Academy.

You will sit in a classroom video: Professor Munzer writes on the board, you copy, then you check. Lessons cover Grade 7, 8, 9 (Brevet), Grade 11, Grade 12 Life Sciences, and SAT Math.

How to subscribe:
1) Create a student account.
2) Choose your grade.
3) Send the monthly fee by Whish Money and keep the receipt.
4) Access opens after Professor Munzer confirms payment.

No lesson is published until the professor reviews it.

Reply YES if your family wants a place this month.

(draft — not sent)`,
        status: "awaiting_approval",
      },
    };
  }
  if (text.includes("video") || text.includes("فيديو") || text.includes("lesson") || text.includes("درس")) {
    return {
      reply:
        "Classroom videos are already prepared for every chapter in Grades 7, 8, 9, 11, 12 LS, and SAT. Open Classroom Studio, play a lesson, then approve publishing if the writing and voice are correct. I will not show a new lesson to students without that approval.",
    };
  }
  return {
    reply: `${greeting} Tell me whether to prepare: (1) a school letter, (2) a student subscription invite, or (3) a review list of classroom videos.`,
  };
}

export function stampMessage(from: ManagerMessage["from"], body: string): ManagerMessage {
  return { id: createId("msg"), from, body, createdAt: new Date().toISOString() };
}
