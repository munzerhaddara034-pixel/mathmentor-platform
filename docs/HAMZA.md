# Hamza «حمزة» v2: developer agent

Hamza is the developer agent in `/admin/team`. He reads the repo, proposes a patch, and **never** writes to the live branch himself.
Every change follows this path:

```
chat request ─► task (queued) ─► worker: agent loop on a repo snapshot (read-only tools)
             ─► prechecks (paths, secrets, any, syntax, standards, risk tier) ─► proposal card (diff)
             ─► Approval #1: one-time code HMZ-XXXXXX  ─► branch feat/* | fix/* + PR to HAMZA_BASE_BRANCH
             ─► GitHub Actions `hamza-ci` (standards, tsc, tests, test:team, build)  ─► (red: ≤2 repair rounds)
             ─► Approval #2: second code + typed live-branch name, only on a green PR head ─► squash-merge
             ─► Render auto-deploys the live branch ─► «تراجع» (revert) opens a reverse PR through the same path
```

WhatsApp, voice and Agent Hub cannot approve code. A text "approved" in the chat does nothing; only the codes in the app count.

## Code map (`src/lib/hamza/`)
| Area | Files |
|---|---|
| Config / env | `config.ts` (one place for every `HAMZA_*` variable, with clamped defaults) |
| Approval codes | `codes.ts` (salted SHA-256; single-use; TTL; attempt cap; bound to proposal + revision + diff hash + action + branch) |
| Pipeline | `pipeline/` (`issueCode`, `openPr`, `ciRefresh`, `merge`, `reject`), `ci.ts`, `timeline.ts`, `audit.ts` |
| GitHub | `github/octokit.ts` (reader / writer), `github/types.ts` (fakes in tests implement the same interface) |
| Models | `models/` (router with primary → fallbacks, a cheap tier, a price table), `cost.ts` |
| Agent loop | `agent/` (JSON action protocol: tool / propose / reply; step, tool-call, time and USD limits; up to 3 patch rounds) |
| Repo access | `snapshot.ts`, `snapshotSources.ts` (git dir, local dir, GitHub tarball into `/tmp/hamza/<sha>`), `tools.ts`, `repoMap.ts` |
| Patch | `patch.ts` (edit / create / delete / rename ops → proposal files), `standards.ts`, `rules.ts`, `limits.ts` (risk tiers) |
| Tasks | `tasks/` (Postgres `mm_hamza_tasks` with `FOR UPDATE SKIP LOCKED`; file fallback), `runner/`, `worker.ts` |
| After-merge | `revise.ts` (change request on an open PR), `repair.ts` (CI red → fix rounds), `revert.ts` |
| Ops view | `activity.ts` + `/api/admin/team/hamza/activity` (spend, tasks, models, audit events) |
| Evals | `docs/hamza/evals.json` (12 cases) + `evals.ts` (pure scorer) |

## Disabled by default (readiness gate)
Hamza is **off** unless every one of these is set (`src/lib/hamza/readiness.ts`):

| Required | Why |
|---|---|
| `HAMZA_ENABLED=1` | Explicit opt-in (unset, `0` or anything else = off). |
| `GITHUB_TOKEN` | Fine-grained PAT (below). |
| `GITHUB_OWNER`, `GITHUB_REPO` | The one repo Hamza works on. |
| `HAMZA_BASE_BRANCH` | PR target = branch Render deploys (must be set explicitly for the gate). |
| `HAMZA_MODEL_PRIMARY` | Primary model id. |
| `HAMZA_GEMINI_API_KEY` or `GEMINI_API_KEY` (Gemini primary) / `OPENAI_API_KEY` (`openai:` primary) | Key for the primary model. |

While anything is missing: the worker does not start (startup logs `Hamza disabled (not configured; missing: …)`, names only),
messages to حمزة get a fixed "not configured" reply (no model call, no task, no GitHub), every proposal action except
«reject» returns 503, «continue» returns 503, and `/admin/team` (Hamza channel) shows a "not configured" banner listing the
missing variable names. Values are never logged or sent to the browser.

