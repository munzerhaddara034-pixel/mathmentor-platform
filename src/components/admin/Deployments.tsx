"use client";

import { useEffect, useState } from "react";
import { adminMessages } from "@/lib/i18n/ns/admin";
import { useI18n } from "@/components/i18n/I18nProvider";

type Status = "pending" | "approved" | "deploying" | "live" | "failed" | "rolled_back";
type Deployment = { id: string; target: "staging" | "production"; commit: string; reason: string; requestedBy: string; status: Status; approvedBy?: string; url?: string; error?: string; previousCommit?: string; createdAt: string; updatedAt: string };
type ApiResponse = { ok: boolean; deployments?: Deployment[]; canApprove?: boolean; error?: string; errorAr?: string };

export function Deployments() {
  const { locale } = useI18n();
  const t = adminMessages[locale].pages;
  const d = t.deployments;
  const [items, setItems] = useState<Deployment[]>([]);
  const [canOwner, setCanOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [target, setTarget] = useState<"staging" | "production">("staging");
  const [commit, setCommit] = useState("");
  const [reason, setReason] = useState("");

  async function load() {
    try {
      const response = await fetch("/api/admin/deployments", { credentials: "same-origin", cache: "no-store" });
      const data = await response.json() as ApiResponse;
      if (!response.ok || !data.ok) throw new Error();
      setItems(data.deployments ?? []);
      setCanOwner(Boolean(data.canApprove));
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); }, []);

  async function post(path: string, key: string) {
    setBusy(key); setNotice("");
    try {
      const response = await fetch(path, { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: "{}" });
      if (!response.ok) throw new Error();
      setNotice(d.success);
      await load();
    } catch {
      setNotice(d.actionFailed);
    } finally {
      setBusy("");
    }
  }
  async function requestDeployment(event: React.FormEvent) {
    event.preventDefault(); setBusy("request"); setNotice("");
    try {
      const response = await fetch("/api/admin/deployments", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ target, commit, reason }) });
      if (!response.ok) throw new Error();
      setCommit(""); setReason(""); setNotice(d.success); await load();
    } catch {
      setNotice(d.actionFailed);
    } finally {
      setBusy("");
    }
  }
  function statusLabel(status: Status) { return d.statuses[status]; }
  if (loading) return <p className="muted">{d.loading}</p>;
  if (failed) return <p role="alert" className="error">{d.failed}</p>;
  return <>
    <form className="card" onSubmit={(event) => void requestDeployment(event)} aria-label={d.request}>
      <h2>{d.request}</h2>
      <div className="grid two">
        <label>{d.target}<select value={target} onChange={(event) => setTarget(event.target.value as "staging" | "production")}><option value="staging">{d.staging}</option><option value="production">{d.production}</option></select></label>
        <label>{d.commit}<input value={commit} onChange={(event) => setCommit(event.target.value)} placeholder={d.commitPlaceholder} pattern="[a-fA-F0-9]{7,40}" required /></label>
      </div>
      <label>{d.reason}<textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder={d.reasonPlaceholder} required /></label>
      <div className="row"><button className="btn dark" type="submit" disabled={busy === "request"}>{busy === "request" ? d.requestWorking : d.submit}</button>{notice && <p role="status" className="muted">{notice}</p>}</div>
    </form>
    {!items.length ? <p className="muted">{d.empty}</p> : <section className="grid two" aria-label={d.title}>{items.slice().reverse().map((item) => <article className="card" key={item.id}>
      <p><span className={`badge ${item.status === "live" ? "approved" : item.status === "failed" ? "rejected" : item.status === "pending" ? "pending" : ""}`}>{statusLabel(item.status)}</span> <strong>{item.target === "staging" ? d.staging : d.production}</strong></p>
      <dl>
        <div><dt>{d.commit}</dt><dd><code>{item.commit}</code></dd></div>
        <div><dt>{d.reason}</dt><dd>{item.reason}</dd></div>
        <div><dt>{d.requester}</dt><dd>{item.requestedBy}</dd></div>
        <div><dt>{d.status}</dt><dd>{statusLabel(item.status)}</dd></div>
        {item.url && <div><dt>{d.url}</dt><dd><a href={item.url} target="_blank" rel="noreferrer">{item.url}</a></dd></div>}
      </dl>
      {item.error && <p role="alert" className="error">{d.actionFailed}</p>}
      {canOwner && item.status === "pending" && <button className="btn dark" type="button" disabled={busy === item.id} onClick={() => void post(`/api/admin/deployments/${encodeURIComponent(item.id)}/approve`, item.id)}>{busy === item.id ? d.working : d.approve}</button>}
      {canOwner && (item.status === "live" || item.status === "failed") && item.previousCommit && <button className="btn warn" type="button" disabled={busy === `${item.id}-rollback`} onClick={() => void post(`/api/admin/deployments/${encodeURIComponent(item.id)}/rollback`, `${item.id}-rollback`)}>{busy === `${item.id}-rollback` ? d.working : d.rollback}</button>}
    </article>)}</section>}
    {!canOwner && <p className="muted">{d.noOwner}</p>}
  </>;
}
