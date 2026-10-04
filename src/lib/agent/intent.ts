/**
 * Gemini structured JSON intent from Whisper transcript — heuristic fallback
 * understands Lebanese عامية + MSA فصحى via arabicNormalize.
 */

import { z } from "zod";
import { geminiApiKey, geminiModels } from "@/lib/solver/llm";
import { INSTRUCTOR_AR, INSTRUCTOR_EN } from "@/lib/pedagogy/lebanese";
import { arabicMatchBlob, normalizeArabicForMatch } from "./arabicNormalize";
import { AGENT_PERSONA_AR, AGENT_PERSONA_EN, SOLUTION_VERIFIER_RULES_AR } from "./persona";
import type { AgentIntentKind, WhatsAppVoiceIntent } from "./types";

const intentSchema = z.object({
  kind: z.enum([
    "generate_video",
    "school_report",
    "platform_health",
    "broadcast_message",
    "schedule_appointment",
    "add_reminder",
    "daily_briefing",
    "code_evolution_request",
    "school_outreach_request",
    "general_task",
  ]),
  confidence: z.number().min(0).max(1).optional(),
  parameters: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
});

function extractScheduleParams(ar: string, blob: string): Record<string, string | number | boolean | null> {
  const params: Record<string, string | number | boolean | null> = {};
  const aboutMatch = ar.match(/(?:بخصوص|عن|حول)\s+([^\n،.]{3,80})/i);
  if (aboutMatch?.[1]) {
    params.title = aboutMatch[1].trim().slice(0, 120);
  } else {
    const titleMatch = ar.match(/(?:موضوع|title|subject)\s*[:：]\s*([^\n،.]{3,60})/i);
    if (titleMatch?.[1]) params.title = titleMatch[1].trim();
  }
  const contactMatch =
    ar.match(/(?:مع|with)\s+([^\s،,]{2,40}(?:\s+[^\s،,]{2,40})?)/i) ||
    ar.match(/(?:contact|الشخص|الجهه|الجهة)\s*[:：]?\s*([^\n،.]{2,40})/i);
  if (contactMatch?.[1]) params.contactPerson = contactMatch[1].trim();
  const timeMatch = ar.match(/(?:الساعه|الساعة|at)\s*(\d{1,2}(?:[:.:]\d{2})?)/i);
  if (timeMatch?.[1]) params.time = timeMatch[1];
  if (/بعد\s*بكرا|بعد\s*بكره|بعد\s*غ?د|after\s*tomorrow/i.test(blob)) {
    params.dateHint = "after_tomorrow";
  } else if (/بكرا|بكره|غدا|غداً|tomorrow/i.test(blob)) {
    params.dateHint = "tomorrow";
  } else if (/هلا|هللا|هلأ|اليوم|today|المسا|المساء|الصبح/i.test(blob)) {
    params.dateHint = "today";
  }
  return params;
}

/**
 * Heuristic intent classifier (Lebanese dialect + Fusha). Exported for smoke/unit checks.
 * Does not require saying «محمد».
 */
