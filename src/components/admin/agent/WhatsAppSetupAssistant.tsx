"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { fmt } from "@/lib/i18n/format";
import { agentMessages } from "@/lib/i18n/ns/agent";

const CALLBACK_URL =
  "https://mathmentor-platform.onrender.com/api/agent/whatsapp-voice";
const VERIFY_TOKEN = "mathmentor_secret_token";
const META_CONFIG_URL =
  "https://developers.facebook.com/apps/2130954954482381/whatsapp-business/configuration/";
const SELF_PING_CHALLENGE = "1158201444";
const SELF_PING_PATH =
  `/api/agent/whatsapp-voice?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=${SELF_PING_CHALLENGE}`;

type CopyKey = "callback" | "token";

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
 * Brand: Prof. Munzer Haddara / الأستاذ منذر حداره.
 */
export function WhatsAppSetupAssistant() {
  const { locale } = useI18n();
  const t = agentMessages[locale].whatsapp;
  const [copiedKey, setCopiedKey] = useState<CopyKey | null>(null);
  const [ping, setPing] = useState<PingState>({ kind: "idle" });
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
    setPing({ kind: "loading" });
    try {
      const res = await fetch(SELF_PING_PATH, {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      });
      const bodyText = await res.text();
      const trimmed = bodyText.trim();
      if (res.status === 200 && trimmed === SELF_PING_CHALLENGE) {
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
  }, [t]);

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
            <code className="agent-wa-cred-value" dir="ltr">
              {VERIFY_TOKEN}
            </code>
          </div>
          <button
            type="button"
            className="btn agent-wa-copy-btn"
            onClick={() => void onCopy("token", VERIFY_TOKEN)}
          >
            {copiedKey === "token" ? t.copied : t.copy}
          </button>
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
