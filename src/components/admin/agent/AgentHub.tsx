"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SkeletonBlock } from "@/components/ui/Skeleton";
import { useI18n } from "@/components/i18n/I18nProvider";
import { fmt } from "@/lib/i18n/format";
import { agentMessages } from "@/lib/i18n/ns/agent";
import { AgentVoiceRecorder, type AgentVoiceClip } from "./AgentVoiceRecorder";
import { WhatsAppSetupAssistant } from "./WhatsAppSetupAssistant";
import {
  SecretarySchedule,
  type SecretaryAppointmentRow,
  type SecretaryReminderRow,
} from "./SecretarySchedule";
import {
  mapIntentToSection,
  scheduleScrollAndFlashSection,
  type AgentSectionTarget,
} from "./agentHubSections";

type Campaign = {
  id: string;
  title: string;
  audience: string;
  videoStatus: string;
  heygenVideoId?: string;
  demo: boolean;
  message: string;
  scripts: { ar: string; en: string; durationHintSec: number; hooks: string[] };
  socialLogs: Array<{ channel: string; status: string }>;
};

type VoiceTask = {
  id: string;
  whisperTranscript: string;
  intent: { kind: string; source: string };
  status: string;
  automatedReplyText: string;
  outboundWhatsApp?: {
    status: string;
    provider?: string;
    to?: string;
    error?: string;
    at?: string;
  };
};

type Health = {
  apiStatus: string;
  avgLatencyMs: number;
  notices: string[];
  keysPresent: { openai: boolean; heygen: boolean; gemini: boolean; whatsapp: boolean };
  recentErrors: Array<{ endpoint: string; statusCode: number; latencyMs: number }>;
};

type SchoolReportRow = {
  id: string;
  schoolName: string;
  completionRate: number;
  textSummary?: string;
  pdf?: { textSummary?: string };
  whishWalletPhone?: string;
  whishWalletNameAr?: string;
};

type ApprovalRow = {
  id: string;
  kind: string;
  state: string;
  titleAr: string;
  previewAr?: string;
  updatedAt?: string;
};

type EvolutionSnap = {
  id: string;
  beirutDate?: string;
  scores?: {
    voiceConversion?: number;
    approvalThroughput?: number;
    pedagogyHealth?: number;
    overall?: number;
  };
  failedTopics?: Array<{ topicAr: string; count: number }>;
  pendingApprovals?: number;
  optimizationsApplied?: number;
  recommendations?: Array<{ titleAr: string; impactScore: number }>;
  notices?: string[];
};

type Overview = {
  campaigns: Campaign[];
  voiceTasks: VoiceTask[];
  schoolReports: SchoolReportRow[];
  parentDigests: Array<{ id: string; studentName: string }>;
  health: Health | null;
  approvals?: ApprovalRow[];
  evolution?: EvolutionSnap | null;
  appointments?: SecretaryAppointmentRow[];
  reminders?: SecretaryReminderRow[];
};

type VoiceApiTask = {
  intent?: { kind?: string };
  whisperTranscript?: string;
  relatedIds?: string[];
  status?: string;
};

type VoiceSchoolReportPayload = {
  id: string;
  schoolName: string;
  completionRate: number;
  textSummary?: string;
  whishWalletPhone?: string;
  whishWalletNameAr?: string;
};

type VoiceApiResponse = {
  ok?: boolean;
  confirmationAr?: string;
  whatsappReply?: string;
  error?: string;
  errorAr?: string;
  task?: VoiceApiTask;
  campaign?: Campaign | null;
  schoolReport?: VoiceSchoolReportPayload | null;
};

type ResultStrip = {
  excerptAr: string;
  target: AgentSectionTarget;
};

const AUDIENCES = ["brevet", "terminale_gs", "terminale_ls", "parents", "schools", "general"] as const;

/** Demo partner schools (data: names stay as registered). */
const PARTNER_SCHOOLS = [
  { name: "مدرسة الأهلية النموذجية", code: "AHLIA", students: 120 },
  { name: "ثانوية الشريك التجريبية", code: "DEMO-LS", students: 85 },
  { name: "College Partner GS", code: "PART-GS", students: 64 },
];

