"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { useI18n } from "@/components/i18n/I18nProvider";
import { AiTutorBadge } from "@/components/v2/AiTutorBadge";

type BotReply = { reply?: string; needSignIn?: boolean; needAi?: boolean; upgradeUrl?: string };
type ChatRow = { role: "user" | "bot"; text: string; link?: { href: string; label: string } };

/** Fire from anywhere (e.g. dashboard quick action) to open the assistant panel. */
export const OPEN_ASSISTANT_EVENT = "mm:open-assistant";

export function ChatWidget() {
  const { m, locale } = useI18n();
  const a = m.assistant;
  const FALLBACK_REPLY = a.fallback;
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<ChatRow[]>([
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
      const data = (await response.json().catch(() => ({}))) as BotReply;
      let row: ChatRow;
      if (response.status === 401 || data.needSignIn) {
        // The AI tutor needs an account (Gemini quota): show a clear sign-in prompt instead of a generic error.
        const next = `${window.location.pathname}${window.location.search}`;
        row = { role: "bot", text: a.signInPrompt, link: { href: `/login?next=${encodeURIComponent(next)}`, label: a.signInCta } };
      } else if (response.status === 403 && data.needAi) {
        row = { role: "bot", text: a.upgradePrompt, link: { href: data.upgradeUrl || "/redeem?need=ai", label: a.upgradeCta } };
      } else if (response.status === 429) {
        row = { role: "bot", text: a.rateLimited };
      } else {
        row = { role: "bot", text: response.ok && data.reply ? data.reply : FALLBACK_REPLY };
      }
      setLog((rows) => [...rows, row]);
    } catch {
      setLog((rows) => [...rows, { role: "bot", text: FALLBACK_REPLY }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`chat-widget${open ? " is-open" : ""}`}>
      {open ? (
        <div className="chat-panel" role="dialog" aria-label={m.persona.label}>
          <header>
            <span className="v2-persona-line">
              <strong>{a.name}</strong>
              <AiTutorBadge label={m.persona.ai} onDark />
            </span>
            <button type="button" onClick={() => setOpen(false)} aria-label={a.close}>
              ×
            </button>
          </header>
          <div className="chat-log" aria-live="polite">
            {log.map((row, index) => (
              <p key={index} className={row.role} dir="auto">
                {row.text}
                {row.link ? (
                  <>
                    {" "}
                    <a className="chat-link" href={row.link.href}>
                      {row.link.label}
                    </a>
                  </>
                ) : null}
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
        aria-label={m.persona.label}
        title={m.persona.label}
      >
        <Icon name={open ? "close" : "chat"} />
      </button>
    </div>
  );
}
