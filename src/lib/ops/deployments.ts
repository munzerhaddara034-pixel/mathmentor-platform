import { createId } from "@/lib/ids";
import { readJsonFile, updateJsonFile } from "@/lib/dataDir";
import { redactSecrets } from "@/lib/team/secrets";
import { canApprove } from "@/lib/team/canApprove";
import type { TeamActor } from "@/lib/team/agents";
import { teamMessages } from "@/lib/i18n/ns/team";

export type DeployTarget = "staging" | "production";
export type DeployStatus = "pending" | "approved" | "deploying" | "live" | "failed" | "rolled_back";
export type DeploymentRecord = {
  id: string;
  target: DeployTarget;
  commit: string;
  reason: string;
  requestedBy: string;
  status: DeployStatus;
  approvedBy?: string;
  renderDeployId?: string;
  url?: string;
  error?: string;
  previousCommit?: string;
  createdAt: string;
  updatedAt: string;
};
export type DeploymentAudit = {
  id: string;
  deploymentId: string;
  action: "requested" | "approved" | "deploying" | "live" | "failed" | "rolled_back";
  target: DeployTarget;
  commit?: string;
  previousCommit?: string;
  actor: string;
  status: DeployStatus;
  renderDeployId?: string;
  error?: string;
  createdAt: string;
};

type Store = { deployments?: DeploymentRecord[]; deploymentAudits?: DeploymentAudit[] };
type RenderDeploy = { id?: unknown; status?: unknown; url?: unknown; service?: { url?: unknown }; commit?: { id?: unknown } };

type OverrideActor = TeamActor | ((actor: TeamActor) => TeamActor);
let fetchOverride: typeof fetch | undefined;
let actorOverride: OverrideActor | undefined;

export const DEPLOYMENT_STORE = "ops-deployments.json";
export const DEPLOYMENT_LIMIT = 240;
export const DEPLOYMENT_AUDIT_LIMIT = 480;

/** Test-only hooks mirror the PR-draft store; production never sets these values. */
export function setDeployTestOverrides(input: { fetchImpl?: typeof fetch; actor?: OverrideActor; actorOverride?: OverrideActor } = {}) {
  fetchOverride = input.fetchImpl;
  actorOverride = input.actorOverride ?? input.actor;
}
export function resetDeployTestState() {
  fetchOverride = undefined;
  actorOverride = undefined;
}
/** Alias kept explicit for callers that name the module rather than the operation. */
export const setDeploymentTestOverrides = setDeployTestOverrides;
export const resetDeploymentTestState = resetDeployTestState;

const tr = (locale: "ar" | "en" | "fr" = "en") => teamMessages[locale].deployments;

