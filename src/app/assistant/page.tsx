"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import type { ManagerMessage, OutreachDraft, PlatformSettings } from "@/lib/types";
import { defaultSettings } from "@/lib/settings";

export default function AssistantPage() {
  const [messages, setMessages] = useState<ManagerMessage[]>([]);
  const [outreach, setOutreach] = useState<OutreachDraft[]>([]);
  const [settings, setSettings] = useState<PlatformSettings>(defaultSettings);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const recRef = useRef<SpeechRecognition | null>(null);

  const load = async () => {
    const response = await fetch("/api/assistant");
    const payload = await response.json();
    setMessages(payload.messages ?? []);
    setOutreach(payload.outreach ?? []);
    if (payload.settings) setSettings(payload.settings);
  };

  useEffect(() => {
    void load();
  }, []);

  const sendText = async (message: string) => {
    if (!message.trim()) return;
    setBusy(true);
    await fetch("/api/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    setText("");
    setBusy(false);
    await load();
  };

  const send = (event: FormEvent) => {
    event.preventDefault();
    void sendText(text);
  };

  const listen = () => {
    const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Speech) {
      setText((value) => value || "Voice is not available in this browser. Type the order.");
      return;
    }
    const rec = new Speech();
    rec.lang = "ar-LB";
    rec.interimResults = false;
    rec.onresult = (event: SpeechRecognitionEvent) => {
      const spoken = event.results[0][0].transcript;
      setText(spoken);
      void sendText(spoken);
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  };

  const review = async (id: string, status: "approved" | "rejected") => {
    setBusy(true);
    await fetch("/api/assistant/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    setBusy(false);
    await load();
  };

  return (
    <main className="shell">
      <p className="eyebrow">AI employee · text or voice</p>
      <h1>أعطِ أوامر. هو يطوّر، يولّد، وينتظر موافقتك.</h1>
      <p className="muted">
        Phone now: {settings.phone}. Commands: generate a video, add a lesson, set phone, set price, school letter,
        student invite, develop the platform.
      </p>
      <div className="row" style={{ marginBottom: 16 }}>
        {["Generate Grade 12 LS chapter 1 video", "Set phone +961 71 123 456", "Prepare a school letter", "Invite students to subscribe", "Develop the platform: add SAT weekly contest"].map((cmd) => (
          <button key={cmd} className="btn" type="button" disabled={busy} onClick={() => void sendText(cmd)}>
            {cmd}
          </button>
        ))}
      </div>
      <div className="grid two">
        <section className="card">
          <h2>Orders</h2>
          <div className="paper" style={{ maxHeight: 320, overflow: "auto" }}>
            {messages.map((message) => (
              <p key={message.id}>
                <strong>{message.from === "manager" ? "Employee" : "Professor"}:</strong> {message.body}
              </p>
            ))}
          </div>
          <form onSubmit={send}>
            <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="Type an order, or hold voice." />
            <div className="row">
              <button className="btn dark" disabled={busy} type="submit">
                Send order
              </button>
              <button className="btn" type="button" onClick={listen}>
                {listening ? "Listening…" : "Voice order"}
              </button>
            </div>
          </form>
        </section>
        <section>
          <h2>Must approve before send</h2>
          {outreach.map((item) => (
            <article className="card" key={item.id} style={{ marginBottom: 12 }}>
              <span className={`badge ${item.status === "approved" ? "approved" : "pending"}`}>
                {item.audience} · {item.status}
              </span>
              <h3>{item.subject}</h3>
              <pre className="paper">{item.body}</pre>
              {item.status === "awaiting_approval" ? (
                <div className="row">
                  <button className="btn ok" disabled={busy} type="button" onClick={() => review(item.id, "approved")}>
                    Approve
                  </button>
                  <button className="btn warn" disabled={busy} type="button" onClick={() => review(item.id, "rejected")}>
                    Reject
                  </button>
                </div>
              ) : null}
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}

interface SpeechRecognition extends EventTarget {
  lang: string;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
}
interface SpeechRecognitionEvent {
  results: { 0: { 0: { transcript: string } } };
}
declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  }
}
