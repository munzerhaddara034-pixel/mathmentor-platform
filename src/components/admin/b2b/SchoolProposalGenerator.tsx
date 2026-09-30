"use client";

import { useState } from "react";
import { ApiErrorBanner, SkeletonBlock } from "@/components/ui/Skeleton";
import { useNs } from "@/components/i18n/useNs";
import { fmt } from "@/lib/i18n/format";
import { b2bMessages } from "@/lib/i18n/ns/b2b";

type Curriculum = "Lebanese" | "International";

type ProposalPayload = {
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyHtml: string;
  source: "gemini" | "template";
  quote: {
    students: number;
    perStudent: number;
    monthlyTotal: number;
    yearlyTotal: number;
  };
  schoolName: string;
  curriculum: Curriculum;
};

export function SchoolProposalGenerator() {
  const t = useNs(b2bMessages).proposal;
  const [schoolName, setSchoolName] = useState("");
  const [studentCount, setStudentCount] = useState(30);
  const [curriculum, setCurriculum] = useState<Curriculum>("Lebanese");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [errorAr, setErrorAr] = useState<string>();
  const [proposal, setProposal] = useState<ProposalPayload | null>(null);

  async function generate() {
    setLoading(true);
    setError(undefined);
    setErrorAr(undefined);
    try {
      const res = await fetch("/api/admin/b2b/proposal", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schoolName, studentCount, curriculum }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        proposal?: ProposalPayload;
        error?: string;
        errorAr?: string;
      };
      if (!res.ok || !json.ok || !json.proposal) {
        setError(json.error || t.failed);
        setErrorAr(json.errorAr);
        return;
      }
      setProposal(json.proposal);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.failed);
    } finally {
      setLoading(false);
    }
  }

  function printProposal() {
    window.print();
  }

  return (
    <section className="card b2b-section mm-mobile-stack" aria-labelledby="b2b-proposal-title">
      <h2 id="b2b-proposal-title">{t.title}</h2>
      <p className="muted">{t.lead}</p>

      <div className="b2b-form-grid no-print">
        <label>
          {t.school}
          <input
            value={schoolName}
            onChange={(e) => setSchoolName(e.target.value)}
            placeholder={t.schoolPlaceholder}
            dir="auto"
          />
        </label>
        <label>
          {t.students}
          <input
            type="number"
            min={1}
            max={5000}
            value={studentCount}
            onChange={(e) => setStudentCount(Number(e.target.value) || 0)}
          />
        </label>
        <label>
          {t.curriculum}
          <select
            value={curriculum}
            onChange={(e) => setCurriculum(e.target.value as Curriculum)}
          >
            <option value="Lebanese">{t.lebanese}</option>
            <option value="International">{t.international}</option>
          </select>
        </label>
        <div className="row" style={{ alignItems: "end" }}>
          <button type="button" className="btn" onClick={() => void generate()} disabled={loading || !schoolName.trim()}>
            {t.generate}
          </button>
          {proposal ? (
            <button type="button" className="ghost-btn" onClick={printProposal}>
              {t.print}
            </button>
          ) : null}
        </div>
      </div>

      {loading ? <SkeletonBlock lines={5} label={t.loading} /> : null}
      <ApiErrorBanner error={error} errorAr={errorAr} />

      {proposal ? (
        <div className="b2b-proposal-print print-sheet">
          <p className="muted no-print">
            {fmt(t.source, {
              source: proposal.source === "gemini" ? "Gemini" : t.sourceTemplate,
              total: proposal.quote.monthlyTotal,
              students: proposal.quote.students,
              per: proposal.quote.perStudent,
            })}
          </p>
          <div
            className="paper b2b-proposal-paper"
            dangerouslySetInnerHTML={{ __html: proposal.bodyHtml }}
          />
          <details className="no-print" style={{ marginTop: 12 }}>
            <summary>{t.raw}</summary>
            <pre className="b2b-pre" dir="rtl" lang="ar">
              {proposal.bodyAr}
            </pre>
          </details>
        </div>
      ) : null}
    </section>
  );
}
