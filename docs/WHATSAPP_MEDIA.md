# WhatsApp media — محمد sends & receives files

Brand: **الأستاذ منذر حداره / Prof. Munzer Haddara** only. Instructor allowlist unchanged
(`INSTRUCTOR_WHATSAPP_NUMBER`, default `96176532421` / `76532421`). Whish payment stays `96170772968`.

## Receive (webhook `POST /api/agent/whatsapp-voice`)

| Inbound type | What happens |
|---|---|
| `audio` / voice | Existing voice pipeline (unchanged). |
| `image` | Download → store → **solve** with the Gemini vision solver → محمد verifier (`src/lib/solver/verify.ts`) → Arabic reply. Caption = instruction. |
| `document` PDF / txt | Caption decides: *solve* (حل/solve), *summarize* (لخص/summary — default without caption), *verify exam* (صحح/دقق/راجع/verify), *store* (احفظ/save). |
| `document` Word/Excel/PPT | Stored; reply asks for PDF/image to read it. |
| `video` | Stored + confirmation. |
| `sticker` | Ignored (200, no reply). |

* Add **pdf** / **بي دي اف** to a solve caption to also receive the solution as a PDF document.
* Text **«امتحان تجريبي» / "mock exam"** (+ optional brevet / LS / GS / SE / SAT) → mock exam PDF.
* Meta media: `GET /{media-id}` → `url` → download with the bearer token. Limits: **20MB** inbound,
  MIME allowlist in `src/lib/whatsapp/media/policy.ts`. Lebanese-Arabic error replies for too big /
  unsupported / download failed / AI busy (`errorsAr.ts`).
* Webhooks are ACKed immediately; work runs in `after()` with a short "⏳ …" ack. Meta retries are
  deduped by message id (in-memory).
* Only allow-listed instructor senders are processed (non-instructors get the existing refusal).

## Storage

Binary files: `data/whatsapp-media/` (`/tmp/mathmentor-data/…` on serverless). Metadata:
`whatsapp-media.json` via the shared JSON store. Agent Hub (`/admin/agent-hub`) shows a
**ملفات واتساب** table with staff-only download links.
Solved images/PDFs are also logged in the admin AI query log (`math-queries.json`) with the audit verdict.

> Free Render disk is ephemeral — stored files disappear on redeploy (metadata may remain).

## Send

`sendWhatsAppMedia(to, { type, bytes | link | mediaId, mimeType, caption, filename })`
(`src/lib/whatsapp/media/send.ts`): Meta `POST /{phone-number-id}/media` (multipart) → `POST /messages`.
UltraMsg / Twilio support public `link` only. Recipients: instructor allowlist or a number that sent
an inbound message within 24h; single recipient, rate-limited (40/h per number).

### Staff API

Auth: staff session or `AGENT_WEBHOOK_SECRET` (`x-agent-webhook-secret` / `Authorization: Bearer`).

```bash
# upload a file (multipart, ≲10MB because of the middleware body buffer)
curl -X POST "$BASE/api/agent/whatsapp-media/send" -H "x-agent-webhook-secret: $SECRET" \
  -F to=96176532421 -F caption="الحل" -F "file=@solution.pdf;type=application/pdf"
# public link / stored file / generated mock exam
curl -X POST "$BASE/api/agent/whatsapp-media/send" -H "x-agent-webhook-secret: $SECRET" \
  -H 'content-type: application/json' -d '{"to":"96176532421","type":"document","link":"https://…/a.pdf","filename":"a.pdf"}'
curl … -d '{"to":"96176532421","storedFileId":"wamedia-…"}'
curl … -d '{"to":"96176532421","generate":"mock_exam","track":"terminale-ls"}'
# list / download
curl -H "x-agent-webhook-secret: $SECRET" "$BASE/api/agent/whatsapp-media/files?limit=20"
curl -H "x-agent-webhook-secret: $SECRET" "$BASE/api/agent/whatsapp-media/files/<id>" -o file
```

## Env

`WHATSAPP_ACCESS_TOKEN` (or `WHATSAPP_TOKEN`), `WHATSAPP_PHONE_NUMBER_ID`, `GEMINI_API_KEY`,
`AGENT_WEBHOOK_SECRET`. Optional: `WHATSAPP_GRAPH_VERSION` (default `v21.0`),
`WHATSAPP_GRAPH_BASE_URL` (https proxy or localhost mock for tests).

## Tests

`npm test` — `node --test` unit tests for the dependency-free modules (policy, Arabic errors, caption
intent, Meta payloads, LaTeX → readable text). Needs Node ≥ 22.18 (native type stripping).
