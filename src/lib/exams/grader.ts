import { listSubs, paperById } from "./papers";
import type { GradeResult, OfficialPaper, SubGrade } from "./types";

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/\\mathrm\{e\}/g, "e")
    .replace(/\\mathbb\{r\}/g, "r")
    .replace(/frac\{([^}]+)\}\{([^}]+)\}/g, "$1/$2")
    .replace(/[^a-z0-9./+\-=]/g, "")
    .replace(/ /g, "");
}

function numericClose(answer: string, expected: string[]) {
  const n = Number(answer.replace(",", ".").replace(/[^\d.+-e]/g, ""));
  if (!Number.isFinite(n)) return false;
  return expected.some((item) => {
    const e = Number(item.replace(",", ".").replace(/[^\d.+-e]/g, ""));
    return Number.isFinite(e) && Math.abs(e - n) < 1e-6;
  });
}

export function demoGradePaper(paper: OfficialPaper, answers: Record<string, string>): GradeResult {
  const rows = listSubs(paper);
  const subs: SubGrade[] = rows.map(({ sub }) => {
    const raw = (answers[sub.id] ?? "").trim();
    if (!raw) {
      return {
        subId: sub.id,
        label: sub.label,
        awarded: 0,
        max: sub.marks,
        comment: "Blank — 0.",
        commentAr: "بدون إجابة — صفر.",
      };
    }
    const got = normalize(raw);
    const exact = sub.expected.some((item) => normalize(item) === got);
    const keyword = (sub.keywords ?? []).some((item) => got.includes(normalize(item)));
    const close = numericClose(raw, sub.expected);
    let awarded = 0;
    let comment = "Does not match the official key.";
    let commentAr = "لا تطابق سلم التصحيح.";
    if (exact || close) {
      awarded = sub.marks;
      comment = "Matches the barème.";
      commentAr = "مطابق للسلّم.";
    } else if (keyword) {
      awarded = Math.round(sub.marks * 0.5 * 2) / 2;
      comment = "Partial credit (keyword / method).";
      commentAr = "علامة جزئية (فكرة الحل).";
    }
    return { subId: sub.id, label: sub.label, awarded, max: sub.marks, comment, commentAr };
  });
  const totalAwarded = subs.reduce((sum, row) => sum + row.awarded, 0);
  const totalMax = paper.totalMarks;
  const percent = totalMax ? Math.round((totalAwarded / totalMax) * 100) : 0;
  return {
    source: "demo",
    totalAwarded,
    totalMax,
    percent,
    subs,
    summary: `Demo barème: ${totalAwarded}/${totalMax} (${percent}%).`,
    summaryAr: `سلّم تجريبي: ${totalAwarded}/${totalMax} (${percent}%).`,
  };
}

export async function gradePaper(paper: OfficialPaper, answers: Record<string, string>): Promise<GradeResult> {
  const key = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim() || "";
  if (!key) return demoGradePaper(paper, answers);
  try {
    const compact = listSubs(paper).map(({ sub }) => ({
      id: sub.id,
      label: sub.label,
      marks: sub.marks,
      expected: sub.expected,
      answer: answers[sub.id] ?? "",
    }));
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `You are Prof. Munzer Haddara grading a Lebanese official math paper. Never say Al-Tarah. Return JSON { "subs": [ { "id", "awarded", "comment", "commentAr" } ], "summary", "summaryAr" }. Award at most the given marks. Items:\n${JSON.stringify(compact)}`,
                },
              ],
            },
          ],
        }),
      },
    );
    if (!response.ok) return demoGradePaper(paper, answers);
    const payload = (await response.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("\n") ?? "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return demoGradePaper(paper, answers);
    const parsed = JSON.parse(match[0]) as {
      summary?: string;
      summaryAr?: string;
      subs?: Array<{ id?: string; awarded?: number; comment?: string; commentAr?: string }>;
    };
    const demo = demoGradePaper(paper, answers);
    const byId = new Map((parsed.subs ?? []).map((row) => [row.id, row]));
    const subs = demo.subs.map((row) => {
      const llm = byId.get(row.subId);
      if (!llm) return row;
      const awarded = Math.max(0, Math.min(row.max, Number(llm.awarded) || 0));
      return {
        ...row,
        awarded,
        comment: llm.comment || row.comment,
        commentAr: llm.commentAr || row.commentAr,
      };
    });
    const totalAwarded = subs.reduce((sum, row) => sum + row.awarded, 0);
    return {
      source: "llm",
      totalAwarded,
      totalMax: paper.totalMarks,
      percent: paper.totalMarks ? Math.round((totalAwarded / paper.totalMarks) * 100) : 0,
      subs,
      summary: parsed.summary || demo.summary,
      summaryAr: parsed.summaryAr || demo.summaryAr,
    };
  } catch {
    return demoGradePaper(paper, answers);
  }
}

export function requirePaper(id: string) {
  const paper = paperById(id);
  if (!paper) throw new Error(`Unknown paper ${id}`);
  return paper;
}
