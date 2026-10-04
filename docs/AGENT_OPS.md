# Autonomous Operations & Growth Agent

Staff ops brain for **MathMentor · أكاديمية منذر حداره**  
Brand only: **Prof. Munzer Haddara / الأستاذ منذر حداره** — never Al-Tarah / الطارة.

## Phones (do not mix)

| Role | Number | Notes |
| --- | --- | --- |
| **Whish / payment / booking notify** | **96170772968** باسم **منذر أحمد حداره** | `WHISH_TRANSFER_PHONE` / `TEACHER_WHATSAPP` — **unchanged** |
| **Agent Hub WhatsApp instructor allowlist** | **96176532421** (local **76532421**) | `INSTRUCTOR_WHATSAPP_NUMBER` only |

Accepted allowlist forms: `76532421` · `076532421` · `96176532421` · `+96176532421` · `0096176532421`.

Unauthorized inbound WhatsApp → reply «عذراً، هذا الرقم مخصص لإدارة منصة Math Mentor فقط.» and **do not** run the agent pipeline.


## Executive AI Secretary — محمد

Intents (WhatsApp text/voice → `runWhatsAppVoicePipeline`):

| Intent | Example (AR) | Persist |
| --- | --- | --- |
| `schedule_appointment` | سجّل موعد غداً الساعة ١٠ مع الأستاذ أحمد بخصوص الباريم | `appointments[]` in agent-ops store |
| `add_reminder` | ذكّرني غداً بمراجعة امتحان المشتقات — عاجل | `reminders[]` |
| `daily_briefing` | أعطني الموجز اليومي / جدول أعمالي اليوم | lists pending |

محمد هو السكرتير التنفيذي وواجهة واتساب الأمامية: confirmations introduce/sign as **محمد، سكرتير الأستاذ منذر حداره / MathMentor**; the instructor brand remains **الأستاذ منذر حداره / MathMentor** (never الطارة). Hub section: **سكرتير محمد · جدول المواعيد والمهام اليومية** (`SecretarySchedule`).

**Front door to ops:** for non-secretary intents (`generate_video` / marketing, `school_report`, `platform_health`, `general_task`, …) WhatsApp replies say محمد تواصل مع **المساعد التشغيلي** ونفّذ… on Munzer’s behalf, then the ops agent continues (draft-and-approve wording for موافقة / رفض stays intact).

## Live webhook

**URL:** `https://mathmentor-munzer.netlify.app/api/agent/whatsapp-voice`

### Meta Cloud API verify (GET)

1. In Meta Developer Console → WhatsApp → Configuration → Webhook, set Callback URL to the URL above.
2. Verify token = the value of `WHATSAPP_VERIFY_TOKEN` (required; there is no default — if unset, verification fails closed and the server logs why).
3. Subscribe to `messages`.
4. Meta sends `GET ?hub.mode=subscribe&hub.verify_token=…&hub.challenge=…` → API returns **plain-text** `hub.challenge` when the token matches.

Staff health JSON (no challenge): open the same path without hub params.

### Inbound (POST)

Accepts:

- Meta Cloud API JSON (`object: whatsapp_business_account`)
- UltraMsg-style JSON (`data.from` / `ptt` / media URL)
- Twilio WhatsApp form (`From`, `MediaUrl0`, `Body`)
- Agent Hub multipart / JSON (staff session or `AGENT_WEBHOOK_SECRET`)

Voice notes (`audio/ogg`, `mp4`, `mpeg`, …) are downloaded with provider token when URL/id is given, then Whisper via `transcribeAudioOrDemo`. Authorized senders: **WhatsApp confirmation FIRST** (or approval decision), then persist voice task to Agent Hub (`persist: false` in pipeline → `sendAgentWhatsAppConfirmation` saves). Never silent-drop authorized instructor text/audio; media download failures still WA-reply in Arabic and save a failed task. Missing keys → outbox log only (never throws).

## Draft-and-Approve (Self-Evolving Executive)

States: `DRAFTED` → `AWAITING_APPROVAL` → `APPROVED` → `DEPLOYED` | `REJECTED`.

