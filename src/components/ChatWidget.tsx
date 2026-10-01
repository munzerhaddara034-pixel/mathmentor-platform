"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { useI18n } from "@/components/i18n/I18nProvider";

type BotReply = { reply?: string };

/** Fire from anywhere (e.g. dashboard quick action) to open the assistant panel. */
export const OPEN_ASSISTANT_EVENT = "mm:open-assistant";

export function ChatWidget() {
  const { m, locale } = useI18n();
  const a = m.assistant;
  const FALLBACK_REPLY = a.fallback;
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<{ role: "user" | "bot"; text: string }[]>([
    { role: "bot", text: a.greeting },
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
        body: JSON.stringify({ message, locale }),
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
    <div className={`chat-widget${open ? " is-open" : ""}`}>
      {open ? (
        <div className="chat-panel" role="dialog" aria-label={a.name}>
          <header>
            <strong>{a.name}</strong>
            <button type="button" onClick={() => setOpen(false)} aria-label={a.close}>
              ×
            </button>
          </header>
          <div className="chat-log" aria-live="polite">
            {log.map((row, index) => (
              <p key={index} className={row.role} dir="auto">
                {row.text}
              </p>
            ))}
            {busy ? (
              <p className="bot chat-typing" aria-label={a.typing}>
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
            <input value={text} onChange={(event) => setText(event.target.value)} placeholder={a.placeholder} />
            <button className="btn dark" type="submit" disabled={busy}>
              {a.send}
            </button>
          </form>
        </div>
      ) : null}
      <button
        className="chat-fab"
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={a.name}
        title={a.name}
      >
        <Icon name={open ? "close" : "chat"} />
      </button>
    </div>
  );
}