## Environment (Render)
| Variable | Default | Meaning |
|---|---|---|
| `HAMZA_ENABLED` | **off** | Must be `1` to turn Hamza on (see the gate above). `0` is the kill switch: stops new tasks and the worker. Existing PRs are untouched. |
| `HAMZA_WORKER` | on | `0` = this instance does not run the in-process worker. |
| `HAMZA_BASE_BRANCH` | required | The **only** branch setting: PR target = branch Render deploys. Required by the gate (the code still falls back to `GITHUB_BRANCH` / `agent-hub-latest` for branch protection checks). |
| `HAMZA_CI_CHECKS` | `hamza-ci` | Required check-run names (comma list). |
| `HAMZA_CODE_TTL_MINUTES` | 30 (5–120) | Approval-code lifetime. |
| `HAMZA_CODE_MAX_ATTEMPTS` | 5 (1–10) | Wrong attempts before a code is burned. |
| `HAMZA_MAX_REPAIR_ROUNDS` | 2 (0–2) | Auto-repair rounds after red CI (each still needs Approval #1). |
| `HAMZA_TASK_BUDGET_USD` | 2 | Per-task cap; when reached, the task pauses with a checkpoint («تابع» continues it). |
| `HAMZA_TASK_BUDGET_MAX_USD` | 5 | Hard per-task ceiling for «تابع» (approver only). |
| `HAMZA_MONTHLY_BUDGET_USD` | 60 | Month cap; reaching it stops new tasks. |
| `HAMZA_MAX_TOOL_CALLS` / `HAMZA_MAX_STEPS` / `HAMZA_TASK_TIMEOUT_MINUTES` | 40 / 24 / 15 | Loop limits. |
| `HAMZA_MODEL_PRIMARY` | unset → legacy team chain + notice | e.g. `gemini-3.1-pro-preview` |
| `HAMZA_MODEL_FALLBACKS` | none | e.g. `gemini-3.8-flash,openai:gpt-5.3-codex` |
| `HAMZA_MODEL_CHEAP` | primary | Used for summaries / compaction, e.g. `gemini-3.8-flash` |
| `HAMZA_MODEL_PRICES` | built-in table | JSON `{"<model>":{"in":2,"out":12,"cached":0.2}}` in USD per 1M tokens |
| `HAMZA_DEFAULT_PRICE` | `2,12` | Price for unknown models (so caps still hold). |
| `HAMZA_MERGE_APPROVER_EMAILS` | all team approvers | Who may give Approval #2 (must also be in `TEAM_APPROVER_EMAILS`/`ADMIN_EMAILS`). |
| `TEAM_APPROVER_EMAILS` | `ADMIN_EMAILS` | Who may give Approval #1. |
| `HAMZA_GEMINI_API_KEY` | `GEMINI_API_KEY` | Separate Gemini key for Hamza, so his spend is visible on its own. |
| `OPENAI_API_KEY` | none | Only when an `openai:` model is configured. |
| `GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO` | none | Fine-grained PAT (below). |
| `TEAM_REPO_LOCAL_DIR` | none | Local dev only: snapshot from a local checkout instead of a GitHub tarball. |

## GitHub setup (once, by Munzer)
1. **Fine-grained PAT**, limited to the one repo:
   - Contents: Read and write
   - Pull requests: Read and write
   - Checks: Read
   - Actions: Read
   - Metadata: Read (implicit)
   - **No** Workflows, Administration, Secrets or Environments permissions.
   Without the Workflows permission, GitHub itself refuses any push touching `.github/workflows/`. The app denies `.github/` as well.
2. **Ruleset** on the live branch (`agent-hub-latest`, plus `main`):
   - require a pull request;
   - require status check **`hamza-ci`** (strict, up to date);
   - block force pushes and deletions;
   - allow squash merges.
   The bypass list must not contain the account that owns the PAT. A fine-grained PAT always acts as the user who
   created it: if it is Munzer's own token and Munzer (or "Repository admin") is on the bypass list, the token bypasses
   the ruleset too, and only the app-side guards stop a direct push. Safest: leave the bypass list empty, or create
   the PAT from a separate collaborator account with the Write role.
   Note: "require a pull request" also blocks today's direct merge-pushes to `agent-hub-latest`; releases then go
   through PRs too.
3. **Add the CI workflow (one time, by Munzer).** The automation token has no `workflow` scope, so GitHub refused to
   push `.github/workflows/hamza-ci.yml`. Its exact content is kept in `docs/hamza/hamza-ci.workflow.yml`: copy it to
   `.github/workflows/hamza-ci.yml` with the GitHub web editor (or a token that has the `workflow` scope). Until it
   exists, Hamza's PRs show "no CI check started" and Approval #2 (merge) stays blocked, which fails safe.
   **Actions:** `.github/workflows/hamza-ci.yml` runs on PRs to the live branch with `permissions: contents: read` and no secrets. If the repo is private, CI uses Actions minutes.

## Rollback runbook
1. Preferred: on the merged card press «تراجع». It opens `fix/revert-<sha7>`, runs CI, and asks for Approval #2. Render redeploys after the merge.
2. If the site is down right now: in the Render dashboard → service → **Events / Deploys**, choose **Rollback** to the previous deploy. It takes effect immediately. Then do step 1 so the branch matches.
3. Stop Hamza: set `HAMZA_ENABLED=0` (or remove it), and `HAMZA_WORKER=0` if needed, then redeploy. Open PRs stay on GitHub and can be closed there.
4. If a code is suspected leaked: codes expire in `HAMZA_CODE_TTL_MINUTES`, are single-use and bound to one diff. Reject the proposal to burn the code.

## Local testing
```bash
npm test                 # node:test suites (fake GitHub, fake models, memory/file stores)
npm run test:team        # team-chat end-to-end script (file storage)
npm run check:standards  # the same standards gate CI runs (HAMZA_STANDARDS_BASE=<ref> to diff against)
TEAM_REPO_LOCAL_DIR=$PWD HAMZA_MODEL_PRIMARY=… npm run dev   # real models, local snapshot, still no GitHub writes without GITHUB_TOKEN
```
Migration `009_hamza_tasks` creates `mm_hamza_tasks` / `mm_hamza_steps`. The app applies it automatically on the first Postgres connection (`ensureDatabaseReady`). You can also run it ahead of time with `npm run db:migrate`. It is idempotent.

## Known limits
- The tool protocol is JSON actions in text, not native function calling.
- CI status is polled every ≥45 s; there is no webhook.
- Chat attachments are not passed to Hamza.
- Revision diffs are incremental against the PR head.
- The task store's file fallback is single-instance only. Postgres claims are safe across instances.
- A revert that restores code with `any` is blocked by the prechecks like any other patch; fix it forward instead.
