"use client";

import { SCOPE_OPTIONS, scopeLabel, type PromoCodeRecord, type ScopeKind } from "@/lib/access";
import { useEffect, useMemo, useState } from "react";

type Dashboard = {
  subscribers: number;
  videosTop: { id: string; title: string; views: number }[];
  examAverage: number;
  cardsSold: number;
  cardsLeft: number;
  financials: { estimatedUsd: number; currency: string };
  attempts: { studentName: string; score: number; lessonId: string }[];
};

type LessonRow = {
  id: string;
  track: string;
  chapter: number;
  title: string;
  arabicTitle: string;
  videoUrl?: string;
  videoUrlFr?: string;
  enabled: boolean;
};

type BankRow = {
  id: string;
  title: string;
  arabicTitle: string;
  certificate: string;
  track: string;
  questionCount: number;
};

type CertRow = { id: string; arabic: string; english: string };

type ContentPayload = {
  lessons?: LessonRow[];
  banks?: BankRow[];
  certificates?: CertRow[];
  overrides?: { key: string; enabled: boolean }[];
};

type Tab = "codes" | "lessons" | "exams";

export function AdminPanel() {
  const [tab, setTab] = useState<Tab>("codes");
  const [data, setData] = useState<Dashboard | null>(null);
  const [cards, setCards] = useState<PromoCodeRecord[]>([]);
  const [scopeKey, setScopeKey] = useState("plan:all");
  const [count, setCount] = useState(100);
  const [expiresAt, setExpiresAt] = useState("");
  const [note, setNote] = useState("");
  const [customCode, setCustomCode] = useState("");
  const [status, setStatus] = useState("");
  const [content, setContent] = useState<ContentPayload>({});
  const [filter, setFilter] = useState<"all" | "used" | "unused">("all");

  const load = () => {
    void fetch("/api/dashboard")
      .then((response) => response.json())
      .then(setData);
    void fetch("/api/cards")
      .then((response) => response.json())
      .then((payload: { cards?: PromoCodeRecord[] }) => setCards(payload.cards ?? []));
    void fetch("/api/admin/content")
      .then((response) => response.json())
      .then((payload: ContentPayload) => setContent(payload));
  };

  useEffect(() => {
    load();
  }, []);

  const generate = async () => {
    const [scopeKind, scopeId] = scopeKey.split(":") as [ScopeKind, string];
    const response = await fetch("/api/cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scopeKind,
        scopeId,
        count,
        expiresAt: expiresAt || undefined,
        note,
        code: count === 1 ? customCode : undefined,
      }),
    });
    const payload = (await response.json()) as { error?: string; created?: PromoCodeRecord[] };
    setStatus(payload.error ?? `تم توليد ${payload.created?.length ?? 0} كوداً من 12 خانة`);
    load();
  };

  const patchContent = async (body: Record<string, unknown>) => {
    await fetch("/api/admin/content", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    load();
  };

  const visibleCards = useMemo(() => {
    if (filter === "used") return cards.filter((card) => card.used);
    if (filter === "unused") return cards.filter((card) => !card.used);
    return cards;
  }, [cards, filter]);

  if (!data) return <main className="shell">جارٍ تحميل لوحة الإدارة…</main>;

  return (
    <main className="shell admin-shell" dir="rtl">
      <p className="eyebrow">لوحة الإدارة · الأستاذ منذر</p>
      <h1>الأكواد · الفيديو · بنوك الامتحان</h1>
      <p className="muted">
        توليد بطاقات 12 خانة، متابعة من فعّلها، وتشغيل أو إيقاف الدروس والبنوك دون تعديل ملفات JSON يدوياً.
      </p>
      <div className="grid three">
        <article className="card">
          <h3>المشتركون / المفعّلون</h3>
          <p style={{ fontSize: 36 }}>{data.subscribers}</p>
        </article>
        <article className="card">
          <h3>متوسط الامتحانات</h3>
          <p style={{ fontSize: 36 }}>{data.examAverage}%</p>
        </article>
        <article className="card">
          <h3>البطاقات</h3>
          <p style={{ fontSize: 36 }}>{data.cardsLeft}</p>
          <p className="muted">غير مستخدمة · مستخدمة {data.cardsSold}</p>
        </article>
      </div>

      <div className="exam-part-tabs" style={{ marginTop: 20 }}>
        <button type="button" className={`exam-part-tab ${tab === "codes" ? "active" : ""}`} onClick={() => setTab("codes")}>
          أكواد التفعيل
        </button>
        <button type="button" className={`exam-part-tab ${tab === "lessons" ? "active" : ""}`} onClick={() => setTab("lessons")}>
          الدروس والفيديو
        </button>
        <button type="button" className={`exam-part-tab ${tab === "exams" ? "active" : ""}`} onClick={() => setTab("exams")}>
          بنوك الامتحانات
        </button>
      </div>

      {tab === "codes" ? (
        <>
          <section className="card" style={{ marginTop: 20 }}>
            <h2>توليد دفعة أكواد</h2>
            <label>
              الصف / الوحدة
              <select value={scopeKey} onChange={(event) => setScopeKey(event.target.value)}>
                {SCOPE_OPTIONS.map((item) => (
                  <option key={`${item.kind}:${item.id}`} value={`${item.kind}:${item.id}`}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              الكمية (حتى 100)
              <input type="number" min={1} max={100} value={count} onChange={(event) => setCount(Number(event.target.value))} />
            </label>
            {count === 1 ? (
              <label>
                كود مخصص من 12 خانة (اختياري)
                <input value={customCode} onChange={(event) => setCustomCode(event.target.value.toUpperCase())} dir="ltr" maxLength={12} />
              </label>
            ) : null}
            <label>
              تاريخ الانتهاء (اختياري)
              <input type="date" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} />
            </label>
            <label>
              ملاحظة الدفعة
              <input value={note} onChange={(event) => setNote(event.target.value)} />
            </label>
            <button className="btn dark" type="button" onClick={() => void generate()}>
              توليد {count} كود
            </button>
            {status ? <p className="success">{status}</p> : null}
          </section>
          <section className="card" style={{ marginTop: 20, overflowX: "auto" }}>
            <div className="progress-head">
              <h2>متابعة الاستخدام</h2>
              <select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}>
                <option value="all">الكل</option>
                <option value="unused">غير مستخدم</option>
                <option value="used">مستخدم</option>
              </select>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>الكود</th>
                  <th>النطاق</th>
                  <th>الحالة</th>
                  <th>الطالب</th>
                  <th>الهاتف</th>
                  <th>وقت التفعيل</th>
                  <th>الانتهاء</th>
                </tr>
              </thead>
              <tbody>
                {visibleCards.map((card) => (
                  <tr key={card.code}>
                    <td dir="ltr">{card.code}</td>
                    <td>{scopeLabel(card.scopeKind, card.scopeId)}</td>
                    <td>{card.used ? "مستخدم" : "غير مستخدم"}</td>
                    <td>{card.redeemedName ?? "—"}</td>
                    <td dir="ltr">{card.redeemedPhone ?? "—"}</td>
                    <td>{card.redeemedAt ? card.redeemedAt.replace("T", " ").slice(0, 16) : "—"}</td>
                    <td>{card.expiresAt ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      ) : null}

      {tab === "lessons" ? (
        <section className="card" style={{ marginTop: 20, overflowX: "auto" }}>
          <h2>إدارة الدروس والفيديو</h2>
          <p className="muted">فعّل أو عطّل الدرس، وعدّل روابط الفيديو دون فتح الملفات المصدرية.</p>
          <table className="data-table">
            <thead>
              <tr>
                <th>الدرس</th>
                <th>الفصل</th>
                <th>فيديو</th>
                <th>الحالة</th>
              </tr>
            </thead>
            <tbody>
              {(content.lessons ?? []).map((lesson) => (
                <tr key={lesson.id}>
                  <td>
                    <strong>{lesson.arabicTitle}</strong>
                    <div className="muted">{lesson.title}</div>
                    <input
                      defaultValue={lesson.videoUrl ?? ""}
                      placeholder="videoUrl"
                      dir="ltr"
                      onBlur={(event) => {
                        if (event.target.value !== (lesson.videoUrl ?? "")) {
                          void patchContent({
                            key: `lesson:${lesson.id}`,
                            kind: "lesson",
                            videoUrl: event.target.value,
                          });
                        }
                      }}
                    />
                  </td>
                  <td>
                    {lesson.track} · {lesson.chapter}
                  </td>
                  <td>{lesson.videoUrl ? "نعم" : "لوح"}</td>
                  <td>
                    <button
                      type="button"
                      className={lesson.enabled ? "btn ok" : "btn warn"}
                      onClick={() =>
                        void patchContent({
                          key: `lesson:${lesson.id}`,
                          kind: "lesson",
                          enabled: !lesson.enabled,
                        })
                      }
                    >
                      {lesson.enabled ? "مفعّل" : "معطّل"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {tab === "exams" ? (
        <section className="card" style={{ marginTop: 20 }}>
          <h2>فروع الشهادة والبنوك</h2>
          <div className="grid two">
            {(content.certificates ?? []).map((cert) => {
              const enabled = !content.overrides?.some((item) => item.key === `exam-cert:${cert.id}` && item.enabled === false);
              return (
                <article className="card" key={cert.id} style={{ margin: 0 }}>
                  <h3>
                    {cert.id} · {cert.arabic}
                  </h3>
                  <p className="muted">{cert.english}</p>
                  <button
                    type="button"
                    className={enabled ? "btn ok" : "btn warn"}
                    onClick={() =>
                      void patchContent({
                        key: `exam-cert:${cert.id}`,
                        kind: "exam-cert",
                        enabled: !enabled,
                      })
                    }
                  >
                    {enabled ? "الفرع مفتوح" : "الفرع معطّل"}
                  </button>
                </article>
              );
            })}
          </div>
          <table className="data-table" style={{ marginTop: 20 }}>
            <thead>
              <tr>
                <th>البنك</th>
                <th>الفرع</th>
                <th>الأسئلة</th>
                <th>الحالة</th>
              </tr>
            </thead>
            <tbody>
              {(content.banks ?? []).map((bank) => {
                const enabled = !content.overrides?.some((item) => item.key === `bank:${bank.id}` && item.enabled === false);
                return (
                  <tr key={bank.id}>
                    <td>
                      {bank.arabicTitle}
                      <div className="muted">{bank.title}</div>
                    </td>
                    <td>{bank.certificate}</td>
                    <td>{bank.questionCount}</td>
                    <td>
                      <button
                        type="button"
                        className={enabled ? "btn ok" : "btn warn"}
                        onClick={() =>
                          void patchContent({
                            key: `bank:${bank.id}`,
                            kind: "bank",
                            enabled: !enabled,
                          })
                        }
                      >
                        {enabled ? "مفعّل" : "معطّل"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ) : null}

      <section className="card" style={{ marginTop: 20 }}>
        <h2>الفيديوهات الأكثر مشاهدة</h2>
        {data.videosTop.map((row) => (
          <p key={row.id}>
            {row.title} — {row.views}
          </p>
        ))}
      </section>
    </main>
  );
}
