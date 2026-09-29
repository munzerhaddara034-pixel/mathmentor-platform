/**
 * Smoke: Lebanese عامية + فصحى normalizer + heuristic intents.
 * Run: npx tsx scripts/verify-arabic-intent.ts
 */
import {
  arabicMatchBlob,
  normalizeArabicForMatch,
} from "../src/lib/agent/arabicNormalize";
import { heuristicIntent } from "../src/lib/agent/intent";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const cases: Array<{ phrase: string; kind: string }> = [
  { phrase: "المنصه جاهزه نبلّش شغل؟", kind: "platform_health" },
  { phrase: "المنصة جاهزة؟", kind: "platform_health" },
  { phrase: "حط موعد بكرا الساعة ١٠ مع أحمد", kind: "schedule_appointment" },
  { phrase: "سجّل موعد بعد بكرة المسا مع المدير", kind: "schedule_appointment" },
  { phrase: "ذكرني بكرا راجع المشتقات", kind: "add_reminder" },
  { phrase: "ذكّرني ما تنسى التمرين", kind: "add_reminder" },
  { phrase: "شو عندي اليوم", kind: "daily_briefing" },
  { phrase: "أجندة اليوم", kind: "daily_briefing" },
  { phrase: "سوّي فيديو ريلز للبروفيه", kind: "generate_video" },
  { phrase: "تقرير مدرسة الأهلية", kind: "school_report" },
  { phrase: "تواصل مع مدرسة الأهلية واقنع المدير", kind: "school_outreach_request" },
  { phrase: "راسل مدير مدرسة الحكمة school pitch", kind: "school_outreach_request" },
  { phrase: "طور الكود وأضف ميزة التذكير", kind: "code_evolution_request" },
  { phrase: "عدّل كود src/lib/agent/secretary.ts", kind: "code_evolution_request" },
  { phrase: "add feature for parent digest", kind: "code_evolution_request" },
];

function main() {
  const n = normalizeArabicForMatch("المنصة جاهزة — بدّي هلأ");
  assert(n.includes("المنصه"), `ة→ه platform: ${n}`);
  assert(n.includes("جاهزه"), `ة→ه ready: ${n}`);
  assert(n.includes("بدي"), `بدّي→بدي: ${n}`);
  assert(n.includes("هلا"), `هلأ→هلا: ${n}`);
  assert(!/ـ/.test(normalizeArabicForMatch("مــوعــد")), "tatweel stripped");
  assert(arabicMatchBlob("شو عندي").includes("شو"), "blob keeps شو");

  for (const { phrase, kind } of cases) {
    const intent = heuristicIntent(phrase);
    assert(
      intent.kind === kind,
      `Expected ${kind} for «${phrase}», got ${intent.kind}`,
    );
    console.log(`OK  ${kind.padEnd(22)} ← ${phrase}`);
  }

  // Never require Mohamed's name
  const noName = heuristicIntent("حط تذكير بكرا راجع الدرس");
  assert(noName.kind === "add_reminder", "reminder without محمد");

  const bareSchool = heuristicIntent("مدرسة");
  assert(bareSchool.kind !== "school_outreach_request", "bare مدرسة must not be school_outreach");
  assert(bareSchool.kind !== "school_report", "bare مدرسة must not be school_report");
  const bareCode = heuristicIntent("code");
  assert(bareCode.kind !== "code_evolution_request", "bare code must not be code_evolution");
  const bareDevelop = heuristicIntent("طور");
  assert(bareDevelop.kind !== "code_evolution_request", "bare طور must not be code_evolution");
  console.log("OK  negatives             ← bare مدرسة/code/طور rejected");

  console.log("\nAll Lebanese/Fusha intent smoke checks passed.");
}

main();
