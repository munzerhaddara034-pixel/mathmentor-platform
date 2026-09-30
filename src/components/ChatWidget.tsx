"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";

type BotReply = { reply?: string };

/** Fire from anywhere (e.g. dashboard quick action) to open the assistant panel. */
export const OPEN_ASSISTANT_EVENT = "mm:open-assistant";

const FALLBACK_REPLY = "تعذّر الرد الآن. جرّب مرة أخرى بعد قليل، أو تواصل مع الأستاذ منذر حداره عبر واتساب.";

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<{ role: "user" | "bot"; text: string }[]>([
    { role: "bot", text: "أهلاً بك. أنا «مساعد الأستاذ منذر». اسأل عن درس، تمرين، أو طريقة الاشتراك." },
  ]);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_ASSISTANT_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_ASSISTANT_EVENT, onOpen);
  }, []);

  const send = async () => {
    const message = text.trim();
    if (!message || busy) return;
    setText("");
    setLog((rows) => [...rows, { role: "user", text: message }]);
    setBusy(true);
    try {
      const response = await fetch("/api/bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = (await response.json()) as BotReply;
      setLog((rows) => [...rows, { role: "bot", text: response.ok && data.reply ? data.reply : FALLBACK_REPLY }]);
    } catch {
      setLog((rows) => [...rows, { role: "bot", text: FALLBACK_REPLY }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`chat-widget${open ? " is-open" : ""}`} dir="rtl">
      {open ? (
        <div className="chat-panel" role="dialog" aria-label="مساعد الأستاذ منذر">
          <header>
            <strong>مساعد الأستاذ منذر</strong>
            <button type="button" onClick={() => setOpen(false)} aria-label="إغلاق المساعد">
              ×
            </button>
          </header>
          <div className="chat-log" aria-live="polite">
            {log.map((row, index) => (
              <p key={index} className={row.role}>
                {row.text}
              </p>
            ))}
            {busy ? (
              <p className="bot chat-typing" aria-label="جارٍ الرد">
                <span />
                <span />
                <span />
              </p>
            ) : null}
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
      <button
        className="chat-fab"
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label="مساعد الأستاذ منذر"
        title="مساعد الأستاذ منذر"
      >
        <Icon name={open ? "close" : "chat"} />
      </button>
    </div>
  );
}
