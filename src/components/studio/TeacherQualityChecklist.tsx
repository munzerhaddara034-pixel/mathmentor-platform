const ITEMS = [
  {
    title: "Exam alignment",
    titleAr: "مواءمة الامتحان الرسمي",
    body: "LS / GS / SE (or Brevet) official pattern: domain, justified limits or discriminant, table of variation, sketch. Not a slogan.",
  },
  {
    title: "Step completeness",
    titleAr: "اكتمال الخطوات",
    body: "Every algebra line is on the board (product rule, factoring, substitution). A paying student can copy it into the booklet.",
  },
  {
    title: "Graph necessity",
    titleAr: "ضرورة الرسم",
    body: "The graph is timed and marked: roots, extrema, asymptotes. Pan/zoom must not pause the video.",
  },
  {
    title: "Trap + correction",
    titleAr: "الخطأ الشائع وتصحيحه",
    body: "Name the wrong reasoning the marker sees every year, then the correct line.",
  },
  {
    title: "Monetization ready",
    titleAr: "جاهز للبيع",
    body: "English default and French of equal quality (épreuve language, not a calque). Instructor: Prof. Munzer Haddara / الأستاذ منذر حداره.",
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
