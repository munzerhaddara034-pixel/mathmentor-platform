"use client";

import { useState } from "react";

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<{ role: "user" | "bot"; text: string }[]>([
    { role: "bot", text: "أهلاً بك. أنا «مساعد الأستاذ منذر». اسأل عن درس، تمرين، أو طريقة الاشتراك." },
  ]);

  const send = async () => {
    const message = text.trim();
    if (!message) return;
    setText("");
    setLog((rows) => [...rows, { role: "user", text: message }]);
    setBusy(true);
    const response = await fetch("/api/bot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    const data = (await response.json()) as { reply?: string };
    setLog((rows) => [...rows, { role: "bot", text: data.reply ?? "تعذّر الرد. اترك اسمك ورقم 76532421." }]);
    setBusy(false);
  };

  return (
    <div className="chat-widget" dir="rtl">
      {open ? (
        <div className="chat-panel">
          <header>
            <strong>مساعد الأستاذ منذر</strong>
            <button type="button" onClick={() => setOpen(false)} aria-label="إغلاق المساعد">
              ×
            </button>
          </header>
          <div className="chat-log">
            {log.map((row, index) => (
              <p key={index} className={row.role}>
                {row.text}
              </p>
            ))}
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void send();
            }}
          >
            <input value={text} onChange={(event) => setText(event.target.value)} placeholder="اكتب سؤالك…" />
            <button className="btn dark" type="submit" disabled={busy}>
              إرسال
            </button>
          </form>
        </div>
      ) : null}
      <button className="chat-fab" type="button" onClick={() => setOpen((value) => !value)}>
        مساعد الأستاذ منذر
      </button>
    </div>
  );
}
