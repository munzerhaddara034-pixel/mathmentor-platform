"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { academyLessons } from "@/lib/academyLessons";
import { defaultSettings, whatsappLink } from "@/lib/settings";
import type { PlatformSettings, ProgressEntry, StoreData, StudentChatMessage } from "@/lib/types";

export default function StudentPage() {
  const [settings, setSettings] = useState<PlatformSettings>(defaultSettings);
  const [progress, setProgress] = useState<ProgressEntry[]>([]);
  const [messages, setMessages] = useState<StudentChatMessage[]>([]);
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

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
    <main className="shell" dir="rtl">
      <p className="eyebrow">Student desk</p>
      <h1>تقدمك، درسك التالي، ودردشة مع صورة الدفتر</h1>
      <p className="muted">
        Completed {progress.length} lessons. Next: {next?.title}. WhatsApp {settings.phone}.
      </p>
      <div className="grid two">
        <article className="card">
          <h2>Keep moving</h2>
          <p>
            {next?.gradeLabel} · Chapter {next?.chapter} · {next?.title}
          </p>
          <div className="row">
            <Link className="btn dark" href={`/classroom/${next?.id}`}>
              Continue classroom video
            </Link>
            <Link className="btn" href="/subscribe">
              Subscription
            </Link>
          </div>
        </article>
        <article className="card">
          <h2>Ask the tutor</h2>
          <div className="paper" style={{ maxHeight: 220, overflow: "auto" }}>
            {messages.map((message) => (
              <p key={message.id}>
                <strong>{message.from === "tutor" ? "Tutor" : "You"}:</strong> {message.body}
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
            <textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="Ask in English or Arabic. Attach a notebook photo or PDF." />
            <input type="file" accept="image/*,.pdf,.txt" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
            <div className="row">
              <button className="btn dark" disabled={busy} type="submit">
                Send question
              </button>
            </div>
          </form>
        </article>
      </div>
      <h2>Plans</h2>
      <div className="grid two">
        {settings.plans.map((plan) => (
          <article className="card" key={plan.id}>
            <h3>{plan.arabicName}</h3>
            <p>${plan.usdMonthly} / month · ${plan.usdTerm} / term</p>
            <p className="muted">{plan.includes}</p>
            <a className="btn" href={whatsappLink(settings.whatsapp, `I want ${plan.name}`)}>
              Subscribe on WhatsApp
            </a>
          </article>
        ))}
      </div>
    </main>
  );
}
