"use client";

import { useEffect, useState } from "react";
import { adminMessages } from "@/lib/i18n/ns/admin";
import { teamMessages } from "@/lib/i18n/ns/team";
import { useI18n } from "@/components/i18n/I18nProvider";

const AGENTS = ["mohamed", "sami", "developer", "finance"] as const;
type AgentId = (typeof AGENTS)[number];
type HealthAgent = {
  agent: AgentId;
  successCount: number;
  failureCount: number;
  escalationCount: number;
  medianDurationMs: number;
  webSearch: { totalCount: number; successCount: number; failureCount: number; resultCount: number };
  recent: Array<{ at: string; outcome: "success" | "failed"; durationMs: number; verified: boolean; escalation: boolean; failure?: string; tools: string[] }>;
  memorySummaries: Array<{ at: string; outcome: "success" | "failed"; verified: boolean; summary: string; tools: string[] }>;
};
type HealthResponse = {
  ok: true;
  agents: HealthAgent[];
  webSearch: {
    totalCount: number;
    successCount: number;
    failureCount: number;
    resultCount: number;
    lastFailures: Array<{ at: string; agent: string; query: string; reason?: string; durationMs: number }>;
  };
};

type AdminPages = typeof adminMessages.en.pages;
type TeamAgentNames = typeof teamMessages.en.agents;

function WebResearchHealth({ data, t }: { data: HealthResponse["webSearch"]; t: AdminPages }) {
  return (
    <article className="card" style={{ marginTop: 20 }}>
      <h2>{t.teamHealthWebTitle}</h2>
      <dl className="health-summary">
        <div><dt>{t.teamHealthWebTotal}</dt><dd>{data.totalCount}</dd></div>
        <div><dt>{t.teamHealthWebSuccess}</dt><dd>{data.successCount}</dd></div>
        <div><dt>{t.teamHealthWebFailed}</dt><dd>{data.failureCount}</dd></div>
        <div><dt>{t.teamHealthWebResults}</dt><dd>{data.resultCount}</dd></div>
      </dl>
      <h3>{t.teamHealthWebFailures}</h3>
      {data.lastFailures.length ? (
        <ul>{data.lastFailures.map((record, index) => <li key={`${record.at}-${index}`}><time dateTime={record.at}>{record.at}</time> · {record.agent} · {record.query}{record.reason ? ` — ${record.reason}` : ""}</li>)}</ul>
      ) : <p className="muted">{t.teamHealthWebNoFailures}</p>}
    </article>
  );
}

function AgentHealthCard({ item, names, t }: { item: HealthAgent; names: TeamAgentNames; t: AdminPages }) {
  return (
    <article className="card">
      <h2>{names[item.agent]}</h2>
      <dl className="health-summary">
        <div><dt>{t.teamHealthSuccess}</dt><dd>{item.successCount}</dd></div>
        <div><dt>{t.teamHealthFailed}</dt><dd>{item.failureCount}</dd></div>
        <div><dt>{t.teamHealthEscalations}</dt><dd>{item.escalationCount}</dd></div>
        <div><dt>{t.teamHealthMedian}</dt><dd>{item.medianDurationMs} {t.teamHealthMs}</dd></div>
        <div><dt>{t.teamHealthWebTotal}</dt><dd>{item.webSearch.totalCount}</dd></div>
      </dl>
      <section>
        <h3>{t.teamHealthRecent}</h3>
        {item.recent.length ? <ul>{item.recent.map((record, index) => <li key={`${record.at}-${index}`}><time dateTime={record.at}>{record.at}</time> · {record.outcome === "failed" ? t.teamHealthFailure : t.teamHealthVerification}{record.escalation ? ` · ${t.teamHealthEscalated}` : ""}{record.failure ? ` — ${record.failure}` : ""}</li>)}</ul> : <p className="muted">{t.teamHealthNoRecent}</p>}
      </section>
      <section>
        <h3>{t.teamHealthMemory}</h3>
        {item.memorySummaries.length ? <ul>{item.memorySummaries.map((summary, index) => <li key={`${summary.at}-${index}`}><time dateTime={summary.at}>{summary.at}</time> · {summary.summary}</li>)}</ul> : <p className="muted">{t.teamHealthNoMemory}</p>}
      </section>
    </article>
  );
}

export function TeamHealth() {
  const { locale } = useI18n();
  const t = adminMessages[locale].pages;
  const names = teamMessages[locale].agents;
  const [data, setData] = useState<HealthResponse | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    void fetch("/api/admin/team/health", { credentials: "same-origin", cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(String(response.status));
        return (await response.json()) as HealthResponse;
      })
      .then((next) => { if (active) setData(next); })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, []);

  if (!data) return <p className="muted">{failed ? t.teamHealthLoadFailed : t.teamHealthLoading}</p>;
  return <><WebResearchHealth data={data.webSearch} t={t} /><div className="grid two" style={{ marginTop: 20 }}>{data.agents.map((item) => <AgentHealthCard key={item.agent} item={item} names={names} t={t} />)}</div></>;
}
