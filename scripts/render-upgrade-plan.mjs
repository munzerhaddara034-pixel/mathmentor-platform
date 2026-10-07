#!/usr/bin/env node
/**
 * Move a Render web service off the free compute plan (which spins down after 15 idle minutes) and
 * verify the result. Dry run by default: it prints the current plan and what would change.
 *
 *   RENDER_API_KEY=rnd_xxx node scripts/render-upgrade-plan.mjs --service mathmentor-platform
 *   RENDER_API_KEY=rnd_xxx node scripts/render-upgrade-plan.mjs --service mathmentor-platform --plan starter --apply
 *
 * Plans: free | starter (0.5c-512mb, $7/mo) | standard (1c-2g, $25/mo) | pro (2c-4g, $85/mo).
 * The API key is read from the environment only, is never printed, and is never written to a file.
 * Changing the plan costs money on the Render account, so --apply must be passed explicitly.
 */
const API = "https://api.render.com/v1";
const PLANS = {
  free: { id: "free", label: "Free · 0.1 CPU / 512 MB · spins down after 15 idle minutes" },
  starter: { id: "starter", label: "Starter · 0.5 CPU / 512 MB · always on · $7/month" },
  standard: { id: "standard", label: "Standard · 1 CPU / 2 GB · always on · $25/month" },
  pro: { id: "pro", label: "Pro · 2 CPU / 4 GB · always on · $85/month" },
};

function parseArgs(argv) {
  const args = { service: "", plan: "starter", apply: false, owner: "", healthUrl: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === "--apply") args.apply = true;
    else if (flag === "--service") args.service = argv[++index] ?? "";
    else if (flag === "--plan") args.plan = argv[++index] ?? "";
    else if (flag === "--owner") args.owner = argv[++index] ?? "";
    else if (flag === "--health-url") args.healthUrl = argv[++index] ?? "";
  }
  return args;
}

const key = process.env.RENDER_API_KEY?.trim();
if (!key) {
  console.error("RENDER_API_KEY is required (Render Dashboard → Account Settings → API Keys). It is read from the environment only.");
  process.exit(2);
}

const args = parseArgs(process.argv.slice(2));
if (!args.service) {
  console.error("Usage: RENDER_API_KEY=… node scripts/render-upgrade-plan.mjs --service <name> [--plan starter] [--owner own-xxx] [--apply]");
  process.exit(2);
}
const plan = PLANS[args.plan];
if (!plan) {
  console.error(`Unknown plan "${args.plan}". Known: ${Object.keys(PLANS).join(", ")}`);
  process.exit(2);
}

async function api(path, init = {}) {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(`${init.method ?? "GET"} ${path} → ${response.status} ${text.slice(0, 300)}`);
  return body;
}

async function findService() {
  const query = args.owner ? `?ownerId=${encodeURIComponent(args.owner)}&limit=100` : "?limit=100";
  const services = await api(`/services${query}`);
  const match = services
    .map((entry) => entry.service ?? entry)
    .find((service) => service.name === args.service || service.id === args.service);
  if (!match) {
    const names = services.map((entry) => (entry.service ?? entry).name).join(", ");
    throw new Error(`service "${args.service}" not found. Visible services: ${names || "(none)"}`);
  }
  return match;
}

async function waitForHealth(url, timeoutMs = 300_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      const body = await response.json().catch(() => null);
      if (response.ok && body?.ok) return { ok: true, ms: Date.now() - started, body };
      console.log(`  … ${response.status} ${JSON.stringify(body)}`);
    } catch (error) {
      console.log(`  … not reachable yet (${error instanceof Error ? error.message : "error"})`);
    }
    await new Promise((resolve) => setTimeout(resolve, 10_000));
  }
  return { ok: false, ms: Date.now() - started };
}

const service = await findService();
const currentPlan = service.serviceDetails?.plan ?? service.plan ?? "unknown";
const healthUrl = args.healthUrl || `https://${service.serviceDetails?.url?.replace(/^https?:\/\//, "") ?? `${service.name}.onrender.com`}/api/health`;

console.log(`service:        ${service.name} (${service.id})`);
console.log(`type / region:  ${service.type} · ${service.region ?? "?"}`);
console.log(`current plan:   ${currentPlan}${PLANS[currentPlan] ? ` — ${PLANS[currentPlan].label}` : ""}`);
console.log(`target plan:    ${plan.id} — ${plan.label}`);
console.log(`health probe:   ${healthUrl}`);

if (currentPlan === plan.id) {
  console.log("\nNothing to do: the service is already on this plan.");
  process.exit(0);
}
if (!args.apply) {
  console.log("\nDry run. Re-run with --apply to change the plan (this starts billing on the Render account).");
  process.exit(0);
}

console.log("\nApplying the plan change …");
await api(`/services/${service.id}`, { method: "PATCH", body: JSON.stringify({ serviceDetails: { plan: plan.id } }) });
console.log("Plan updated. Triggering a deploy to apply it …");
await api(`/services/${service.id}/deploys`, { method: "POST", body: JSON.stringify({ clearCache: "do_not_clear" }) });

const health = await waitForHealth(healthUrl);
if (health.ok) {
  console.log(`\n✅ Deployed and healthy after ${Math.round(health.ms / 1000)}s: ${JSON.stringify(health.body)}`);
  console.log("Next: leave the service idle for 20 minutes and open the site once — it must load immediately.");
} else {
  console.error("\n⚠️ The plan change was submitted but the health probe did not turn healthy in time. Check the deploy log in the Render Dashboard.");
  process.exit(1);
}
