"use client";

import { useState } from "react";
import { ApiErrorBanner } from "@/components/ui/Skeleton";
import type { TeamMessage, TeamProposal } from "@/lib/team/types";
import { DiffView } from "./DiffView";
import { InlineRich } from "./RichText";
import { decideProposal } from "./teamApi";

type Props = {
  proposal: TeamProposal;
  onDecided: (proposal: TeamProposal, message: TeamMessage) => void;
};

const STATUS_AR: Record<TeamProposal["status"], string> = {
  pending: "بانتظار موافقة منذر",
  committing: "جارٍ الـ Commit…",
  committed: "تم الـ Commit",
  rejected: "مرفوض",
  failed: "فشل — يمكن إعادة المحاولة",
};

/** Developer diff card with «موافقة ونشر» / «رفض» (explicit human click + confirmation dialog). */
export function ProposalCard({ proposal, onDecided }: Props) {
  const [mode, setMode] = useState<"idle" | "approve" | "reject">("idle");
  const [target, setTarget] = useState<"feature" | "live">("feature");
  const [branch, setBranch] = useState(proposal.targetBranch);
  const [typed, setTyped] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorAr, setErrorAr] = useState("");
  const open = proposal.status === "pending" || proposal.status === "failed";
  const chosenBranch = target === "live" ? proposal.baseBranch : branch.trim();
  const canSubmit =
    mode === "reject" || (reviewed && chosenBranch.length > 2 && (target === "feature" || typed === proposal.baseBranch));

  const submit = async () => {
    if (!canSubmit || busy) return;
    setBusy(true);
    setErrorAr("");
    const result = await decideProposal(proposal.id, {
      action: mode === "reject" ? "reject" : "approve",
      confirm: true,
      branch: mode === "approve" ? chosenBranch : undefined,
      confirmBranch: mode === "approve" && target === "live" ? typed : undefined,
    });
    setBusy(false);
    if (!result.ok) {
      setErrorAr(result.errorAr);
      return;
    }
    setMode("idle");
    onDecided(result.data.proposal, result.data.message);
  };

  return (
    <section className={`team-proposal is-${proposal.status}`} aria-label="اقتراح تعديل كود">
      <header className="team-proposal-head">
        <strong dir="ltr">{proposal.commitMessage}</strong>
        <span className={`team-status is-${proposal.status}`}>{STATUS_AR[proposal.status]}</span>
      </header>
      {proposal.summaryAr ? (
        <p>
          <InlineRich text={proposal.summaryAr} />
        </p>
      ) : null}
      <dl className="team-proposal-meta">
        <dt>الفرع</dt>
        <dd dir="ltr">
          {proposal.committedBranch ?? proposal.targetBranch} ← {proposal.baseBranch}
        </dd>
        {proposal.risksAr ? (
          <>
            <dt>المخاطر</dt>
            <dd>{proposal.risksAr}</dd>
          </>
        ) : null}
        {proposal.testPlanAr ? (
          <>
            <dt>الاختبار</dt>
            <dd>{proposal.testPlanAr}</dd>
          </>
        ) : null}
      </dl>
      {proposal.files.map((file) => (
        <DiffView key={file.path} file={file} />
      ))}
      <ul className="team-checks">
        {proposal.checks.map((check) => (
          <li key={check}>{check}</li>
        ))}
      </ul>
      {proposal.commitUrl ? (
        <p className="team-commit-link">
          Commit:{" "}
          <a href={proposal.commitUrl} target="_blank" rel="noreferrer" dir="ltr">
            {proposal.commitSha?.slice(0, 7)}
          </a>{" "}
          · {proposal.decidedBy}
        </p>
      ) : null}
      {proposal.status === "rejected" && proposal.decidedBy ? <p className="muted">رفضه {proposal.decidedBy}</p> : null}
      {proposal.error && proposal.status === "failed" ? <p className="team-error-text">{proposal.error}</p> : null}

      {open && mode === "idle" ? (
        <div className="team-proposal-actions">
          <button type="button" className="btn team-approve" onClick={() => setMode("approve")}>
            موافقة ونشر
          </button>
          <button type="button" className="btn ghost-btn team-reject" onClick={() => setMode("reject")}>
            رفض
          </button>
        </div>
      ) : null}

      {open && mode !== "idle" ? (
        <div className="team-confirm" role="dialog" aria-modal="false" aria-label="تأكيد القرار">
          {mode === "approve" ? (
            <>
              <p className="team-confirm-title">تأكيد الـ Commit — لا يحدث شيء قبل الضغط على «تأكيد»</p>
              <label className="team-radio">
                <input type="radio" checked={target === "feature"} onChange={() => setTarget("feature")} />
                فرع ميزة (موصى به — لا يعيد نشر Render)
              </label>
              {target === "feature" ? (
                <input
                  className="team-input"
                  dir="ltr"
                  value={branch}
                  onChange={(event) => setBranch(event.target.value)}
                  aria-label="اسم فرع الميزة"
                />
              ) : null}
              <label className="team-radio">
                <input type="radio" checked={target === "live"} onChange={() => setTarget("live")} />
                الفرع الحيّ <code dir="ltr">{proposal.baseBranch}</code> (Render يعيد النشر)
              </label>
              {target === "live" ? (
                <input
                  className="team-input"
                  dir="ltr"
                  placeholder={proposal.baseBranch}
                  value={typed}
                  onChange={(event) => setTyped(event.target.value)}
                  aria-label="اكتب اسم الفرع الحيّ للتأكيد"
                />
              ) : null}
              <label className="team-check">
                <input type="checkbox" checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} />
                راجعتُ الـ Diff وأوافق على تنفيذه باسمي.
              </label>
            </>
          ) : (
            <p className="team-confirm-title">رفض هذا الـ Diff؟ لن يحدث أي Commit.</p>
          )}
          <ApiErrorBanner errorAr={errorAr} />
          <div className="team-proposal-actions">
            <button type="button" className="btn team-approve" disabled={!canSubmit || busy} onClick={() => void submit()}>
              {busy ? "جارٍ التنفيذ…" : mode === "approve" ? "تأكيد الموافقة والنشر" : "تأكيد الرفض"}
            </button>
            <button type="button" className="btn ghost-btn" disabled={busy} onClick={() => setMode("idle")}>
              إلغاء
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
