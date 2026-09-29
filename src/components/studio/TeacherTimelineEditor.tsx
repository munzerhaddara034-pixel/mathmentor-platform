"use client";

import { useEffect, useMemo, useState } from "react";
import type { LessonLocale } from "@/lib/studio/i18n";
import { pickText, STUDIO_UI } from "@/lib/studio/i18n";
import {
  CANVAS_ACTION_TYPES,
  eventsStorageKey,
  TIMELINE_STORAGE_KEY,
  validateTimelineEvents,
  type CanvasAction,
  type CanvasActionType,
  type LessonTimeline,
} from "@/lib/studio/timeline";
import { parseQuizAction } from "@/lib/studio/quiz";

type Props = {
  timeline: LessonTimeline;
  language: LessonLocale;
  onApply: (events: CanvasAction[]) => void;
};

type DraftEvent = {
  at: string;
  type: CanvasActionType;
  latex: string;
  expression: string;
  domain: string;
  highlights: string;
  question: string;
  choices: string;
  correctId: string;
  explanation: string;
  payloadJson: string;
};

function emptyDraft(at = "0"): DraftEvent {
  return {
    at,
    type: "show_equation",
    latex: "",
    expression: "",
    domain: "",
    highlights: "",
    question: "",
    choices: "",
    correctId: "",
    explanation: "",
    payloadJson: "",
  };
}

function stringifyMaybe(value: unknown) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "";
  }
}

function actionToDraft(action: CanvasAction): DraftEvent {
  const payload = (action.payload ?? {}) as Record<string, unknown>;
  const question = payload.question as { en?: string } | string | undefined;
  const choices = payload.choices ?? payload.options;
  return {
    at: String(action.at ?? 0),
    type: action.type,
    latex: String(action.latex ?? payload.latex ?? payload.math_latex ?? ""),
    expression: String(action.expression ?? payload.expression ?? payload.fn ?? ""),
    domain: Array.isArray(action.domain)
      ? action.domain.join(", ")
      : Array.isArray(payload.domain)
        ? (payload.domain as number[]).join(", ")
        : Array.isArray(payload.xDomain)
          ? (payload.xDomain as number[]).join(", ")
          : "",
    highlights: stringifyMaybe(action.highlights ?? payload.highlights),
    question: typeof question === "string" ? question : String(question?.en ?? ""),
    choices: Array.isArray(choices)
      ? choices
          .map((item) => {
            if (typeof item === "string") return item;
            if (item && typeof item === "object") {
              const rec = item as Record<string, unknown>;
              const text = rec.text as { en?: string } | string | undefined;
              const label = typeof text === "string" ? text : text?.en ?? "";
              return `${String(rec.id ?? "")}: ${label}`.replace(/^: /, "");
            }
            return "";
          })
          .filter(Boolean)
          .join("\n")
      : "",
    correctId: String(payload.correctId ?? payload.answer ?? ""),
    explanation: String(
      typeof payload.explanation === "string"
        ? payload.explanation
        : (payload.explanation as { en?: string } | undefined)?.en ?? "",
    ),
    payloadJson: "",
  };
}

function parseDomain(text: string): [number, number] | undefined {
  const parts = text.split(/[,;\s]+/).map((part) => Number(part.trim())).filter((n) => Number.isFinite(n));
  if (parts.length < 2) return undefined;
  return [parts[0], parts[1]];
}

function parseChoices(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const match = line.match(/^([a-zA-Z0-9]+)[:.)\-\s]+(.+)$/);
      if (match) return { id: match[1].toLowerCase(), text: { en: match[2].trim(), fr: match[2].trim() } };
      return { id: String.fromCharCode(97 + index), text: { en: line, fr: line } };
    });
}

function draftToAction(draft: DraftEvent): unknown {
  const at = Number(draft.at);
  const payload: Record<string, unknown> = {};
  let extra: Record<string, unknown> = {};
  if (draft.payloadJson.trim()) {
    extra = JSON.parse(draft.payloadJson) as Record<string, unknown>;
  }
  if (draft.latex.trim()) payload.latex = draft.latex.trim();
  if (draft.expression.trim()) {
    payload.expression = draft.expression.trim();
    payload.fn = draft.expression.trim();
  }
  const domain = parseDomain(draft.domain);
  if (domain) {
    payload.domain = domain;
    payload.xDomain = domain;
  }
  if (draft.highlights.trim()) {
    try {
      payload.highlights = JSON.parse(draft.highlights);
    } catch {
      payload.highlights = draft.highlights;
    }
  }
  if (draft.type === "quiz_mcq") {
    if (draft.question.trim()) payload.question = { en: draft.question.trim(), fr: draft.question.trim() };
    if (draft.choices.trim()) payload.choices = parseChoices(draft.choices);
    if (draft.correctId.trim()) payload.correctId = draft.correctId.trim();
    if (draft.explanation.trim()) payload.explanation = { en: draft.explanation.trim(), fr: draft.explanation.trim() };
  }
  const merged = { ...payload, ...extra };
  return {
    at,
    type: draft.type,
    latex: draft.latex.trim() || undefined,
    expression: draft.expression.trim() || undefined,
    domain,
    payload: merged,
  };
}

