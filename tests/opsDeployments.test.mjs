import { test, after } from "node:test";
import assert from "node:assert/strict";
import { setPersistentStoreOverride } from "../src/lib/dataDir.ts";
import {
  DEPLOYMENT_LIMIT,
  approveDeploy,
  getDeployment,
  listDeploymentAudits,
  listDeployments,
  requestDeploy,
  resetDeployTestState,
  rollbackDeploy,
  setDeployTestOverrides,
  syncDeployStatus,
} from "../src/lib/ops/deployments.ts";

const docs = new Map();
setPersistentStoreOverride({
  async getJSON(key) { return docs.has(key) ? structuredClone(docs.get(key)) : null; },
  async setJSON(key, value) { docs.set(key, structuredClone(value)); },
});
const ENV_KEYS = ["DEPLOY_APPROVALS", "DEPLOY_STAGING_AUTO", "RENDER_API_KEY", "RENDER_STAGING_SERVICE_ID", "RENDER_PROD_SERVICE_ID", "TEAM_APPROVER_EMAILS"];
const originalEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
const owner = { id: "owner-1", name: "Munzer", email: "owner@example.test", role: "admin" };
const staff = { id: "staff-1", name: "Staff", email: "staff@example.test", role: "teacher" };

function clear() {
  docs.clear(); resetDeployTestState();
  for (const key of ENV_KEYS) delete process.env[key];
  process.env.TEAM_APPROVER_EMAILS = owner.email;
}
function configure() {
  process.env.RENDER_API_KEY = "render-api-key-never-returned";
  process.env.RENDER_STAGING_SERVICE_ID = "srv-staging-fixed";
  process.env.RENDER_PROD_SERVICE_ID = "srv-production-fixed";
}
function renderStub({ statuses = [] } = {}) {
  const requests = [];
  let deployNumber = 0;
  const fetchImpl = async (url, init = {}) => {
    const item = { url: String(url), init, body: init.body ? JSON.parse(init.body) : undefined };
    requests.push(item);
    if (init.method === "POST" && item.url.endsWith("/deploys")) {
      deployNumber += 1;
      return Response.json({ id: `render-deploy-${deployNumber}`, status: "created", url: "https://service.example.test" }, { status: 202 });
    }
    if (init.method === "GET" && item.url.includes("/deploys/")) {
      const index = requests.filter((request) => request.init.method === "GET").length - 1;
      return Response.json({ id: item.url.split("/").at(-1), status: statuses[index] ?? "build_in_progress" });
    }
    throw new Error(`unexpected Render URL ${item.url}`);
  };
  return { fetchImpl, requests };
}
function lastStored() { return docs.get("ops-deployments.json") ?? { deployments: [], deploymentAudits: [] }; }

after(() => {
  clear();
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  setPersistentStoreOverride(null);
});

test("staging requests are auto-approved by default", async () => {
  clear(); configure();
  const result = await requestDeploy({ target: "staging", commit: "abcdef1", reason: "Preview release", requestedBy: "staff-1" });
  assert.equal(result.ok, true);
  assert.equal(result.deployment.status, "approved");
  assert.equal((await listDeployments()).length, 1);
});

test("production requests remain pending until an owner approves", async () => {
  clear(); configure();
  const result = await requestDeploy({ target: "production", commit: "abcdef2", reason: "Production release", requestedBy: "staff-1" });
  assert.equal(result.ok, true);
  assert.equal(result.deployment.status, "pending");
  assert.equal(lastStored().deploymentAudits.at(-1).action, "requested");
});

test("non-owner approval is rejected before any Render call", async () => {
  clear(); configure(); const stub = renderStub(); setDeployTestOverrides({ fetchImpl: stub.fetchImpl });
  const requested = await requestDeploy({ target: "production", commit: "abcdef3", reason: "Needs review", requestedBy: "staff-1" });
  const result = await approveDeploy(requested.deployment.id, staff);
  assert.equal(result.ok, false); assert.equal(result.status, 403); assert.match(result.errorAr, /المالك/); assert.equal(stub.requests.length, 0);
});

test("owner approval triggers one staging deploy on the server staging service", async () => {
  clear(); configure(); const stub = renderStub(); setDeployTestOverrides({ fetchImpl: stub.fetchImpl });
  const requested = await requestDeploy({ target: "staging", commit: "abcdef4", reason: "Staging release", requestedBy: "staff-1" });
  const result = await approveDeploy(requested.deployment.id, owner);
  assert.equal(result.ok, true); assert.equal(stub.requests.length, 1); assert.match(stub.requests[0].url, /srv-staging-fixed/); assert.equal(stub.requests[0].body.commitId, "abcdef4");
});

test("owner approval triggers one production deploy on the server production service", async () => {
  clear(); configure(); const stub = renderStub(); setDeployTestOverrides({ fetchImpl: stub.fetchImpl });
  const requested = await requestDeploy({ target: "production", commit: "abcdef5", reason: "Production release", requestedBy: "staff-1" });
  const result = await approveDeploy(requested.deployment.id, owner);
  assert.equal(result.ok, true); assert.equal(stub.requests.length, 1); assert.match(stub.requests[0].url, /srv-production-fixed/); assert.equal(stub.requests[0].body.commitId, "abcdef5");
});

