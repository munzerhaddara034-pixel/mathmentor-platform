"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { academyLessons } from "@/lib/academyLessons";
import { defaultSettings } from "@/lib/settings";
import { RegionLockedPrices } from "@/components/billing/RegionLockedPrices";
import { useNs } from "@/components/i18n/useNs";
import { fmt } from "@/lib/i18n/format";
import { accountMessages } from "@/lib/i18n/ns/account";
import type { PlatformSettings, ProgressEntry, StoreData, StudentChatMessage } from "@/lib/types";

export default function StudentPage() {
  const t = useNs(accountMessages).student;
  const [settings, setSettings] = useState<PlatformSettings>(defaultSettings);
  const [progress, setProgress] = useState<ProgressEntry[]>([]);
  const [messages, setMessages] = useState<StudentChatMessage[]>([]);
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [streak, setStreak] = useState(0);
  const [xp, setXp] = useState(0);
  const [badges, setBadges] = useState<string[]>([]);

  useEffect(() => {
    void fetch("/api/content")
      .then((response) => response.json())
      .then((store: StoreData) => {
        setSettings(store.settings ?? defaultSettings);
        setProgress(store.progress ?? []);
      });
    void fetch("/api/tutor")
      .then((response) => response.json())
      .then((payload) => setMessages(payload.messages ?? []));
    void fetch("/api/gamification/me", { credentials: "same-origin" })
      .then((response) => response.json())
      .then((payload: { profile?: { streakDays?: number; xp?: number; badges?: string[] } }) => {
        setStreak(payload.profile?.streakDays ?? 0);
        setXp(payload.profile?.xp ?? 0);
        setBadges(payload.profile?.badges ?? []);
      })
      .catch(() => undefined);
  }, []);

  const done = new Set(progress.map((item) => item.lessonId));
  const next = academyLessons.find((lesson) => !done.has(lesson.id)) ?? academyLessons[0];

  const send = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    const form = new FormData();
    form.set("body", body);
    if (file) form.set("file", file);
    const response = await fetch("/api/tutor", { method: "POST", body: form });
    const payload = await response.json();
    setMessages(payload.messages ?? []);
    setBody("");
    setFile(null);
    setBusy(false);
  };

  return (
    <main className="shell">
      <p className="eyebrow">{t.eyebrow}</p>
      <h1>{t.title}</h1>
      <p className="muted">
        {fmt(t.summary, { done: progress.length, next: next?.title ?? "—", phone: settings.phone })}
      </p>
      <div className="card" style={{ marginBlockStart: 12 }}>
        <h2>
          🔥 {fmt(t.streakXp, { streak, xp })}
        </h2>
        <p className="muted">{badges.length ? badges.join(" · ") : t.badgesHint}</p>
        <div className="row">
          <Link className="btn" href="/profile">
            {t.profileBadges}
          </Link>
          <Link className="btn" href="/wallet">
            {t.wallet}
          </Link>
          <Link className="btn" href="/exams">
            {t.examSim}
          </Link>
          <Link className="btn" href="/leaderboard">
            {t.monthlyXp}
          </Link>
        </div>
      </div>
      <div className="grid two">
        <article className="card">
          <h2>{t.keepMoving}</h2>
          <p>
            {next?.gradeLabel} · {fmt(t.chapter, { n: next?.chapter ?? "" })} · {next?.title}
          </p>
          <div className="row">
            <Link className="btn dark" href={`/classroom/${next?.id}`}>
              {t.continueVideo}
            </Link>
            <Link className="btn" href="/math-solver">
              {t.solver}
            </Link>
            <Link className="btn" href="/live">
              {t.book}
            </Link>
            <Link className="btn dark" href="/live/classroom/demo">
              {t.joinSession}
            </Link>
            <Link className="btn" href="/subscribe">
              {t.subscription}
            </Link>
          </div>
        </article>
        <article className="card">
          <h2>{t.askTutor}</h2>
          <div className="paper" style={{ maxHeight: 220, overflow: "auto" }}>
            {messages.map((message) => (
              <p key={message.id}>
                <strong>{message.from === "tutor" ? t.tutor : t.you}:</strong> {message.body}
                {message.fileUrl ? (
                  <>
                    {" "}
                    <a href={message.fileUrl} target="_blank" rel="noreferrer">
                      {message.fileName}
                    </a>
                  </>
                ) : null}
              </p>
            ))}
          </div>
          <form onSubmit={send}>
            <textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder={t.askPlaceholder} />
            <input type="file" accept="image/*,.pdf,.txt" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
            <div className="row">
              <button className="btn dark" disabled={busy} type="submit">
                {t.send}
              </button>
            </div>
          </form>
        </article>
      </div>
      <h2>{t.plans}</h2>
      {/* Region-locked (pricing v2): prices from plans.ts only, after location is enabled. */}
      <RegionLockedPrices showBookLink={false} />
      <div className="row" style={{ marginTop: 12 }}>
        <Link className="btn dark" href="/subscribe">
          {t.payWhish}
        </Link>
      </div>
    </main>
  );
}