export function TeacherTimelineEditor({ timeline, language, onApply }: Props) {
  const [drafts, setDrafts] = useState<DraftEvent[]>(() =>
    (timeline.events?.length ? timeline.events : []).map(actionToDraft),
  );
  const [rawJson, setRawJson] = useState(() => JSON.stringify(timeline.events ?? [], null, 2));
  const [mode, setMode] = useState<"form" | "json">("form");
  const [errorEn, setErrorEn] = useState("");
  const [errorAr, setErrorAr] = useState("");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDrafts((timeline.events ?? []).map(actionToDraft));
    setRawJson(JSON.stringify(timeline.events ?? [], null, 2));
  }, [timeline.events]);

  const eventCount = useMemo(() => drafts.length, [drafts]);

  const setDraft = (index: number, patch: Partial<DraftEvent>) => {
    setDrafts((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const collectEvents = (): { ok: true; events: CanvasAction[] } | { ok: false } => {
    try {
      const raw = mode === "json" ? JSON.parse(rawJson) : drafts.map(draftToAction);
      const parsed = validateTimelineEvents(raw);
      if (!parsed.ok) {
        setErrorEn(parsed.messageEn);
        setErrorAr(parsed.messageAr);
        setStatus("");
        return { ok: false };
      }
      for (const event of parsed.events) {
        if (event.type === "quiz_mcq" && !parseQuizAction(event, event.at)) {
          setErrorEn("quiz_mcq needs a question, at least two choices, and correctId.");
          setErrorAr("quiz_mcq يحتاج إلى سؤال، خيارين على الأقل، وcorrectId.");
          setStatus("");
          return { ok: false };
        }
        if (!Number.isFinite(event.at) || event.at < 0) {
          setErrorEn("Each event time must be a number ≥ 0 seconds.");
          setErrorAr("يجب أن يكون وقت كل حدث رقماً ≥ 0 ثانية.");
          setStatus("");
          return { ok: false };
        }
      }
      setErrorEn("");
      setErrorAr("");
      return parsed;
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Invalid JSON";
      setErrorEn(`Invalid JSON: ${detail}`);
      setErrorAr(`JSON غير صالح: ${detail}`);
      setStatus("");
      return { ok: false };
    }
  };

  const applyLive = () => {
    const parsed = collectEvents();
    if (!parsed.ok) return;
    onApply(parsed.events);
    setRawJson(JSON.stringify(parsed.events, null, 2));
    setStatus(pickText(STUDIO_UI.teacherApplied, language));
  };

  const save = async () => {
    const parsed = collectEvents();
    if (!parsed.ok) return;
    onApply(parsed.events);
    try {
      window.sessionStorage.setItem(eventsStorageKey(timeline.id), JSON.stringify(parsed.events));
      const full = { ...timeline, events: parsed.events };
      window.sessionStorage.setItem(TIMELINE_STORAGE_KEY, JSON.stringify(full));
    } catch {
      /* quota */
    }
    setSaving(true);
    try {
      const response = await fetch("/api/studio/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId: timeline.id, events: parsed.events }),
      });
      const payload = (await response.json()) as { error?: string; errorAr?: string };
      if (!response.ok) {
        setErrorEn(payload.error ?? `Save failed (${response.status})`);
        setErrorAr(payload.errorAr ?? "فشل الحفظ");
        setStatus("");
        return;
      }
      setStatus(pickText(STUDIO_UI.teacherSaved, language));
    } catch (error) {
      const detail = error instanceof Error ? error.message : "network";
      setErrorEn(`Could not reach the events API (${detail}). Events are still in sessionStorage.`);
      setErrorAr(`تعذّر الوصول إلى واجهة الأحداث (${detail}). الأحداث ما زالت في sessionStorage.`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="studio-teacher-editor" aria-label={pickText(STUDIO_UI.teacherTitle, language)}>
      <header className="studio-teacher-head">
        <div>
          <p className="eyebrow">{pickText(STUDIO_UI.teacherEyebrow, language)}</p>
          <h2>{pickText(STUDIO_UI.teacherTitle, language)}</h2>
          <p className="muted">
            {eventCount} {pickText(STUDIO_UI.teacherEvents, language)} · {timeline.id}
            {" · "}
            <a href="/studio/voice-solver">تسجيل الشرح الصوتي / Voice-to-Math</a>
          </p>
        </div>
        <div className="studio-teacher-head-actions">
          <button className="btn" type="button" onClick={() => setMode((value) => (value === "form" ? "json" : "form"))}>
            {mode === "form" ? pickText(STUDIO_UI.teacherJsonMode, language) : pickText(STUDIO_UI.teacherFormMode, language)}
          </button>
          <button className="btn dark" type="button" onClick={applyLive}>
            {pickText(STUDIO_UI.teacherApply, language)}
          </button>
          <button className="btn ok" type="button" onClick={() => void save()} disabled={saving}>
            {saving ? pickText(STUDIO_UI.teacherSaving, language) : pickText(STUDIO_UI.teacherSave, language)}
          </button>
        </div>
      </header>

      {errorEn || errorAr ? (
        <div className="studio-teacher-error" role="alert">
          <p>{errorEn}</p>
          <p dir="rtl" lang="ar">
            {errorAr}
          </p>
        </div>
      ) : null}
      {status ? <p className="studio-teacher-status">{status}</p> : null}

      {mode === "json" ? (
        <textarea
          className="studio-teacher-json"
          value={rawJson}
          spellCheck={false}
          aria-label="Timeline events JSON"
          onChange={(event) => setRawJson(event.target.value)}
        />
      ) : (
        <div className="studio-teacher-list">
          {drafts.map((draft, index) => (
            <article key={`ev-${index}`} className="studio-teacher-row">
              <div className="studio-teacher-row-head">
                <label>
                  {pickText(STUDIO_UI.teacherTime, language)}
                  <input
                    type="number"
                    min={0}
                    step={0.1}
                    value={draft.at}
                    onChange={(event) => setDraft(index, { at: event.target.value })}
                  />
                </label>
                <label>
                  {pickText(STUDIO_UI.teacherType, language)}
                  <select
                    value={draft.type}
                    onChange={(event) => setDraft(index, { type: event.target.value as CanvasActionType })}
                  >
                    {CANVAS_ACTION_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="btn warn"
                  type="button"
                  onClick={() => setDrafts((current) => current.filter((_, i) => i !== index))}
                >
                  {pickText(STUDIO_UI.teacherRemove, language)}
                </button>
              </div>
              {draft.type === "quiz_mcq" ? (
                <>
                  <label>
                    {pickText(STUDIO_UI.teacherQuestion, language)}
                    <input value={draft.question} onChange={(event) => setDraft(index, { question: event.target.value })} />
                  </label>
                  <label>
                    {pickText(STUDIO_UI.teacherChoices, language)}
                    <textarea
                      rows={4}
                      value={draft.choices}
                      onChange={(event) => setDraft(index, { choices: event.target.value })}
                    />
                  </label>
                  <label>
                    {pickText(STUDIO_UI.teacherCorrect, language)}
                    <input value={draft.correctId} onChange={(event) => setDraft(index, { correctId: event.target.value })} />
                  </label>
                  <label>
                    {pickText(STUDIO_UI.teacherExplanation, language)}
                    <textarea
                      rows={2}
                      value={draft.explanation}
                      onChange={(event) => setDraft(index, { explanation: event.target.value })}
                    />
                  </label>
                </>
              ) : (
                <>
                  <label>
                    LaTeX
                    <input value={draft.latex} onChange={(event) => setDraft(index, { latex: event.target.value })} />
                  </label>
                  <label>
                    {pickText(STUDIO_UI.teacherExpression, language)}
                    <input
                      value={draft.expression}
                      onChange={(event) => setDraft(index, { expression: event.target.value })}
                    />
                  </label>
                  <label>
                    {pickText(STUDIO_UI.teacherDomain, language)}
                    <input
                      value={draft.domain}
                      placeholder="-3, 2"
                      onChange={(event) => setDraft(index, { domain: event.target.value })}
                    />
                  </label>
                  <label>
                    {pickText(STUDIO_UI.teacherHighlights, language)}
                    <textarea
                      rows={3}
                      value={draft.highlights}
                      onChange={(event) => setDraft(index, { highlights: event.target.value })}
                    />
                  </label>
                </>
              )}
              <label>
                {pickText(STUDIO_UI.teacherPayload, language)}
                <textarea
                  rows={2}
                  value={draft.payloadJson}
                  placeholder='{"caption":{"en":"…"}}'
                  onChange={(event) => setDraft(index, { payloadJson: event.target.value })}
                />
              </label>
            </article>
          ))}
          <button className="btn" type="button" onClick={() => setDrafts((current) => [...current, emptyDraft("0")])}>
            {pickText(STUDIO_UI.teacherAdd, language)}
          </button>
        </div>
      )}
    </section>
  );
}
