import { Database } from "bun:sqlite";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");
const DB_PATH = join(ROOT, "data", "madoguchi.db");

export const db = new Database(DB_PATH, { create: true });
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------
db.exec(`
CREATE TABLE IF NOT EXISTS companies (
  id                     TEXT PRIMARY KEY,
  company_name           TEXT NOT NULL,
  kana                   TEXT,
  industry               TEXT,
  membership_plan        TEXT,
  contract_status        TEXT,
  contract_start         TEXT,
  renewal_date           TEXT,
  payment_status         TEXT,
  invoice_request_status TEXT,
  contact_person         TEXT,
  notes                  TEXT
);

CREATE TABLE IF NOT EXISTS registered_phones (
  phone      TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id)
);

CREATE TABLE IF NOT EXISTS emails (
  id          TEXT PRIMARY KEY,
  received_at TEXT,
  from_addr   TEXT,
  subject     TEXT,
  body        TEXT
);

CREATE TABLE IF NOT EXISTS events (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id      TEXT REFERENCES companies(id),
  ts              TEXT NOT NULL,
  kind            TEXT NOT NULL,          -- email | call | status_change | note
  field           TEXT,                   -- payment_status | invoice_request_status | ...
  old_value       TEXT,
  new_value       TEXT,
  source_email_id TEXT,
  source_quote    TEXT,
  summary_ja      TEXT,
  transcript      TEXT,
  confidence      REAL,
  needs_review    INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_events_company ON events(company_id);
CREATE INDEX IF NOT EXISTS idx_events_field ON events(company_id, field);
`);

// ---------------------------------------------------------------------------
// Seed (only when empty)
// ---------------------------------------------------------------------------
type SeedCompany = {
  id: string;
  company_name: string;
  kana: string;
  industry: string;
  membership_plan: string;
  contract_status: string;
  contract_start: string;
  renewal_date: string;
  payment_status: string;
  invoice_request_status: string;
  registered_phones?: string[];
  contact_person: string;
  notes: string;
};

type SeedCall = {
  company_id: string;
  ts: string;
  direction?: string;
  caller_phone?: string;
  summary_ja: string;
  transcript: string;
};

export function seedIfEmpty() {
  const count = (
    db.query("SELECT COUNT(*) AS n FROM companies").get() as { n: number }
  ).n;
  if (count > 0) return;

  const companies: SeedCompany[] = JSON.parse(
    readFileSync(join(ROOT, "data", "companies.json"), "utf-8"),
  );
  const calls: SeedCall[] = JSON.parse(
    readFileSync(join(ROOT, "data", "calls.json"), "utf-8"),
  );

  const insCompany = db.prepare(`
    INSERT INTO companies
      (id, company_name, kana, industry, membership_plan, contract_status,
       contract_start, renewal_date, payment_status, invoice_request_status,
       contact_person, notes)
    VALUES
      ($id, $company_name, $kana, $industry, $membership_plan, $contract_status,
       $contract_start, $renewal_date, $payment_status, $invoice_request_status,
       $contact_person, $notes)
  `);
  const insPhone = db.prepare(
    "INSERT OR IGNORE INTO registered_phones (phone, company_id) VALUES ($phone, $company_id)",
  );
  const insCall = db.prepare(`
    INSERT INTO events (company_id, ts, kind, summary_ja, transcript, needs_review)
    VALUES ($company_id, $ts, 'call', $summary_ja, $transcript, 0)
  `);

  const seed = db.transaction(() => {
    for (const c of companies) {
      insCompany.run({
        $id: c.id,
        $company_name: c.company_name,
        $kana: c.kana,
        $industry: c.industry,
        $membership_plan: c.membership_plan,
        $contract_status: c.contract_status,
        $contract_start: c.contract_start,
        $renewal_date: c.renewal_date,
        $payment_status: c.payment_status,
        $invoice_request_status: c.invoice_request_status,
        $contact_person: c.contact_person,
        $notes: c.notes ?? "",
      });
      for (const phone of c.registered_phones ?? []) {
        insPhone.run({ $phone: phone, $company_id: c.id });
      }
    }
    for (const call of calls) {
      insCall.run({
        $company_id: call.company_id,
        $ts: call.ts,
        $summary_ja: call.summary_ja,
        $transcript: call.transcript,
      });
    }
  });
  seed();
  console.log(
    `[db] seeded ${companies.length} companies, ${calls.length} calls`,
  );
}

// ---------------------------------------------------------------------------
// Types + helpers shared with the API layer
// ---------------------------------------------------------------------------
export type Company = {
  id: string;
  company_name: string;
  kana: string;
  industry: string;
  membership_plan: string;
  contract_status: string;
  contract_start: string;
  renewal_date: string;
  payment_status: string;
  invoice_request_status: string;
  contact_person: string;
  notes: string;
};

/** Fields the extractor is allowed to write onto a company row. */
export const EXTRACTABLE_FIELDS = [
  "payment_status",
  "invoice_request_status",
  "contract_status",
  "renewal_date",
] as const;
export type ExtractableField = (typeof EXTRACTABLE_FIELDS)[number];
