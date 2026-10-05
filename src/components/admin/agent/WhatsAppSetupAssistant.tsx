"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { fmt } from "@/lib/i18n/format";
import { agentMessages } from "@/lib/i18n/ns/agent";

const CALLBACK_URL =
  "https://mathmentor-platform.onrender.com/api/agent/whatsapp-voice";
const META_CONFIG_URL =
  "https://developers.facebook.com/apps/2130954954482381/whatsapp-business/configuration/";

/**
 * The verify token is a server secret (WHATSAPP_VERIFY_TOKEN). It is never hardcoded or shown here;
 * the admin types it for the self-ping, which checks that it matches the server value.
 */
function selfPingPath(token: string, challenge: string) {
  const params = new URLSearchParams({ "hub.mode": "subscribe", "hub.verify_token": token, "hub.challenge": challenge });
  return `/api/agent/whatsapp-voice?${params.toString()}`;
}

function randomChallenge() {
  const bytes = new Uint32Array(2);
  crypto.getRandomValues(bytes);
  return `${bytes[0]}${bytes[1]}`;
}

type CopyKey = "callback";

type PingState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; message: string }
  | { kind: "error"; message: string };

async function copyText(value: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // fall through to legacy path
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = value;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/**
 * Quick-copy credentials + Meta console link + webhook self-ping
 * for WhatsApp Cloud API setup in Agent Hub.
 * Brand: منذر حداره · MathMentor.
 */
export function WhatsAppSetupAssistant() {
  const { locale } = useI18n();
  const t = agentMessages[locale].whatsapp;
  const [copiedKey, setCopiedKey] = useState<CopyKey | null>(null);
  const [ping, setPing] = useState<PingState>({ kind: "idle" });
  const [token, setToken] = useState("");
  const copyTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current != null) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  const onCopy = useCallback(async (key: CopyKey, value: string) => {
    const ok = await copyText(value);
    if (!ok) return;
    setCopiedKey(key);
    if (copyTimerRef.current != null) {
      window.clearTimeout(copyTimerRef.current);
    }
    copyTimerRef.current = window.setTimeout(() => {
      setCopiedKey(null);
      copyTimerRef.current = null;
    }, 1800);
  }, []);

  const runSelfPing = useCallback(async () => {
    const typed = token.trim();
    if (!typed) {
      setPing({ kind: "error", message: t.tokenMissing });
      return;
    }
    const challenge = randomChallenge();
    setPing({ kind: "loading" });
    try {
      const res = await fetch(selfPingPath(typed, challenge), {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      });
      const bodyText = await res.text();
      const trimmed = bodyText.trim();
      if (res.status === 200 && trimmed === challenge) {
        setPing({
          kind: "ok",
          message: t.pingOk,
        });
        return;
      }
      const snippet = trimmed.slice(0, 280) || t.emptyBody;
      setPing({
        kind: "error",
        message: fmt(t.pingFailed, { status: res.status, body: snippet }),
      });
    } catch (error) {
      setPing({
        kind: "error",
        message: error instanceof Error ? error.message : t.pingError,
      });
    }
  }, [t, token]);

  return (
    <section
      id="agent-whatsapp-setup"
      className="card agent-panel agent-whatsapp-setup"
    >
      <h2>{t.title}</h2>
      <p className="muted">{t.lead}</p>

      <div className="agent-wa-creds">
        <div className="agent-wa-cred-row">
          <div className="agent-wa-cred-meta">
            <span className="agent-wa-cred-label">{t.callback}</span>
            <code className="agent-wa-cred-value" dir="ltr">
              {CALLBACK_URL}
            </code>
          </div>
          <button
            type="button"
            className="btn agent-wa-copy-btn"
            onClick={() => void onCopy("callback", CALLBACK_URL)}
          >
            {copiedKey === "callback" ? t.copied : t.copy}
          </button>
        </div>

        <div className="agent-wa-cred-row">
          <div className="agent-wa-cred-meta">
            <span className="agent-wa-cred-label">{t.token}</span>
            <span className="muted" dir="auto">
              {t.tokenHint}
            </span>
            <input
              type="password"
              autoComplete="off"
              className="agent-wa-cred-value"
              dir="ltr"
              aria-label={t.tokenInput}
              placeholder={t.tokenInput}
              value={token}
              onChange={(event) => setToken(event.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="agent-actions agent-wa-actions">
        <a
          className="btn agent-result-primary-btn"
          href={META_CONFIG_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t.openMeta}
        </a>
        <button
          type="button"
          className="btn ghost-btn"
          disabled={ping.kind === "loading"}
          onClick={() => void runSelfPing()}
        >
          {ping.kind === "loading" ? "…" : t.selfPing}
        </button>
      </div>

      {ping.kind === "ok" || ping.kind === "error" ? (
        <p
          className={
            ping.kind === "ok" ? "agent-wa-ping-ok" : "agent-wa-ping-error"
          }
          role="status"
          aria-live="polite"
          dir="auto"
        >
          {ping.message}
        </p>
      ) : null}
    </section>
  );
}