test("client-supplied service, repository, and branch values are ignored", async () => {
  clear(); configure(); const stub = renderStub(); setDeployTestOverrides({ fetchImpl: stub.fetchImpl });
  const requested = await requestDeploy({ target: "production", commit: "abcdef6", reason: "fixed server route", requestedBy: "staff-1", serviceId: "attacker-service", repo: "attacker/repo", branch: "main" });
  await approveDeploy(requested.deployment.id, owner);
  assert.equal(stub.requests[0].url.includes("attacker-service"), false); assert.equal(stub.requests[0].url.includes("attacker"), false); assert.match(stub.requests[0].url, /srv-production-fixed/);
});

test("missing Render configuration returns localized not-configured error without network", async () => {
  clear(); const stub = renderStub(); setDeployTestOverrides({ fetchImpl: stub.fetchImpl });
  const requested = await requestDeploy({ target: "production", commit: "abcdef7", reason: "No config", requestedBy: "staff-1" });
  const result = await approveDeploy(requested.deployment.id, owner);
  assert.equal(result.ok, false); assert.equal(result.status, 503); assert.match(result.errorAr, /غير مهيّأ/); assert.equal(stub.requests.length, 0);
});

test("kill switch refuses request and approval paths before any network call", async () => {
  clear(); configure(); process.env.DEPLOY_APPROVALS = "off"; let calls = 0;
  setDeployTestOverrides({ fetchImpl: async () => { calls += 1; throw new Error("network must not run"); } });
  const request = await requestDeploy({ target: "production", commit: "abcdef8", reason: "disabled", requestedBy: "staff-1" });
  const approval = await approveDeploy("missing", owner);
  const rollback = await rollbackDeploy("missing", owner);
  assert.equal(request.ok, false); assert.equal(approval.ok, false); assert.equal(rollback.ok, false); assert.match(request.errorAr, /متوقفة/); assert.equal(calls, 0); assert.equal(docs.size, 0);
});

test("rollback redeploys the previous live commit and records rolled_back", async () => {
  clear(); configure(); const stub = renderStub({ statuses: ["live"] }); setDeployTestOverrides({ fetchImpl: stub.fetchImpl });
  const first = await requestDeploy({ target: "production", commit: "abcdef9", reason: "First live", requestedBy: "staff-1" });
  await approveDeploy(first.deployment.id, owner); await syncDeployStatus(first.deployment.id);
  const next = await requestDeploy({ target: "production", commit: "abcdeff", reason: "Next release", requestedBy: "staff-1" });
  const rolled = await rollbackDeploy(next.deployment.id, owner);
  assert.equal(rolled.ok, true); assert.equal(rolled.deployment.status, "rolled_back"); assert.equal(rolled.deployment.previousCommit, "abcdef9");
  const posts = stub.requests.filter((request) => request.init.method === "POST"); assert.equal(posts.length, 2); assert.equal(posts.at(-1).body.commitId, "abcdef9"); assert.equal((await listDeploymentAudits()).at(-1).action, "rolled_back");
});

test("status sync never fabricates live for an in-progress Render status", async () => {
  clear(); configure(); const stub = renderStub({ statuses: ["build_in_progress"] }); setDeployTestOverrides({ fetchImpl: stub.fetchImpl });
  const requested = await requestDeploy({ target: "production", commit: "abcde10", reason: "Observe only", requestedBy: "staff-1" });
  await approveDeploy(requested.deployment.id, owner);
  const result = await syncDeployStatus(requested.deployment.id);
  assert.equal(result.ok, true); assert.equal(result.deployment.status, "deploying"); assert.notEqual(result.deployment.status, "live");
});

test("deployment records and audits stay bounded to the newest records", async () => {
  clear();
  for (let index = 0; index < DEPLOYMENT_LIMIT + 5; index += 1) {
    const result = await requestDeploy({ target: "production", commit: `${(index + 0xabcde00).toString(16).slice(-7)}`, reason: `request ${index}`, requestedBy: "staff-1" });
    assert.equal(result.ok, true);
  }
  assert.equal((await listDeployments()).length, DEPLOYMENT_LIMIT); assert.equal(lastStored().deployments.length, DEPLOYMENT_LIMIT); assert.ok(lastStored().deploymentAudits.length <= 480);
});

test("Render API key is absent from responses, records, audits, and logs", async () => {
  clear(); configure(); const key = process.env.RENDER_API_KEY; const stub = renderStub(); const logs = []; const original = console.error; console.error = (...values) => logs.push(values.join(" "));
  try {
    setDeployTestOverrides({ fetchImpl: stub.fetchImpl });
    const requested = await requestDeploy({ target: "production", commit: "abcde11", reason: `Reason ${key}`, requestedBy: `Requester ${key}` });
    const result = await approveDeploy(requested.deployment.id, owner);
    assert.equal(JSON.stringify(requested).includes(key), false); assert.equal(JSON.stringify(result).includes(key), false);
  } finally { console.error = original; }
  assert.equal(JSON.stringify(lastStored()).includes(key), false); assert.equal(JSON.stringify(await listDeploymentAudits()).includes(key), false); assert.equal(JSON.stringify(logs).includes(key), false);
});
