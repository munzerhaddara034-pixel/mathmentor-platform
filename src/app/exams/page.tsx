"use client";

import {
  CATALOG_TOPICS,
  CERTIFICATE_META,
  EXAM_SESSIONS,
  EXAM_YEARS,
  PRACTICE_DISCLAIMER,
  listCertificates,
  listExamPacks,
  topicsAvailableFor,
  type CatalogTopicId,
  type CertificateBranch,
  type ExamPackMeta,
} from "@/lib/examCatalog";
import type { SessionKind } from "@/lib/types";
import { canAccessExamCertificate } from "@/lib/access";
import { useWatchAccess } from "@/components/SecurePlayerShell";
import { RedeemButton } from "@/components/RedeemModal";
import Link from "next/link";
import { useMemo, useState } from "react";

function playHref(pack: ExamPackMeta) {
  return `/exams/play?pack=${encodeURIComponent(pack.id)}`;
}

function printHref(pack: ExamPackMeta) {
  return `/exams/print?pack=${encodeURIComponent(pack.id)}&mode=paper`;
}

export default function ExamsCatalogPage() {
  const [certificate, setCertificate] = useState<CertificateBranch | "">("");
  const [year, setYear] = useState<number | "">(2024);
  const [session, setSession] = useState<SessionKind | "">("");
  const [topic, setTopic] = useState<CatalogTopicId | "">("");
  const { user, entitlements } = useWatchAccess();

  const packs = useMemo(
    () =>
      listExamPacks({
        certificate: certificate || undefined,
        year: year || undefined,
        session: session || undefined,
        topic: topic || undefined,
      }),
    [certificate, year, session, topic],
  );

  const papers = packs.filter((pack) => pack.kind === "full-paper");
  const drills = packs.filter((pack) => pack.kind === "topic-drill");
  const availableTopics = certificate ? topicsAvailableFor(certificate) : CATALOG_TOPICS.map((item) => item.id);

  return (
    <main className="shell exams-hub" dir="rtl">
      <p className="eyebrow">بنك الامتحانات الرسمية · أسلوب النماذج اللبنانية</p>
      <h1>الامتحانات والتمارين</h1>
      <p className="muted">{PRACTICE_DISCLAIMER}</p>
      <div className="row">
        <RedeemButton label="تفعيل كود الامتحانات" />
      </div>

      <section className="card exam-filters">
        <h2>تصفية الكتالوج</h2>
        <div className="exam-filter-grid">
          <label>
            فرع الشهادة
            <select value={certificate} onChange={(event) => setCertificate(event.target.value as CertificateBranch | "")}>
              <option value="">كل الفروع</option>
              {listCertificates().map((item) => (
                <option key={item} value={item}>
                  {item} — {CERTIFICATE_META[item].arabic}
                </option>
              ))}
            </select>
          </label>
          <label>
            السنة (أسلوب تدريبي)
            <select value={year} onChange={(event) => setYear(event.target.value ? Number(event.target.value) : "")}>
              <option value="">كل السنوات</option>
              {EXAM_YEARS.map((item) => (
                <option key={item} value={item}>
                  {item} · تدريب بأسلوب النماذج
                </option>
              ))}
            </select>
          </label>
          <label>
            الدورة
            <select value={session} onChange={(event) => setSession(event.target.value as SessionKind | "")}>
              <option value="">عادية واستثنائية</option>
              {EXAM_SESSIONS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.arabic} ({item.english})
                </option>
              ))}
            </select>
          </label>
          <label>
            الموضوع
            <select value={topic} onChange={(event) => setTopic(event.target.value as CatalogTopicId | "")}>
              <option value="">كل الموضوعات</option>
              {CATALOG_TOPICS.map((item) => (
                <option key={item.id} value={item.id} disabled={certificate !== "" && !availableTopics.includes(item.id)}>
                  {item.arabic} — {item.english}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="muted">
          السنة والدورة وسمٌ تدريبي مثل <code>style:official-2024-ordinary</code> وليست ادعاء أن الورقة هي امتحان تلك الدورة حرفياً.
        </p>
      </section>

      <section className="exam-cert-row">
        {listCertificates().map((item) => (
          <button
            key={item}
            type="button"
            className={`exam-cert-chip ${certificate === item ? "active" : ""}`}
            onClick={() => setCertificate(certificate === item ? "" : item)}
          >
            <strong>{item}</strong>
            <span>{CERTIFICATE_META[item].arabic}</span>
          </button>
        ))}
      </section>

      <section style={{ marginTop: 28 }}>
        <h2>نماذج كاملة (أولاً / ثانياً / …)</h2>
        <p className="muted">ورقة متعددة المسائل بعلامة 20 وباريم، مع مؤقت كالمسابقة الرسمية.</p>
        {papers.length ? (
          <div className="grid two">
            {papers.map((pack) => {
              const open = canAccessExamCertificate(pack.certificate, entitlements, user?.role);
              return (
              <article className="card exam-pack-card" key={pack.id} style={open ? undefined : { opacity: 0.65 }}>
                <span className="badge">{pack.certificate}</span>
                <span className="badge">{pack.styleTag}</span>
                <h3>{pack.arabicTitle}</h3>
                <p className="muted">
                  {pack.durationMinutes} دقيقة · {pack.totalPoints} علامة · {pack.questionCount} سؤالاً · النجاح {pack.passScore}%
                </p>
                <ul className="exam-part-list">
                  {pack.parts.map((part) => (
                    <li key={part.id}>
                      {part.arabicLabel} — {part.points} عل.
                    </li>
                  ))}
                </ul>
                <div className="row">
                  {open ? (
                    <>
                      <Link className="btn dark" href={playHref(pack)}>
                        ابدأ الامتحان
                      </Link>
                      <Link className="btn" href={printHref(pack)}>
                        ورقة PDF
                      </Link>
                    </>
                  ) : (
                    <span className="muted">يحتاج كود الفرع (صف 12 أو المتوسطة حسب الشهادة)</span>
                  )}
                </div>
              </article>
              );
            })}
          </div>
        ) : (
          <p className="muted">لا نماذج كاملة بهذه التصفية. جرّب فرعاً آخر أو أزل السنة.</p>
        )}
      </section>

      <section style={{ marginTop: 32 }}>
        <h2>تدريب حسب الموضوع</h2>
        <p className="muted">الدوال، الأعداد المركبة، الاحتمالات، الهندسة التحليلية، المتتاليات، المعادلات التفاضلية.</p>
        {drills.length ? (
          <div className="grid two">
            {drills.map((pack) => {
              const open = canAccessExamCertificate(pack.certificate, entitlements, user?.role);
              return (
              <article className="card exam-pack-card" key={pack.id} style={open ? undefined : { opacity: 0.65 }}>
                <span className="badge">{pack.certificate}</span>
                <h3>{pack.arabicTitle}</h3>
                <p className="muted">
                  {pack.questionCount} سؤالاً · {pack.durationMinutes} دقيقة · بنوك موجودة في content/banks
                </p>
                <div className="row">
                  {open ? (
                    <>
                      <Link className="btn dark" href={playHref(pack)}>
                        تدريب الموضوع
                      </Link>
                      <Link className="btn" href={printHref(pack)}>
                        ورقة PDF
                      </Link>
                    </>
                  ) : (
                    <span className="muted">مقفلة — فعّل كود الفرع أولاً</span>
                  )}
                </div>
              </article>
              );
            })}
          </div>
        ) : (
          <p className="muted">
            {topic && certificate
              ? `لا بنك جاهز لموضوع هذا الفرع بعد — إن وُجد فهو مدرج كمسودة. جرّب نموذجاً كاملاً أو موضوعاً آخر.`
              : "اختر موضوعاً أو أزل التصفية."}
          </p>
        )}
      </section>

      <p className="muted" style={{ marginTop: 28 }}>
        مسابقات البنوك القديمة ما زالت على <Link href="/practice">/practice</Link> وتستخدم نفس محرّك الاختبار.
      </p>
    </main>
  );
}
