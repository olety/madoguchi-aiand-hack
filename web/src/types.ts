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
  alerts: string[];
  days_to_renewal: number | null;
};

export type EventRow = {
  id: number;
  company_id: string | null;
  ts: string;
  kind: "email" | "call" | "status_change" | "note";
  field: string | null;
  old_value: string | null;
  new_value: string | null;
  source_email_id: string | null;
  source_quote: string | null;
  summary_ja: string | null;
  transcript: string | null;
  confidence: number | null;
  needs_review: number;
};

export type EmailRow = {
  id: string;
  received_at: string;
  from_addr: string;
  subject: string;
  body: string;
};

export type CompanyDetail = Company & {
  events: EventRow[];
  phones: string[];
};

export type Attention = {
  renewal_soon: { count: number; companies: Company[] };
  unpaid: { count: number; companies: Company[] };
  invoice_missing: { count: number; companies: Company[] };
};

export type SampleEmail = {
  file: string;
  id: string;
  received_at: string;
  from_addr: string;
  subject: string;
  body: string;
};

export type IngestResult = {
  email_id: string;
  company_id: string | null;
  company_name: string;
  classification?: string;
  summary_ja?: string;
  applied?: { field: string; old: string; new: string }[];
  review?: { field: string; new: string; confidence: number }[];
  needs_human_review?: boolean;
  error?: string;
};

export type Phone = { phone: string; company_id: string; company_name: string };