function renderApiKey() {
  return process.env.RENDER_API_KEY?.trim() || "";
}
function scrub(value: unknown, max = 1_000) {
  const key = renderApiKey();
  let text = redactSecrets(typeof value === "string" ? value : "").text;
  if (key) text = text.split(key).join("[redacted]");
  return text.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max);
}
function cleanRequired(value: unknown, max: number) {
  return scrub(value, max);
}
function disabled() {
  return (process.env.DEPLOY_APPROVALS ?? "on").trim().toLowerCase() === "off";
}
function stagingAuto() {
  return (process.env.DEPLOY_STAGING_AUTO ?? "on").trim().toLowerCase() !== "off";
}
function validTarget(value: unknown): value is DeployTarget {
  return value === "staging" || value === "production";
}
function validCommit(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{7,40}$/i.test(value);
}
function actorFor(actor: TeamActor): TeamActor {
  if (!actorOverride) return actor;
  return typeof actorOverride === "function" ? actorOverride(actor) : actorOverride;
}
function actorLabel(actor: TeamActor | string | null | undefined): string {
  if (typeof actor === "string") return cleanRequired(actor, 180) || "unknown";
  if (!actor || typeof actor !== "object") return "unknown";
  return cleanRequired(actor.name || actor.email || actor.id, 180) || "unknown";
}
function actorIdentity(actor: TeamActor): string {
  const effective = actorFor(actor);
  return actorLabel(effective);
}
function fail(key: keyof typeof teamMessages.en.deployments, status = 400) {
  return { ok: false as const, status, error: tr("en")[key], errorAr: tr("ar")[key], errorFr: tr("fr")[key] };
}
function safeDeployment(record: DeploymentRecord): DeploymentRecord {
  const out: DeploymentRecord = {
    id: scrub(record.id, 160),
    target: record.target,
    commit: scrub(record.commit, 40),
    reason: scrub(record.reason, 1_000),
    requestedBy: scrub(record.requestedBy, 180),
    status: record.status,
    createdAt: scrub(record.createdAt, 80),
    updatedAt: scrub(record.updatedAt, 80),
  };
  if (record.approvedBy) out.approvedBy = scrub(record.approvedBy, 180);
  if (record.renderDeployId) out.renderDeployId = scrub(record.renderDeployId, 180);
  if (record.url) out.url = scrub(record.url, 600);
  if (record.error) out.error = scrub(record.error, 500);
  if (record.previousCommit) out.previousCommit = scrub(record.previousCommit, 40);
  return out;
}
function safeAudit(audit: DeploymentAudit): DeploymentAudit {
  const out: DeploymentAudit = {
    id: scrub(audit.id, 160),
    deploymentId: scrub(audit.deploymentId, 160),
    action: audit.action,
    target: audit.target,
    actor: scrub(audit.actor, 180),
    status: audit.status,
    createdAt: scrub(audit.createdAt, 80),
  };
  if (audit.commit) out.commit = scrub(audit.commit, 40);
  if (audit.previousCommit) out.previousCommit = scrub(audit.previousCommit, 40);
  if (audit.renderDeployId) out.renderDeployId = scrub(audit.renderDeployId, 180);
  if (audit.error) out.error = scrub(audit.error, 500);
  return out;
}
function normalizeStore(db: Store): Store {
  return {
    deployments: Array.isArray(db.deployments) ? db.deployments.map(safeDeployment) : [],
    deploymentAudits: Array.isArray(db.deploymentAudits) ? db.deploymentAudits.map(safeAudit) : [],
  };
}
async function store() {
  return readJsonFile<Store>(DEPLOYMENT_STORE, { deployments: [], deploymentAudits: [] });
}
export async function listDeployments() {
  const rows = await store();
  return (Array.isArray(rows.deployments) ? rows.deployments : []).slice(-DEPLOYMENT_LIMIT).map(safeDeployment);
}
export async function getDeployment(id: string) {
  const cleanId = scrub(id, 160);
  const found = (await store()).deployments?.find((item) => item.id === cleanId);
  return found ? safeDeployment(found) : null;
}
export async function listDeploymentAudits() {
  const rows = await store();
  return (Array.isArray(rows.deploymentAudits) ? rows.deploymentAudits : []).slice(-DEPLOYMENT_AUDIT_LIMIT).map(safeAudit);
}

