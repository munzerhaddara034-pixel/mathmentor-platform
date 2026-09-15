"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { StoryboardPlayer } from "@/components/StoryboardPlayer";
import { emptyStoreData, type ContentDraft, type LibraryItem, type ReviewStatus, type StoreData } from "@/lib/types";

export default function ProfessorPage() {
  const [store, setStore] = useState<StoreData>(emptyStoreData);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    const response = await fetch("/api/content");
    setStore((await response.json()) as StoreData);
  };

  useEffect(() => {
    void refresh();
  }, []);

  const queue = useMemo(
    () => store.drafts.filter((draft) => draft.status === "awaiting_approval" || draft.status === "changes_requested"),
    [store.drafts],
  );

  const onUpload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/library", { method: "POST", body: form });
    const payload = await response.json();
    setBusy(false);
    if (!response.ok) {
      setMessage(payload.error ?? "تعذر الرفع");
      return;
    }
    event.currentTarget.reset();
    setMessage("تم حفظ المصدر في المكتبة.");
    await refresh();
  };

  const importAhlia = async () => {
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/library/ingest-ahlia", { method: "POST" });
    const payload = await response.json();
    setBusy(false);
    setMessage(`تم استيراد ${payload.added ?? 0} كتاباً من مجلد الأهلية.`);
    await refresh();
  };

  const generate = async (libraryItemId: string) => {
    setBusy(true);
    await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ libraryItemId }),
    });
    setBusy(false);
    setMessage("أُنشئت المسودات وأُرسلت إلى طابور مراجعة الأستاذ.");
    await refresh();
  };

  const review = async (id: string, status: ReviewStatus, professorNote?: string) => {
    setBusy(true);
    await fetch("/api/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status, professorNote }),
    });
    setBusy(false);
    await refresh();
  };

  return (
    <main className="shell">
      <p className="eyebrow">Professor Munzer’s management area</p>
      <h1>توليد ثم مراجعة ثم نشر</h1>
      <p className="muted">
        ارفع الكتاب أو نموذج الامتحان، ولّد فيديو الشرح وحلول الفيديو/الورق، ثم اعتمد أو ارفض قبل أن يراها الطالب.
      </p>
      <div className="row">
        <a className="btn dark" href="/admin">لوحة الإدارة / الأكواد</a>
        <a className="btn dark" href="/classroom">Classroom videos</a>
        <a className="btn" href="/assistant">AI manager</a>
      </div>
      {message ? <p className="success">{message}</p> : null}

      <div className="card" style={{ marginTop: 24 }}>
        <h2>كتب الأهلية على الجهاز</h2>
        <p className="muted">
          المجلد: Desktop / math book ahlia — تُستورد الكتب ودلائل الحلول وحزم الجلسات، ثم يولَّد الفيديو والحل الورقي للمراجعة فقط.
        </p>
        <button className="btn dark" disabled={busy} type="button" onClick={() => void importAhlia()}>
          استيراد كتب الأهلية
        </button>
      </div>

      <form className="card" onSubmit={onUpload} style={{ marginTop: 24 }}>
        <h2>رفع كتاب أو نموذج لبناني</h2>
        <div className="grid two">
          <label>
            العنوان
            <input name="title" required placeholder="كتاب الصف التاسع / نموذج Brevet" />
          </label>
          <label>
            المادة
            <input name="subject" placeholder="جبر، دوال، احتمال..." />
          </label>
          <label>
            النوع
            <select name="kind" defaultValue="book">
              <option value="book">كتاب</option>
              <option value="exam-model">نموذج امتحان / جلسات</option>
              <option value="solution-guide">دليل حلول</option>
              <option value="worksheet">ورقة تدريب</option>
            </select>
          </label>
          <label>
            المسار
            <select name="track" defaultValue="grade-9">
              <option value="grade-7">صف 7 — EB7</option>
              <option value="grade-8">صف 8 — EB8</option>
              <option value="grade-9">صف 9 — شهادة متوسطة</option>
              <option value="grade-11">صف 11 — S1</option>
              <option value="grade-12">صف 12 — ثانوية</option>
              <option value="sat">SAT Math</option>
            </select>
          </label>
          <label>
            اللغة
            <select name="language" defaultValue="ar">
              <option value="ar">العربية</option>
              <option value="en">English</option>
            </select>
          </label>
          <label>
            ملف (اختياري)
            <input name="file" type="file" accept=".txt,.md,.pdf,.doc,.docx" />
          </label>
        </div>
        <label style={{ marginTop: 12 }}>
          ملاحظات
          <input name="notes" placeholder="الفصل، الدرس، أو رقم النموذج" />
        </label>
        <label style={{ marginTop: 12 }}>
          النص المستخرج من الكتاب أو النموذج
          <textarea name="extractedText" required placeholder="الصق نص الدرس أو المسألة هنا ليتم توليد الشرح والحل." />
        </label>
        <div className="row">
          <button className="btn dark" disabled={busy} type="submit">
            حفظ في المكتبة
          </button>
        </div>
      </form>

      <section className="grid two" style={{ marginTop: 28 }}>
        <div>
          <h2>المكتبة</h2>
          {store.library.map((item) => (
            <LibraryCard key={item.id} item={item} busy={busy} onGenerate={generate} />
          ))}
        </div>
        <div>
          <h2>طابور الاعتماد ({queue.length})</h2>
          {queue.length === 0 ? <p className="muted">لا مسودات بانتظار المراجعة.</p> : null}
          {queue.map((draft) => (
            <DraftCard key={draft.id} draft={draft} busy={busy} onReview={review} />
          ))}
        </div>
      </section>
    </main>
  );
}

