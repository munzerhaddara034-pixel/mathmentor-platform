import {
  DIGITAL_SAT_MATH_BLUEPRINT,
  OFFICIAL_SAT_LINKS,
  OFFICIAL_SAT_PRACTICE_HUB,
} from "@/lib/exams/officialSatBlueprint";
import { fmt } from "@/lib/i18n/format";
import { examsMessages } from "@/lib/i18n/ns/exams";
import { rich } from "@/lib/i18n/rich";
import { getI18n } from "@/lib/i18n/server";

/** Official College Board links only — no CB item text stored. */
export async function OfficialSatSection() {
  const { locale } = await getI18n();
  const t = examsMessages[locale].sat;
  const isAr = locale === "ar";
  return (
    <section className="card" style={{ marginBottom: 24 }}>
      <h2 style={{ marginTop: 0 }}>{t.title}</h2>
      <p className="muted" style={{ marginBottom: 12 }}>
        {rich(t.lead, { original: <strong>{t.original}</strong> })}
      </p>
      <p style={{ marginBottom: 10 }}>
        <a href={OFFICIAL_SAT_PRACTICE_HUB} target="_blank" rel="noopener noreferrer">
          {t.hub}
        </a>
      </p>
      <ul style={{ paddingInlineStart: 20, marginBottom: 12 }}>
        {OFFICIAL_SAT_LINKS.map((link) => (
          <li key={link.test} style={{ marginBottom: 8 }}>
            <a href={link.pdfUrl} target="_blank" rel="noopener noreferrer">
              {isAr ? link.labelAr : link.labelEn}
            </a>
          </li>
        ))}
      </ul>
      <p className="muted" style={{ fontSize: "0.92rem" }}>
        {fmt(t.blueprint, {
          modules: DIGITAL_SAT_MATH_BLUEPRINT.modules,
          per: DIGITAL_SAT_MATH_BLUEPRINT.questionsPerModule,
          domains: DIGITAL_SAT_MATH_BLUEPRINT.domains.map((d) => (isAr ? d.ar : d.en)).join(" / "),
        })}
      </p>
    </section>
  );
}
