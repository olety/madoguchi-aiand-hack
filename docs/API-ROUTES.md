# MADOGUCHI API Route Table

Agreed 2026-07-17. Dashboard + ingestion owned by dashboard teammate; voice owns only `POST /api/calls`.

## Endpoints

| Method | Route | Owner | Request | Response | Notes |
|--------|-------|-------|---------|----------|-------|
| `GET` | `/api/companies` | dashboard | `?q=` optional | `[{ ...company, alerts: string[] }]` | Search matches `company_name`, `kana`, `id` partial, width-insensitive. |
| `GET` | `/api/companies/:id` | dashboard | — | `{ company, events[], phones[] }` | Events newest-first. |
| `GET` | `/api/attention` | dashboard | — | `{ renewal_soon: { count, companies[] }, unpaid: { count, companies[] }, invoice_missing: { count, companies[] } }` | Seed target: `3 / 3 / 2`. |
| `POST` | `/api/ingest` | dashboard | `{ emails: [{ id, received_at, from_addr, subject, body }] }` | `{ results: [{ email_id, ok, updates, needs_human_review, error? }] }` | Stores raw email → LLM extract → writes events + applies updates. |
| `GET` | `/api/export.csv` | dashboard | — | CSV download | UTF-8 with BOM; columns: 企業名, 契約状況, 契約更新日, 支払い状況, 請求依頼状況, 会員プラン, 担当者. |
| `GET` | `/api/phones` | dashboard | — | `[{ phone, company_id, company_name }]` | For settings modal. |
| `POST` | `/api/phones` | dashboard | `{ phone, company_id }` | `{ phone, company_id }` | Register a phone. |
| `DELETE` | `/api/phones/:phone` | dashboard | — | `{ deleted: true }` | Remove a phone. |
| `GET` | `/api/phones/:phone` | dashboard | — | `{ company_id }` or 404 | Voice agent lookup helper. |
| `POST` | `/api/calls` | voice | `{ company_id, summary_ja, transcript, ts? }` | `{ event_id }` | Voice agent's only seam. Creates `events` row `kind=call`. `ts` defaults to server `now()`. |

## Voice Stack Note

Voice agent uses Cartesia Ink 2 (STT) and Sonic 3.5 (TTS). This does not affect the routes above.