- Marketing videos, school reports, outreach, and weekly recommendations are **staged** — WhatsApp staging preview to **96176532421**.
- Never auto-post social / deploy outreach without instructor approval.
- WhatsApp replies **موافق** / **اعتمد** / **انشر** (or EN approve/deploy) → `DEPLOYED` + ✅ notify.
- **ارفض** → `REJECTED`. Voice edit notes keep `AWAITING_APPROVAL`.
- Hub: `/admin/agent-hub` → Staged Approvals one-click · `POST /api/agent/approvals`.

## Self-evolution & weekly brief

- `POST /api/agent/weekly-brief` (auth: `JOBS_SECRET` / `AGENT_WEBHOOK_SECRET` / staff; demo if empty).
- Cron: **Sunday 00:00 Asia/Beirut** — pass `{"force":true}` for manual runs outside the window.
- Stages 3 recommendations for 1-click / WhatsApp approval.

## School persuasion

- `GET|POST /api/agent/persuasion` — Lebanon (Barème) / GCC / International packs + objection handlers.
- Optional `stageOutreach: true` creates an `AWAITING_APPROVAL` outreach letter.

## Outbound WhatsApp (instructor)

Every Agent Hub **completion** path sends an Arabic summary to `INSTRUCTOR_WHATSAPP_NUMBER` (**96176532421**) via `notifyInstructorHubCompletion` → `sendAgentWhatsAppConfirmation` → `whatsapp/adapter` (Meta when configured):

| Path | When |
| --- | --- |
| `POST /api/agent/whatsapp-voice` | After voice/text pipeline (already wired) |
| `POST /api/agent/marketing-video` | After campaign create |
| `POST /api/agent/marketing-video/webhook` | After HeyGen render callback |
| `POST /api/agent/generate-report` | After school report or parent digest |
| `GET /api/agent/health?notifyWhatsApp=1` | Explicit hub “Refresh + واتساب” only (silent overview refresh does **not** notify) |

Meta inbound audio: if `mediaId` is present and `fetchMetaMediaById` fails, a **failed** voice task is still saved and WhatsApp explains the failure (never silent drop). Outbound status is logged on the task.

Whish / payment phone stays **96170772968** — do not mix with the instructor allowlist.

