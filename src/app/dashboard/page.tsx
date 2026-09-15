"use client";

import { defaultSettings } from "@/lib/settings";
import type { ScratchCard } from "@/lib/types";
import { useEffect, useState } from "react";

type Dashboard = {
  subscribers: number;
  videosTop: { id: string; title: string; views: number }[];
  examAverage: number;
  cardsSold: number;
  cardsLeft: number;
  financials: { estimatedUsd: number; currency: string };
  attempts: { studentName: string; score: number; lessonId: string }[];
};

export default function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [cards, setCards] = useState<ScratchCard[]>([]);
  const [planId, setPlanId] = useState("all");
  const [prefix, setPrefix] = useState("MUNZER");
  const [count, setCount] = useState(10);
  const [expiresAt, setExpiresAt] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState("");

  const load = () => {
    void fetch("/api/dashboard")
      .then((response) => response.json())
      .then(setData);
    void fetch("/api/cards")
      .then((response) => response.json())
      .then((payload: { cards?: ScratchCard[] }) => setCards(payload.cards ?? []));
  };

  useEffect(() => {
    load();
  }, []);

  const generate = async () => {
    const response = await fetch("/api/cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: prefix, planId, count, expiresAt: expiresAt || undefined, note }),
    });
    const payload = (await response.json()) as { error?: string; created?: ScratchCard[] };
    setStatus(payload.error ?? `تم توليد ${payload.created?.length ?? 0} كود`);
    load();
  };

  if (!data) return <main className="shell">جارٍ تحميل الإحصائيات…</main>;
  return (
    <main className="shell" dir="rtl">
      <p className="eyebrow">لوحة تحكم الأستاذ</p>
      <h1>إحصائيات · أكواد التفعيل · الحماية</h1>
      <div className="row" style={{ marginTop: 8 }}>
        <a className="btn dark" href="/studio/script">مولّد سكربت الدرس</a>
        <a className="btn" href="/lessons/interactive">السبورة الذكية</a>
      </div>
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
          <h3>تقدير مالي</h3>
          <p style={{ fontSize: 36 }}>
            {data.financials.estimatedUsd} {data.financials.currency}
          </p>
          <p className="muted">
            بطاقات مباعة {data.cardsSold} · متبقية {data.cardsLeft}
          </p>
        </article>
      </div>
      <section className="card" style={{ marginTop: 20 }}>
        <h2>توليد أكواد التفعيل بالجملة</h2>
        <label>
          الدورة / الصف
          <select value={planId} onChange={(event) => setPlanId(event.target.value)}>
            {defaultSettings.plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.arabicName}
              </option>
            ))}
          </select>
        </label>
        <label>
          بادئة الكود (أو كود واحد مخصص إن كان العدد 1)
          <input value={prefix} onChange={(event) => setPrefix(event.target.value)} />
        </label>
        <label>
          الكمية (حتى 100)
          <input type="number" min={1} max={100} value={count} onChange={(event) => setCount(Number(event.target.value))} />
        </label>
        <label>
          تاريخ الانتهاء (اختياري)
          <input type="date" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} />
        </label>
        <label>
          ملاحظة الدفعة
          <input value={note} onChange={(event) => setNote(event.target.value)} />
        </label>
        <button className="btn dark" type="button" onClick={() => void generate()}>
          توليد الأكواد
        </button>
        {status ? <p className="success">{status}</p> : null}
      </section>
      <section className="card" style={{ marginTop: 20, overflowX: "auto" }}>
        <h2>متابعة الأكواد</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>الكود</th>
              <th>الدورة</th>
              <th>الحالة</th>
              <th>الطالب</th>
              <th>الهاتف</th>
              <th>الإنشاء</th>
              <th>الانتهاء</th>
            </tr>
          </thead>
          <tbody>
            {cards.map((card) => (
              <tr key={card.code}>
                <td>{card.code}</td>
                <td>{card.planId}</td>
                <td>{card.used ? "مستخدم" : "غير مستخدم"}</td>
                <td>{card.usedBy ?? "—"}</td>
                <td>{card.usedPhone ?? "—"}</td>
                <td>{card.createdAt ? card.createdAt.slice(0, 10) : "—"}</td>
                <td>{card.expiresAt ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="card" style={{ marginTop: 20 }}>
        <h2>الفيديوهات الأكثر مشاهدة</h2>
        {data.videosTop.map((row) => (
          <p key={row.id}>
            {row.title} — {row.views}
          </p>
        ))}
      </section>
      <section className="card" style={{ marginTop: 20 }}>
        <h2>أداء الطلاب</h2>
        {data.attempts.map((row, index) => (
          <p key={index}>
            {row.studentName}: {row.score}% · {row.lessonId}
          </p>
        ))}
      </section>
    </main>
  );
}
