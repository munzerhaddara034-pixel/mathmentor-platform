import {
  DIGITAL_SAT_MATH_BLUEPRINT,
  OFFICIAL_SAT_LINKS,
  OFFICIAL_SAT_PRACTICE_HUB,
} from "@/lib/exams/officialSatBlueprint";

/** Official College Board links only — no CB item text stored. */
export function OfficialSatSection() {
  return (
    <section className="card" style={{ marginBottom: 24 }} dir="rtl">
      <h2 style={{ marginTop: 0 }}>النموذج الرسمي College Board</h2>
      <p className="muted" style={{ marginBottom: 8 }}>
        الطالب يفتح النموذج الرسمي من College Board؛ المنصة تولّد أسئلة أصلية على نفس النسق دون نسخ الأسئلة.
      </p>
      <p className="muted" dir="ltr" style={{ marginBottom: 12 }}>
        Student opens the official College Board practice PDF; MathMentor generates{" "}
        <strong>original</strong> items in the same style — we do not copy exam questions.
      </p>
      <p style={{ marginBottom: 10 }}>
        <a href={OFFICIAL_SAT_PRACTICE_HUB} target="_blank" rel="noopener noreferrer">
          College Board practice hub · مركز التمارين الرسمي
        </a>
      </p>
      <ul style={{ paddingInlineStart: 20, marginBottom: 12 }}>
        {OFFICIAL_SAT_LINKS.map((link) => (
          <li key={link.test} style={{ marginBottom: 8 }}>
            <a href={link.pdfUrl} target="_blank" rel="noopener noreferrer">
              {link.labelAr}
            </a>
            <span className="muted" dir="ltr">
              {" · "}
              {link.labelEn}
            </span>
          </li>
        ))}
      </ul>
      <p className="muted" style={{ fontSize: "0.92rem" }}>
        بنية Digital SAT Math العامة: {DIGITAL_SAT_MATH_BLUEPRINT.modules} modules ×{" "}
        {DIGITAL_SAT_MATH_BLUEPRINT.questionsPerModule} سؤال ·{" "}
        {DIGITAL_SAT_MATH_BLUEPRINT.domains.map((d) => d.ar).join(" / ")} · MCQ + SPR · آلة حاسبة مسموحة.
      </p>
    </section>
  );
}
