# Dashboard One-Shot Prompt (fire at hour 0, then FREEZE)

Feed this whole prompt to pi/Kimi at the event. After it renders and search works, freeze the
dashboard — all remaining time goes to ingestion + voice. Test-fire once Thursday to shake out
spec ambiguities.

---

Build a member-company status dashboard web app. Stack, structure, and behavior are specified
exactly — follow them.

## Stack

- **Bun + Hono** server (`server/index.ts`): serves the API and the built frontend.
- **SQLite via `bun:sqlite`** (`server/db.ts`), file `data/madoguchi.db`. On first boot, seed
  from `data/companies.json` and `data/calls.json` if the DB is empty.
- **React + Vite + Tailwind** frontend (`web/`). Language of the entire UI: **Japanese**.
- Single `bun run dev` script starts server (port 3000) + Vite dev (proxy `/api` → 3000).
- No auth, no routing library (one page + drawers), no state library (fetch + useState).

## Data model (SQLite tables)

- `companies`: id (text pk), company_name, kana, industry, membership_plan, contract_status,
  contract_start, renewal_date, payment_status, invoice_request_status, contact_person, notes
- `registered_phones`: phone (text pk), company_id
- `events` (the timeline + provenance store): id (auto), company_id, ts, kind
  (`email` | `call` | `status_change` | `note`), field, old_value, new_value, source_email_id,
  source_quote, summary_ja, transcript
- `emails` (raw source store): id (text pk), received_at, from_addr, subject, body

## API (Hono routes)

- `GET /api/companies?q=` — list; `q` matches company_name OR kana OR id, partial,
  case/width-insensitive. Return all fields + a computed `alerts` array per company (see below).
- `GET /api/companies/:id` — company + its events (newest first) + registered phones.
- `GET /api/attention` — three counts + company lists:
  - `renewal_soon`: contract_status=有効 AND renewal_date within 30 days of today
  - `unpaid`: payment_status IN (未払い, 督促中)
  - `invoice_missing`: invoice_request_status=未送付
- `POST /api/ingest` — body `{emails: [{id, received_at, from_addr, subject, body}]}`. For each:
  store raw email, call the LLM (see `prompts/extraction-prompt.md` — implement as
  `server/extract.ts` with `AI_BASE_URL`/`AI_API_KEY`/`AI_MODEL` env vars, OpenAI-compatible
  chat completions), apply high-confidence updates to `companies`, write one `events` row per
  update carrying `source_email_id` + `source_quote`, flag low-confidence rows
  `needs_human_review`. Return per-email results so the UI can animate rows updating.
- `POST /api/calls` — body `{company_id, transcript, summary_ja}` → events row (kind=call).
- `GET /api/export.csv` — companies as CSV, **UTF-8 with BOM** (Excel-JP opens it correctly),
  columns in this order: 企業名, 契約状況, 契約更新日, 支払い状況, 請求依頼状況, 会員プラン, 担当者.
- `GET/POST/DELETE /api/phones` — manage registered_phones (settings table).

## UI layout (one page, top to bottom)

1. **Header**: 「MADOGUCHI — 会員企業ステータス」 + big search box (placeholder
   「企業名・カナで検索…」) + CSVエクスポート button + 設定 (gear) button.
2. **Attention cards** (3 across): 「更新間近」「未払い」「請求依頼漏れ」 — big count,
   clickable → filters the table below. Amber/red accent when count > 0.
3. **Company table**: columns 企業名(+kana small) / 契約状況 / 更新日 / 支払い状況 /
   請求依頼状況 / プラン. Status values render as colored badges:
   - green: 有効, 支払い済み, 送付済み
   - amber: 更新手続き中, 入金待ち, 作成中, 新規申込中
   - red: 未払い, 督促中, 未送付, 解約予定
   - renewal_date within 30 days → date cell gets amber background + 「あと◯日」 chip.
   **Every status badge that has a source event is clickable** → opens the provenance drawer.
4. **Provenance drawer** (right side, slide-in): the status, its source email (subject, from,
   date, full body) with `source_quote` **highlighted yellow** via exact substring match,
   confidence, and a 「確認済みにする」 button (clears needs_human_review).
5. **Company detail drawer** (opens on row click): all fields + registered phones +
   **timeline** (events newest-first: emails ingested, calls with 📞 icon + summary + expandable
   transcript, status changes as「支払い状況: 入金待ち → 支払い済み」).
6. **Settings modal**: registered_phones table (phone ↔ company dropdown), add/delete rows.
   Title: 「登録電話番号（発信者ID照合用）」.
7. **Ingest panel** (collapsible, for the demo): textarea list of pending emails from
   `data/emails/`, an 「取り込み実行」 button, and per-email result rows that appear as
   processing completes. When an update lands, the affected table row flashes briefly.

## Design

Clean enterprise SaaS, light theme: white cards on `#f8fafc`, `rounded-2xl`, `shadow-sm`,
generous padding, Inter/system font stack + Japanese fallback (`"Inter", "Hiragino Sans",
"Noto Sans JP", sans-serif`). The search box is the hero — large, centered under the header.
No dark mode, no responsive breakpoints (demo runs on one laptop at 125% zoom).

## Acceptance checks (run before freezing)

1. `bun run dev` → dashboard renders with 16 seed companies.
2. Typing「ABC」finds ABCロボティクス; typing「さくら」/「サクラ」finds both サクラ精機 and
   サクラバイオ.
3. Attention cards show 3 / 3 / 2 with the seed data (before ingestion).
4. CSV opens in Excel/Numbers with Japanese intact.
5. Clicking a status badge with no source event does nothing (no crash); seeded statuses have
   no events yet — that's expected until ingestion runs.