function LibraryCard({
  item,
  busy,
  onGenerate,
}: {
  item: LibraryItem;
  busy: boolean;
  onGenerate: (id: string) => void;
}) {
  return (
    <article className="card" style={{ marginBottom: 12 }}>
      <span className="badge">{item.kind}</span>
      <h3>{item.title}</h3>
      <p className="muted">
        {item.subject} · {item.fileName}
      </p>
      <p>{item.notes}</p>
      <div className="row">
        {item.sourcePath ? (
          <a className="btn dark" href={`/api/library/file/${item.id}`} target="_blank" rel="noreferrer">
            فتح PDF
          </a>
        ) : null}
        <button className="btn" disabled={busy} type="button" onClick={() => onGenerate(item.id)}>
          توليد فيديو وحلول للمراجعة
        </button>
      </div>
    </article>
  );
}

function DraftCard({
  draft,
  busy,
  onReview,
}: {
  draft: ContentDraft;
  busy: boolean;
  onReview: (id: string, status: ReviewStatus, note?: string) => void;
}) {
  const [note, setNote] = useState("");
  return (
    <article className="card" style={{ marginBottom: 12 }}>
      <span className={`badge ${draft.status === "awaiting_approval" ? "pending" : "rejected"}`}>{draft.kind}</span>
      <h3>{draft.title}</h3>
      <p className="muted">{draft.questionRef}</p>
      <StoryboardPlayer scenes={draft.storyboard} language={draft.language} />
      <h4>الحل الورقي</h4>
      <pre className="paper">{draft.printableSolution}</pre>
      <label>
        ملاحظة الأستاذ
        <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="تصحيح الخطأ إن وُجد" />
      </label>
      <div className="row">
        <button className="btn ok" disabled={busy} type="button" onClick={() => onReview(draft.id, "approved", note)}>
          اعتماد ونشر للطالب
        </button>
        <button className="btn" disabled={busy} type="button" onClick={() => onReview(draft.id, "changes_requested", note)}>
          طلب تعديل
        </button>
        <button className="btn warn" disabled={busy} type="button" onClick={() => onReview(draft.id, "rejected", note)}>
          رفض
        </button>
      </div>
    </article>
  );
}
