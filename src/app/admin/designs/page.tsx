import Link from "next/link";
import { requireStaff } from "@/lib/auth/guards";
import { adminMessages } from "@/lib/i18n/ns/admin";
import { getI18n } from "@/lib/i18n/server";
import { listYoussefDesigns } from "@/lib/team/youssefActions";

export const dynamic = "force-dynamic";

function formatDate(value: string, locale: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString(locale) : value;
}

export default async function AdminDesignsPage() {
  await requireStaff("/admin/designs");
  const { locale, dir } = await getI18n();
  const t = adminMessages[locale].pages;
  const designs = await listYoussefDesigns();
  return (
    <main className="shell" dir={dir}>
      <p className="eyebrow">{t.designsEyebrow}</p>
      <h1>{t.designsTitle}</h1>
      <p className="muted">
        {t.designsLead} · <Link href="/admin">{t.backToAdmin}</Link>
      </p>
      {designs.length === 0 ? (
        <p className="card">{t.designsEmpty}</p>
      ) : (
        <div style={{ display: "grid", gap: "24px" }}>
          {designs.map((design) => (
            <article className="card" key={design.id}>
              <header>
                <p className="eyebrow">{design.id}</p>
                <h2>{design.title}</h2>
                <p className="muted">
                  {t.designRequest}: {design.request} · Language: <bdi dir="ltr">{design.language}</bdi> · {t.designUpdatedAt.replace("{date}", formatDate(design.updatedAt, locale))}
                </p>
              </header>
              <div style={{ display: "grid", gap: "16px", gridTemplateColumns: "minmax(220px, 1fr) minmax(0, 2fr)" }}>
                <section>
                  <h3>{t.designBrief}</h3>
                  <p>
                    <strong>{t.designPalette}</strong>: {design.brief.palette.join(" · ")}
                  </p>
                  <p>
                    <strong>{t.designTypography}</strong>: {design.brief.typographyScale.join(" · ")}
                  </p>
                  <p>
                    <strong>{t.designSpacing}</strong>: {design.brief.spacing.join(" · ")}
                  </p>
                </section>
                <section>
                  <h3>{t.designPreview}</h3>
                  <iframe
                    title={design.title}
                    srcDoc={design.html}
                    sandbox=""
                    style={{ background: "#fff", border: "1px solid #dbe4ee", borderRadius: "16px", minHeight: "480px", width: "100%" }}
                  />
                </section>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
