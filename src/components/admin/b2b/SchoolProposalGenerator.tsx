"use client";

import { useState } from "react";
import { ApiErrorBanner, SkeletonBlock } from "@/components/ui/Skeleton";

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
        setError(json.error || "Proposal generation failed.");
        setErrorAr(json.errorAr);
        return;
      }
      setProposal(json.proposal);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Proposal generation failed.");
    } finally {
      setLoading(false);
    }
  }

  function printProposal() {
    window.print();
  }

  return (
    <section className="card b2b-section mm-mobile-stack" aria-labelledby="b2b-proposal-title">
      <h2 id="b2b-proposal-title">مولّد عرض المدارس / School proposal</h2>
      <p className="muted" dir="rtl" lang="ar">
        عرض رسمي قابل للطباعة — خصومات، ميزات تفاعلية، دور المنصة في نجاح الامتحان، وتسعير B2B. العلامة: الأستاذ منذر
        حداره فقط.
      </p>

      <div className="b2b-form-grid no-print">
        <label>
          اسم المدرسة / School name
          <input
            value={schoolName}
            onChange={(e) => setSchoolName(e.target.value)}
            placeholder="مثال: ثانوية الأهلية"
            dir="auto"
          />
        </label>
        <label>
          عدد طلاب الشهادة / Certificate students
          <input
            type="number"
            min={1}
            max={5000}
            value={studentCount}
            onChange={(e) => setStudentCount(Number(e.target.value) || 0)}
          />
        </label>
        <label>
          المنهج / Curriculum
          <select
            value={curriculum}
            onChange={(e) => setCurriculum(e.target.value as Curriculum)}
          >
            <option value="Lebanese">Lebanese · لبناني</option>
            <option value="International">International · دولي</option>
          </select>
        </label>
        <div className="row" style={{ alignItems: "end" }}>
          <button type="button" className="btn" onClick={() => void generate()} disabled={loading || !schoolName.trim()}>
            توليد العرض
          </button>
          {proposal ? (
            <button type="button" className="ghost-btn" onClick={printProposal}>
              طباعة / Print
            </button>
          ) : null}
        </div>
      </div>

      {loading ? <SkeletonBlock lines={5} label="Generating proposal" /> : null}
      <ApiErrorBanner error={error} errorAr={errorAr} />

      {proposal ? (
        <div className="b2b-proposal-print print-sheet">
          <p className="muted no-print">
            المصدر: {proposal.source === "gemini" ? "Gemini" : "قالب عربي قوي"} · عرض B2B ≈ $
            {proposal.quote.monthlyTotal}/شهر ({proposal.quote.students} × ${proposal.quote.perStudent})
          </p>
          <div
            className="paper b2b-proposal-paper"
            dangerouslySetInnerHTML={{ __html: proposal.bodyHtml }}
          />
          <details className="no-print" style={{ marginTop: 12 }}>
            <summary>النص الخام (AR)</summary>
            <pre className="b2b-pre" dir="rtl" lang="ar">
              {proposal.bodyAr}
            </pre>
          </details>
        </div>
      ) : null}
    </section>
  );
}
