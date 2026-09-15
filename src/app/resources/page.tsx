import { resourceFiles } from "@/lib/resources";
import Link from "next/link";

export default function ResourcesPage() {
  return (
    <main className="shell" dir="rtl">
      <p className="eyebrow">المرفقات والملخصات</p>
      <h1>دوسيات وأوراق عمل للطباعة</h1>
      <p className="muted">عرض محمي بعلامة مائية. التحميل المباشر للملف غير متاح؛ افتح الصفحة للعرض أو اطبع والنص يحمل اسمك.</p>
      <div className="grid two">
        {resourceFiles.map((file) => (
          <article className="card" key={file.id}>
            <span className="badge">{file.kind}</span>
            <h2>{file.title}</h2>
            <p className="muted">{file.kind}</p>
            <Link className="btn dark" href={file.href}>
              عرض محمي
            </Link>
          </article>
        ))}
      </div>
    </main>
  );
}
