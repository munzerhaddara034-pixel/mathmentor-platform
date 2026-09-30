import { Ltr } from "@/components/ui/Ltr";

export function HowItWorks() {
  return (
    <section className="mm-section" aria-labelledby="mm-how-title">
      <h2 id="mm-how-title" className="mm-section-title">
        كيف تبدأ؟
      </h2>
      <ol className="mm-steps">
        <li className="mm-card">
          <span className="mm-step-n">1</span>
          <div>
            <h3>اختر صفّك وفرعك</h3>
            <p>
              الشهادة المتوسطة، أو الثانوية العامة <Ltr>(LS / GS / SE)</Ltr>.
            </p>
          </div>
        </li>
        <li className="mm-card">
          <span className="mm-step-n">2</span>
          <div>
            <h3>تابع الدروس وتدرّب</h3>
            <p>في كل درس: شرح، مثالان، خطأ شائع، وتمارين.</p>
          </div>
        </li>
        <li className="mm-card">
          <span className="mm-step-n">3</span>
          <div>
            <h3>اسأل عندما تعلق</h3>
            <p>الحلّال متاح دائماً، والأستاذ منذر في الحصة المباشرة.</p>
          </div>
        </li>
      </ol>
    </section>
  );
}
