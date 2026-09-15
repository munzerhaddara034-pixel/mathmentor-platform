"use client";

import { MathTex } from "@/components/MathTex";
import type { ExamPackMeta } from "@/lib/examCatalog";
import { PRACTICE_DISCLAIMER } from "@/lib/examCatalog";
import type { QuizQuestion } from "@/lib/types";

const CHOICE_LABELS = ["أ", "ب", "ج", "د", "هـ"];

export function ExamPaperSheet({
  pack,
  questions,
  mode,
  answers,
}: {
  pack: ExamPackMeta;
  questions: QuizQuestion[];
  mode: "paper" | "solutions";
  answers?: (number | null)[];
}) {
  const yearSession = [pack.year, pack.session === "extraordinary" ? "استثنائية" : pack.session === "ordinary" ? "عادية" : ""]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="exam-paper" dir="rtl">
      <header className="exam-paper-head">
        <div className="exam-crest">
          <span className="exam-crest-mark">∑</span>
          <div>
            <p className="exam-kicker">الجمهورية اللبنانية</p>
            <p className="exam-ministry">وزارة التربية والتعليم العالي · إطار تدريبي</p>
          </div>
        </div>
        <div className="exam-brand-block">
          <strong>Math Mentor</strong>
          <span>الأستاذ منذر حدارة</span>
        </div>
      </header>
      <p className="exam-disclaimer">{pack.disclaimer || PRACTICE_DISCLAIMER}</p>
      <h1 className="exam-paper-title">{pack.arabicTitle}</h1>
      <p className="exam-paper-sub">{pack.title}</p>
      <dl className="exam-meta-grid">
        <div>
          <dt>المادة</dt>
          <dd>الرياضيات</dd>
        </div>
        <div>
          <dt>الشهادة</dt>
          <dd>
            {pack.certificate}
            {yearSession ? ` · ${yearSession}` : ""}
          </dd>
        </div>
        <div>
          <dt>المدة</dt>
          <dd>{pack.durationMinutes ? `${pack.durationMinutes} دقيقة` : "تدريب حر"}</dd>
        </div>
        <div>
          <dt>العلامة</dt>
          <dd>
            {pack.totalPoints} {mode === "solutions" ? "— مع باريم الحلول" : ""}
          </dd>
        </div>
      </dl>
      <p className="exam-style-tag">وسم الأسلوب: {pack.styleTag} · تدريب بأسلوب النماذج الرسمية وليست دورة منسوخة.</p>

      {pack.parts.map((part) => {
        const items = questions.filter((item) => (item.partId ?? "I") === part.id);
        if (!items.length) return null;
        return (
          <section key={part.id} className="exam-part-block">
            <h2>
              المسألة {part.roman} — {part.arabicLabel}
              <span className="exam-part-marks">({part.points} علامات)</span>
            </h2>
            {items.map((item, index) => {
              const globalIndex = questions.findIndex((row) => row.id === item.id);
              const picked = answers?.[globalIndex];
              const ok = picked === item.correctIndex;
              return (
                <div key={item.id} className="exam-item">
                  <p className="exam-item-stem">
                    <strong>
                      {index + 1}.
                    </strong>{" "}
                    {item.prompt}
                    <span className="exam-item-bareme">[{item.points ?? 1} عل.]</span>
                  </p>
                  <MathTex tex={item.latex} />
                  <ol className="exam-choices">
                    {item.options.map((option, optionIndex) => (
                      <li
                        key={`${item.id}-${optionIndex}`}
                        className={
                          mode === "solutions" && optionIndex === item.correctIndex ? "exam-choice-key" : undefined
                        }
                      >
                        <span>{CHOICE_LABELS[optionIndex] ?? optionIndex + 1})</span> {option}
                      </li>
                    ))}
                  </ol>
                  {mode === "solutions" ? (
                    <div className="exam-solution">
                      <p>
                        <strong>الباريم:</strong> {ok ? item.points ?? 1 : 0} / {item.points ?? 1}
                        {picked == null ? " · بدون إجابة" : ok ? " · إجابة صحيحة" : " · إجابة خاطئة"}
                      </p>
                      <p>
                        <strong>الإجابة:</strong> {item.options[item.correctIndex]}
                      </p>
                      <strong>خطوات الحل</strong>
                      {(item.solution ?? item.steps).map((step) => (
                        <p key={step}>{step}</p>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </section>
        );
      })}
    </article>
  );
}
