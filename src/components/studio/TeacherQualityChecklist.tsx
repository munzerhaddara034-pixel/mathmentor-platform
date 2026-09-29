const ITEMS = [
  {
    title: "Official sequence",
    titleAr: "التسلسل الرسمي",
    body: "Key Idea first, then D_f, then limits with asymptote equations (x=a, y=b, y=ax+b), then f' and the table of variations, then C_f. Not a slogan.",
  },
  {
    title: "Exam alignment",
    titleAr: "مواءمة الامتحان الرسمي",
    body: "LS / GS / SE (or Brevet) wording in EN+FR: Show that / Montrer que, Deduce / En déduire, Calculate / Calculer, IVT / Théorème des valeurs intermédiaires.",
  },
  {
    title: "Step completeness",
    titleAr: "اكتمال الخطوات",
    body: "Every algebra line is on the board with a named theorem. Continuity + monotonicity before IVT. A paying student can copy it into the booklet.",
  },
  {
    title: "Graph + variation table",
    titleAr: "الرسم وجدول التغيرات",
    body: "Canvas triggers: renderMath, plotFunction, variationTable, boxAnswer. Roots, extrema, asymptotes timed. Pan/zoom must not pause the video.",
  },
  {
    title: "Trap + boxed answers",
    titleAr: "الخطأ الشائع والإجابات المؤطّرة",
    body: "Name the shortcuts that lose barème marks, then the correction. Each sub-question ends with a Boxed Final Answer.",
  },
  {
    title: "Monetization ready",
    titleAr: "جاهز للبيع",
    body: "English default and French of equal quality. Instructor: Prof. Munzer Haddara / الأستاذ منذر حداره — never الطارة.",
  },
];

export function TeacherQualityChecklist() {
  return (
    <section className="teacher-checklist" aria-label="Teacher quality checklist">
      <p className="eyebrow">Teacher quality checklist · قائمة جودة الأستاذ</p>
      <h2>Before you record or publish</h2>
      <p className="muted">
        Prof. Munzer Haddara / الأستاذ منذر حداره — a lesson ships only if a Terminale student could sit an official paper from this board.
      </p>
      <ol>
        {ITEMS.map((item) => (
          <li key={item.title}>
            <strong>
              {item.title}
              <span className="teacher-checklist-ar"> · {item.titleAr}</span>
            </strong>
            <span>{item.body}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
