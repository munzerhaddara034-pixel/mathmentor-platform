"use client";

import Link from "next/link";
import { useState } from "react";
import { OPEN_ASSISTANT_EVENT } from "@/components/ChatWidget";
import { useI18n } from "@/components/i18n/I18nProvider";
import { Icon } from "@/components/ui/Icon";
import { fmt } from "@/lib/i18n/format";
import type { MathQueryRecord, StudentRating } from "@/lib/solver/types";

type Summary = Pick<MathQueryRecord, "id" | "rating" | "needsRetake" | "videoStatus" | "heygenJobId" | "track">;

/** Follow-up chips, localized rating (try/catch), and staff-only tools (hidden from students). */
export function SolverResultActions({ initial, canTeach }: { initial: Summary; canTeach: boolean }) {
  const { m } = useI18n();
  const r = m.result;
  const [query, setQuery] = useState<Summary>(initial);
  const [rateState, setRateState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const rate = async (rating: StudentRating) => {
    setRateState("saving");
    try {
      const response = await fetch(`/api/solve-math/${query.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ rating }),
      });
      const payload = (await response.json()) as { query?: MathQueryRecord };
      if (!response.ok || !payload.query) throw new Error(`rate ${response.status}`);
      setQuery((current) => ({ ...current, rating: payload.query?.rating }));
      setRateState("saved");
    } catch {
      setRateState("error");
    }
  };

  const generate = async () => {
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/generate-avatar-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ queryId: query.id }),
      });
      const payload = (await response.json()) as { notice?: string; error?: string; demoMode?: boolean };
      setNotice(payload.notice || payload.error || (payload.demoMode ? "Demo video ready." : "Job queued."));
      const refresh = await fetch(`/api/solve-math/${query.id}`, { credentials: "same-origin" });
      const next = (await refresh.json()) as { query?: MathQueryRecord };
      if (next.query) setQuery((current) => ({ ...current, videoStatus: next.query?.videoStatus ?? current.videoStatus, heygenJobId: next.query?.heygenJobId }));
    } catch {
      setNotice(r.staffFailed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="v2-result-actions">
      <div className="v2-chip-row">
        {query.needsRetake ? null : (
          <Link href={`/lessons/interactive-explanation?id=${query.id}`} className="v2-chip v2-chip-btn">
            <Icon name="board" size={16} /> {r.chipBoard}
          </Link>
        )}
        <button type="button" className="v2-chip v2-chip-btn" onClick={() => window.dispatchEvent(new Event(OPEN_ASSISTANT_EVENT))}>
          <Icon name="chat" size={16} /> {r.chipAsk}
        </button>
        <Link href="/practice" className="v2-chip v2-chip-btn">
          <Icon name="layers" size={16} /> {r.chipSimilar}
        </Link>
        <Link href="/math-solver" className="v2-chip v2-chip-btn">
          <Icon name="camera" size={16} /> {r.chipNew}
        </Link>
      </div>

      {query.needsRetake ? null : (
        <div className="v2-rate glass" role="group" aria-label={r.rateQ}>
          <span>{r.rateQ}</span>
          <div className="v2-rate-btns">
            <button type="button" className="v2-btn v2-btn-glass v2-btn-sm" aria-pressed={query.rating === 1} disabled={rateState === "saving"} onClick={() => void rate(1)}>
              <Icon name="check" size={16} /> {r.rateUp}
            </button>
            <button type="button" className="v2-btn v2-btn-glass v2-btn-sm" aria-pressed={query.rating === -1} disabled={rateState === "saving"} onClick={() => void rate(-1)}>
              <Icon name="close" size={16} /> {r.rateDown}
            </button>
          </div>
          {rateState === "saved" ? (
            <p className="v2-muted v2-small" role="status">
              {r.rateThanks}
            </p>
          ) : null}
          {rateState === "error" ? (
            <p className="mm-widget-error" role="alert">
              {r.rateFailed}
            </p>
          ) : null}
        </div>
      )}

      {canTeach && !query.needsRetake ? (
        <details className="v2-staff glass" dir="ltr" lang="en">
          <summary>{r.staffTools}</summary>
          <div className="v2-chip-row">
            <button className="v2-btn v2-btn-primary v2-btn-sm" type="button" disabled={busy} onClick={() => void generate()}>
              {busy ? r.staffGenerating : r.staffGenerate}
            </button>
            <Link className="v2-btn v2-btn-glass v2-btn-sm" href={`/lessons/interactive-explanation?id=${query.id}`}>
              {r.staffSplit}
            </Link>
          </div>
          {notice ? <p className="v2-small">{notice}</p> : null}
          <p className="v2-muted v2-small">
            {fmt(r.staffVideo, { status: query.videoStatus })}
            {query.heygenJobId ? ` · job ${query.heygenJobId}` : ""}
          </p>
        </details>
      ) : null}
    </div>
  );
}