function previousLive(rows: DeploymentRecord[], target: DeployTarget) {
  return [...rows].reverse().find((item) => item.target === target && item.status === "live")?.commit;
}
function appendAudit(db: Store, input: Omit<DeploymentAudit, "id" | "createdAt">) {
  const audit: DeploymentAudit = { ...input, id: createId("deploy-audit"), createdAt: new Date().toISOString() };
  const existing = Array.isArray(db.deploymentAudits) ? db.deploymentAudits.map(safeAudit) : [];
  return [...existing, safeAudit(audit)].slice(-DEPLOYMENT_AUDIT_LIMIT);
}
function serviceId(target: DeployTarget) {
  return (target === "staging" ? process.env.RENDER_STAGING_SERVICE_ID : process.env.RENDER_PROD_SERVICE_ID)?.trim() || "";
}
function renderConfigured(target: DeployTarget) {
  return Boolean(renderApiKey() && serviceId(target));
}
class RenderRequestError extends Error {
  readonly status: number;
  constructor(status: number, _message = "") {
    super("Render API request failed.");
    this.status = status;
    this.name = "RenderRequestError";
  }
}
async function renderRequest<T>(target: DeployTarget, path: string, init: RequestInit): Promise<T> {
  const key = renderApiKey();
  const service = serviceId(target);
  if (!key || !service) throw new RenderRequestError(503, tr("en").notConfigured);
  const response = await (fetchOverride ?? fetch)(`https://api.render.com/v1/services/${encodeURIComponent(service)}${path}`, {
    ...init,
    headers: {
      accept: "application/json",
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) {
    let detail = "";
    try { detail = await response.text(); } catch { /* diagnostic body is optional */ }
    throw new RenderRequestError(response.status, detail);
  }
  try { return await response.json() as T; } catch { throw new RenderRequestError(response.status, "Invalid Render response."); }
}
async function createRenderDeploy(target: DeployTarget, commit: string) {
  const response = await renderRequest<RenderDeploy>(target, "/deploys", {
    method: "POST",
    body: JSON.stringify({ clearCache: "do_not_clear", deployMode: "build_and_deploy", commitId: commit }),
  });
  const id = typeof response.id === "string" ? scrub(response.id, 180) : "";
  if (!id) throw new RenderRequestError(502, "Render returned no deploy id.");
  const url = typeof response.url === "string" ? scrub(response.url, 600) : typeof response.service?.url === "string" ? scrub(response.service.url, 600) : undefined;
  return { id, url };
}

async function updateRecord(id: string, transform: (record: DeploymentRecord) => DeploymentRecord) {
  const next = await updateJsonFile<Store>(DEPLOYMENT_STORE, { deployments: [], deploymentAudits: [] }, (db) => {
    const base = normalizeStore(db);
    const rows = base.deployments ?? [];
    return { ...base, deployments: rows.map((item) => item.id === id ? transform(item) : item).slice(-DEPLOYMENT_LIMIT) };
  });
  return (Array.isArray(next.deployments) ? next.deployments : []).find((item) => item.id === id) ?? null;
}
async function auditFor(record: DeploymentRecord, action: DeploymentAudit["action"], actor: string, error?: string) {
  await updateJsonFile<Store>(DEPLOYMENT_STORE, { deployments: [], deploymentAudits: [] }, (db) => {
    const base = normalizeStore(db);
    return {
      ...base,
      deploymentAudits: appendAudit(base, {
        deploymentId: record.id,
        action,
        target: record.target,
        commit: record.commit,
        previousCommit: record.previousCommit,
        actor,
        status: record.status,
        renderDeployId: record.renderDeployId,
        error: error ? scrub(error, 500) : undefined,
      }),
    };
  });
}

export async function requestDeploy(input: { target: DeployTarget; commit: string; reason: string; requestedBy: string | TeamActor } | null | undefined) {
  if (disabled()) return fail("disabled", 503);
  if (!input || typeof input !== "object" || !validTarget(input.target)) return fail("invalidTarget");
  if (!validCommit(input?.commit)) return fail("invalidCommit");
  const reason = cleanRequired(input.reason, 1_000);
  if (!reason) return fail("missingReason");
  const commit = input.commit.toLowerCase();
  const requestedBy = actorLabel(input.requestedBy);
  const now = new Date().toISOString();
  let stored: DeploymentRecord | null = null;
  await updateJsonFile<Store>(DEPLOYMENT_STORE, { deployments: [], deploymentAudits: [] }, (db) => {
    const base = normalizeStore(db);
    const rows = base.deployments ?? [];
    const status: DeployStatus = input.target === "staging" && stagingAuto() ? "approved" : "pending";
    stored = {
      id: createId("deploy"),
      target: input.target,
      commit,
      reason,
      requestedBy,
      status,
      previousCommit: previousLive(rows, input.target),
      createdAt: now,
      updatedAt: now,
    };
    const item = stored as DeploymentRecord;
    return {
      ...base,
      deployments: [...rows, item].slice(-DEPLOYMENT_LIMIT),
      deploymentAudits: appendAudit(base, { deploymentId: item.id, action: "requested", target: item.target, commit: item.commit, previousCommit: item.previousCommit, actor: requestedBy, status: item.status }),
    };
  });
  if (!stored) throw new Error("Deployment was not stored.");
  // Staging is explicitly approved without an owner; the caller may invoke approveDeploy to start it.
  return { ok: true as const, deployment: safeDeployment(stored), record: safeDeployment(stored) };
}

async function startApprovedDeploy(id: string, actor: TeamActor, requireOwner: boolean) {
  if (disabled()) return fail("disabled", 503);
  const effective = actorFor(actor);
  if (requireOwner && !canApprove(effective)) return fail("notOwner", 403);
  const current = await getDeployment(id);
  if (!current) return fail("notFound", 404);
  if (current.status === "deploying" || current.status === "live") return { ok: true as const, deployment: current, record: current };
  if (current.status !== "pending" && current.status !== "approved") return fail("invalidState", 409);
  if (!renderConfigured(current.target)) return fail("notConfigured", 503);

  const actorName = actorIdentity(actor);
  let claimed = false;
  const next = await updateJsonFile<Store>(DEPLOYMENT_STORE, { deployments: [], deploymentAudits: [] }, (db) => {
    const base = normalizeStore(db);
    const rows = base.deployments ?? [];
    const found = rows.find((item) => item.id === current.id);
    if (!found) return base;
    if (found.status === "deploying" || found.status === "live") {
      return base;
    }
    if (found.status !== "pending" && found.status !== "approved") {
      return base;
    }
    claimed = true;
    const deploying = { ...found, status: "deploying" as const, approvedBy: actorName, error: undefined, updatedAt: new Date().toISOString() };
    return { ...base, deployments: rows.map((item) => item.id === current.id ? deploying : item) };
  });
  const claimedRecord = next.deployments?.find((item) => item.id === current.id) ?? null;
  if (!claimedRecord) return fail("notFound", 404);
  if (!claimed) {
    if (claimedRecord.status === "deploying" || claimedRecord.status === "live") return { ok: true as const, deployment: safeDeployment(claimedRecord), record: safeDeployment(claimedRecord) };
    return fail("invalidState", 409);
  }
  await auditFor(claimedRecord, "approved", actorName);
  try {
    const result = await createRenderDeploy(claimedRecord.target, claimedRecord.commit);
    const updated = await updateRecord(claimedRecord.id, (record) => ({ ...record, status: "deploying", renderDeployId: result.id, url: result.url ?? record.url, error: undefined, updatedAt: new Date().toISOString() }));
    if (!updated) return fail("notFound", 404);
    await auditFor(updated, "deploying", actorName);
    return { ok: true as const, deployment: safeDeployment(updated), record: safeDeployment(updated) };
  } catch (error) {
    const safeError = error instanceof RenderRequestError && error.status === 503 ? tr("en").notConfigured : tr("en").renderFailed;
    const failed = await updateRecord(claimedRecord.id, (record) => ({ ...record, status: "failed", error: safeError, updatedAt: new Date().toISOString() }));
    if (failed) await auditFor(failed, "failed", actorName, safeError);
    return { ok: false as const, status: error instanceof RenderRequestError && error.status === 429 ? 429 : 502, error: safeError, errorAr: error instanceof RenderRequestError && error.status === 503 ? tr("ar").notConfigured : tr("ar").renderFailed, errorFr: error instanceof RenderRequestError && error.status === 503 ? tr("fr").notConfigured : tr("fr").renderFailed };
  }
}

export async function approveDeploy(id: string, actor: TeamActor) {
  return startApprovedDeploy(scrub(id, 160), actor, true);
}

/** Staging requests are auto-approved, so staff can activate them without an owner-only action. */
export async function activateStagingDeploy(id: string, actor: TeamActor) {
  const current = await getDeployment(scrub(id, 160));
  if (!current || current.target !== "staging" || current.status !== "approved" || !stagingAuto()) return { ok: true as const, deployment: current, record: current };
  return startApprovedDeploy(current.id, actor, false);
}

export async function rollbackDeploy(id: string, actor: TeamActor) {
  if (disabled()) return fail("disabled", 503);
  const effective = actorFor(actor);
  if (!canApprove(effective)) return fail("notOwner", 403);
  const current = await getDeployment(scrub(id, 160));
  if (!current) return fail("notFound", 404);
  if (!current.previousCommit || !validCommit(current.previousCommit)) return fail("noRollback", 409);
  if (!renderConfigured(current.target)) return fail("notConfigured", 503);
  const actorName = actorIdentity(actor);
  try {
    const result = await createRenderDeploy(current.target, current.previousCommit);
    const rolledBack = await updateRecord(current.id, (record) => ({ ...record, status: "rolled_back", renderDeployId: result.id, url: result.url ?? record.url, error: undefined, updatedAt: new Date().toISOString() }));
    if (!rolledBack) return fail("notFound", 404);
    await auditFor(rolledBack, "rolled_back", actorName);
    return { ok: true as const, deployment: safeDeployment(rolledBack), record: safeDeployment(rolledBack) };
  } catch {
    const failed = await updateRecord(current.id, (record) => ({ ...record, status: "failed", error: tr("en").renderFailed, updatedAt: new Date().toISOString() }));
    if (failed) await auditFor(failed, "failed", actorName, tr("en").renderFailed);
    return { ok: false as const, status: 502, error: tr("en").renderFailed, errorAr: tr("ar").renderFailed, errorFr: tr("fr").renderFailed };
  }
}

export async function syncDeployStatus(id: string) {
  if (disabled()) return fail("disabled", 503);
  const current = await getDeployment(scrub(id, 160));
  if (!current) return fail("notFound", 404);
  if (!current.renderDeployId) return fail("noRenderDeploy", 409);
  if (!renderConfigured(current.target)) return fail("notConfigured", 503);
  try {
    const response = await renderRequest<RenderDeploy>(current.target, `/deploys/${encodeURIComponent(current.renderDeployId)}`, { method: "GET" });
    const status = typeof response.status === "string" ? response.status.toLowerCase() : "";
    let nextStatus: DeployStatus = current.status;
    if (status === "live") nextStatus = "live";
    else if (/(?:^|_)(?:failed|canceled|cancelled|terminated)$/.test(status)) nextStatus = "failed";
    if (nextStatus === current.status) return { ok: true as const, deployment: current, record: current, renderStatus: scrub(status, 80) };
    const updated = await updateRecord(current.id, (record) => ({ ...record, status: nextStatus, error: nextStatus === "failed" ? tr("en").renderFailed : undefined, updatedAt: new Date().toISOString() }));
    if (!updated) return fail("notFound", 404);
    await auditFor(updated, nextStatus === "live" ? "live" : "failed", "render");
    return { ok: true as const, deployment: safeDeployment(updated), record: safeDeployment(updated), renderStatus: scrub(status, 80) };
  } catch {
    return { ok: false as const, status: 502, error: tr("en").statusFailed, errorAr: tr("ar").statusFailed, errorFr: tr("fr").statusFailed };
  }
}