export function heuristicIntent(transcript: string): WhatsAppVoiceIntent {
  const ar = transcript;
  const blob = arabicMatchBlob(transcript);
  const norm = normalizeArabicForMatch(transcript);
  const params: Record<string, string | number | boolean | null> = {};

  // daily_briefing — شو عندي اليوم، الموجز، أجندة…
  if (
    /موجز\s*(اليوم|اليومي)|الموجز|اجنده\s*(اليوم)?|أجندة\s*(اليوم)?|جدول\s*(اليوم|اعمالي|أعمالي)|daily\s*brief|briefing|ما\s*عندي\s*اليوم|مواعيدي\s*اليوم|شو\s*عندي(\s*اليوم)?|شو\s*المواعيد|شو\s*في\s*(اليوم|عنا)|اجندتي|موجزي/i.test(
      blob,
    )
  ) {
    return { kind: "daily_briefing", confidence: 0.8, parameters: {}, source: "heuristic" };
  }

  // schedule_appointment — سجّل/حط موعد، عندي اجتماع، بكرا الساعة، مع فلان…
  if (
    /(?:سجل|حط|احجز|احجزي|book)\s*(?:لي\s*)?(?:موعد|اجتماع|لقاء)|عندي\s*(?:اجتماع|موعد|لقاء)|موعد|اجتماع|لقاء|schedule|appointment|meeting|book\s+(a\s+)?(call|meeting)|بكرا\s*الساع|بعد\s*بكرا|الساعه\s*\d|الساعة\s*\d/i.test(
      blob,
    ) &&
    !/فيديو|video|heygen|تقرير|مدرسه|مدرسة/i.test(blob) &&
    !/ذكرني|تذكير|remind/i.test(blob)
  ) {
    Object.assign(params, extractScheduleParams(ar, blob));
    return { kind: "schedule_appointment", confidence: 0.76, parameters: params, source: "heuristic" };
  }

  // code_evolution_request — tighten: no bare «code» / bare «طور»
  // Phrases: طور الكود، عدّل كود، برمج، حدّث الصفحة، add feature, code evolution, commit github…
  if (
    /(?:طور|عد[ّ]?ل)\s*(?:ال)?كود|عد[ّ]?ل\s*كود|برمج(?:ني|لنا|لي)?|حدث\s*(?:ال)?(?:صفحه|صفحة|كود)|add\s+feature|code\s*evolution|self[\s-]?evolv|اعمل\s*(?:كوميت|commit)|commit\s*(?:to\s*)?github|ادفع\s*(?:ل)?github|github\s*commit|طور\s*(?:المنصه|المنصة|الوكيل)/i.test(
      blob,
    )
  ) {
    params.note = transcript.slice(0, 500);
    const pathMatch =
      ar.match(/(?:(?:ملف|file|path)\s*[:：]?\s*)((?:src\/|app\/|lib\/|docs\/)[\w./\-]+)/i) ||
      ar.match(/((?:src|app|lib|docs)\/[\w./\-]+\.\w{1,8})/i);
    if (pathMatch?.[1]) params.filePath = pathMatch[1];
    return { kind: "code_evolution_request", confidence: 0.78, parameters: params, source: "heuristic" };
  }

  // add_reminder — ذكّرني، حط تذكير، ما تنسى…
  if (
    /تذكير|ذكرني|ذكّرني|حط\s*تذكير|ما\s*تنسى|ما\s*تنسا|remind(?:er)?|add\s+reminder|مهمه\s*لاحقه|مهمة\s*لاحقة/i.test(
      blob,
    )
  ) {
    params.task =
      transcript
        .replace(/تذكير|ذك[ّ]?رني|ذكرني|حط\s*تذكير|ما\s*تنس[اىةه]|remind(?:er)?|add\s+reminder/gi, "")
        .trim()
        .slice(0, 200) || transcript.slice(0, 200);
    if (/عاجل|مهم جدا|high|urgent/i.test(blob)) params.priority = "high";
    else if (/منخفض|low/i.test(blob)) params.priority = "low";
    else params.priority = "medium";
    return { kind: "add_reminder", confidence: 0.76, parameters: params, source: "heuristic" };
  }

  // school_outreach_request — NOT bare «مدرسة»; require outreach verbs / school pitch
  if (
    /تواصل\s*مع\s*مدرس[ةه]|راسل\s*(?:مدير|مديرة|مدرس[ةه])|اقنع\s*(?:المدرس[ةه]|الاداره|الإدارة|مدير)?|school\s*pitch|pitch\s*(?:to\s*)?school|outreach\s*(?:to\s*)?school|رسالة\s*(?:اقناع|إقناع)\s*(?:لل)?مدرس/i.test(
      blob,
    )
  ) {
    const schoolMatch = ar.match(/مدرس[ةه]\s+([^\s،.]{2,}(?:\s+[^\s،.]{2,})?)/);
    if (schoolMatch?.[1]) params.schoolName = schoolMatch[1];
    const phoneMatch = ar.match(/(?:\+?961[\s-]?)?(?:0?7[\d\s-]{6,10}|\d{7,12})/);
    if (phoneMatch?.[0]) params.principalPhone = phoneMatch[0].replace(/[^\d+]/g, "");
    if (/خليج|gcc|saudi|امارات|قطر/i.test(blob)) params.region = "GCC";
    else if (/دولي|international|ib\b/i.test(blob)) params.region = "International";
    else params.region = "Lebanon";
    return { kind: "school_outreach_request", confidence: 0.78, parameters: params, source: "heuristic" };
  }

  // generate_video / marketing — فيديو، ريلز، سوّي حملة…
  if (
    /فيديو|video|heygen|ريلز|reel|tiktok|انستا|سوي\s*(فيديو|ريلز|حمله|حملة)|اعمل\s*(فيديو|ريلز|حمله|حملة)|حمله\s*تسويق|حملة\s*تسويق|انشر\s*(فيديو|ريلز)|campaign/i.test(
      blob,
    )
  ) {
    if (/brevet|بروفيه/i.test(blob)) params.audience = "brevet";
    else if (/gs|علوم عامه|علوم عامة|terminale.?gs/i.test(blob)) params.audience = "terminale_gs";
    else if (/ls|علوم الحياه|علوم الحياة|terminale.?ls/i.test(blob)) params.audience = "terminale_ls";
    else params.audience = "general";
    return { kind: "generate_video", confidence: 0.72, parameters: params, source: "heuristic" };
  }

  // school_report — require تقرير / school report / B2B (no bare «مدرسة»)
  if (
    /تقرير\s*(?:مدرس[ةه]|مدرسي|B2B)?|school.?report|b2b\s*report|شراك[ةه]\s*مدرس|ارسل\s*تقرير|ابعث\s*تقرير|تقرير\s*مدارس/i.test(
      blob,
    )
  ) {
    const schoolMatch = ar.match(/مدرس[ةه]\s+([^\s،.]+(?:\s+[^\s،.]+)?)/);
    if (schoolMatch?.[1]) params.schoolName = schoolMatch[1];
    return { kind: "school_report", confidence: 0.7, parameters: params, source: "heuristic" };
  }

  // platform_health — المنصه جاهزه، شغل الوكيل، كل شي تمام، في عطل…
  if (
    /صحه|صحة|health|502|503|latency|المنصه|منص[ةه]|جاهزه|جاهز[ةه]|هل\s*المنص|شغل\s*الوكيل|كل\s*شي\s*تمام|في\s*عطل|نبلش\s*شغل|ready\s*(to\s*)?(start|work|go)|platform\s*(ready|health|status)|api\s*status|وضع\s*المنص/i.test(
      blob,
    )
  ) {
    return { kind: "platform_health", confidence: 0.8, parameters: {}, source: "heuristic" };
  }

  // broadcast
  if (/بث|broadcast|ارسل|أرسل|رساله للجميع|رسالة للجميع|whatsapp.?blast|ابعث\s*للجميع/i.test(blob)) {
    params.message = transcript.slice(0, 400);
    return { kind: "broadcast_message", confidence: 0.65, parameters: params, source: "heuristic" };
  }

  // student target
  if (/طالب|طلاب|student.?target|استهداف|متابعه طالب|متابعة طالب/i.test(blob)) {
    params.task = "student_target";
    params.note = transcript.slice(0, 500);
    return { kind: "general_task", confidence: 0.68, parameters: params, source: "heuristic" };
  }

  // Keep norm available for debugging in general_task note length only
  void norm;

  return {
    kind: "general_task",
    confidence: 0.55,
    parameters: { note: transcript.slice(0, 500) },
    source: "heuristic",
  };
}