function pickCampaignFromOverview(overview: Overview | null, ids: string[]): Campaign | null {
  if (!overview?.campaigns?.length || !ids.length) return null;
  const idSet = new Set(ids);
  return overview.campaigns.find((c) => idSet.has(c.id)) ?? overview.campaigns[0] ?? null;
}

function reportSummaryText(row: SchoolReportRow | VoiceSchoolReportPayload | null | undefined): string {
  if (!row) return "";
  if ("textSummary" in row && typeof row.textSummary === "string" && row.textSummary.trim()) {
    return row.textSummary.trim();
  }
  if ("pdf" in row && row.pdf?.textSummary?.trim()) return row.pdf.textSummary.trim();
  return "";
}

export function AgentHub() {
  const { locale } = useI18n();
  const t = agentMessages[locale];
  const [overview, setOverview] = useState<Overview | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [log, setLog] = useState("");
  const [relatedIds, setRelatedIds] = useState<string[]>([]);
  const [jumpTarget, setJumpTarget] = useState<AgentSectionTarget | null>(null);
  const [resultStrip, setResultStrip] = useState<ResultStrip | null>(null);
  const [flashTick, setFlashTick] = useState(0);
  const flashSkipMount = useRef(true);
  const [transcript, setTranscript] = useState(
    "أنشئ فيديو تسويقي لترمينال علوم عامة عن قلق الامتحان وأخطاء الباريم في المشتقات والمقاربات",
  );
  const [audience, setAudience] = useState("terminale_gs");
  const [schoolName, setSchoolName] = useState(PARTNER_SCHOOLS[0].name);
  const [campaignPreview, setCampaignPreview] = useState<Campaign | null>(null);
  const [schoolReportPanel, setSchoolReportPanel] = useState<string>("");

  const refresh = useCallback(async (opts?: { preserveLog?: boolean }): Promise<Overview | null> => {
    try {
      const res = await fetch("/api/agent/health", { credentials: "include" });
      const json = (await res.json()) as {
        ok?: boolean;
        health?: Health;
        overview?: Partial<Overview>;
        error?: string;
      };
      if (!res.ok || !json.ok) {
        if (!opts?.preserveLog) {
          setLog(json.error || `Health ${res.status}`);
        }
        return null;
      }
      const next: Overview = {
        campaigns: json.overview?.campaigns ?? [],
        voiceTasks: json.overview?.voiceTasks ?? [],
        schoolReports: json.overview?.schoolReports ?? [],
        parentDigests: json.overview?.parentDigests ?? [],
        health: json.health ?? json.overview?.health ?? null,
        approvals: (json.overview as Overview | undefined)?.approvals ?? [],
        evolution: (json.overview as Overview | undefined)?.evolution ?? null,
        appointments: (json.overview as Overview | undefined)?.appointments ?? [],
        reminders: (json.overview as Overview | undefined)?.reminders ?? [],
      };
      setOverview(next);
      return next;
    } catch (error) {
      if (!opts?.preserveLog) {
        setLog(error instanceof Error ? error.message : "refresh failed");
      }
      return null;
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function revealSection(target: AgentSectionTarget | null) {
    if (!target) return;
    scheduleScrollAndFlashSection(target.sectionId, { delayMs: 80 });
  }

  useEffect(() => {
    if (flashSkipMount.current) {
      flashSkipMount.current = false;
      return;
    }
    if (!jumpTarget || flashTick === 0) return;
    scheduleScrollAndFlashSection(jumpTarget.sectionId, { delayMs: 220 });
  }, [flashTick, jumpTarget, overview, campaignPreview, schoolReportPanel]);

  async function runVoice(opts?: { file?: File | null; clip?: AgentVoiceClip | null; live?: boolean }) {
    setBusy("voice");
    setLog(opts?.live || opts?.clip ? t.voice.analysing : "");
    setRelatedIds([]);
    setJumpTarget(null);
    setResultStrip(null);
    try {
      let res: Response;
      if (opts?.clip) {
        const form = new FormData();
        form.set("file", opts.clip.blob, opts.clip.filename);
        form.set("mimeType", opts.clip.mimeType);
        form.set("source", "live-mic");
        res = await fetch("/api/agent/whatsapp-voice", {
          method: "POST",
          credentials: "include",
          body: form,
        });
      } else if (opts?.file) {
        const form = new FormData();
        form.set("file", opts.file);
        form.set("transcript", transcript);
        res = await fetch("/api/agent/whatsapp-voice", {
          method: "POST",
          credentials: "include",
          body: form,
        });
      } else {
        res = await fetch("/api/agent/whatsapp-voice", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcript, demo: true }),
        });
      }
      const json = (await res.json()) as VoiceApiResponse;
      const httpOk = res.ok;
      const hasTask = Boolean(json.task);
      // Treat as success when HTTP ok + task present; do not drop jumpTarget on soft error fields.
      const succeeded = httpOk && hasTask && json.ok !== false;
      const intentKind = json.task?.intent?.kind;
      const ids = Array.isArray(json.task?.relatedIds)
        ? json.task.relatedIds.filter((id): id is string => typeof id === "string" && id.length > 0)
        : [];
      // Fall back: marketing ids imply generate_video section even if intent string is odd.
      const sectionTarget =
        mapIntentToSection(intentKind) ??
        (ids.some((id) => id.startsWith("mkt-"))
          ? mapIntentToSection("generate_video")
          : null);

      const confirmation =
        json.confirmationAr || json.whatsappReply || json.errorAr || json.error || "";
      const intentLine = intentKind ? fmt(t.voice.intent, { v: intentKind }) : "";
      const transcriptLine = json.task?.whisperTranscript
        ? fmt(t.voice.transcript, { v: json.task.whisperTranscript.slice(0, 220) })
        : "";
      const relatedLine = ids.length ? fmt(t.voice.ids, { v: ids.join(", ") }) : "";

      setLog(
        [confirmation, intentLine, transcriptLine, relatedLine].filter(Boolean).join("\n") ||
          JSON.stringify(json).slice(0, 400),
      );
      setRelatedIds(ids);

      // Always set jumpTarget on voice success with a mapped section — never leave Output without CTA.
      if (succeeded && sectionTarget) {
        setJumpTarget(sectionTarget);
      } else {
        setJumpTarget(null);
      }

      const fresh = await refresh({ preserveLog: true });

      const wantsCampaign =
        intentKind === "generate_video" ||
        Boolean(json.campaign) ||
        ids.some((id) => id.startsWith("mkt-"));
      if (succeeded && wantsCampaign) {
        const fromApi = json.campaign ?? null;
        const fromOverview = pickCampaignFromOverview(fresh, ids);
        const campaign = fromApi ?? fromOverview;
        if (campaign) {
          setCampaignPreview(campaign);
        }
      }

      if (succeeded && (intentKind === "school_report" || sectionTarget?.sectionId === "agent-school-dispatcher")) {
        const fromApi = json.schoolReport;
        const matched =
          fromApi ??
          (ids.length
            ? fresh?.schoolReports.find((r) => ids.includes(r.id))
            : fresh?.schoolReports[0]) ??
          null;
        const summary =
          reportSummaryText(fromApi) ||
          reportSummaryText(matched) ||
          confirmation.slice(0, 480);
        if (summary) setSchoolReportPanel(summary);
      }

      if (succeeded && sectionTarget) {
        const excerptAr = (confirmation || t.voice.done).slice(0, 220);
        setResultStrip({ excerptAr, target: sectionTarget });
        setFlashTick((n) => n + 1);
        // Direct schedule — do not rely only on the flashTick effect (React refresh races).
        scheduleScrollAndFlashSection(sectionTarget.sectionId, { delayMs: 280 });
      }
    } catch (error) {
      setLog(error instanceof Error ? error.message : t.voice.failed);
      setRelatedIds([]);
      setJumpTarget(null);
      setResultStrip(null);
    } finally {
      setBusy(null);
    }
  }

  function onLiveClip(clip: AgentVoiceClip) {
    void runVoice({ clip, live: true });
  }

  async function runCampaign() {
    setBusy("campaign");
    setLog("");
    setRelatedIds([]);
    setJumpTarget(null);
    setResultStrip(null);
    try {
      const res = await fetch("/api/agent/marketing-video", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audience, language: "ar", autoPostApproved: false }),
      });
      const json = (await res.json()) as { campaign?: Campaign; notice?: string; error?: string };
      if (json.campaign) setCampaignPreview(json.campaign);
      setLog(json.notice || json.error || t.campaign.queued);
      await refresh();
    } catch (error) {
      setLog(error instanceof Error ? error.message : t.campaign.failed);
    } finally {
      setBusy(null);
    }
  }

  async function runSchoolReport() {
    setBusy("report");
    setLog("");
    setRelatedIds([]);
    setJumpTarget(null);
    setResultStrip(null);
    try {
      const res = await fetch("/api/agent/generate-report", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "school", schoolName }),
      });
      const json = (await res.json()) as {
        textSummary?: string;
        report?: { pdf?: { textSummary?: string }; whishWalletPhone?: string; whishWalletNameAr?: string };
        whish?: { phone: string; nameAr: string };
        error?: string;
      };
      const summary = json.textSummary || json.report?.pdf?.textSummary || "";
      const whishLine = json.whish
        ? `Whish ${json.whish.phone} · ${json.whish.nameAr}`
        : json.report?.whishWalletPhone
          ? `Whish ${json.report.whishWalletPhone} · ${json.report.whishWalletNameAr ?? ""}`
          : "";
      const combined = [summary, whishLine, json.error].filter(Boolean).join("\n");
      setLog(combined);
      if (summary) setSchoolReportPanel(summary);
      await refresh();
    } catch (error) {
      setLog(error instanceof Error ? error.message : t.schools.reportFailed);
    } finally {
      setBusy(null);
    }
  }

  async function runParentDigest() {
    setBusy("parent");
    setLog("");
    setRelatedIds([]);
    setJumpTarget(null);
    setResultStrip(null);
    try {
      const res = await fetch("/api/agent/generate-report", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "parent", studentName: "مايا" }),
      });
      const json = (await res.json()) as {
        whatsappAr?: string;
        digest?: { whatsapp?: { bodyAr?: string } };
        error?: string;
      };
      setLog(json.whatsappAr || json.digest?.whatsapp?.bodyAr || json.error || t.schools.digestOk);
      await refresh();
    } catch (error) {
      setLog(error instanceof Error ? error.message : t.schools.digestFailed);
    } finally {
      setBusy(null);
    }
  }

  async function actApproval(id: string, action: "approve" | "reject") {
    setBusy(`appr-${id}`);
    try {
      const res = await fetch("/api/agent/approvals", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string; approval?: ApprovalRow };
      setLog(
        json.ok
          ? fmt(action === "approve" ? t.approvals.approved : t.approvals.rejected, { title: json.approval?.titleAr || id })
          : json.error || t.approvals.failed,
      );
      await refresh({ preserveLog: true });
    } catch (error) {
      setLog(error instanceof Error ? error.message : t.approvals.failed);
    } finally {
      setBusy(null);
    }
  }

  async function runWeeklyBrief() {
    setBusy("brief");
    try {
      const res = await fetch("/api/agent/weekly-brief", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: true, notifyWhatsApp: true }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        briefAr?: string;
        outbound?: { status?: string };
      };
      setLog(json.briefAr || json.error || t.evolution.briefOk);
      await refresh({ preserveLog: true });
    } catch (error) {
      setLog(error instanceof Error ? error.message : t.evolution.briefFailed);
    } finally {
      setBusy(null);
    }
  }

  const health = overview?.health;
  const showRecentVoice =
    Boolean(overview?.voiceTasks?.length) || jumpTarget?.sectionId === "agent-recent-voice";

  const outputCard =
    log ? (
      <section
        className={`card agent-panel agent-log${jumpTarget ? " agent-log-sticky" : ""}`}
        aria-live="polite"
      >
        <h2>{t.output}</h2>
        <pre dir="auto">{log}</pre>
        {relatedIds.length ? (
          <p className="agent-related-ids muted" dir="ltr">
            relatedIds: {relatedIds.join(" · ")}
          </p>
        ) : null}
        {jumpTarget ? (
          <div className="agent-log-actions">
            <button
              type="button"
              className="btn agent-result-primary-btn"
              onClick={() => revealSection(jumpTarget)}
            >
              {t.voice.showResult}
            </button>
            <button
              type="button"
              className="btn ghost-btn agent-jump-btn"
              onClick={() => revealSection(jumpTarget)}
            >
              {t.jump[jumpTarget.jumpKey]}
            </button>
          </div>
        ) : null}
      </section>
    ) : null;

  return (
    <div className="agent-hub" data-theme="dark">
      <WhatsAppSetupAssistant />

      <section className="card agent-panel">
        <h2>{t.voice.title}</h2>
        <p className="muted">{t.voice.lead}</p>
        <textarea
          className="agent-textarea"
          dir="rtl"
          lang="ar"
          rows={3}
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          aria-label={t.voice.transcriptLabel}
        />
        <div className="agent-actions">
          <AgentVoiceRecorder disabled={busy === "voice"} onRecorded={onLiveClip} />
          <label className="btn ghost-btn">
            {t.voice.upload}
            <input
              type="file"
              accept="audio/*,video/webm"
              hidden
              onChange={(e) => void runVoice({ file: e.target.files?.[0] ?? null })}
            />
          </label>
          <button type="button" className="btn" disabled={busy === "voice"} onClick={() => void runVoice()}>
            {busy === "voice" ? "…" : t.voice.runDemo}
          </button>
        </div>
        {busy === "voice" ? (
          <div className="agent-voice-busy" aria-busy="true">
            <SkeletonBlock lines={2} label={t.voice.analysing} />
            <p className="muted">{t.voice.analysing}</p>
          </div>
        ) : null}
      </section>

      {resultStrip ? (
        <section
          className="card agent-panel agent-result-strip"
          aria-live="polite"
        >
          <p className="agent-result-excerpt" dir="auto">
            {resultStrip.excerptAr}
          </p>
          <button
            type="button"
            className="btn agent-result-primary-btn"
            onClick={() => revealSection(resultStrip.target)}
          >
            {t.voice.showResult}
          </button>
        </section>
      ) : null}

      {outputCard}

      <section id="agent-campaign-studio" className="card agent-panel">
        <h2>{t.campaign.title}</h2>
        <label className="agent-label">
          {t.campaign.audience}
          <select value={audience} onChange={(e) => setAudience(e.target.value)}>
            {AUDIENCES.map((id) => (
              <option key={id} value={id}>
                {t.campaign.audiences[id]}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn" disabled={busy === "campaign"} onClick={() => void runCampaign()}>
          {busy === "campaign" ? "…" : t.campaign.run}
        </button>
        {campaignPreview ? (
          <div className="agent-preview">
            <p>
              <strong>{campaignPreview.title}</strong> · {campaignPreview.videoStatus}
              {campaignPreview.demo ? ` · ${t.campaign.demo}` : ""}
            </p>
            <p dir="rtl" lang="ar">
              {campaignPreview.scripts.ar}
            </p>
            <p dir="ltr">{campaignPreview.scripts.en}</p>
            <p className="muted">
              HeyGen: {campaignPreview.heygenVideoId || "—"} · {t.campaign.social}:{" "}
              {campaignPreview.socialLogs.map((s) => `${s.channel}:${s.status}`).join(" · ")}
            </p>
          </div>
        ) : null}
      </section>

      <section id="agent-school-dispatcher" className="card agent-panel">
        <h2>{t.schools.title}</h2>
        <ul className="agent-school-list">
          {PARTNER_SCHOOLS.map((s) => (
            <li key={s.code}>
              <button type="button" className="ghost-btn" onClick={() => setSchoolName(s.name)}>
                {s.name}
              </button>
              <span className="muted">
                {s.code} · {fmt(t.schools.students, { n: s.students })}
              </span>
            </li>
          ))}
        </ul>
        <p className="muted">{fmt(t.schools.whishOnly, { phone: "96170772968" })}</p>
        <div className="agent-actions">
          <button type="button" className="btn" disabled={busy === "report"} onClick={() => void runSchoolReport()}>
            {busy === "report" ? "…" : fmt(t.schools.report, { name: schoolName })}
          </button>
          <button
            type="button"
            className="btn ghost-btn"
            disabled={busy === "parent"}
            onClick={() => void runParentDigest()}
          >
            {t.schools.parentDigest}
          </button>
        </div>
        {schoolReportPanel ? (
          <div className="agent-preview agent-school-report-panel">
            <strong>{t.schools.lastReport}</strong>
            <pre dir="auto">{schoolReportPanel}</pre>
          </div>
        ) : null}
        {overview?.schoolReports?.length ? (
          <ul className="muted">
            {overview.schoolReports.slice(0, 4).map((r) => (
              <li key={r.id}>
                {r.schoolName} · {Math.round(r.completionRate * 100)}%
              </li>
            ))}
          </ul>
        ) : null}
      </section>


      <SecretarySchedule
        appointments={overview?.appointments}
        reminders={overview?.reminders}
      />

      <section id="agent-staged-approvals" className="card agent-panel">
        <h2>{t.approvals.title}</h2>
        <p className="muted">{fmt(t.approvals.lead, { phone: "96176532421" })}</p>
        {overview?.approvals?.filter((a) => a.state === "AWAITING_APPROVAL" || a.state === "DRAFTED").length ? (
          <table className="agent-table">
            <thead>
              <tr>
                <th>{t.approvals.colTitle}</th>
                <th>{t.approvals.colKind}</th>
                <th>{t.approvals.colState}</th>
                <th>{t.approvals.colAction}</th>
              </tr>
            </thead>
            <tbody>
              {overview.approvals
                .filter((a) => a.state === "AWAITING_APPROVAL" || a.state === "DRAFTED")
                .slice(0, 10)
                .map((a) => (
                  <tr key={a.id}>
                    <td dir="auto">
                      <strong>{a.titleAr}</strong>
                      <div className="muted" style={{ fontSize: "0.8em" }}>
                        {a.id}
                      </div>
                    </td>
                    <td>{a.kind}</td>
                    <td>{a.state}</td>
                    <td>
                      <div className="agent-actions">
                        <button
                          type="button"
                          className="btn"
                          disabled={busy === `appr-${a.id}`}
                          onClick={() => void actApproval(a.id, "approve")}
                        >
                          {t.approvals.approve}
                        </button>
                        <button
                          type="button"
                          className="btn ghost-btn"
                          disabled={busy === `appr-${a.id}`}
                          onClick={() => void actApproval(a.id, "reject")}
                        >
                          {t.approvals.reject}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        ) : (
          <p className="muted">{t.approvals.none}</p>
        )}
      </section>

      <section id="agent-self-evolution" className="card agent-panel">
        <h2>{t.evolution.title}</h2>
        <p className="muted">{t.evolution.lead}</p>
        {overview?.evolution?.scores ? (
          <>
            <ul className="agent-keys">
              <li>
                {t.evolution.overall}: <strong>{overview.evolution.scores.overall ?? "—"}</strong>/100
              </li>
              <li>
                {t.evolution.voiceConversion}: {overview.evolution.scores.voiceConversion ?? "—"}
              </li>
              <li>
                {t.evolution.approvals}: {overview.evolution.scores.approvalThroughput ?? "—"}
              </li>
              <li>
                {t.evolution.pedagogy}: {overview.evolution.scores.pedagogyHealth ?? "—"}
              </li>
              <li>
                {t.evolution.pending}: {overview.evolution.pendingApprovals ?? 0}
              </li>
              <li>
                {t.evolution.deployed}: {overview.evolution.optimizationsApplied ?? 0}
              </li>
            </ul>
            {overview.evolution.failedTopics?.length ? (
              <p className="muted">
                {t.evolution.failedTopics}{" "}
                {overview.evolution.failedTopics.map((topic) => `${topic.topicAr}(${topic.count})`).join(" · ")}
              </p>
            ) : null}
            {overview.evolution.recommendations?.length ? (
              <ul>
                {overview.evolution.recommendations.slice(0, 3).map((r) => (
                  <li key={r.titleAr} dir="auto">
                    {r.titleAr} · {fmt(t.evolution.impact, { n: r.impactScore })}
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        ) : (
          <p className="muted">{t.evolution.none}</p>
        )}
        <button type="button" className="btn" disabled={busy === "brief"} onClick={() => void runWeeklyBrief()}>
          {busy === "brief" ? "…" : t.evolution.runBrief}
        </button>
      </section>

      <section id="agent-platform-health" className="card agent-panel">
        <h2>{t.health.title}</h2>
        {health ? (
          <>
            <p>
              {fmt(t.health.status, { status: health.apiStatus, ms: health.avgLatencyMs })}
            </p>
            <ul className="agent-keys">
              <li>OpenAI: {health.keysPresent.openai ? "✓" : t.health.demo}</li>
              <li>HeyGen: {health.keysPresent.heygen ? "✓" : t.health.demo}</li>
              <li>Gemini: {health.keysPresent.gemini ? "✓" : t.health.demo}</li>
              <li>WhatsApp: {health.keysPresent.whatsapp ? "✓" : t.health.outbox}</li>
            </ul>
            <table className="agent-table">
              <thead>
                <tr>
                  <th>{t.health.endpoint}</th>
                  <th>{t.health.code}</th>
                  <th>ms</th>
                </tr>
              </thead>
              <tbody>
                {health.recentErrors.map((row) => (
                  <tr key={`${row.endpoint}-${row.statusCode}-${row.latencyMs}`}>
                    <td>{row.endpoint}</td>
                    <td>{row.statusCode}</td>
                    <td>{row.latencyMs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ul className="muted">
              {health.notices.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </>
        ) : (
          <SkeletonBlock lines={3} label={t.health.loading} />
        )}
        <button
          type="button"
          className="btn ghost-btn"
          onClick={() => {
            void (async () => {
              setBusy("health");
              try {
                const res = await fetch("/api/agent/health?notifyWhatsApp=1", {
                  credentials: "include",
                });
                const json = (await res.json()) as {
                  ok?: boolean;
                  error?: string;
                  whatsappReply?: string;
                  outboundWhatsApp?: { status?: string; provider?: string; to?: string };
                };
                if (!res.ok || !json.ok) {
                  setLog(json.error || `Health ${res.status}`);
                } else {
                  const wa = json.outboundWhatsApp;
                  setLog(
                    [
                      json.whatsappReply || t.health.checked,
                      wa
                        ? `WhatsApp: ${wa.status || "—"}${wa.provider ? ` · ${wa.provider}` : ""}${wa.to ? ` · ${wa.to}` : ""}`
                        : "",
                    ]
                      .filter(Boolean)
                      .join("\n"),
                  );
                  await refresh({ preserveLog: true });
                }
              } catch (error) {
                setLog(error instanceof Error ? error.message : t.health.failed);
              } finally {
                setBusy(null);
              }
            })();
          }}
        >
          {t.health.refresh}
        </button>
      </section>

      {showRecentVoice ? (
        <section id="agent-recent-voice" className="card agent-panel">
          <h2>{t.recent.title}</h2>
          {overview?.voiceTasks?.length ? (
            <ul>
              {overview.voiceTasks.slice(0, 6).map((task) => (
                <li key={task.id}>
                  <strong>{task.intent.kind}</strong> · {task.status} ·{" "}
                  <span dir="auto">{task.whisperTranscript.slice(0, 80)}</span>
                  {task.outboundWhatsApp ? (
                    <div className="muted" style={{ fontSize: "0.85em", marginTop: 4 }}>
                      {t.recent.outbound} <strong>{task.outboundWhatsApp.status}</strong>
                      {task.outboundWhatsApp.provider ? ` · ${task.outboundWhatsApp.provider}` : ""}
                      {task.outboundWhatsApp.to ? ` · ${fmt(t.recent.to, { v: task.outboundWhatsApp.to })}` : ""}
                      {task.outboundWhatsApp.error ? ` · ${task.outboundWhatsApp.error}` : ""}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">{t.recent.none}</p>
          )}
        </section>
      ) : null}
    </div>
  );
}
