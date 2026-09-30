import { resourceFiles } from "@/lib/resources";
import Link from "next/link";
import { classroomMessages } from "@/lib/i18n/ns/classroom";
import { pickTitle } from "@/lib/i18n/pick";
import { getI18n } from "@/lib/i18n/server";

export default async function ResourcesPage() {
  const { locale } = await getI18n();
  const t = classroomMessages[locale].resources;
  return (
    <main className="shell">
      <p className="eyebrow">{t.eyebrow}</p>
      <h1>{t.title}</h1>
      <p className="muted">{t.lead}</p>
      <div className="grid two">
        {resourceFiles.map((file) => (
          <article className="card" key={file.id}>
            <span className="badge">{file.kind}</span>
            <h2>{pickTitle(locale, { title: file.title, arabicTitle: file.arabicTitle ?? "" })}</h2>
            <Link className="btn dark" href={file.href}>
              {t.open}
            </Link>
          </article>
        ))}
      </div>
    </main>
  );
}
