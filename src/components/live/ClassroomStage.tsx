"use client";

import type { ReactNode } from "react";
import { INSTRUCTOR_AR, INSTRUCTOR_EN } from "@/lib/pedagogy/lebanese";
import type { ClassroomChatLine, ClassroomTokenPayload, WhiteboardEquation, WhiteboardStroke } from "@/lib/livekit/protocol";
import { MathWhiteboard } from "./MathWhiteboard";

export type RosterEntry = {
  identity: string;
  name: string;
  isLocal?: boolean;
};

export type ClassroomStageState = {
  strokes: WhiteboardStroke[];
  equations: WhiteboardEquation[];
  onStroke: (stroke: WhiteboardStroke) => void;
  onEquation: (equation: WhiteboardEquation) => void;
  onClear: () => void;
  canWrite: boolean;
  hands: Record<string, string>;
  onRaiseHand: () => void;
  handRaised: boolean;
  chatLines: ClassroomChatLine[];
  chatText: string;
  onChatText: (value: string) => void;
  onSendChat: () => void;
  writers: string[];
  avAllowed: string[];
  onGrantWrite: (identity: string, allowed: boolean) => void;
  onGrantAv: (identity: string, allowed: boolean) => void;
  onEndClass: () => void;
  ended: boolean;
  muted: boolean;
  cameraOff: boolean;
  onToggleMute: () => void;
  onToggleCamera: () => void;
};

type Props = {
  session: ClassroomTokenPayload;
  userId: string;
  stage: ClassroomStageState;
  roster: RosterEntry[];
  video?: ReactNode;
  avControls?: ReactNode;
  chat?: ReactNode;
  onLeave?: () => void;
};

export function ClassroomStage({ session, userId, stage, roster, video, avControls, chat, onLeave }: Props) {
  return (
    <div className="live-classroom" dir="rtl">
      <header className="live-classroom-banner">
        <div>
          <p className="eyebrow">صف مباشر · Live classroom</p>
          <h1>
            {INSTRUCTOR_AR} / {INSTRUCTOR_EN}
          </h1>
          <p className="muted">
            الغرفة <span dir="ltr">{session.roomName}</span>
            {session.demo ? " · وضع تجريبي بدون LiveKit Cloud" : ""}
            {session.isTeacher ? " · أستاذ" : " · طالب"}
          </p>
        </div>
        <div className="live-classroom-banner-actions">
          {session.isTeacher ? (
            <button className="btn warn" type="button" onClick={stage.onEndClass}>
              إنهاء الحصة للجميع / End class for all
            </button>
          ) : (
            <button className="btn" type="button" onClick={onLeave}>
              مغادرة / Leave
            </button>
          )}
        </div>
      </header>
      {session.error ? (
        <p className="live-demo-banner" role="status">
          {session.errorAr} / {session.error}
        </p>
      ) : null}
      {stage.ended ? (
        <p className="error">انتهت الحصة. / This class has ended.</p>
      ) : null}

      <div className="live-classroom-split">
        <MathWhiteboard
          canWrite={stage.canWrite && !stage.ended}
          strokes={stage.strokes}
          equations={stage.equations}
          onStroke={stage.onStroke}
          onEquation={stage.onEquation}
          onClear={stage.onClear}
          authorId={userId}
        />

        <aside className="live-classroom-side">
          <section className="card live-video-card">
            <h2>الفيديو / Video</h2>
            {video ?? (
              <div className="live-video-grid live-video-placeholders">
                <article className="live-tile teacher">
                  <strong>{INSTRUCTOR_EN}</strong>
                  <span>{INSTRUCTOR_AR}</span>
                </article>
                <article className="live-tile">
                  <strong>{session.name}</strong>
                  <span>{session.isTeacher ? "أستاذ / Teacher" : "طالب / Student"}</span>
                </article>
              </div>
            )}
            {avControls ?? (
              <div className="live-av-toggles">
                <button className="btn" type="button" onClick={stage.onToggleMute} disabled={!session.isTeacher && !session.canPublishAv}>
                  {stage.muted ? "إلغاء الكتم / Unmute" : "كتم / Mute"}
                </button>
                <button className="btn" type="button" onClick={stage.onToggleCamera} disabled={!session.isTeacher && !session.canPublishAv}>
                  {stage.cameraOff ? "تشغيل الكاميرا / Camera on" : "إيقاف الكاميرا / Camera off"}
                </button>
              </div>
            )}
          </section>

          <section className="card">
            <h2>المشاركون / Participants</h2>
            <ul className="live-roster">
              {roster.map((person) => {
                const raised = Boolean(stage.hands[person.identity]);
                const writer = session.isTeacher || stage.writers.includes(person.identity);
                const av = session.isTeacher && person.identity === userId ? true : stage.avAllowed.includes(person.identity);
                return (
                  <li key={person.identity}>
                    <div>
                      <strong>{person.name}</strong>
                      <p className="muted">
                        {raised ? "✋ يد مرفوعة / hand raised · " : ""}
                        {writer ? "سبورة / board · " : ""}
                        {person.identity === userId ? "أنت / you" : person.identity}
                      </p>
                    </div>
                    {session.isTeacher && person.identity !== userId ? (
                      <div className="live-grant-row">
                        <button
                          className="btn"
                          type="button"
                          onClick={() => stage.onGrantWrite(person.identity, !stage.writers.includes(person.identity))}
                        >
                          {stage.writers.includes(person.identity) ? "سحب السبورة / Revoke board" : "سماح السبورة / Grant board"}
                        </button>
                        <button
                          className="btn dark"
                          type="button"
                          onClick={() => stage.onGrantAv(person.identity, !av)}
                        >
                          {av ? "قفل الكاميرا / Lock AV" : "سماح الكاميرا / Grant AV"}
                        </button>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            <button className="btn dark" type="button" onClick={stage.onRaiseHand}>
              {stage.handRaised ? "إنزال اليد / Lower hand" : "رفع اليد / Raise hand"}
            </button>
          </section>

          <section className="card live-chat-card">
            <h2>الدردشة / Chat</h2>
            {chat ?? (
              <>
                <ul className="live-chat-log">
                  {stage.chatLines.length === 0 ? <li className="muted">لا رسائل بعد.</li> : null}
                  {stage.chatLines.map((line) => (
                    <li key={line.id}>
                      <strong>{line.name}:</strong> {line.text}
                    </li>
                  ))}
                </ul>
                <form
                  className="live-chat-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    stage.onSendChat();
                  }}
                >
                  <input
                    value={stage.chatText}
                    onChange={(event) => stage.onChatText(event.target.value)}
                    placeholder="رسالة للصف / Message the class"
                  />
                  <button className="btn dark" type="submit">
                    إرسال
                  </button>
                </form>
              </>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