## Routes

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/agent/whatsapp-voice` | Meta verify token **or** open health JSON | Webhook verification + staff health |
| POST | `/api/agent/whatsapp-voice` | Webhook: **phone allowlist**; Hub: staff / `AGENT_WEBHOOK_SECRET` / demo | Voice/media → Whisper → intent → execute → Arabic WhatsApp reply |
| POST | `/api/agent/marketing-video` | Staff / secret | 20–30s AR/EN scripts + HeyGen v2 (mock if no key) |
| POST | `/api/agent/marketing-video/webhook` | `AGENT_WEBHOOK_SECRET` or `HEYGEN_WEBHOOK_SECRET` (open if unset) | Render-complete → social **draft** payload (no public auto-post) |
| POST | `/api/agent/generate-report` | Staff / secret | School PDF-ready HTML **or** parent WhatsApp digest |
| GET | `/api/agent/health` | Staff / secret | Key presence + mock 502/503 latency + overview |
| UI | `/admin/agent-hub` | Staff layout | Dark mobile-first ops dashboard · live mic **تسجيل صوتي مباشر** · Recent voice shows last outbound WhatsApp status |

When secrets are empty (local / Netlify QA), write routes allow **demo** mode (same spirit as empty `JOBS_SECRET`).

## Intents

`generate_video` · `school_report` · `platform_health` · `broadcast_message` · `general_task`

Student-target style requests map to `general_task` with `parameters.task = "student_target"`.

Gemini structured JSON when `GEMINI_API_KEY` is set; otherwise Arabic/EN heuristics. Missing `OPENAI_API_KEY` → Whisper demo transcript.

## Netlify env (Agent WhatsApp)

Set in Site settings → Environment variables (or `netlify env:set`):

```bash
WHATSAPP_VERIFY_TOKEN=<long random value, same as in Meta>
INSTRUCTOR_WHATSAPP_NUMBER=96176532421
WHATSAPP_PROVIDER=meta   # meta | ultramsg | twilio
# Meta (optional):
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_TOKEN=              # alias for ACCESS_TOKEN
# Existing:
ULTRAMSG_INSTANCE_ID=
ULTRAMSG_TOKEN=
TEACHER_WHATSAPP=96170772968
WHISH_TRANSFER_PHONE=96170772968
AGENT_WEBHOOK_SECRET=
```

Do **not** overwrite `WHISH_TRANSFER_PHONE` / Whish defaults with `76532421`.

## Persistence

JSON store `agent-ops.json` via `src/lib/dataDir.ts` (local `data/` or Netlify Blobs / `/tmp`). Outbound also appends to `whatsapp-outbox.json` when provider tokens are missing.

## Modules

- `src/lib/agent/types.ts` — schemas (+ `outboundWhatsApp` on voice tasks)
- `store.ts` — persistence
- `auth.ts` — staff / webhook secret
- `intent.ts` — Gemini + heuristics
- `scripts.ts` — Barème / exam-anxiety hooks (Brevet, Terminale GS/LS)
- `reports.ts` — school + parent digests (Whish refs reused)
- `marketing.ts` — HeyGen dispatch + social drafts
- `voicePipeline.ts` — end-to-end voice
- `whatsappSender.ts` — Arabic outbound formatting → `whatsapp/adapter`
- `health.ts` — platform snapshot
- `approvalWorkflow.ts` — draft/approve/deploy
- `schoolPersuasionEngine.ts` — B2B Lebanon/GCC/Intl
- `selfEvolution.ts` — weekly telemetry + brief

Reuses: `voiceMath/whisper`, `studio/heygen*`, `whish/client`, `b2b/*`, `whatsapp/*`, `pedagogy/lebanese`.

## Teacher QA (staff account from `ADMIN_EMAILS`)

1. Sign in → open `/admin/agent-hub`.
2. **Voice**: click **تسجيل صوتي مباشر** (MediaRecorder → multipart `/api/agent/whatsapp-voice`), أو رفع صوت / تشغيل التجريبي → Arabic confirmation + intent; Recent voice shows outbound WhatsApp status.
3. **Campaign**: pick Terminale GS → Script + HeyGen → see mock video id when key missing; social stays draft.
4. **School**: pick a partner school → تقرير → PDF HTML / text + Whish **96170772968**.
5. **Parent**: ملخّص أهل واتساب → empathetic Arabic digest.
6. **Health**: refresh → keys + synthetic 502/503 rows.
7. **Live WhatsApp**: send a voice note from **76532421** to the connected WhatsApp channel; unauthorized numbers get the Arabic refusal only.

### curl (demo, no secret)

```bash
curl -s "$ORIGIN/api/agent/whatsapp-voice"

curl -s -X POST "$ORIGIN/api/agent/whatsapp-voice" \
  -H 'content-type: application/json' \
  -d '{"demo":true,"transcript":"أنشئ فيديو لترمينال علوم عامة عن الباريم"}'

curl -s -X POST "$ORIGIN/api/agent/marketing-video" \
  -H 'content-type: application/json' \
  -d '{"audience":"terminale_gs","language":"ar"}'

curl -s -X POST "$ORIGIN/api/agent/generate-report" \
  -H 'content-type: application/json' \
  -d '{"kind":"school","schoolName":"ثانوية الشريك"}'
```

## GitHub commits (code evolution)

Set these on Netlify (Site settings → Environment variables) so approved `code_evolution` drafts can commit:

- `GITHUB_TOKEN` — fine-grained or classic PAT with `contents:write` on the repo
- `GITHUB_OWNER` — GitHub org/user (required)
- `GITHUB_REPO` — defaults to `mathmentor-platform` if empty
- `GITHUB_BRANCH` — defaults to `main`

Voice/text matching code-evolution phrases **only stages** an approval draft. Commit + Netlify rebuild run **only after** instructor replies موافق / اعتمد / انشر (or Hub approve). Never auto-commit.

School outreach (`school_outreach_request`) likewise stages a pitch; WhatsApp to the school is sent only after approval.
