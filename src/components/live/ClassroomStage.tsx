"use client";

import type { ReactNode } from "react";
import { INSTRUCTOR_AR, INSTRUCTOR_EN } from "@/lib/pedagogy/lebanese";
import type { ClassroomChatLine, ClassroomTokenPayload, WhiteboardEquation, WhiteboardPlot, WhiteboardStroke } from "@/lib/livekit/protocol";
import { MathWhiteboard } from "./MathWhiteboard";
import { VoiceToBoardPanel } from "./VoiceToBoardPanel";
import { useI18n } from "@/components/i18n/I18nProvider";
import { liveMessages } from "@/lib/i18n/ns/live";
import { pickLang } from "@/lib/i18n/pick";
import { rich } from "@/lib/i18n/rich";

export type RosterEntry = {
  identity: string;
  name: string;
  isLocal?: boolean;
};

export type ClassroomStageState = {
  strokes: WhiteboardStroke[];
  equations: WhiteboardEquation[];
  plots: WhiteboardPlot[];
  onStroke: (stroke: WhiteboardStroke) => void;
  onEquation: (equation: WhiteboardEquation) => void;
  onPlot: (plot: WhiteboardPlot) => void;
  onClear: () => void;
  canWrite: boolean;
  canClear: boolean;
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
  /** Teacher only: reopen an ended class ("Start again"). */
  onRestartClass: () => void;
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
  /** Shown above the roster (e.g. demo mode has no real presence list). */
  rosterNotice?: string;
  /** Extra controls in the video card (audio-only toggle, network quality…). */
  mediaExtras?: ReactNode;
  video?: ReactNode;
  avControls?: ReactNode;
  chat?: ReactNode;
  onLeave?: () => void;
};

export function ClassroomStage({ session, userId, stage, roster, rosterNotice, mediaExtras, video, avControls, chat, onLeave }: Props) {
  const { locale } = useI18n();
  const t = liveMessages[locale].room;
  const instructor = locale === "ar" ? INSTRUCTOR_AR : INSTRUCTOR_EN;
  const sessionError = pickLang(locale, session.error, session.errorAr);
  return (
    <div className="live-classroom mm-mobile-stack">
      <header className="live-classroom-banner">
        <div>
          <p className="eyebrow">{t.eyebrow}</p>
          <h1>{instructor}</h1>
          <p className="muted">
            {rich(t.room, { name: <span dir="ltr">{session.roomName}</span> })}
            {session.demo ? ` · ${t.demo}` : ""}
            {session.isTeacher ? ` · ${t.teacher}` : ` · ${t.student}`}
          </p>
        </div>
        <div className="live-classroom-banner-actions">
          {session.isTeacher && stage.ended ? (
            <button className="btn dark" type="button" onClick={stage.onRestartClass}>
              {t.restart}
            </button>
          ) : session.isTeacher ? (
            <button className="btn warn" type="button" onClick={stage.onEndClass}>
              {t.endAll}
            </button>
          ) : (
            <button className="btn" type="button" onClick={onLeave}>
              {t.leave}
            </button>
          )}
        </div>
      </header>
      {sessionError ? (
        <div
          className={session.demo && !session.ok ? "live-demo-banner" : "studio-teacher-error mm-api-error"}
          role="alert"
        >
          <p>{sessionError}</p>
        </div>
      ) : null}
      {stage.ended ? (
        <p className="error">{t.ended}</p>
      ) : null}

      <div className="live-classroom-split">
        <MathWhiteboard
          canWrite={stage.canWrite && !stage.ended}
          canClear={stage.canClear}
          strokes={stage.strokes}
          equations={stage.equations}
          plots={stage.plots}
          onStroke={stage.onStroke}
          onEquation={stage.onEquation}
          onPlot={stage.onPlot}
          onClear={stage.onClear}
          authorId={userId}
        />

        <aside className="live-classroom-side">
          <section className="card live-video-card">
            <h2>{t.video}</h2>
            {mediaExtras}
            {video ?? (
              <div className="live-video-grid live-video-placeholders">
                <article className="live-tile teacher">
                  <strong>{instructor}</strong>
                  <span>{t.teacherRole}</span>
                </article>
                <article className="live-tile">
                  <strong>{session.name}</strong>
                  <span>{session.isTeacher ? t.teacherRole : t.studentRole}</span>
                </article>
              </div>
            )}
            {avControls ?? (
              <div className="live-av-toggles">
                <button className="btn" type="button" onClick={stage.onToggleMute} disabled={!session.isTeacher && !session.canPublishAv}>
                  {stage.muted ? t.unmute : t.mute}
                </button>
                <button className="btn" type="button" onClick={stage.onToggleCamera} disabled={!session.isTeacher && !session.canPublishAv}>
                  {stage.cameraOff ? t.cameraOn : t.cameraOff}
                </button>
              </div>
            )}
          </section>

          {session.isTeacher && !stage.ended ? (
            <VoiceToBoardPanel
              authorId={userId}
              onEquation={stage.onEquation}
              disabled={!stage.canWrite}
            />
          ) : null}

          <section className="card">
            <h2>{t.participants}</h2>
            {rosterNotice ? (
              <p className="muted live-roster-notice" role="note">
                {rosterNotice}
              </p>
            ) : null}
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
                        {raised ? t.handRaised : ""}
                        {writer ? t.boardTag : ""}
                        {person.identity === userId ? t.you : person.identity}
                      </p>
                    </div>
                    {session.isTeacher && person.identity !== userId ? (
                      <div className="live-grant-row">
                        <button
                          className="btn"
                          type="button"
                          onClick={() => stage.onGrantWrite(person.identity, !stage.writers.includes(person.identity))}
                        >
                          {stage.writers.includes(person.identity) ? t.revokeBoard : t.grantBoard}
                        </button>
                        <button
                          className="btn dark"
                          type="button"
                          onClick={() => stage.onGrantAv(person.identity, !av)}
                        >
                          {av ? t.lockAv : t.grantAv}
                        </button>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            <button className="btn dark" type="button" onClick={stage.onRaiseHand}>
              {stage.handRaised ? t.lowerHand : t.raiseHand}
            </button>
          </section>

          <section className="card live-chat-card">
            <h2>{t.chat}</h2>
            {chat ?? (
              <>
                <ul className="live-chat-log">
                  {stage.chatLines.length === 0 ? <li className="muted">{t.noMessages}</li> : null}
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
                    placeholder={t.messagePh}
                  />
                  <button className="btn dark" type="submit">
                    {t.send}
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