export async function parseVoiceIntent(transcript: string): Promise<WhatsAppVoiceIntent> {
  const text = transcript.trim();
  if (!text) {
    return {
      kind: "general_task",
      confidence: 0.3,
      parameters: { note: "empty transcript" },
      source: "demo",
    };
  }

  const key = geminiApiKey();
  if (!key) {
    const h = heuristicIntent(text);
    return { ...h, source: "demo" };
  }

  const prompt = [
    AGENT_PERSONA_AR,
    AGENT_PERSONA_EN,
    ...SOLUTION_VERIFIER_RULES_AR,
    `Right now you act as the operations brain for MathMentor (Lebanese math platform).`,
    `Brand ONLY: ${INSTRUCTOR_EN} / ${INSTRUCTOR_AR}. Never mention Al-Tarah or الطارة.`,
    `Language: staff messages may be Lebanese colloquial Arabic (عامية لبنانية), Modern Standard Arabic (فصحى), English, or mixed.`,
    `ALWAYS interpret Lebanese dialect the same as Fusha — map dialect phrases to the structured intent below.`,
    `Examples of dialect→intent: «المنصه جاهزه»→platform_health; «حط موعد بكرا»→schedule_appointment; «ذكرني»→add_reminder; «شو عندي اليوم»→daily_briefing.`,
    `Never require the name محمد / Mohamed in the transcript — intents work without addressing the secretary by name.`,
    `Classify the staff WhatsApp voice/text transcript into ONE intent JSON:`,
    `{ "kind": "generate_video"|"school_report"|"platform_health"|"broadcast_message"|"schedule_appointment"|"add_reminder"|"daily_briefing"|"code_evolution_request"|"school_outreach_request"|"general_task",`,
    `  "confidence": 0-1,`,
    `  "parameters": { audience?, schoolName?, message?, topic?, language?, task?, note?, title?, subject?, dateTime?, date?, time?, contactPerson?, priority?, dueDate? } }`,
    `schedule_appointment: book a meeting (سجّل/سجل/حط موعد، عندي اجتماع، بكرا الساعة، بعد بكرة، هلأ، المسا، الصبح، مع فلان) — fill title/subject, dateTime (ISO if possible) or date+time, contactPerson.`,
    `add_reminder: personal/action reminder (ذكّرني/ذكرني، حط تذكير، ما تنسى، تذكير) — fill task, priority (low|medium|high), dueDate ISO if possible.`,
    `daily_briefing: today's agenda (شو عندي اليوم، الموجز، أجندة اليوم، شو المواعيد).`,
    `platform_health: readiness / is the platform ready (المنصه/المنصة جاهزة/جاهزه، شغل الوكيل، كل شي تمام، في عطل، صحة المنصة، ready to start) — NEVER general_task.`,
    `generate_video: marketing video/reel (فيديو، ريلز، سوّي/اعمل حملة).`,
    `school_report: B2B school report (تقرير مدرسة/مدرسي) — requires تقرير/report, not bare مدرسة.`,
    `school_outreach_request: draft school pitch / راسل مدير / تواصل مع مدرسة / اقنع / school pitch — NEVER bare مدرسة; stage for approval, never auto-send WhatsApp.`,
    `code_evolution_request: evolve platform code (طور الكود، عدّل كود، برمج، حدّث الصفحة، add feature, code evolution) — NEVER bare "code"; stage GitHub commit draft for approval, never auto-commit.`,
    `If the staff asks to target/follow a student, use kind general_task with parameters.task="student_target".`,
    `Audiences: brevet | terminale_gs | terminale_ls | parents | schools | general.`,
    `Timezone for dates: Asia/Beirut.`,
    `Transcript:`,
    text,
  ].join("\n");

  for (const model of geminiModels()) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, responseMimeType: "application/json" },
        }),
      });
      if (!response.ok) {
        if (response.status === 429) console.warn(`[mathmentor] intent: Gemini ${model} quota (429) — trying next model / heuristic`);
        continue;
      }
      const json = (await response.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const raw = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("\n") ?? "";
      const start = raw.indexOf("{");
      const end = raw.lastIndexOf("}");
      if (start < 0 || end <= start) continue;
      const parsed = intentSchema.safeParse(JSON.parse(raw.slice(start, end + 1)));
      if (!parsed.success) continue;
      const geminiResult: WhatsAppVoiceIntent = {
        kind: parsed.data.kind as AgentIntentKind,
        confidence: parsed.data.confidence ?? 0.8,
        parameters: parsed.data.parameters ?? {},
        source: "gemini",
      };
      // Prefer high-confidence heuristic for ops intents — Gemini often collapses
      // «هل المنصه جاهزه» into hollow general_task.
      const heuristic = heuristicIntent(text);
      const preferHeuristic =
        heuristic.kind !== "general_task" &&
        heuristic.confidence >= 0.7 &&
        (geminiResult.kind === "general_task" ||
          geminiResult.confidence < heuristic.confidence);
      if (preferHeuristic) {
        return heuristic;
      }
      return geminiResult;
    } catch {
      /* next model */
    }
  }

  return heuristicIntent(text);
}
